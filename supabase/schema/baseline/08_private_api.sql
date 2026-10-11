-- ============================================================================
--  BASELINE · esquema private_api (36 funciones) · volcado LEÍDO de producción
--  Proyecto mtuvnbgljwbsaizjjgzs · 2026-10-11 · pg_get_functiondef, sin tocar nada.
--  Es una FOTO para leer y diffear, NO una migración para aplicar.
--  Cierra el "hueco conocido" de supabase/schema/README.md: los wrappers de public
--  delegan aquí; sin esto el baseline no era autocontenido.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- private_api.actualizar_cotizacion_segura
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := auth.jwt()->>'email';
  v_role text;
  v_c public.cotizaciones%rowtype;
  v_owner text;
  v_partidas jsonb;
  v_acomodo jsonb;
  v_totales jsonb;
  v_total numeric;
  v_piezas integer;
  v_activa boolean;
  v_cliente_id bigint;
  v_contacto_id bigint;
  v_proyecto_id bigint;
begin
  if v_email is null or not public.puede_entrar() then
    raise exception 'no autorizado';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch invalido';
  end if;

  select lower(p.rol) into v_role
  from public.permitidos p
  where lower(p.email)=lower(v_email)
  limit 1;
  if v_role not in ('direccion','diseno','vendedor') then
    raise exception 'rol sin permiso';
  end if;

  select * into v_c from public.cotizaciones where id=p_cotizacion_id for update;
  if not found then raise exception 'cotizacion no existe'; end if;
  if not (lower(coalesce(v_c.usuario,''))=lower(v_email) or public.puede_editar_config()) then
    raise exception 'sin acceso';
  end if;
  if lower(coalesce(v_c.estado,'borrador')) <> 'borrador' then
    raise exception 'cotizacion no editable en estado %',v_c.estado;
  end if;

  if p_patch ? 'estado' and lower(coalesce(p_patch->>'estado','borrador')) <> 'borrador' then
    raise exception 'estado protegido; use el flujo de emision';
  end if;
  if p_patch ? 'folio_oficial' and nullif(p_patch->>'folio_oficial','') is distinct from v_c.folio_oficial then
    raise exception 'folio_oficial protegido; use el flujo de emision';
  end if;

  v_owner := v_c.usuario;
  if p_patch ? 'usuario' then
    if v_role not in ('direccion','diseno') then
      if lower(coalesce(p_patch->>'usuario','')) <> lower(coalesce(v_c.usuario,'')) then
        raise exception 'propietario protegido';
      end if;
    elsif nullif(trim(p_patch->>'usuario'),'') is not null then
      select p.email into v_owner
      from public.permitidos p
      where lower(p.email)=lower(trim(p_patch->>'usuario'))
      limit 1;
      if v_owner is null then raise exception 'usuario propietario invalido'; end if;
    end if;
  end if;

  v_partidas := case when p_patch ? 'partidas' then p_patch->'partidas' else v_c.partidas end;
  v_acomodo := case when p_patch ? 'acomodo' then p_patch->'acomodo' else v_c.acomodo end;
  v_totales := case when p_patch ? 'totales' then p_patch->'totales' else v_c.totales end;
  if jsonb_typeof(coalesce(v_partidas,'[]'::jsonb)) <> 'array' then raise exception 'partidas debe ser arreglo'; end if;
  if v_acomodo is not null and jsonb_typeof(v_acomodo) not in ('array','object') then raise exception 'acomodo invalido'; end if;
  if v_totales is not null and jsonb_typeof(v_totales) <> 'object' then raise exception 'totales invalido'; end if;

  v_total := v_c.total;
  if p_patch ? 'total' then begin v_total := coalesce(nullif(p_patch->>'total','')::numeric,0); exception when others then raise exception 'total invalido'; end; end if;
  v_piezas := v_c.piezas;
  if p_patch ? 'piezas' then begin v_piezas := coalesce(nullif(p_patch->>'piezas','')::integer,0); exception when others then raise exception 'piezas invalido'; end; end if;
  v_activa := v_c.activa;
  if p_patch ? 'activa' then begin v_activa := (p_patch->>'activa')::boolean; exception when others then raise exception 'activa invalida'; end; end if;
  v_cliente_id := v_c.cliente_id;
  if p_patch ? 'cliente_id' then begin v_cliente_id := nullif(p_patch->>'cliente_id','')::bigint; exception when others then raise exception 'cliente_id invalido'; end; end if;
  v_contacto_id := v_c.contacto_id;
  if p_patch ? 'contacto_id' then begin v_contacto_id := nullif(p_patch->>'contacto_id','')::bigint; exception when others then raise exception 'contacto_id invalido'; end; end if;
  v_proyecto_id := v_c.proyecto_id;
  if p_patch ? 'proyecto_id' then begin v_proyecto_id := nullif(p_patch->>'proyecto_id','')::bigint; exception when others then raise exception 'proyecto_id invalido'; end; end if;
  if v_total < 0 then raise exception 'total no puede ser negativo'; end if;
  if v_piezas < 0 then raise exception 'piezas no puede ser negativo'; end if;

  update public.cotizaciones
  set usuario=v_owner,
      cliente=case when p_patch ? 'cliente' then nullif(p_patch->>'cliente','') else cliente end,
      folio=case when p_patch ? 'folio' then nullif(p_patch->>'folio','') else folio end,
      partidas=v_partidas,
      acomodo=v_acomodo,
      totales=v_totales,
      total=v_total,
      piezas=v_piezas,
      huella_mp=case when p_patch ? 'huella_mp' then nullif(p_patch->>'huella_mp','') else huella_mp end,
      activa=v_activa,
      cliente_id=v_cliente_id,
      contacto_id=v_contacto_id,
      proyecto_id=v_proyecto_id,
      actualizado=now()
  where id=p_cotizacion_id;

  return public.cotizacion_segura(p_cotizacion_id);
end;
$function$;

-- ---------------------------------------------------------------------------
-- private_api.asignar_folio_oficial
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.asignar_folio_oficial(p_cotizacion_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_email text := auth.jwt()->>'email';
  v_existente text;
  v_folio text;
  v_owner text;
  v_has_revision boolean := false;
begin
  if v_email is null or not public.puede_entrar() then
    raise exception 'no autorizado para asignar folio oficial';
  end if;

  select c.usuario, c.folio_oficial
    into v_owner, v_existente
  from public.cotizaciones c
  where c.id = p_cotizacion_id
  for update;

  if not found then
    raise exception 'cotización inexistente';
  end if;

  if not (lower(coalesce(v_owner,'')) = lower(v_email) or public.puede_editar_config()) then
    raise exception 'sin permiso sobre esta cotización';
  end if;

  if v_existente is not null then
    return v_existente;
  end if;

  select exists (
    select 1
    from public.cotizaciones_revisiones r
    where r.cotizacion_id = p_cotizacion_id
      and r.tipo = 'generado_v2'
  ) into v_has_revision;

  if not v_has_revision then
    raise exception 'folio oficial bloqueado: la cotización no tiene una revisión emitida por el flujo v2';
  end if;

  v_folio := 'VH-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.folio_oficial_seq')::text, 5, '0');
  update public.cotizaciones
     set folio_oficial = v_folio
   where id = p_cotizacion_id;

  return v_folio;
end
$function$;

-- ---------------------------------------------------------------------------
-- private_api.canonicalizar_spatial_spec_producto_version
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.canonicalizar_spatial_spec_producto_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  s jsonb;
  src text;
  conf text;
begin
  if jsonb_typeof(coalesce(new.atributos,'{}'::jsonb)->'spatial_spec') = 'object' then
    return new;
  end if;

  s := coalesce(
    new.atributos#>'{cocrear,spatial_spec}',
    new.atributos#>'{cocrear,spec,spatial_spec}'
  );
  if s is null or jsonb_typeof(s) <> 'object' then
    return new;
  end if;

  -- Minimal evidence contract. If provenance is absent/invalid, keep the source
  -- payload nested in cocrear but do not elevate it to canonical spatial truth.
  src := upper(coalesce(s->>'source', s->>'fuente', ''));
  conf := lower(coalesce(s->>'confidence', s->>'confianza', ''));
  if src not in ('USER','PLAN','CATALOG','ENGINEERING','DIRECTION','FACTORY','AI_INFERENCE','RULE') then
    return new;
  end if;
  if conf not in ('alta','media','baja','high','medium','low') then
    return new;
  end if;

  new.atributos := jsonb_set(coalesce(new.atributos,'{}'::jsonb), '{spatial_spec}', s, true);
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- private_api.cocrear_seguro
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- private_api.config_para_rol
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.config_para_rol()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d jsonb;
begin
  select datos into d from public.config where id = 'vonhaucke';
  if d is null then return '{}'::jsonb; end if;
  if public.puede_editar_config() then
    return d;                            -- direccion/diseno: completo (con costos)
  end if;
  return public.config_sanitizada(d);    -- vendedor: sin economía interna
end;
$function$;

-- ---------------------------------------------------------------------------
-- private_api.cotizacion_revisiones_seguras
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.cotizacion_revisiones_seguras(p_cotizacion_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := auth.jwt()->>'email';
  v_economia boolean := public.puede_ver_economia();
  v_allowed boolean;
  v_result jsonb;
begin
  if v_email is null or not public.puede_entrar() then
    raise exception 'no autorizado';
  end if;

  select (c.usuario = v_email or public.puede_editar_config())
    into v_allowed
    from public.cotizaciones c where c.id = p_cotizacion_id;
  if v_allowed is not true then raise exception 'sin acceso'; end if;

  select coalesce(jsonb_agg(
    case when v_economia then payload else public.jsonb_sin_economia(payload) end
    order by (payload->>'revision')::int desc
  ), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'id', r.id,
      'cotizacion_id', r.cotizacion_id,
      'folio', r.folio,
      'cliente', r.cliente,
      'revision', r.revision,
      'emitida_en', r.emitida_en,
      'usuario', r.usuario,
      'total', r.total,
      'hash', r.hash,
      'snapshot', r.snapshot,
      'tipo', r.tipo
    ) as payload
    from public.cotizaciones_revisiones r
    where r.cotizacion_id = p_cotizacion_id
  ) s;
  return v_result;
end;
$function$;

-- ---------------------------------------------------------------------------
-- private_api.cotizacion_segura
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.cotizacion_segura(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c record; v_email text; payload jsonb;
begin
  v_email := auth.jwt()->>'email';
  select * into c from cotizaciones where id=p_id;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if not (c.usuario = v_email or puede_editar_config()) then
    return jsonb_build_object('ok', false, 'motivo', 'sin_acceso');
  end if;
  payload := jsonb_build_object(
    'ok', true, 'id', c.id, 'folio', c.folio, 'folio_oficial', c.folio_oficial, 'cliente', c.cliente,
    'estado', c.estado, 'total', c.total, 'piezas', c.piezas, 'activa', c.activa,
    'cliente_id', c.cliente_id, 'contacto_id', c.contacto_id, 'proyecto_id', c.proyecto_id,
    'partidas', c.partidas, 'totales', c.totales, 'acomodo', c.acomodo, 'creado', c.creado
  );
  -- Dirección ve todo; el resto recibe el payload SIN economía interna.
  if puede_ver_economia() then
    return payload;
  end if;
  return public.jsonb_sin_economia(payload);
end $function$;

-- ---------------------------------------------------------------------------
-- private_api.cotizaciones_mias
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.cotizaciones_mias(p_limite integer DEFAULT 60)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare arr jsonb; lim int; v_email text;
begin
  if not public.puede_entrar() then return '[]'::jsonb; end if;
  v_email := auth.jwt()->>'email';
  lim := greatest(1, least(coalesce(p_limite, 60), 200));
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id, 'creado', c.creado, 'actualizado', c.actualizado,
      'usuario', c.usuario, 'cliente', c.cliente, 'folio', c.folio,
      'folio_oficial', c.folio_oficial, 'estado', c.estado,
      'total', c.total, 'piezas', c.piezas, 'activa', c.activa,
      'huella_mp', c.huella_mp,
      'cliente_id', c.cliente_id, 'contacto_id', c.contacto_id, 'proyecto_id', c.proyecto_id,
      'partidas', coalesce((
        select jsonb_agg(jsonb_build_object(
          'nombre', e->>'nombre',
          'cantidad', e->'cantidad',
          'precioUnitario', e->'precioUnitario'))
        from jsonb_array_elements(case when jsonb_typeof(c.partidas)='array' then c.partidas else '[]'::jsonb end) e
      ), '[]'::jsonb)
    ) order by c.actualizado desc), '[]'::jsonb)
  into arr
  from ( select * from public.cotizaciones
          where activa = true and (usuario = v_email or public.puede_editar_config())
          order by actualizado desc limit lim ) c;
  return arr;
end
$function$;

-- ---------------------------------------------------------------------------
-- private_api.cotizaciones_seguras
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.cotizaciones_seguras()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := auth.jwt()->>'email';
  v_economia boolean := public.puede_ver_economia();
  v_result jsonb;
begin
  if v_email is null or not public.puede_entrar() then
    raise exception 'no autorizado';
  end if;

  select coalesce(jsonb_agg(
    case when v_economia then payload else public.jsonb_sin_economia(payload) end
    order by (payload->>'actualizado')::timestamptz desc
  ), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'id', c.id,
      'creado', c.creado,
      'actualizado', c.actualizado,
      'usuario', c.usuario,
      'cliente', c.cliente,
      'folio', c.folio,
      'folio_oficial', c.folio_oficial,
      'estado', c.estado,
      'partidas', c.partidas,
      'acomodo', c.acomodo,
      'totales', c.totales,
      'total', c.total,
      'piezas', c.piezas,
      'activa', c.activa,
      'cliente_id', c.cliente_id,
      'contacto_id', c.contacto_id,
      'proyecto_id', c.proyecto_id
    ) as payload
    from public.cotizaciones c
    where c.usuario = v_email or public.puede_editar_config()
  ) s;

  return v_result;
end;
$function$;

-- ---------------------------------------------------------------------------
-- private_api.current_request_email
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.current_request_email()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select lower(coalesce((select auth.jwt() ->> 'email'), ''))
$function$;

-- ---------------------------------------------------------------------------
-- private_api.emitir_revision
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.emitir_revision(p_cotizacion_id bigint, p_snapshot jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return public.emitir_revision_v2(p_cotizacion_id,p_snapshot) || jsonb_build_object('legacy_entrypoint',true);
end;
$function$;

-- ---------------------------------------------------------------------------
-- private_api.es_direccion
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.es_direccion()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.permitidos where email = (auth.jwt() ->> 'email') and rol = 'direccion');
$function$;

-- ---------------------------------------------------------------------------
-- private_api.guard_cotizacion_estado_directo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.guard_cotizacion_estado_directo()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  -- SECURITY DEFINER RPCs use the privileged execution role; raw PostgREST
  -- writes under authenticated can edit drafts but cannot forge issuance.
  IF current_user = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.estado IS DISTINCT FROM 'borrador' OR NEW.folio_oficial IS NOT NULL THEN
        RAISE EXCEPTION 'Estado/folio oficial protegidos: utilice RPC de emision'
          USING ERRCODE='42501';
      END IF;
    ELSE
      IF NEW.estado IS DISTINCT FROM OLD.estado
         OR NEW.folio_oficial IS DISTINCT FROM OLD.folio_oficial THEN
        RAISE EXCEPTION 'Estado/folio oficial protegidos: utilice RPC de emision'
          USING ERRCODE='42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- private_api.guardar_cocrear_seguro
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.guardar_cocrear_seguro(p_expediente_id bigint, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := auth.jwt()->>'email';
  v_role text;
  e public.expedientes%rowtype;
  v_id bigint;
  v_rev int;
  v_hash text;
  v_same boolean := false;
  v_name text;
  v_tipo text;
  v_w numeric;
  v_d numeric;
  v_h numeric;
  v_prod bigint;
  v_prev_version bigint;
begin
  if v_email is null or not public.puede_entrar() then raise exception 'no autorizado'; end if;
  select lower(p.rol) into v_role from public.permitidos p where lower(p.email)=lower(v_email) limit 1;
  if v_role not in ('direccion','diseno','vendedor') then raise exception 'rol sin permiso para cocrear'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'payload cocrear inválido'; end if;

  v_hash := md5(p_payload::text);
  v_name := coalesce(nullif(p_payload->>'nombre',''),nullif(p_payload#>>'{spec,nombre}',''),nullif(p_payload#>>'{intent,nombre}',''),'Cocreación');
  v_tipo := coalesce(nullif(p_payload->>'familia',''),nullif(p_payload#>>'{spec,familia}',''),nullif(p_payload#>>'{intent,familia}',''));
  begin v_w := nullif(coalesce(p_payload#>>'{spec,dimensions,width}',p_payload#>>'{spec,dimensiones,ancho_mm}',p_payload#>>'{dimensions,width}',p_payload->>'ancho_mm'),'')::numeric; exception when others then v_w:=null; end;
  begin v_d := nullif(coalesce(p_payload#>>'{spec,dimensions,depth}',p_payload#>>'{spec,dimensiones,fondo_mm}',p_payload#>>'{dimensions,depth}',p_payload->>'fondo_mm'),'')::numeric; exception when others then v_d:=null; end;
  begin v_h := nullif(coalesce(p_payload#>>'{spec,dimensions,height}',p_payload#>>'{spec,dimensiones,alto_mm}',p_payload#>>'{dimensions,height}',p_payload->>'alto_mm'),'')::numeric; exception when others then v_h:=null; end;

  if p_expediente_id is null then
    insert into public.expedientes(
      creado_por,actualizado_por,nombre,estado,producto_tipo,ancho_mm,fondo_mm,alto_mm,cocrear,revision,analysis_hash
    ) values (
      v_email,v_email,v_name,'borrador',v_tipo,v_w,v_d,v_h,p_payload,1,v_hash
    ) returning id into v_id;
    v_rev := 1;
    insert into public.expediente_revisiones(
      expediente_id,rev,creado_por,nombre,analysis_hash,cocrear
    ) values (v_id,v_rev,v_email,v_name,v_hash,p_payload);
  else
    select * into e from public.expedientes where id=p_expediente_id for update;
    if not found then raise exception 'expediente no existe'; end if;
    if not (public.puede_editar_config() or lower(coalesce(e.creado_por,''))=lower(v_email)) then
      raise exception 'sin permiso sobre cocreación';
    end if;

    v_id := e.id;
    v_prod := e.producto_id;
    v_prev_version := e.producto_version_id;
    v_same := (coalesce(e.analysis_hash,'')=v_hash or e.cocrear=p_payload);
    if v_same then
      return jsonb_build_object('ok',true,'expediente_id',v_id,'revision',e.revision,'nueva_revision',false,'idempotente',true,'producto_id',e.producto_id,'producto_version_id',e.producto_version_id);
    end if;

    v_rev := e.revision + 1;
    -- Persist immutable revision first, carrying the canonical version that was current before this change.
    insert into public.expediente_revisiones(
      expediente_id,rev,creado_por,nombre,bom,costo,confirmaciones,materiales,plano_urls,
      render_aislado_url,render_ambiente_url,analysis_hash,cocrear,producto_id,producto_version_id
    ) values (
      e.id,v_rev,v_email,v_name,e.bom,e.costo,e.confirmaciones,e.materiales,e.plano_urls,
      e.render_aislado_url,e.render_ambiente_url,v_hash,p_payload,e.producto_id,null
    );

    update public.expedientes set
      actualizado=now(), actualizado_por=v_email,
      nombre=v_name,
      producto_tipo=coalesce(v_tipo,producto_tipo),
      ancho_mm=coalesce(v_w,ancho_mm), fondo_mm=coalesce(v_d,fondo_mm), alto_mm=coalesce(v_h,alto_mm),
      cocrear=p_payload, revision=v_rev, analysis_hash=v_hash,
      -- content changed: prior ProductVersion no longer represents current design until re-registered
      producto_version_id=null
    where id=e.id;

    if v_prod is not null then
      update public.renders
         set stale=true, estado=case when estado='GENERATED' then 'STALE' else estado end
       where producto_id=v_prod and stale=false;
    end if;
  end if;

  return jsonb_build_object(
    'ok',true,'expediente_id',v_id,'revision',v_rev,'nueva_revision',true,
    'analysis_hash',v_hash,'producto_id',coalesce(v_prod,(select producto_id from public.expedientes where id=v_id)),
    'producto_version_id',null,
    'needs_product_revision',true
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- private_api.hash_revision
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.hash_revision(p_snapshot jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l_pl numeric; l_desc numeric; l_cont numeric; l_man numeric; l_flete numeric; l_iva numeric; v_total numeric;
begin
  l_pl    := coalesce((p_snapshot#>>'{totales,precioLista}')::numeric, 0);
  l_desc  := coalesce((p_snapshot#>>'{totales,descuento}')::numeric, 0);
  l_cont  := coalesce((p_snapshot#>>'{totales,contingencia}')::numeric, 0);
  l_man   := coalesce((p_snapshot#>>'{totales,maniobras}')::numeric, 0);
  l_flete := coalesce((p_snapshot#>>'{totales,flete}')::numeric, 0);
  l_iva   := coalesce((p_snapshot#>>'{totales,iva}')::numeric, 0);
  v_total := l_pl - l_desc + l_cont + l_man + l_flete + l_iva;
  return md5(jsonb_build_object(
    'partidas', p_snapshot->'partidas', 'totales', p_snapshot->'totales',
    'total', to_jsonb(v_total), 'folio', p_snapshot->'folio',
    'cliente', p_snapshot->'cliente', 'acomodo', p_snapshot->'acomodo')::text);
end $function$;

-- ---------------------------------------------------------------------------
-- private_api.marcar_renders_stale_producto
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.marcar_renders_stale_producto(p_producto_id bigint, p_except_version_id bigint DEFAULT NULL::bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  if not public.puede_editar_config() then raise exception 'no autorizado'; end if;
  update public.renders
     set stale = true,
         estado = case
           when estado in ('GENERATED','VALIDATED') then 'STALE'
           else estado
         end
   where producto_id = p_producto_id
     and (p_except_version_id is null or producto_version_id <> p_except_version_id)
     and stale = false;
  get diagnostics n = row_count;
  return n;
end;
$function$;

-- ---------------------------------------------------------------------------
-- private_api.producto_cotizable
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.producto_cotizable(p_producto_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r jsonb; begin
  r := resolver_precio_autorizado(p_producto_id);
  return jsonb_build_object('cotizable', (r->>'ok')::boolean, 'detalle', r);
end $function$;

-- ---------------------------------------------------------------------------
-- private_api.puede_editar_config
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.puede_editar_config()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.permitidos
    where email = (auth.jwt() ->> 'email') and rol in ('direccion','diseno')
  );
$function$;

-- ---------------------------------------------------------------------------
-- private_api.puede_entrar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.puede_entrar()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.permitidos where email = (auth.jwt() ->> 'email'));
$function$;

-- ---------------------------------------------------------------------------
-- private_api.puede_ver_economia
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.puede_ver_economia()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(select 1 from public.permitidos where email=(auth.jwt()->>'email') and rol='direccion');
$function$;

-- ---------------------------------------------------------------------------
-- private_api.resolver_aprobacion
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.resolver_aprobacion(p_id bigint, p_estado text, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE yo text; fila aprobaciones%ROWTYPE;
BEGIN
  yo := auth.jwt()->>'email';
  IF yo IS NULL OR NOT public.es_direccion() THEN RAISE EXCEPTION 'solo Dirección resuelve aprobaciones'; END IF;
  IF p_estado NOT IN ('APROBADA','RECHAZADA','CONTRAOFERTA') THEN RAISE EXCEPTION 'estado inválido: %', p_estado; END IF;
  UPDATE aprobaciones SET estado = p_estado, resuelto_por = yo, resuelto_en = now(),
         motivo = COALESCE(p_motivo, motivo)
   WHERE id = p_id AND estado = 'PENDIENTE'
  RETURNING * INTO fila;
  IF NOT FOUND THEN RAISE EXCEPTION 'aprobación % no existe o ya fue resuelta', p_id; END IF;
  RETURN jsonb_build_object('id', fila.id, 'estado', fila.estado, 'resuelto_por', fila.resuelto_por);
END; $function$;

-- ---------------------------------------------------------------------------
-- private_api.resolver_costo_insumo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.resolver_costo_insumo(p_insumo_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
  c record;
  cfg jsonb;
BEGIN
  -- Guardia seller-safe: el costo NO se entrega a quien no debe verlo.
  IF NOT public.puede_editar_config() THEN
    RAISE EXCEPTION 'no autorizado: el costo de insumos es economía interna (dirección/diseño)';
  END IF;

  -- 1) Catálogo vigente (fuente con estados de certificación).
  SELECT * INTO c FROM public.catalogo_vigente WHERE insumo_id = p_insumo_id LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'insumo_id', c.insumo_id,
      'precio', c.precio,
      'moneda', COALESCE(c.propiedades->>'moneda', 'MXN'),
      'unidad', c.unidad_compra,
      'fuente', COALESCE(c.fuente, 'catalogo_vigente'),
      'evidencia', c.evidencia,
      'vigencia', c.vigente_desde,
      'certificable', c.certificable,
      'requiere_validacion', COALESCE(c.requiere_validacion_compras, false),
      'estado_certificacion',
        CASE
          WHEN c.estado = 'aprobado' AND c.certificable THEN 'CERTIFICADO'
          WHEN c.estado = 'propuesto_validado' THEN 'PRELIMINAR'
          WHEN c.estado = 'propuesto' THEN 'PROPUESTO'
          ELSE 'DESCONOCIDO'
        END
    );
  END IF;

  -- 2) Config legado (lo que el motor LIVE usa hoy). Honesto: no certificado.
  SELECT datos->'insumos'->p_insumo_id INTO cfg FROM public.config WHERE id = 'vonhaucke';
  IF cfg IS NOT NULL AND cfg <> 'null'::jsonb THEN
    RETURN jsonb_build_object(
      'insumo_id', p_insumo_id,
      'precio', COALESCE((cfg->>'precio')::numeric, (cfg->>'precioBase')::numeric),
      'moneda', COALESCE(cfg->>'moneda', 'MXN'),
      'unidad', cfg->>'unidad',
      'fuente', 'config_legado',
      'evidencia', NULL,
      'vigencia', NULL,
      'certificable', false,
      'requiere_validacion', true,
      'estado_certificacion', 'CONFIG_LEGADO'
    );
  END IF;

  -- 3) Desconocido: NO se inventa precio.
  RETURN jsonb_build_object(
    'insumo_id', p_insumo_id, 'precio', NULL, 'moneda', NULL, 'unidad', NULL,
    'fuente', NULL, 'evidencia', NULL, 'vigencia', NULL,
    'certificable', false, 'requiere_validacion', true,
    'estado_certificacion', 'DESCONOCIDO'
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- private_api.resolver_renders_canonicos
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.resolver_renders_canonicos(p_version_ids bigint[])
 RETURNS TABLE(producto_id bigint, producto_version_id bigint, estado text, stale boolean, storage_url text, creado timestamp with time zone, prompt_version text, geometry_hash text, modo text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.producto_id, r.producto_version_id, r.estado, r.stale,
         r.storage_url, r.creado, r.prompt_version, r.geometry_hash, r.modo
  from public.renders r
  where r.producto_version_id = any(p_version_ids)
$function$;

-- ---------------------------------------------------------------------------
-- private_api.revisiones_seguras
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.revisiones_seguras(p_cotizacion_id bigint)
 RETURNS TABLE(revision integer, total numeric, hash text, snapshot jsonb, emitida_en timestamp with time zone, tipo text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select r.revision,
         r.total,
         r.hash,
         case when public.puede_editar_config() then r.snapshot
              else public.jsonb_sin_economia(r.snapshot) end as snapshot,
         r.emitida_en,
         r.tipo
  from public.cotizaciones_revisiones r
  where r.cotizacion_id = p_cotizacion_id
    and ( r.usuario = (auth.jwt() ->> 'email') or public.puede_editar_config() )
  order by r.revision;
$function$;

-- ---------------------------------------------------------------------------
-- private_api.verificar_aprobacion
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.verificar_aprobacion(p_cotizacion_id bigint, p_revision_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare fila aprobaciones%rowtype; yo text; v_puede boolean; v_reglas_version integer;
begin
  yo := auth.jwt()->>'email';
  if yo is null or not public.puede_entrar() then raise exception 'no autorizado'; end if;
  select (c.usuario = yo or public.puede_editar_config()) into v_puede from public.cotizaciones c where c.id = p_cotizacion_id;
  if v_puede is not true then raise exception 'sin permiso sobre la cotizacion %', p_cotizacion_id; end if;
  v_reglas_version := (public.reglas_comerciales_vigentes(current_date)->>'version')::integer;
  if v_reglas_version is null then return jsonb_build_object('aprobada', false, 'motivo', 'sin_politica_vigente'); end if;
  select * into fila from aprobaciones
   where cotizacion_id = p_cotizacion_id and revision_hash = p_revision_hash and estado = 'APROBADA'
     and reglas_version = v_reglas_version
   order by resuelto_en desc nulls last limit 1;
  if found then
    return jsonb_build_object('aprobada', true, 'id', fila.id, 'reglas_version', fila.reglas_version, 'resuelto_por', fila.resuelto_por, 'resuelto_en', fila.resuelto_en);
  end if;
  return jsonb_build_object('aprobada', false, 'reglas_version', v_reglas_version);
end; $function$;

-- ---------------------------------------------------------------------------
-- private_api.vincular_cotizacion
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.vincular_cotizacion(p_cotizacion_id bigint, p_cliente_id bigint DEFAULT NULL::bigint, p_contacto_id bigint DEFAULT NULL::bigint, p_proyecto_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_email text; v_ok boolean;
begin
  v_email := auth.jwt()->>'email';
  select (usuario = v_email or puede_editar_config()) into v_ok from cotizaciones where id=p_cotizacion_id;
  if v_ok is null then return jsonb_build_object('ok',false,'motivo','cotizacion_inexistente'); end if;
  if not v_ok then raise exception 'no autorizado'; end if;
  update cotizaciones set cliente_id=p_cliente_id, contacto_id=p_contacto_id, proyecto_id=p_proyecto_id
    where id=p_cotizacion_id;
  return jsonb_build_object('ok',true,'cotizacion_id',p_cotizacion_id,
    'cliente_id',p_cliente_id,'contacto_id',p_contacto_id,'proyecto_id',p_proyecto_id);
end $function$;

-- ---------------------------------------------------------------------------
-- private_api.crear_cotizacion_segura
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.crear_cotizacion_segura(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := auth.jwt()->>'email';
  v_role text;
  v_owner text;
  v_id bigint;
  v_partidas jsonb := coalesce(p_payload->'partidas','[]'::jsonb);
  v_acomodo jsonb := p_payload->'acomodo';
  v_totales jsonb := p_payload->'totales';
  v_total numeric := 0;
  v_piezas integer := 0;
  v_activa boolean := true;
  v_cliente_id bigint;
  v_contacto_id bigint;
  v_proyecto_id bigint;
  v_idempotency_key text := nullif(btrim(coalesce(p_payload->>'_idempotency_key','')), '');
  v_payload_hash text;
  v_prev_quote_id bigint;
  v_prev_payload_hash text;
begin
  if v_email is null or not public.puede_entrar() then
    raise exception 'no autorizado';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload invalido';
  end if;

  select lower(p.rol) into v_role
  from public.permitidos p
  where lower(p.email)=lower(v_email)
  limit 1;
  if v_role not in ('direccion','diseno','vendedor') then
    raise exception 'rol sin permiso';
  end if;

  if jsonb_typeof(v_partidas) <> 'array' then
    raise exception 'partidas debe ser arreglo';
  end if;
  if v_acomodo is not null and jsonb_typeof(v_acomodo) not in ('array','object') then
    raise exception 'acomodo invalido';
  end if;
  if v_totales is not null and jsonb_typeof(v_totales) <> 'object' then
    raise exception 'totales invalido';
  end if;

  -- El dueño nunca lo decide un vendedor. Diseño/Dirección pueden asignar una cotización
  -- a un usuario permitido; en ausencia de asignación, queda a nombre del caller.
  v_owner := v_email;
  if v_role in ('direccion','diseno') and nullif(trim(p_payload->>'usuario'),'') is not null then
    select p.email into v_owner
    from public.permitidos p
    where lower(p.email)=lower(trim(p_payload->>'usuario'))
    limit 1;
    if v_owner is null then raise exception 'usuario propietario invalido'; end if;
  end if;

  begin v_total := coalesce(nullif(p_payload->>'total','')::numeric,0); exception when others then raise exception 'total invalido'; end;
  begin v_piezas := coalesce(nullif(p_payload->>'piezas','')::integer,0); exception when others then raise exception 'piezas invalido'; end;
  begin if p_payload ? 'activa' then v_activa := (p_payload->>'activa')::boolean; end if; exception when others then raise exception 'activa invalida'; end;
  begin if nullif(p_payload->>'cliente_id','') is not null then v_cliente_id := (p_payload->>'cliente_id')::bigint; end if; exception when others then raise exception 'cliente_id invalido'; end;
  begin if nullif(p_payload->>'contacto_id','') is not null then v_contacto_id := (p_payload->>'contacto_id')::bigint; end if; exception when others then raise exception 'contacto_id invalido'; end;
  begin if nullif(p_payload->>'proyecto_id','') is not null then v_proyecto_id := (p_payload->>'proyecto_id')::bigint; end if; exception when others then raise exception 'proyecto_id invalido'; end;

  if v_total < 0 then raise exception 'total no puede ser negativo'; end if;
  if v_piezas < 0 then raise exception 'piezas no puede ser negativo'; end if;
  -- Estado emitido/folio oficial sólo se obtienen por la compuerta de emisión.
  if p_payload ? 'estado' and lower(coalesce(p_payload->>'estado','borrador')) <> 'borrador' then
    raise exception 'estado protegido; use el flujo de emision';
  end if;
  if nullif(p_payload->>'folio_oficial','') is not null then
    raise exception 'folio_oficial protegido; use el flujo de emision';
  end if;

  -- Serialize retries of the SAME create operation, never dedupe by content.
  IF v_idempotency_key IS NOT NULL THEN
    IF length(v_idempotency_key)<10 OR length(v_idempotency_key)>100
       OR v_idempotency_key !~ '^[a-zA-Z0-9_-]+$' THEN
      RAISE EXCEPTION 'idempotency key invalid';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext(lower(v_email)),hashtext(v_idempotency_key));
    v_payload_hash := md5((p_payload - '_idempotency_key')::text);
    SELECT i.cotizacion_id, i.payload_hash INTO v_prev_quote_id,v_prev_payload_hash
      FROM private_api.cotizacion_idempotencia i
      WHERE i.actor_email=lower(v_email) AND i.request_key=v_idempotency_key;
    IF FOUND THEN
      IF v_prev_payload_hash IS DISTINCT FROM v_payload_hash THEN
        RAISE EXCEPTION 'idempotency key reused with different payload';
      END IF;
      RETURN public.cotizacion_segura(v_prev_quote_id);
    END IF;
  END IF;

  insert into public.cotizaciones(
    usuario,cliente,folio,estado,partidas,acomodo,totales,total,piezas,
    huella_mp,activa,cliente_id,contacto_id,proyecto_id
  ) values (
    v_owner,
    nullif(p_payload->>'cliente',''),
    nullif(p_payload->>'folio',''),
    'borrador',
    v_partidas,
    v_acomodo,
    v_totales,
    v_total,
    v_piezas,
    nullif(p_payload->>'huella_mp',''),
    v_activa,
    v_cliente_id,
    v_contacto_id,
    v_proyecto_id
  ) returning id into v_id;

  IF v_idempotency_key IS NOT NULL THEN
    INSERT INTO private_api.cotizacion_idempotencia
      (actor_email,request_key,cotizacion_id,payload_hash)
    VALUES (lower(v_email),v_idempotency_key,v_id,v_payload_hash);
  END IF;

  return public.cotizacion_segura(v_id);
end;
$function$;

-- ---------------------------------------------------------------------------
-- private_api.registrar_producto_desde_expediente
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- private_api.registrar_render_canonico
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.registrar_render_canonico(p_producto_id bigint, p_producto_version_id bigint, p_expediente_id bigint, p_storage_path text, p_storage_url text, p_prompt_version text, p_modo text, p_spec_hash text, p_geometry_hash text, p_inputs jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id bigint;
  v_name text;
  v_dims jsonb;
  v_ok boolean;
  v_email text := auth.jwt()->>'email';
  v_exp public.expedientes%rowtype;
begin
  if v_email is null or not public.puede_entrar() then
    raise exception 'no autorizado';
  end if;
  if p_producto_id is null or p_producto_version_id is null then
    raise exception 'producto/version requeridos';
  end if;
  if coalesce(trim(p_storage_path),'')='' then raise exception 'storage_path requerido'; end if;
  if coalesce(trim(p_prompt_version),'')='' then raise exception 'prompt_version requerido'; end if;
  if coalesce(trim(p_spec_hash),'')='' then raise exception 'spec_hash requerido'; end if;
  if coalesce(trim(p_geometry_hash),'')='' then raise exception 'geometry_hash requerido'; end if;

  select exists(
    select 1 from public.producto_versiones pv
    where pv.id=p_producto_version_id and pv.producto_id=p_producto_id
  ) into v_ok;
  if not v_ok then raise exception 'producto_version_id no pertenece al producto'; end if;

  if p_expediente_id is not null then
    select * into v_exp from public.expedientes e where e.id=p_expediente_id;
    if not found then raise exception 'expediente inexistente'; end if;
    if not (public.puede_editar_config() or lower(coalesce(v_exp.creado_por,''))=lower(v_email)) then
      raise exception 'sin acceso al expediente';
    end if;
    if v_exp.producto_id is distinct from p_producto_id then
      raise exception 'expediente no corresponde al producto';
    end if;
    if v_exp.producto_version_id is null then
      raise exception 'expediente sin version canonica vigente';
    end if;
    if v_exp.producto_version_id is distinct from p_producto_version_id then
      raise exception 'version stale: el expediente ya apunta a otra revision canonica';
    end if;
  end if;

  select p.nombre,pv.dimensiones into v_name,v_dims
  from public.productos p
  join public.producto_versiones pv on pv.producto_id=p.id
  where p.id=p_producto_id and pv.id=p_producto_version_id;

  insert into public.renders(
    creado_por, producto_nombre, producto_version, prompt_version, categoria,
    ancho_mm, fondo_mm, alto_mm, modo, storage_path, storage_url, inputs,
    costo_estado, estado, producto_id, producto_version_id, expediente_id,
    spec_hash, geometry_hash, geometry_validation, feature_validation, finish_validation, stale
  ) values (
    v_email, v_name, p_producto_version_id::text, p_prompt_version, 'cocrear',
    nullif(v_dims->>'ancho_mm','')::numeric,
    nullif(v_dims->>'fondo_mm','')::numeric,
    nullif(v_dims->>'alto_mm','')::numeric,
    p_modo, p_storage_path, p_storage_url, coalesce(p_inputs,'{}'::jsonb),
    null, 'GENERATED', p_producto_id, p_producto_version_id, p_expediente_id,
    p_spec_hash, p_geometry_hash, 'NOT_VERIFIED', 'NOT_VERIFIED', 'NOT_VERIFIED', false
  ) returning id into v_id;

  return jsonb_build_object(
    'ok',true,
    'render_id',v_id,
    'producto_id',p_producto_id,
    'producto_version_id',p_producto_version_id,
    'expediente_id',p_expediente_id,
    'stale',false,
    'validation','NOT_VERIFIED'
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- private_api.resolver_precio_autorizado
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.resolver_precio_autorizado(p_producto_id bigint, p_version_id bigint DEFAULT NULL::bigint, p_variante_id bigint DEFAULT NULL::bigint, p_fecha date DEFAULT CURRENT_DATE, p_moneda text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_prod record; v_ver record; v_var record; v_item record;
begin
  select * into v_prod from productos where id=p_producto_id;
  if not found then return jsonb_build_object('ok',false,'motivo','producto_inexistente'); end if;
  if not v_prod.activo or v_prod.estado<>'activo' then return jsonb_build_object('ok',false,'motivo','producto_inactivo'); end if;

  select * into v_ver from producto_versiones
   where id = coalesce(p_version_id, v_prod.version_tecnica_vigente_id) and producto_id=p_producto_id;
  if not found then return jsonb_build_object('ok',false,'motivo','version_invalida'); end if;
  if v_ver.estado_tecnico not in ('aprobado','certificado') then
    return jsonb_build_object('ok',false,'motivo','version_no_aprobada'); end if;

  if p_variante_id is not null then
    select * into v_var from variantes_producto where id=p_variante_id and producto_version_id=v_ver.id;
    if not found then return jsonb_build_object('ok',false,'motivo','variante_invalida'); end if;
    if not v_var.activa then return jsonb_build_object('ok',false,'motivo','variante_inactiva'); end if;
  end if;

  select lpi.*, lp.id lp_id, lp.vigencia_desde lp_vd, lp.vigencia_hasta lp_vh
    into v_item
  from lista_precio_items lpi
  join listas_precio lp on lp.id = lpi.lista_precio_id
  where lpi.producto_id = p_producto_id
    and (lpi.producto_version_id is null or lpi.producto_version_id = v_ver.id)
    and (p_variante_id is null or lpi.variante_id is null or lpi.variante_id = p_variante_id)
    and lp.estado = 'approved'
    and (lp.vigencia_desde is null or lp.vigencia_desde <= p_fecha)
    and (lp.vigencia_hasta is null or lp.vigencia_hasta >= p_fecha)
    and (lpi.vigencia_desde is null or lpi.vigencia_desde <= p_fecha)
    and (lpi.vigencia_hasta is null or lpi.vigencia_hasta >= p_fecha)
    and (p_moneda is null or lpi.moneda = p_moneda)
  order by (lpi.variante_id is not null) desc, (lpi.producto_version_id is not null) desc,
           lp.version desc, coalesce(lpi.vigencia_desde, lp.vigencia_desde) desc nulls last
  limit 1;

  if not found then
    if exists(select 1 from lista_precio_items lpi join listas_precio lp on lp.id=lpi.lista_precio_id
              where lpi.producto_id=p_producto_id and lp.estado='approved') then
      return jsonb_build_object('ok',false,'motivo','precio_no_vigente');
    end if;
    return jsonb_build_object('ok',false,'motivo','sin_precio_autorizado');
  end if;

  return jsonb_build_object(
    'ok', true, 'producto_id', p_producto_id, 'version_id', v_ver.id, 'variante_id', p_variante_id,
    'lista_precio_id', v_item.lp_id, 'lista_precio_item_id', v_item.id,
    'precio_lista', v_item.precio_lista, 'moneda', v_item.moneda,
    'vigencia_desde', coalesce(v_item.vigencia_desde, v_item.lp_vd),
    'vigencia_hasta', coalesce(v_item.vigencia_hasta, v_item.lp_vh),
    'estado', 'autorizado'
  );
end $function$;

-- ---------------------------------------------------------------------------
-- private_api.solicitar_aprobacion
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.solicitar_aprobacion(p_cotizacion_id bigint, p_revision_hash text, p_descuento numeric DEFAULT NULL::numeric, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare yo text; existente aprobaciones%rowtype; nuevo aprobaciones%rowtype; v_puede boolean; v_reglas_version integer;
begin
  yo := auth.jwt()->>'email';
  if yo is null or not public.puede_entrar() then raise exception 'no autorizado'; end if;
  select (c.usuario = yo or public.puede_editar_config()) into v_puede from public.cotizaciones c where c.id = p_cotizacion_id;
  if v_puede is not true then raise exception 'sin permiso sobre la cotizacion %', p_cotizacion_id; end if;
  if p_revision_hash is null or length(p_revision_hash) = 0 then raise exception 'falta revision_hash (snapshot)'; end if;
  v_reglas_version := (public.reglas_comerciales_vigentes(current_date)->>'version')::integer;
  if v_reglas_version is null then raise exception 'no hay politica comercial vigente'; end if;

  select * into existente from aprobaciones
   where cotizacion_id = p_cotizacion_id and revision_hash = p_revision_hash and estado = 'PENDIENTE'
     and reglas_version = v_reglas_version
   order by creado desc limit 1;
  if found then
    return jsonb_build_object('id', existente.id, 'estado', existente.estado, 'reglas_version', existente.reglas_version, 'ya_existia', true);
  end if;

  insert into aprobaciones(cotizacion_id, revision_hash, estado, descuento_solicitado, motivo, solicitado_por, creado, reglas_version)
  values (p_cotizacion_id, p_revision_hash, 'PENDIENTE', p_descuento, p_motivo, yo, now(), v_reglas_version)
  returning * into nuevo;
  return jsonb_build_object('id', nuevo.id, 'estado', nuevo.estado, 'reglas_version', nuevo.reglas_version, 'ya_existia', false);
end; $function$;

-- ---------------------------------------------------------------------------
-- private_api.solicitar_aprobacion_snapshot
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.solicitar_aprobacion_snapshot(p_cotizacion_id bigint, p_snapshot jsonb, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare yo text; v_hash text; v_desc numeric; existente aprobaciones%rowtype; nuevo aprobaciones%rowtype; v_puede boolean; v_reglas_version integer;
begin
  yo := auth.jwt()->>'email';
  if yo is null or not public.puede_entrar() then raise exception 'no autorizado'; end if;
  select (c.usuario = yo or public.puede_editar_config()) into v_puede from public.cotizaciones c where c.id = p_cotizacion_id;
  if v_puede is not true then raise exception 'sin permiso sobre la cotizacion %', p_cotizacion_id; end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then raise exception 'snapshot invalido'; end if;
  v_reglas_version := (public.reglas_comerciales_vigentes(current_date)->>'version')::integer;
  if v_reglas_version is null then raise exception 'no hay politica comercial vigente'; end if;
  v_hash := public.hash_revision(p_snapshot);
  v_desc := coalesce((p_snapshot#>>'{totales,descuentoPct}')::numeric, 0);
  select * into existente from aprobaciones
   where cotizacion_id = p_cotizacion_id and revision_hash = v_hash and estado = 'PENDIENTE'
     and reglas_version = v_reglas_version
   order by creado desc limit 1;
  if found then
    return jsonb_build_object('ok', true, 'id', existente.id, 'estado', existente.estado, 'hash', v_hash, 'reglas_version', existente.reglas_version, 'ya_existia', true);
  end if;
  insert into aprobaciones(cotizacion_id, revision_hash, estado, descuento_solicitado, motivo, solicitado_por, creado, reglas_version)
  values (p_cotizacion_id, v_hash, 'PENDIENTE', v_desc, p_motivo, yo, now(), v_reglas_version)
  returning * into nuevo;
  return jsonb_build_object('ok', true, 'id', nuevo.id, 'estado', nuevo.estado, 'hash', v_hash, 'reglas_version', nuevo.reglas_version, 'ya_existia', false);
end $function$;

-- ---------------------------------------------------------------------------
-- private_api.cotizacion_emitible
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.cotizacion_emitible(p_cotizacion_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c public.cotizaciones%rowtype;
  snap jsonb;
  gate jsonb;
begin
  select * into c from public.cotizaciones where id=p_cotizacion_id;
  if not found then
    return jsonb_build_object('ok',false,'estado','BLOCKED','motivos',jsonb_build_array('no_existe'));
  end if;
  snap := jsonb_build_object('partidas',c.partidas,'totales',coalesce(c.totales,'{}'::jsonb),'total',c.total);
  gate := public.evaluar_emision_cotizacion(p_cotizacion_id,snap);
  return jsonb_build_object(
    'ok', gate->>'state'='ALLOWED',
    'estado', gate->>'state',
    'motivos', coalesce(gate->'reasons','[]'::jsonb),
    'economics', coalesce(gate->'economics','[]'::jsonb),
    'hash', gate->>'hash'
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- private_api.requiere_aprobacion_snapshot
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.requiere_aprobacion_snapshot(p_snapshot jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reglas jsonb;
  v_desc_max numeric;
  v_margen_min numeric;
  pt jsonb;
  v_desc_txt text;
  v_precio_txt text;
  v_lpi_txt text;
  v_ver_txt text;
  v_desc numeric;
  v_precio numeric;
  v_piso numeric;
  v_costo numeric;
begin
  v_reglas := public.reglas_comerciales_vigentes(current_date);
  if v_reglas is null then return true; end if;
  v_desc_max := coalesce((v_reglas->>'descuento_max_sin_aprobacion')::numeric, 0);
  v_margen_min := coalesce((v_reglas->>'margen_minimo_pct')::numeric, 0);

  if coalesce((p_snapshot#>>'{totales,descuentoPct}')::numeric, 0) > v_desc_max then
    return true;
  end if;

  for pt in select value from jsonb_array_elements(coalesce(p_snapshot->'partidas','[]'::jsonb)) loop
    v_desc_txt := coalesce(nullif(pt->>'descuento',''), nullif(pt->>'descuento_solicitado',''));
    if v_desc_txt is not null and v_desc_txt ~ '^-?[0-9]+([.][0-9]+)?$' then
      v_desc := v_desc_txt::numeric;
      if v_desc > v_desc_max then return true; end if;
    end if;

    v_precio_txt := nullif(pt->>'precioUnitario','');
    if v_precio_txt is null or v_precio_txt !~ '^-?[0-9]+([.][0-9]+)?$' then
      continue;
    end if;
    v_precio := v_precio_txt::numeric;

    v_lpi_txt := coalesce(nullif(pt->>'lista_precio_item_id',''), nullif(pt->>'listaPrecioItemId',''));
    if v_lpi_txt is not null and v_lpi_txt ~ '^[0-9]+$' then
      select piso_minimo into v_piso from public.lista_precio_items where id = v_lpi_txt::bigint;
      if v_piso is not null and v_precio < v_piso then return true; end if;
    end if;

    v_ver_txt := coalesce(nullif(pt->>'producto_version_id',''), nullif(pt->>'productoVersionId',''));
    if v_ver_txt is not null and v_ver_txt ~ '^[0-9]+$' then
      select costo_oficial_referencia into v_costo
      from public.producto_version_economia
      where producto_version_id = v_ver_txt::bigint;
      if v_costo is not null and v_precio > 0 then
        if ((v_precio - v_costo) / v_precio) * 100 < v_margen_min then return true; end if;
      end if;
    end if;
  end loop;

  return false;
end $function$;

-- ---------------------------------------------------------------------------
-- private_api.emitir_revision_v2
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.emitir_revision_v2(p_cotizacion_id bigint, p_snapshot jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  ident text := coalesce(nullif(claims->>'email',''), nullif(claims->>'sub',''));
  v_folio text; v_cliente text; v_puede boolean; v_malas int;
  v_desc_max numeric; v_reglas jsonb; v_requiere_aprobacion_linea boolean := false;
  v_pl_exact numeric; l_pl numeric; l_desc numeric; l_cont numeric; l_man numeric; l_flete numeric; l_iva numeric;
  v_total numeric; v_claim numeric; v_hash text; v_last_hash text; v_last_rev int; v_rev int;
  pt jsonb; v_res jsonb; v_special jsonb; v_pl_auth numeric; v_desc numeric; v_pf_auth numeric; v_pu numeric; v_pid bigint;
  v_pid_txt text; v_ver_txt text; v_var_txt text; v_lpi_txt text;
  v_gate jsonb; v_state text; v_is_special boolean;
begin
  if p_cotizacion_id is null then raise exception 'emitir_revision_v2: se requiere cotizacion_id'; end if;
  if p_snapshot is null or jsonb_array_length(coalesce(p_snapshot->'partidas','[]'::jsonb)) = 0 then
    raise exception 'emitir_revision_v2: snapshot sin partidas';
  end if;

  select c.folio, c.cliente, (c.usuario = ident or public.puede_editar_config())
    into v_folio, v_cliente, v_puede from public.cotizaciones c where c.id = p_cotizacion_id;
  if not found then raise exception 'emitir_revision_v2: la cotizacion % no existe', p_cotizacion_id; end if;
  if v_puede is not true then raise exception 'emitir_revision_v2: sin permiso sobre la cotizacion %', p_cotizacion_id; end if;

  -- Gate único: integridad + economía + aprobación para el hash exacto.
  v_gate := public.evaluar_emision_cotizacion(p_cotizacion_id,p_snapshot);
  v_state := v_gate->>'state';
  if v_state <> 'ALLOWED' then
    raise exception 'emitir_revision_v2: emisión bloqueada [%]: %', v_state, coalesce((v_gate->'reasons')::text,'[]');
  end if;

  select count(*) into v_malas from jsonb_array_elements(p_snapshot->'partidas') x
    where coalesce((x->>'precioUnitario')::numeric,0) <= 0 or coalesce((x->>'cantidad')::numeric,0) <= 0;
  if v_malas > 0 then raise exception 'emitir_revision_v2: % renglon(es) sin precio o cantidad validos', v_malas; end if;

  v_reglas := public.reglas_comerciales_vigentes(current_date);
  v_desc_max := coalesce((v_reglas->>'descuento_max_sin_aprobacion')::numeric, 0);

  for pt in select * from jsonb_array_elements(p_snapshot->'partidas') loop
    v_pid_txt := coalesce(nullif(pt->>'producto_id',''), nullif(pt->>'productoId',''));
    if v_pid_txt is not null then
      v_pid := v_pid_txt::bigint;
      v_ver_txt := coalesce(nullif(pt->>'producto_version_id',''), nullif(pt->>'productoVersionId',''), nullif(pt->>'product_version_id',''));
      v_var_txt := coalesce(nullif(pt->>'variante_id',''), nullif(pt->>'varianteId',''));
      v_lpi_txt := coalesce(nullif(pt->>'lista_precio_item_id',''), nullif(pt->>'listaPrecioItemId',''));
      if v_ver_txt is null then
        raise exception 'emitir_revision_v2: producto % sin product_version_id canónico', v_pid;
      end if;

      v_is_special := false;
      v_res := public.resolver_precio_autorizado(
        v_pid,
        v_ver_txt::bigint,
        case when v_var_txt is null then null else v_var_txt::bigint end,
        current_date,
        coalesce(nullif(pt->>'moneda',''), 'MXN')
      );

      if not coalesce((v_res->>'ok')::boolean,false) then
        if v_var_txt is not null then
          raise exception 'emitir_revision_v2: producto % sin precio autorizado (%)', v_pid, coalesce(v_res->>'motivo','?');
        end if;
        v_special := public.resolver_precio_especial_proyecto(
          v_pid,
          v_ver_txt::bigint,
          current_date,
          coalesce(nullif(pt->>'moneda',''), 'MXN')
        );
        if not coalesce((v_special->>'ok')::boolean,false) then
          raise exception 'emitir_revision_v2: producto % sin precio autorizado ni especial válido (%)', v_pid, coalesce(v_special->>'motivo',v_res->>'motivo','?');
        end if;
        if v_special->>'commercial_state' <> 'AUTHORIZED_PROJECT_SPECIAL' then
          raise exception 'emitir_revision_v2: especial % aún no tiene ingeniería aprobada (%)', v_pid, coalesce(v_special->>'commercial_state','?');
        end if;
        v_res := v_special;
        v_is_special := true;
      end if;

      v_pl_auth := (v_res->>'precio_lista')::numeric;
      begin v_desc := coalesce(nullif(pt->>'descuento',''),nullif(pt->>'descuento_solicitado',''),'0')::numeric; exception when others then v_desc:=null; end;
      if v_desc is null or v_desc < 0 or v_desc > 100 then raise exception 'emitir_revision_v2: descuento invalido en producto %', v_pid; end if;
      if v_desc > v_desc_max then v_requiere_aprobacion_linea := true; end if;
      if v_is_special and v_res->>'economia_estado' in ('ESTIMATED','USER_APPROVED_ESTIMATE') then v_requiere_aprobacion_linea := true; end if;

      v_pf_auth := round(v_pl_auth * (1 - v_desc/100),2);
      v_pu := round((pt->>'precioUnitario')::numeric,2);
      if v_pu <> v_pf_auth then
        raise exception 'emitir_revision_v2: precioUnitario (%) != precio autoritativo (%) en producto %', v_pu, v_pf_auth, v_pid;
      end if;

      if v_is_special then
        if v_lpi_txt is not null then
          raise exception 'emitir_revision_v2: un especial de proyecto no debe traer lista_precio_item_id (%)', v_lpi_txt;
        end if;
      elsif v_lpi_txt is not null and v_lpi_txt::bigint <> (v_res->>'lista_precio_item_id')::bigint then
        raise exception 'emitir_revision_v2: lista_precio_item_id no coincide en producto %', v_pid;
      end if;
    end if;
  end loop;

  l_pl    := coalesce((p_snapshot#>>'{totales,precioLista}')::numeric, 0);
  l_desc  := coalesce((p_snapshot#>>'{totales,descuento}')::numeric, 0);
  l_cont  := coalesce((p_snapshot#>>'{totales,contingencia}')::numeric, 0);
  l_man   := coalesce((p_snapshot#>>'{totales,maniobras}')::numeric, 0);
  l_flete := coalesce((p_snapshot#>>'{totales,flete}')::numeric, 0);
  l_iva   := coalesce((p_snapshot#>>'{totales,iva}')::numeric, 0);
  v_total := l_pl - l_desc + l_cont + l_man + l_flete + l_iva;
  v_claim := (p_snapshot->>'total')::numeric;
  if v_claim is null or v_claim <> v_total then
    raise exception 'emitir_revision_v2: el total (%) no es la suma exacta del desglose (%)', v_claim, v_total;
  end if;
  v_pl_exact := coalesce((select sum(round((x->>'precioUnitario')::numeric*(x->>'cantidad')::numeric,2))
                          from jsonb_array_elements(p_snapshot->'partidas') x),0);
  if round(l_pl,2) <> round(v_pl_exact,2) then
    raise exception 'emitir_revision_v2: precioLista (%) no coincide con la suma de partidas (%)', l_pl, round(v_pl_exact,2);
  end if;

  v_hash := public.hash_revision(p_snapshot);
  if v_requiere_aprobacion_linea or public.requiere_aprobacion_snapshot(p_snapshot) then
    if not coalesce((public.verificar_aprobacion(p_cotizacion_id, v_hash)->>'aprobada')::boolean, false) then
      raise exception 'emitir_revision_v2: aprobación de Dirección no vigente para esta versión exacta';
    end if;
  end if;

  perform pg_advisory_xact_lock(p_cotizacion_id);
  select hash, revision into v_last_hash, v_last_rev
    from public.cotizaciones_revisiones where cotizacion_id = p_cotizacion_id order by revision desc limit 1;
  if v_last_hash is not null and v_last_hash = v_hash then
    return jsonb_build_object('revision', v_last_rev, 'nueva', false, 'total', v_total, 'v', 2, 'gate','ALLOWED');
  end if;
  v_rev := coalesce(v_last_rev,0) + 1;
  insert into public.cotizaciones_revisiones (cotizacion_id, folio, cliente, revision, usuario, total, hash, snapshot, tipo)
    values (p_cotizacion_id, v_folio, v_cliente, v_rev, ident, v_total, v_hash, p_snapshot, 'generado_v2');
  return jsonb_build_object('revision', v_rev, 'nueva', true, 'total', v_total, 'v', 2, 'gate','ALLOWED');
end;
$function$;

-- ---------------------------------------------------------------------------
-- private_api.evaluar_emision_cotizacion
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.evaluar_emision_cotizacion(p_cotizacion_id bigint, p_snapshot jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := auth.jwt()->>'email';
  v_c public.cotizaciones%rowtype;
  v_reasons text[] := '{}';
  v_econ_reasons text[] := '{}';
  v_approval_reasons text[] := '{}';
  v_hash text;
  v_requires_approval boolean := false;
  v_approved boolean := false;
  v_count int; v_db_count int;
  v_pt jsonb; v_dbpt jsonb; v_ord bigint;
  v_qty numeric; v_price numeric; v_cost numeric;
  v_pid_txt text; v_pvid_txt text; v_pvid bigint; v_pid bigint; v_cost_ref numeric;
  v_snap_identity text; v_db_identity text;
  v_rules jsonb; v_min_margin numeric;
  v_margin numeric;
  v_prod_source text; v_pv_state text;
  v_special jsonb; v_special_cost_state text; v_special_commercial_state text;
  v_desc numeric; v_expected_price numeric;
begin
  if v_email is null or not public.puede_entrar() then
    return jsonb_build_object('state','BLOCKED','reasons',jsonb_build_array('no_autorizado'));
  end if;

  select * into v_c from public.cotizaciones where id=p_cotizacion_id;
  if not found then return jsonb_build_object('state','BLOCKED','reasons',jsonb_build_array('cotizacion_no_existe')); end if;
  if not (v_c.usuario=v_email or public.puede_editar_config()) then
    return jsonb_build_object('state','BLOCKED','reasons',jsonb_build_array('sin_permiso'));
  end if;

  if p_snapshot is null or jsonb_typeof(coalesce(p_snapshot->'partidas','null'::jsonb)) <> 'array' then
    return jsonb_build_object('state','BLOCKED','reasons',jsonb_build_array('snapshot_sin_partidas'));
  end if;

  v_rules := public.reglas_comerciales_vigentes(current_date);
  begin v_min_margin := nullif(v_rules->>'margen_minimo_pct','')::numeric; exception when others then v_min_margin:=null; end;
  if v_min_margin is null then
    return jsonb_build_object('state','BLOCKED','reasons',jsonb_build_array('politica_comercial_sin_margen_minimo'));
  end if;

  v_count := jsonb_array_length(p_snapshot->'partidas');
  v_db_count := jsonb_array_length(coalesce(v_c.partidas,'[]'::jsonb));
  if v_count=0 then v_reasons := array_append(v_reasons,'snapshot_sin_partidas'); end if;
  if v_count<>v_db_count then v_reasons := array_append(v_reasons,'partidas_no_corresponden_a_cotizacion'); end if;

  for v_pt, v_ord in select value, ordinality from jsonb_array_elements(p_snapshot->'partidas') with ordinality loop
    begin v_qty := nullif(v_pt->>'cantidad','')::numeric; exception when others then v_qty:=null; end;
    begin v_price := nullif(v_pt->>'precioUnitario','')::numeric; exception when others then v_price:=null; end;
    if v_qty is null or v_qty<=0 then v_reasons:=array_append(v_reasons,format('linea_%s_cantidad_invalida',v_ord)); end if;
    if v_price is null or v_price<=0 then v_reasons:=array_append(v_reasons,format('linea_%s_precio_invalido',v_ord)); end if;

    select value into v_dbpt from jsonb_array_elements(coalesce(v_c.partidas,'[]'::jsonb)) with ordinality d(value,ord) where ord=v_ord;
    if v_dbpt is null then v_reasons:=array_append(v_reasons,format('linea_%s_sin_correspondencia',v_ord)); continue; end if;

    v_snap_identity := coalesce(nullif(v_pt->>'id',''),nullif(v_pt->>'piezaId',''),nullif(v_pt->>'producto_id',''),nullif(v_pt->>'productoId',''),nullif(v_pt->>'nombre',''));
    v_db_identity := coalesce(nullif(v_dbpt->>'id',''),nullif(v_dbpt->>'piezaId',''),nullif(v_dbpt->>'producto_id',''),nullif(v_dbpt->>'productoId',''),nullif(v_dbpt->>'nombre',''));
    if v_snap_identity is null or v_db_identity is null or v_snap_identity<>v_db_identity then
      v_reasons:=array_append(v_reasons,format('linea_%s_identidad_no_coincide',v_ord)); continue;
    end if;

    v_pid_txt := coalesce(nullif(v_pt->>'producto_id',''),nullif(v_pt->>'productoId',''),nullif(v_pt->>'product_id',''));
    v_pvid_txt := coalesce(nullif(v_pt->>'producto_version_id',''),nullif(v_pt->>'productoVersionId',''),nullif(v_pt->>'product_version_id',''));
    v_cost_ref:=null; v_pvid:=null; v_pid:=null; v_cost:=null; v_prod_source:=null; v_pv_state:=null; v_special:=null;

    -- Dos mundos explícitos:
    -- 1) canónico: producto_id y producto_version_id numéricos;
    -- 2) legacy: clave textual sin ProductVersion, cuyo costo histórico se toma SOLO de la fila persistida.
    if v_pid_txt is not null then
      if v_pid_txt ~ '^[0-9]+$' then
        v_pid:=v_pid_txt::bigint;
      elsif v_pvid_txt is not null then
        v_reasons:=array_append(v_reasons,format('linea_%s_producto_id_invalido',v_ord));
      end if;
    end if;

    if v_pvid_txt is not null then
      if v_pvid_txt ~ '^[0-9]+$' then
        v_pvid:=v_pvid_txt::bigint;
      else
        v_reasons:=array_append(v_reasons,format('linea_%s_producto_version_id_invalido',v_ord));
      end if;
    end if;

    if v_pid is not null and v_pvid is null then
      v_reasons:=array_append(v_reasons,format('linea_%s_sin_product_version_id',v_ord));
    elsif v_pid is null and v_pvid is not null then
      v_reasons:=array_append(v_reasons,format('linea_%s_sin_product_id',v_ord));
    end if;

    if v_pid is not null and v_pvid is not null then
      select p.source_type,pv.estado_tecnico,e.costo_oficial_referencia
        into v_prod_source,v_pv_state,v_cost_ref
      from public.productos p
      join public.producto_versiones pv on pv.producto_id=p.id and pv.id=v_pvid
      left join public.producto_version_economia e on e.producto_version_id=pv.id
      where p.id=v_pid;
      if not found then
        v_reasons:=array_append(v_reasons,format('linea_%s_product_version_no_corresponde',v_ord));
      elsif v_prod_source='expediente' then
        v_special := public.resolver_precio_especial_proyecto(v_pid,v_pvid,current_date,coalesce(nullif(v_pt->>'moneda',''),'MXN'));
        if not coalesce((v_special->>'ok')::boolean,false) then
          if v_special->>'motivo'='ECONOMICS_INCOMPLETE' then
            v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_especial_desconocido',v_ord));
          else
            v_reasons:=array_append(v_reasons,format('linea_%s_especial_%s',v_ord,coalesce(v_special->>'motivo','invalido')));
          end if;
        else
          v_special_cost_state:=v_special->>'economia_estado';
          v_special_commercial_state:=v_special->>'commercial_state';
          begin v_cost:=nullif(v_special->>'costo_interno','')::numeric; exception when others then v_cost:=null; end;
          if v_special_commercial_state='PRELIMINARY_SPECIAL' then
            v_reasons:=array_append(v_reasons,format('linea_%s_ingenieria_preliminar',v_ord));
          end if;
          if v_special_cost_state in ('ESTIMATED','USER_APPROVED_ESTIMATE') then
            v_approval_reasons:=array_append(v_approval_reasons,format('linea_%s_costo_especial_no_certificado',v_ord));
          elsif v_special_cost_state is null or v_special_cost_state='ECONOMICS_INCOMPLETE' then
            v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_especial_desconocido',v_ord));
          end if;

          begin v_desc:=coalesce(nullif(v_pt->>'descuento',''),nullif(v_pt->>'descuento_solicitado',''),'0')::numeric; exception when others then v_desc:=null; end;
          if v_desc is null or v_desc<0 or v_desc>100 then
            v_reasons:=array_append(v_reasons,format('linea_%s_descuento_invalido',v_ord));
          elsif v_price is not null and v_price>0 then
            v_expected_price:=round((v_special->>'precio_lista')::numeric*(1-v_desc/100),2);
            if round(v_price,2)<>v_expected_price then
              v_reasons:=array_append(v_reasons,format('linea_%s_precio_especial_no_autoritativo',v_ord));
            end if;
          end if;
        end if;
      else
        if v_cost_ref is not null and v_cost_ref>0 then v_cost:=v_cost_ref;
        else v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_productversion_desconocido',v_ord)); end if;
      end if;
    else
      -- Sólo legacy sin ProductVersion: nunca se confía en el costo del snapshot recibido;
      -- se usa exclusivamente el costo histórico persistido en la cotización.
      begin v_cost:=nullif(v_dbpt->>'costoUnitario','')::numeric; exception when others then v_cost:=null; end;

      -- Las líneas nuevas del Costeador guardan el veredicto del servidor. Un costo
      -- PRELIMINAR puede vivir en borrador, pero no convertirse en emisión definitiva.
      -- Las cotizaciones legacy que no traen costoEstado conservan su tratamiento histórico.
      if lower(coalesce(v_dbpt->>'costoEstado','')) = 'preliminar' then
        v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_preliminar_no_certificado',v_ord));
      elsif lower(coalesce(v_dbpt->>'costoEstado','')) in ('incompleto','bloqueado') then
        v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_no_certificado',v_ord));
      end if;
    end if;

    if v_cost is null or v_cost<=0 then
      if not (v_pid is not null and cardinality(v_econ_reasons)>0) then
        v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_desconocido',v_ord));
      end if;
    elsif v_price is not null and v_price>0 then
      v_margin := ((v_price-v_cost)/v_price)*100;
      if v_price < v_cost then
        v_approval_reasons:=array_append(v_approval_reasons,format('linea_%s_precio_bajo_costo',v_ord));
      elsif v_margin < v_min_margin then
        v_approval_reasons:=array_append(v_approval_reasons,format('linea_%s_margen_bajo_%s',v_ord,trim(to_char(v_min_margin,'FM999990D99'))));
      end if;
    end if;
  end loop;

  select coalesce(array_agg(distinct x),'{}'::text[]) into v_reasons from unnest(v_reasons) x;
  select coalesce(array_agg(distinct x),'{}'::text[]) into v_econ_reasons from unnest(v_econ_reasons) x;
  select coalesce(array_agg(distinct x),'{}'::text[]) into v_approval_reasons from unnest(v_approval_reasons) x;

  v_hash := public.hash_revision(p_snapshot);
  v_requires_approval := public.requiere_aprobacion_snapshot(p_snapshot) or cardinality(v_approval_reasons)>0;
  if v_requires_approval then
    v_approved := coalesce((public.verificar_aprobacion(p_cotizacion_id,v_hash)->>'aprobada')::boolean,false);
  else v_approved:=true; end if;

  if cardinality(v_reasons)>0 then
    return jsonb_build_object('state','BLOCKED','reasons',to_jsonb(v_reasons),'economics',to_jsonb(v_econ_reasons),'approval_reasons',to_jsonb(v_approval_reasons),'hash',v_hash,'approval_required',v_requires_approval,'approved',v_approved,'margen_minimo_pct',v_min_margin);
  end if;
  if cardinality(v_econ_reasons)>0 then
    return jsonb_build_object('state','ECONOMICS_INCOMPLETE','reasons',to_jsonb(v_econ_reasons),'approval_reasons',to_jsonb(v_approval_reasons),'hash',v_hash,'approval_required',v_requires_approval,'approved',v_approved,'margen_minimo_pct',v_min_margin);
  end if;
  if not v_approved then
    return jsonb_build_object('state','APPROVAL_REQUIRED','reasons',case when cardinality(v_approval_reasons)>0 then to_jsonb(v_approval_reasons) else jsonb_build_array('aprobacion_requerida_para_hash') end,'hash',v_hash,'approval_required',true,'approved',false,'margen_minimo_pct',v_min_margin);
  end if;
  return jsonb_build_object('state','ALLOWED','reasons','[]'::jsonb,'approval_reasons',to_jsonb(v_approval_reasons),'hash',v_hash,'approval_required',v_requires_approval,'approved',v_approved,'margen_minimo_pct',v_min_margin);
end;
$function$;

