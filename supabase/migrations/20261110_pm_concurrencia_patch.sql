-- ============================================================================
--  PARCHE DE CONCURRENCIA (P1) de guardar_producto_maestro — 2026-11-10.
--  PROPUESTO · NO APLICADO. Aplicar a prod SÓLO con autorización de Dirección.
--
--  La RPC desplegada (14 args) hacía: SELECT version ... WHERE clave; chequeo de
--  version; y UPDATE ... WHERE clave (sólo por clave). Bajo DOS conexiones
--  READ COMMITTED concurrentes sobre la misma clave eso es un LOST UPDATE: ambas
--  leen version=1, ambas pasan el chequeo y ambas escriben → una se pierde.
--
--  Fix (CREATE OR REPLACE, MISMA firma de 14 args → SIN drop, no cuelga el MCP):
--    · pg_advisory_xact_lock por clave → serializa read-check-write (y el alta de
--      una clave nueva: la 2a conexión espera y ve "ya existe").
--    · SELECT ... FOR UPDATE → bloquea la fila existente desde la lectura.
--    · UPDATE ... WHERE clave AND version = v_ver_actual + `if not found` →
--      actualización condicional ATÓMICA: si la version cambió, 0 filas → VERSION_CONFLICT.
--  No cambia precios, factores, BOM ni aprobaciones. No toca datos.
--
--  APLICAR: ejecutar este CREATE OR REPLACE (apply_migration o SQL editor). Es
--  idempotente y reversible (CREATE OR REPLACE a la versión previa).
-- ============================================================================
create or replace function public.guardar_producto_maestro(
  p_clave text, p_nombre text, p_lineas jsonb,
  p_factor_mo numeric, p_factor_gif numeric, p_material_real numeric,
  p_cos_fab_calculado numeric default null,
  p_cos_fab_real numeric default null,
  p_dims_mm integer[] default null,
  p_tipo_bom text default 'BOM_BORRADOR',
  p_fuente text default null,
  p_version_anterior integer default null,
  p_sustituir boolean default false,
  p_sustituir_verificado boolean default false
) returns jsonb
language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_ver_actual integer; v_tipo_actual text; v_existe boolean := false;
  v_nueva_ver integer; v_accion text; v_pend integer; v_huella text;
begin
  if not public.puede_certificar_costo() then
    raise exception 'no autorizado: solo Direccion (persona real) confirma un despiece como Producto Maestro';
  end if;
  if p_clave is null or btrim(p_clave) = '' then raise exception 'falta la clave'; end if;
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'faltan las lineas del despiece';
  end if;
  if p_material_real is null or p_material_real <= 0 then raise exception 'material_real invalido'; end if;
  if p_tipo_bom not in ('BOM_BORRADOR','BOM_REVISADO','BOM_DETALLADO_VERIFICADO','AGREGADO_HISTORICO') then
    raise exception 'tipo_bom invalido: %', p_tipo_bom;
  end if;

  -- CONCURRENCIA: serializa por clave (read-check-write atómico).
  perform pg_advisory_xact_lock(hashtext('producto_maestro:' || btrim(p_clave)));

  select count(*) into v_pend from jsonb_array_elements(p_lineas) l
   where coalesce((l->>'pendiente')::boolean, false) = true
      or nullif(btrim(coalesce(l->>'insumoId','')), '') is null
      or coalesce((l->>'cantidad')::numeric, 0) <= 0
      or nullif(btrim(coalesce(l->>'unidad','')), '') is null;

  if p_tipo_bom = 'BOM_DETALLADO_VERIFICADO' and v_pend > 0 then
    raise exception 'BOM_DETALLADO_VERIFICADO rechazado: % linea(s) pendiente(s) (sin insumoId, sin cantidad fisica o sin unidad). Guarda como BOM_BORRADOR.', v_pend;
  end if;

  v_huella := md5(coalesce(p_lineas::text,'') || '|' || coalesce(p_material_real::text,'') || '|' || coalesce(p_tipo_bom,''));

  select version, coalesce(estado_bom, tipo_bom) into v_ver_actual, v_tipo_actual
    from public.producto_maestro where clave = btrim(p_clave) for update;
  v_existe := found;

  if v_existe then
    if not coalesce(p_sustituir, false) then
      raise exception 'ya existe un Producto Maestro para "%" (version %). Para sustituirlo, confirma explicitamente (p_sustituir).', btrim(p_clave), v_ver_actual;
    end if;
    if p_version_anterior is distinct from v_ver_actual then
      raise exception 'VERSION_CONFLICT: "%" fue modificado por otra sesion (version actual %, tu esperabas %). Reabre y reintenta.', btrim(p_clave), v_ver_actual, p_version_anterior;
    end if;
    if v_tipo_actual = 'BOM_DETALLADO_VERIFICADO' and not coalesce(p_sustituir_verificado, false) then
      raise exception 'la clave "%" tiene un BOM VERIFICADO; sustituirlo requiere confirmacion explicita (p_sustituir_verificado)', btrim(p_clave);
    end if;
    v_nueva_ver := v_ver_actual + 1; v_accion := 'sustituir';
    update public.producto_maestro set
      nombre = p_nombre, lineas = p_lineas,
      factor_mo = p_factor_mo, factor_gif = p_factor_gif, material_real = p_material_real,
      cos_fab_calculado = coalesce(p_cos_fab_calculado, round(p_material_real * (1 + coalesce(p_factor_mo,0) + coalesce(p_factor_gif,0)), 2)),
      cos_fab_real = p_cos_fab_real,
      dims_mm = coalesce(p_dims_mm, public.producto_maestro.dims_mm),
      tipo_bom = p_tipo_bom, estado_bom = p_tipo_bom,
      fuente = coalesce(nullif(btrim(coalesce(p_fuente,'')),''), 'Confirmado en COSTEAR por ' || v_email),
      version = v_nueva_ver, actualizado_por = v_email, actualizado_en = now(), huella = v_huella
    where clave = btrim(p_clave) and version = v_ver_actual;
    if not found then
      raise exception 'VERSION_CONFLICT: "%" cambió durante el guardado (reabre y reintenta).', btrim(p_clave);
    end if;
  else
    v_nueva_ver := 1; v_accion := 'crear';
    insert into public.producto_maestro
      (clave, nombre, lineas, factor_mo, factor_gif, material_real, cos_fab_calculado, cos_fab_real,
       dims_mm, tipo_bom, estado_bom, fuente, version, creado_por, actualizado_por, creado_en, actualizado_en, huella)
    values
      (btrim(p_clave), p_nombre, p_lineas, p_factor_mo, p_factor_gif, p_material_real,
       coalesce(p_cos_fab_calculado, round(p_material_real * (1 + coalesce(p_factor_mo,0) + coalesce(p_factor_gif,0)), 2)),
       p_cos_fab_real, p_dims_mm, p_tipo_bom, p_tipo_bom,
       coalesce(nullif(btrim(coalesce(p_fuente,'')),''), 'Confirmado en COSTEAR por ' || v_email),
       1, v_email, v_email, now(), now(), v_huella);
  end if;

  insert into public.producto_maestro_historial
    (clave, version, accion, tipo_bom, material_real, cos_fab_calculado, cos_fab_real, n_lineas, n_pendientes, huella, guardado_por, lineas)
  values
    (btrim(p_clave), v_nueva_ver, v_accion, p_tipo_bom, p_material_real,
     coalesce(p_cos_fab_calculado, round(p_material_real * (1 + coalesce(p_factor_mo,0) + coalesce(p_factor_gif,0)), 2)),
     p_cos_fab_real, jsonb_array_length(p_lineas), v_pend, v_huella, v_email, p_lineas);

  return jsonb_build_object('ok', true, 'clave', btrim(p_clave), 'version', v_nueva_ver,
    'accion', v_accion, 'tipo_bom', p_tipo_bom, 'pendientes', v_pend, 'huella', v_huella, 'guardado_por', v_email);
end $$;

revoke all on function public.guardar_producto_maestro(text,text,jsonb,numeric,numeric,numeric,numeric,numeric,integer[],text,text,integer,boolean,boolean) from public, anon;
grant execute on function public.guardar_producto_maestro(text,text,jsonb,numeric,numeric,numeric,numeric,numeric,integer[],text,text,integer,boolean,boolean) to authenticated;
