-- ============================================================================
--  P0 · INTEGRIDAD Y VERSIONADO DE guardar_producto_maestro (2026-11-09).
--  PROPUESTA — NO APLICADA A PRODUCCIÓN. Se prueba en entorno aislado (PGlite) y
--  se aplica SÓLO con autorización explícita de Dirección, junto con el cliente
--  (GuardarProductoMaestro.jsx + productoMaestroDesdeDespiece.js), que es su par.
--
--  Cierra el P0 detectado en la auditoría del 2026-11-08: la RPC previa
--  (20261108_guardar_producto_maestro.sql) (1) confiaba en el tipo_bom que
--  mandara el navegador — podía guardar un BOM incompleto como VERIFICADO; y (2)
--  hacía ON CONFLICT DO UPDATE, sobrescribiendo una clave existente sin versión,
--  sin confirmación de sustitución y sin rastro.
--
--  Esta versión, fail-closed en el BACKEND (no confía en el cliente):
--   1. Estados de BOM explícitos: BOM_BORRADOR (provisional) · BOM_REVISADO ·
--      BOM_DETALLADO_VERIFICADO (certificable) · AGREGADO_HISTORICO.
--   2. VERIFICADO exige integridad comprobada EN EL SERVIDOR: ninguna línea
--      pendiente, toda línea con insumoId, cantidad física > 0 y unidad. Un
--      payload que diga VERIFICADO sin cumplirlo se RECHAZA.
--   3. Control optimista: version por clave. Sobrescribir exige p_sustituir=true
--      y p_version_anterior = versión actual (si no, VERSION_CONFLICT). Sustituir
--      un VERIFICADO exige además p_sustituir_verificado=true.
--   4. Separa COSTO CALCULADO (cos_fab_calculado, factores) de REFERENCIA MEDIDA
--      (cos_fab_real, sólo si viene de fábrica). No vuelve a inventar cos_fab_real.
--   5. Historial append-only: quién guardó qué, con qué huella, en qué versión.
--   6. Conserva la puerta de Dirección (puede_certificar_costo): un vendedor no guarda.
--
--  ROLLBACK:
--    drop function if exists public.guardar_producto_maestro(text,text,jsonb,numeric,numeric,numeric,numeric,numeric,integer[],text,text,integer,boolean,boolean);
--    -- (las columnas y el historial son aditivos; se conservan)
-- ============================================================================
begin;

-- 1) Columnas aditivas de versionado y trazabilidad (idempotentes).
alter table public.producto_maestro add column if not exists version integer not null default 1;
alter table public.producto_maestro add column if not exists cos_fab_calculado numeric;
alter table public.producto_maestro add column if not exists actualizado_por text;
alter table public.producto_maestro add column if not exists huella text;
alter table public.producto_maestro add column if not exists estado_bom text;

-- 2) Historial append-only de Productos Maestros (quién confirmó qué).
create table if not exists public.producto_maestro_historial (
  id bigint generated always as identity primary key,
  clave text not null,
  version integer not null,
  accion text not null,                 -- 'crear' | 'sustituir'
  tipo_bom text not null,
  material_real numeric,
  cos_fab_calculado numeric,
  cos_fab_real numeric,
  n_lineas integer,
  n_pendientes integer,
  huella text,
  guardado_por text not null,
  guardado_en timestamptz not null default now(),
  lineas jsonb                          -- snapshot íntegro (nada se pierde)
);
alter table public.producto_maestro_historial enable row level security;
revoke all on table public.producto_maestro_historial from public, anon, authenticated;
grant select on table public.producto_maestro_historial to service_role;
create or replace function public.producto_maestro_historial_inmutable() returns trigger
  language plpgsql set search_path to '' as 'begin raise exception ''producto_maestro_historial es append-only''; end';
drop trigger if exists trg_pm_historial_inmutable on public.producto_maestro_historial;
create trigger trg_pm_historial_inmutable before update or delete on public.producto_maestro_historial
  for each row execute function public.producto_maestro_historial_inmutable();

-- 3) La RPC gobernada, fail-closed en el servidor.
create or replace function public.guardar_producto_maestro(
  p_clave text, p_nombre text, p_lineas jsonb,
  p_factor_mo numeric, p_factor_gif numeric, p_material_real numeric,
  p_cos_fab_calculado numeric default null,     -- CALCULADO por factores (lo normal al guardar)
  p_cos_fab_real numeric default null,          -- REFERENCIA de fábrica medida (sólo si existe)
  p_dims_mm integer[] default null,
  p_tipo_bom text default 'BOM_BORRADOR',       -- por omisión BORRADOR: verificar es acto explícito
  p_fuente text default null,
  p_version_anterior integer default null,      -- control optimista (null = alta nueva)
  p_sustituir boolean default false,            -- confirmación explícita para sobrescribir
  p_sustituir_verificado boolean default false  -- confirmación extra para sustituir un VERIFICADO
) returns jsonb
language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_ver_actual integer; v_tipo_actual text; v_existe boolean := false;
  v_nueva_ver integer; v_accion text; v_pend integer; v_huella text;
begin
  -- Puerta: sólo Dirección (persona real). Un vendedor jamás guarda un Producto Maestro.
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

  -- Pendientes = líneas sin insumoId, sin cantidad física > 0, sin unidad, o marcadas pendiente.
  select count(*) into v_pend from jsonb_array_elements(p_lineas) l
   where coalesce((l->>'pendiente')::boolean, false) = true
      or nullif(btrim(coalesce(l->>'insumoId','')), '') is null
      or coalesce((l->>'cantidad')::numeric, 0) <= 0
      or nullif(btrim(coalesce(l->>'unidad','')), '') is null;

  -- INTEGRIDAD SERVER-SIDE: un VERIFICADO con cualquier pendiente se RECHAZA (no se confía en el cliente).
  if p_tipo_bom = 'BOM_DETALLADO_VERIFICADO' and v_pend > 0 then
    raise exception 'BOM_DETALLADO_VERIFICADO rechazado: % linea(s) pendiente(s) (sin insumoId, sin cantidad fisica o sin unidad). Guarda como BOM_BORRADOR.', v_pend;
  end if;

  v_huella := md5(coalesce(p_lineas::text,'') || '|' || coalesce(p_material_real::text,'') || '|' || coalesce(p_tipo_bom,''));

  -- ¿Ya existe la clave? (control optimista + confirmación de sustitución)
  select version, coalesce(estado_bom, tipo_bom) into v_ver_actual, v_tipo_actual
    from public.producto_maestro where clave = btrim(p_clave);
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
      cos_fab_real = p_cos_fab_real,     -- sólo referencia medida; NO se inventa desde factores
      dims_mm = coalesce(p_dims_mm, public.producto_maestro.dims_mm),
      tipo_bom = p_tipo_bom, estado_bom = p_tipo_bom,
      fuente = coalesce(nullif(btrim(coalesce(p_fuente,'')),''), 'Confirmado en COSTEAR por ' || v_email),
      version = v_nueva_ver, actualizado_por = v_email, actualizado_en = now(), huella = v_huella
    where clave = btrim(p_clave);
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

commit;
