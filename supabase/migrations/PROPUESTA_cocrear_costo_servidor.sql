-- ============================================================================
--  PROPUESTA · COCREAR 10 · D-02 / D-03 · el servidor es dueño del dinero de Cocrear.
--  ⚠️ NO APLICAR sin autorización de Dirección (prefijo PROPUESTA_: no entra en `db push`).
--
--  Defectos (docs/auditoria/COCREAR_VONI_10.md, COCREAR_10.md):
--   D-02 `registrar_producto_desde_expediente` adoptaba como costo oficial el `costSnapshot` que
--        escribe el NAVEGADOR en el payload (incluso sin BOM).
--   D-03 "Validar ingeniería" de Cocrear no llegaba al servidor: la versión quedaba `preliminar`.
--
--  Cambio:
--   1. Tabla `public.cocrear_costeo_servidor`: una fila por costeo de una co-creación GUARDADA,
--      escrita SÓLO por la Edge `costear-servidor` (service role, modo cocrear) con el MISMO motor
--      (calcular, Alba V1 × dificultad), ligada al `analysis_hash` de la revisión. RLS sin políticas
--      (deny-all para anon/authenticated): nadie la escribe desde el navegador.
--   2. `registrar_producto_desde_expediente`: para un expediente con `cocrear`, el importe y el
--      estado técnico salen de esa fila (la validada, si existe; si no, la última) de ESA revisión.
--      Sin fila → `costo_servidor_pendiente`. Incompleta → `expediente_incompleto_no_publicable`.
--      Validada por Diseño/Dirección en el servidor → `aprobado` (o `certificado` si el costo lo es).
--      Expedientes que NO son co-creación (biblioteca de Costear): sin cambios.
--   3. `cocrear_seguro` devuelve `validacion_servidor` (la misma fila; sin costo/margen para quien
--      no ve economía, vía jsonb_sin_economia).
--  Una revisión nueva (guardar_cocrear_seguro cambia el analysis_hash) deja SIN verdad de servidor a
--  la anterior: hay que volver a costear/validar. Nada se hereda en silencio.
--
--  Despliegue (orden): 1) esta migración; 2) Edge `costear-servidor-rc` (y, al promover, copiar a
--  `costear-servidor`). Con la Edge vieja el modo cocrear responde 400 y la UI lo dice (fail-closed).
--  Probado contra PostgreSQL real (PGlite) en supabase/tests/cocrearCostoServidor.test.js.
-- ============================================================================

begin;

create table if not exists public.cocrear_costeo_servidor (
  id bigint generated always as identity primary key,
  creado timestamptz not null default now(),
  expediente_id bigint not null references public.expedientes(id) on delete cascade,
  expediente_rev integer not null default 1,
  analysis_hash text,
  spec_hash text not null,
  visual_hash text not null,
  bom_hash text not null,
  estado text not null check (estado in ('certificado','preliminar','incompleto','bloqueado')),
  costo_unitario numeric(14,2) check (costo_unitario is null or costo_unitario > 0),
  precio_sugerido numeric(14,2) check (precio_sugerido is null or precio_sugerido > 0),
  margen_politica numeric check (margen_politica is null or (margen_politica >= 0 and margen_politica < 100)),
  dificultad text,
  formula_version text,
  version_motor text,
  version_catalogo text,
  fuente_costo text,
  calculado_por text not null,
  rol text not null,
  ingenieria_validada boolean not null default false,
  validada_por text,
  validada_en timestamptz,
  warnings jsonb not null default '[]'::jsonb,
  evidencia jsonb not null default '{}'::jsonb,
  -- Una validación de ingeniería sólo existe firmada por Diseño/Dirección y con costo emitible.
  constraint cocrear_costeo_validacion_coherente check (
    not ingenieria_validada
    or (validada_por is not null and validada_en is not null and rol in ('direccion','diseno')
        and estado in ('certificado','preliminar') and costo_unitario is not null)),
  -- Un costeo incompleto nunca lleva importe (ni $0): el precio queda "Por confirmar".
  constraint cocrear_costeo_incompleto_sin_importe check (
    estado in ('certificado','preliminar') or (costo_unitario is null and precio_sugerido is null))
);
create index if not exists cocrear_costeo_servidor_revision_idx
  on public.cocrear_costeo_servidor (expediente_id, analysis_hash, ingenieria_validada, id desc);

alter table public.cocrear_costeo_servidor enable row level security;
-- Sin políticas: deny-all para el front. La Edge escribe con service role y las RPC SECURITY DEFINER leen.
revoke all on public.cocrear_costeo_servidor from public, anon, authenticated;
grant select, insert on public.cocrear_costeo_servidor to service_role;

-- ----------------------------------------------------------------------------
-- private_api.registrar_producto_desde_expediente (cuerpo de producción + rama co-creación)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.registrar_producto_desde_expediente(p_expediente_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e public.expedientes%rowtype;
  v_email text := auth.jwt()->>'email';
  v_role text;
  v_elevated boolean := false;
  v_prod_id bigint;
  v_ver_id bigint;
  v_estado_tec text;
  v_ec text;
  v_existing_version bigint;
  v_cost numeric;
  v_attrs jsonb;
  v_staled int := 0;
  -- COCREAR 10 (D-02/D-03): verdad de servidor de la revisión guardada.
  v_srv public.cocrear_costeo_servidor%rowtype;
  v_es_cocrear boolean := false;
  v_validado_srv boolean := false;
begin
  if v_email is null or not public.puede_entrar() then raise exception 'no autorizado'; end if;
  select lower(p.rol) into v_role from public.permitidos p where lower(p.email)=lower(v_email) limit 1;
  if v_role not in ('direccion','diseno','vendedor') then raise exception 'rol sin permiso'; end if;
  v_elevated := v_role in ('direccion','diseno');

  select * into e from public.expedientes where id=p_expediente_id for update;
  if not found then return jsonb_build_object('ok',false,'motivo','expediente_inexistente'); end if;
  if not (v_elevated or lower(coalesce(e.creado_por,''))=lower(v_email)) then
    return jsonb_build_object('ok',false,'motivo','sin_acceso');
  end if;

  v_es_cocrear := e.cocrear is not null;

  if v_es_cocrear then
    -- COCREAR 10 · D-02: el importe de una co-creación NUNCA sale del payload del navegador
    -- (`cocrear.costSnapshot`). Sale de la fila que escribió costear-servidor (service role) para
    -- ESTA revisión (mismo analysis_hash). Si hay una validada, manda ésa.
    select c.* into v_srv
      from public.cocrear_costeo_servidor c
     where c.expediente_id = e.id and c.analysis_hash is not distinct from e.analysis_hash
     order by c.ingenieria_validada desc, c.id desc
     limit 1;
    if not found then
      return jsonb_build_object('ok',false,'motivo','costo_servidor_pendiente',
        'detalle','Costea en el servidor la revisión guardada (costear-servidor, modo cocrear) antes de registrarla.');
    end if;
    v_ec := v_srv.estado;
    if v_srv.estado in ('incompleto','bloqueado') or v_srv.costo_unitario is null then
      return jsonb_build_object('ok',false,'motivo','expediente_incompleto_no_publicable','estado_costo',v_ec);
    end if;
    v_validado_srv := v_srv.ingenieria_validada;
  else
  v_ec := coalesce(e.costo->>'estado_costo', e.cocrear#>>'{costSnapshot,status}', e.cocrear#>>'{costo,status}');
  if v_ec is null or lower(v_ec) in ('incompleto','unknown','pending','pending_price','pending_material','economics_incomplete') then
    return jsonb_build_object('ok',false,'motivo','expediente_incompleto_no_publicable','estado_costo',v_ec);
  end if;
  end if;

  -- Fuente canónica del importe económico del expediente.
  -- Soporta el contrato nuevo CostSnapshot y los campos legacy mientras sigan existiendo.
  if v_es_cocrear then
    v_cost := v_srv.costo_unitario;
  else
  begin
    v_cost := nullif(coalesce(
      e.costo->>'costoTotal',
      e.costo->>'costo_total',
      e.cocrear#>>'{costSnapshot,official_cost}',
      e.cocrear#>>'{costSnapshot,known_cost}',
      e.cocrear#>>'{costSnapshot,total}',
      e.cocrear#>>'{costo,total}'
    ),'')::numeric;
  exception when others then
    v_cost := null;
  end;
  end if;

  -- Fail closed: un estado KNOWN/ESTIMATED no puede registrarse sin un importe positivo.
  if v_cost is null or v_cost <= 0 then
    return jsonb_build_object(
      'ok',false,
      'motivo','costo_estado_con_valor_invalido',
      'estado_costo',v_ec
    );
  end if;

  -- Vendedor puede crear una revisión técnica PRELIMINAR de su propia cocreación,
  -- pero nunca certificarla ni activarla. Diseño/Dirección conservan la autoridad técnica.
  -- COCREAR 10 · D-03: en una co-creación, el estado técnico lo da la validación de ingeniería que
  -- registró el SERVIDOR (Diseño/Dirección, con costo emitible y sin bloqueo estructural), no el JSON
  -- del cliente ni `expedientes.estado`. Así cuenta aunque quien registra sea un vendedor: la autoridad
  -- quedó firmada en la fila del servidor.
  v_estado_tec := case
    when v_es_cocrear and v_validado_srv and v_srv.estado='certificado' then 'certificado'
    when v_es_cocrear and v_validado_srv then 'aprobado'
    when v_es_cocrear then 'preliminar'
    when not v_elevated then 'preliminar'
    when e.estado='aprobado' and lower(v_ec) in ('certificado','known') then 'certificado'
    when e.estado='aprobado' then 'aprobado'
    else 'preliminar'
  end;

  v_prod_id := e.producto_id;
  if v_prod_id is null then
    select p.id into v_prod_id from public.productos p
    where p.source_type='expediente' and p.source_ref=e.id::text
    order by p.id asc limit 1;
  end if;

  if v_prod_id is not null and not exists(
    select 1 from public.productos p
    where p.id=v_prod_id and p.source_type='expediente' and p.source_ref=e.id::text
  ) then
    raise exception 'producto enlazado no pertenece a este expediente';
  end if;

  if v_prod_id is null then
    insert into public.productos(codigo,nombre,familia,descripcion_comercial,source_type,source_ref,estado,activo,creado_por)
      values (null,e.nombre,e.producto_tipo,e.descripcion,'expediente',e.id::text,'borrador',false,v_email)
      returning id into v_prod_id;
  else
    update public.productos
       set nombre=e.nombre,
           familia=coalesce(e.producto_tipo,familia),
           descripcion_comercial=coalesce(e.descripcion,descripcion_comercial),
           actualizado=now()
     where id=v_prod_id;
  end if;

  select pv.id into v_existing_version
    from public.producto_versiones pv
   where pv.producto_id=v_prod_id
     and pv.expediente_id=e.id
     and pv.etiqueta=('rev '||coalesce(e.revision,1))
   order by pv.id desc limit 1;

  if v_existing_version is not null then
    v_ver_id := v_existing_version;
    -- Un vendedor no puede elevar una revisión existente; solo Diseño/Dirección pueden hacerlo.
    if v_elevated or v_validado_srv then
      update public.producto_versiones set estado_tecnico=v_estado_tec where id=v_ver_id;
    end if;
  else
    v_attrs := jsonb_build_object(
      'materiales',to_jsonb(e.materiales),
      'cocrear',coalesce(e.cocrear,'{}'::jsonb),
      'expediente_revision',coalesce(e.revision,1),
      'registered_by_role',v_role,
      'costo_servidor_id',v_srv.id,
      'ingenieria_validada_por',v_srv.validada_por
    );
    insert into public.producto_versiones(producto_id,etiqueta,dimensiones,atributos,expediente_id,bom_hash,estado_tecnico,formula_version)
      values (
        v_prod_id,'rev '||coalesce(e.revision,1),
        jsonb_build_object('ancho_mm',e.ancho_mm,'fondo_mm',e.fondo_mm,'alto_mm',e.alto_mm),
        v_attrs,e.id,coalesce(v_srv.bom_hash,e.costo->>'bom_hash',e.analysis_hash),v_estado_tec,coalesce(v_srv.formula_version,e.costo->>'formula_version')
      ) returning id into v_ver_id;

    update public.renders
       set stale=true,
           estado=case when estado='GENERATED' or estado='VALIDATED' then 'STALE' else estado end
     where producto_id=v_prod_id
       and producto_version_id is distinct from v_ver_id
       and stale=false;
    get diagnostics v_staled = row_count;
  end if;

  -- Mantener economía alineada incluso en re-registros idempotentes.
  insert into public.producto_version_economia(producto_version_id,costo_oficial_referencia,formula_version,fuente)
    values (v_ver_id,v_cost,coalesce(v_srv.formula_version,e.costo->>'formula_version'),
            case when v_es_cocrear then 'costear-servidor #'||v_srv.id||' · expediente '||e.id||' rev '||coalesce(e.revision,1)
                 else 'expediente '||e.id||' rev '||coalesce(e.revision,1) end)
  on conflict (producto_version_id) do update
    set costo_oficial_referencia=excluded.costo_oficial_referencia,
        formula_version=excluded.formula_version,
        fuente=excluded.fuente,
        actualizado=now();

  update public.productos set version_tecnica_vigente_id=v_ver_id where id=v_prod_id;
  update public.expedientes
     set producto_id=v_prod_id,producto_version_id=v_ver_id,actualizado=now(),actualizado_por=v_email
   where id=e.id;
  update public.expediente_revisiones
     set producto_id=v_prod_id,producto_version_id=v_ver_id
   where expediente_id=e.id and rev=coalesce(e.revision,1);

  return jsonb_build_object(
    'ok',true,
    'producto_id',v_prod_id,
    'version_id',v_ver_id,
    'expediente_id',e.id,
    'expediente_revision',coalesce(e.revision,1),
    'estado_tecnico',v_estado_tec,
    'activo',false,
    'idempotente',v_existing_version is not null,
    'renders_stale',v_staled,
    'registered_by_role',v_role,
    'requires_engineering_validation',case when v_es_cocrear then not v_validado_srv else not v_elevated end,
    'costo_fuente',case when v_es_cocrear then 'costear-servidor' else 'expediente' end,
    'ingenieria_validada_servidor',v_validado_srv,
    'nota',case when v_es_cocrear and v_validado_srv then 'Ingeniería validada en el servidor; costo de costear-servidor.' when v_es_cocrear then 'Revisión preliminar: costo de costear-servidor; falta la validación de ingeniería en el servidor.' when not v_elevated then 'Revisión preliminar utilizable en proyecto; requiere validación técnica antes de certificarse/activarse.' else 'ProductRevision canónica enlazada al expediente; Dirección controla activación y precio.' end
  );
end;
$function$;

-- ----------------------------------------------------------------------------
-- private_api.cocrear_seguro (cuerpo de producción + validacion_servidor)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.cocrear_seguro(p_expediente_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := auth.jwt()->>'email';
  e public.expedientes%rowtype;
  v_payload jsonb;
  v_history jsonb;
  v_srv jsonb;
begin
  if v_email is null or not public.puede_entrar() then raise exception 'no autorizado'; end if;
  select * into e from public.expedientes where id=p_expediente_id;
  if not found then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  if not (public.puede_editar_config() or lower(coalesce(e.creado_por,''))=lower(v_email)) then
    return jsonb_build_object('ok',false,'motivo','sin_acceso');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'rev',r.rev,'creado',r.creado,'creado_por',r.creado_por,'nombre',r.nombre,
      'analysis_hash',r.analysis_hash,'cocrear',r.cocrear,
      'producto_id',r.producto_id,'producto_version_id',r.producto_version_id
    ) order by r.rev),'[]'::jsonb)
    into v_history
    from public.expediente_revisiones r where r.expediente_id=e.id;

  -- COCREAR 10: la verdad de SERVIDOR de la revisión vigente (costo/validación de costear-servidor).
  -- Para quien no ve economía, jsonb_sin_economia quita costo_unitario y margen_politica.
  select to_jsonb(c) - 'warnings' into v_srv
    from public.cocrear_costeo_servidor c
   where c.expediente_id = e.id and c.analysis_hash is not distinct from e.analysis_hash
   order by c.ingenieria_validada desc, c.id desc
   limit 1;

  v_payload := jsonb_build_object(
    'ok',true,'id',e.id,'nombre',e.nombre,'revision',e.revision,'estado',e.estado,
    'producto_id',e.producto_id,'producto_version_id',e.producto_version_id,
    'analysis_hash',e.analysis_hash,'cocrear',e.cocrear,'historia',v_history,
    'render_aislado_url',e.render_aislado_url,'render_ambiente_url',e.render_ambiente_url,
    'costo',e.costo,'bom',e.bom,
    'validacion_servidor',v_srv
  );

  if public.puede_ver_economia() then return v_payload; end if;
  return public.jsonb_sin_economia(v_payload);
end;
$function$;

commit;

-- ============================================================================
--  ROLLBACK (no se ejecuta con este archivo: está dentro de un comentario de bloque).
--  Restaura los cuerpos de producción de supabase/schema/baseline/08_private_api.sql
--  (registrar_producto_desde_expediente y cocrear_seguro) y borra la tabla.
/*
-- >>> ROLLBACK COCREAR10 INICIO
begin;
CREATE OR REPLACE FUNCTION private_api.registrar_producto_desde_expediente(p_expediente_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e public.expedientes%rowtype;
  v_email text := auth.jwt()->>'email';
  v_role text;
  v_elevated boolean := false;
  v_prod_id bigint;
  v_ver_id bigint;
  v_estado_tec text;
  v_ec text;
  v_existing_version bigint;
  v_cost numeric;
  v_attrs jsonb;
  v_staled int := 0;
begin
  if v_email is null or not public.puede_entrar() then raise exception 'no autorizado'; end if;
  select lower(p.rol) into v_role from public.permitidos p where lower(p.email)=lower(v_email) limit 1;
  if v_role not in ('direccion','diseno','vendedor') then raise exception 'rol sin permiso'; end if;
  v_elevated := v_role in ('direccion','diseno');

  select * into e from public.expedientes where id=p_expediente_id for update;
  if not found then return jsonb_build_object('ok',false,'motivo','expediente_inexistente'); end if;
  if not (v_elevated or lower(coalesce(e.creado_por,''))=lower(v_email)) then
    return jsonb_build_object('ok',false,'motivo','sin_acceso');
  end if;

  v_ec := coalesce(e.costo->>'estado_costo', e.cocrear#>>'{costSnapshot,status}', e.cocrear#>>'{costo,status}');
  if v_ec is null or lower(v_ec) in ('incompleto','unknown','pending','pending_price','pending_material','economics_incomplete') then
    return jsonb_build_object('ok',false,'motivo','expediente_incompleto_no_publicable','estado_costo',v_ec);
  end if;

  -- Fuente canónica del importe económico del expediente.
  -- Soporta el contrato nuevo CostSnapshot y los campos legacy mientras sigan existiendo.
  begin
    v_cost := nullif(coalesce(
      e.costo->>'costoTotal',
      e.costo->>'costo_total',
      e.cocrear#>>'{costSnapshot,official_cost}',
      e.cocrear#>>'{costSnapshot,known_cost}',
      e.cocrear#>>'{costSnapshot,total}',
      e.cocrear#>>'{costo,total}'
    ),'')::numeric;
  exception when others then
    v_cost := null;
  end;

  -- Fail closed: un estado KNOWN/ESTIMATED no puede registrarse sin un importe positivo.
  if v_cost is null or v_cost <= 0 then
    return jsonb_build_object(
      'ok',false,
      'motivo','costo_estado_con_valor_invalido',
      'estado_costo',v_ec
    );
  end if;

  -- Vendedor puede crear una revisión técnica PRELIMINAR de su propia cocreación,
  -- pero nunca certificarla ni activarla. Diseño/Dirección conservan la autoridad técnica.
  v_estado_tec := case
    when not v_elevated then 'preliminar'
    when e.estado='aprobado' and lower(v_ec) in ('certificado','known') then 'certificado'
    when e.estado='aprobado' then 'aprobado'
    else 'preliminar'
  end;

  v_prod_id := e.producto_id;
  if v_prod_id is null then
    select p.id into v_prod_id from public.productos p
    where p.source_type='expediente' and p.source_ref=e.id::text
    order by p.id asc limit 1;
  end if;

  if v_prod_id is not null and not exists(
    select 1 from public.productos p
    where p.id=v_prod_id and p.source_type='expediente' and p.source_ref=e.id::text
  ) then
    raise exception 'producto enlazado no pertenece a este expediente';
  end if;

  if v_prod_id is null then
    insert into public.productos(codigo,nombre,familia,descripcion_comercial,source_type,source_ref,estado,activo,creado_por)
      values (null,e.nombre,e.producto_tipo,e.descripcion,'expediente',e.id::text,'borrador',false,v_email)
      returning id into v_prod_id;
  else
    update public.productos
       set nombre=e.nombre,
           familia=coalesce(e.producto_tipo,familia),
           descripcion_comercial=coalesce(e.descripcion,descripcion_comercial),
           actualizado=now()
     where id=v_prod_id;
  end if;

  select pv.id into v_existing_version
    from public.producto_versiones pv
   where pv.producto_id=v_prod_id
     and pv.expediente_id=e.id
     and pv.etiqueta=('rev '||coalesce(e.revision,1))
   order by pv.id desc limit 1;

  if v_existing_version is not null then
    v_ver_id := v_existing_version;
    -- Un vendedor no puede elevar una revisión existente; solo Diseño/Dirección pueden hacerlo.
    if v_elevated then
      update public.producto_versiones set estado_tecnico=v_estado_tec where id=v_ver_id;
    end if;
  else
    v_attrs := jsonb_build_object(
      'materiales',to_jsonb(e.materiales),
      'cocrear',coalesce(e.cocrear,'{}'::jsonb),
      'expediente_revision',coalesce(e.revision,1),
      'registered_by_role',v_role
    );
    insert into public.producto_versiones(producto_id,etiqueta,dimensiones,atributos,expediente_id,bom_hash,estado_tecnico,formula_version)
      values (
        v_prod_id,'rev '||coalesce(e.revision,1),
        jsonb_build_object('ancho_mm',e.ancho_mm,'fondo_mm',e.fondo_mm,'alto_mm',e.alto_mm),
        v_attrs,e.id,coalesce(e.costo->>'bom_hash',e.analysis_hash),v_estado_tec,e.costo->>'formula_version'
      ) returning id into v_ver_id;

    update public.renders
       set stale=true,
           estado=case when estado='GENERATED' or estado='VALIDATED' then 'STALE' else estado end
     where producto_id=v_prod_id
       and producto_version_id is distinct from v_ver_id
       and stale=false;
    get diagnostics v_staled = row_count;
  end if;

  -- Mantener economía alineada incluso en re-registros idempotentes.
  insert into public.producto_version_economia(producto_version_id,costo_oficial_referencia,formula_version,fuente)
    values (v_ver_id,v_cost,e.costo->>'formula_version','expediente '||e.id||' rev '||coalesce(e.revision,1))
  on conflict (producto_version_id) do update
    set costo_oficial_referencia=excluded.costo_oficial_referencia,
        formula_version=excluded.formula_version,
        fuente=excluded.fuente,
        actualizado=now();

  update public.productos set version_tecnica_vigente_id=v_ver_id where id=v_prod_id;
  update public.expedientes
     set producto_id=v_prod_id,producto_version_id=v_ver_id,actualizado=now(),actualizado_por=v_email
   where id=e.id;
  update public.expediente_revisiones
     set producto_id=v_prod_id,producto_version_id=v_ver_id
   where expediente_id=e.id and rev=coalesce(e.revision,1);

  return jsonb_build_object(
    'ok',true,
    'producto_id',v_prod_id,
    'version_id',v_ver_id,
    'expediente_id',e.id,
    'expediente_revision',coalesce(e.revision,1),
    'estado_tecnico',v_estado_tec,
    'activo',false,
    'idempotente',v_existing_version is not null,
    'renders_stale',v_staled,
    'registered_by_role',v_role,
    'requires_engineering_validation',not v_elevated,
    'nota',case when not v_elevated then 'Revisión preliminar utilizable en proyecto; requiere validación técnica antes de certificarse/activarse.' else 'ProductRevision canónica enlazada al expediente; Dirección controla activación y precio.' end
  );
end;
$function$;
CREATE OR REPLACE FUNCTION private_api.cocrear_seguro(p_expediente_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := auth.jwt()->>'email';
  e public.expedientes%rowtype;
  v_payload jsonb;
  v_history jsonb;
begin
  if v_email is null or not public.puede_entrar() then raise exception 'no autorizado'; end if;
  select * into e from public.expedientes where id=p_expediente_id;
  if not found then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  if not (public.puede_editar_config() or lower(coalesce(e.creado_por,''))=lower(v_email)) then
    return jsonb_build_object('ok',false,'motivo','sin_acceso');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'rev',r.rev,'creado',r.creado,'creado_por',r.creado_por,'nombre',r.nombre,
      'analysis_hash',r.analysis_hash,'cocrear',r.cocrear,
      'producto_id',r.producto_id,'producto_version_id',r.producto_version_id
    ) order by r.rev),'[]'::jsonb)
    into v_history
    from public.expediente_revisiones r where r.expediente_id=e.id;

  v_payload := jsonb_build_object(
    'ok',true,'id',e.id,'nombre',e.nombre,'revision',e.revision,'estado',e.estado,
    'producto_id',e.producto_id,'producto_version_id',e.producto_version_id,
    'analysis_hash',e.analysis_hash,'cocrear',e.cocrear,'historia',v_history,
    'render_aislado_url',e.render_aislado_url,'render_ambiente_url',e.render_ambiente_url,
    'costo',e.costo,'bom',e.bom
  );

  if public.puede_ver_economia() then return v_payload; end if;
  return public.jsonb_sin_economia(v_payload);
end;
$function$;
drop table if exists public.cocrear_costeo_servidor;
commit;
-- <<< ROLLBACK COCREAR10 FIN
*/
