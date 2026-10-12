-- ============================================================================
--  VH-100 (P0-01) · CARGA del COSTO INDUSTRIAL OFICIAL por ProductVersion.
--  NO APLICADA en producción (RC): requiere autorización de Dirección.
--
--  Medido 2026-10-12: 1,931 partidas de lista con precio y SIN economía
--  (producto_version_economia tiene 12 filas: 2 expedientes reales + 10 fixtures
--  QA). cotizar-servidor y evaluar_emision_cotizacion bloquean con
--  ECONOMICS_INCOMPLETE (correcto: no se inventa costo). La fuente oficial del
--  costo de línea es el ERP Intelisis (reporte "Explosión/costo de producto",
--  clave = productos.codigo, p. ej. ATACM, ACGNBIO, ABACOM60). Este RPC es el
--  vínculo: Dirección sube el reporte (documento con fecha + hash) y cada fila
--  queda en producto_version_economia con su procedencia. NUNCA deriva costo
--  desde precio de venta ni aplica márgenes.
--
--  p_filas: [{codigo, costo, moneda?, fecha?, formula_version?}, …]
-- ============================================================================
create or replace function public.cargar_costos_oficiales(p_documento text, p_filas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private_api'
as $$
declare
  f jsonb; v_codigo text; v_costo numeric; v_moneda text; v_fecha date; v_pv bigint;
  n_ok int := 0; n_sin_producto int := 0; n_sin_costo int := 0; rechazadas jsonb := '[]'::jsonb;
  v_hash text; v_rol text;
begin
  v_rol := coalesce(auth.jwt() -> 'app_metadata' ->> 'rol', auth.jwt() -> 'user_metadata' ->> 'rol', '');
  if not (coalesce(auth.role(), '') = 'service_role' or v_rol = 'direccion' or private_api.puede_editar_config()) then
    raise exception 'no autorizado: sólo Dirección carga costos oficiales';
  end if;
  if coalesce(btrim(p_documento), '') = '' then raise exception 'documento requerido (nombre + fecha del reporte Intelisis)'; end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then raise exception 'p_filas debe ser un arreglo'; end if;
  v_hash := encode(digest(p_filas::text, 'sha256'), 'hex');

  for f in select * from jsonb_array_elements(p_filas) loop
    v_codigo := nullif(btrim(f->>'codigo'), '');
    v_costo := nullif(f->>'costo', '')::numeric;
    v_moneda := coalesce(nullif(upper(f->>'moneda'), ''), 'MXN');
    v_fecha := coalesce(nullif(f->>'fecha', '')::date, current_date);
    if v_codigo is null or v_costo is null or v_costo <= 0 then
      n_sin_costo := n_sin_costo + 1; rechazadas := rechazadas || jsonb_build_object('codigo', v_codigo, 'motivo', 'SIN_COSTO'); continue;
    end if;
    if v_moneda <> 'MXN' then
      -- Sin tipo de cambio documentado no se convierte: se rechaza, no se adivina.
      rechazadas := rechazadas || jsonb_build_object('codigo', v_codigo, 'motivo', 'MONEDA_NO_MXN'); n_sin_costo := n_sin_costo + 1; continue;
    end if;
    select coalesce(p.version_tecnica_vigente_id, (select pv.id from public.producto_versiones pv where pv.producto_id = p.id order by pv.creado desc limit 1))
      into v_pv from public.productos p where p.codigo = v_codigo and p.activo limit 1;
    if v_pv is null then n_sin_producto := n_sin_producto + 1; rechazadas := rechazadas || jsonb_build_object('codigo', v_codigo, 'motivo', 'SIN_PRODUCTO'); continue; end if;
    insert into public.producto_version_economia (producto_version_id, costo_oficial_referencia, formula_version, fuente, actualizado)
    values (v_pv, v_costo, coalesce(nullif(f->>'formula_version', ''), 'intelisis-reporte'),
            format('%s · %s · sha256:%s · %s', p_documento, v_fecha, left(v_hash, 16), coalesce(auth.jwt() ->> 'email', 'service')), now())
    on conflict (producto_version_id) do update
      set costo_oficial_referencia = excluded.costo_oficial_referencia, formula_version = excluded.formula_version, fuente = excluded.fuente, actualizado = now();
    n_ok := n_ok + 1;
  end loop;
  return jsonb_build_object('ok', true, 'documento', p_documento, 'hash', v_hash, 'cargados', n_ok, 'sin_producto', n_sin_producto, 'sin_costo', n_sin_costo, 'rechazadas', rechazadas);
end;
$$;
revoke all on function public.cargar_costos_oficiales(text, jsonb) from public, anon;
grant execute on function public.cargar_costos_oficiales(text, jsonb) to authenticated;
