-- ============================================================================
--  VH-100 (P0-01) · CARGA del COSTO INDUSTRIAL OFICIAL por ProductVersion.
--  ⚠️ PROPUESTA, NO MIGRACIÓN (renombrada el 14-oct-2026 desde 20261012061000_vh100_…: con prefijo de fecha
--  `supabase db push` la habría aplicado). No aplicar sin autorización expresa de Dirección.
--
--  CAMBIOS 14-oct (Operación 9.5, OP9.5-03):
--   · ROL: antes aceptaba `auth.jwt()->'user_metadata'->>'rol'`, que el propio usuario edita con
--     supabase.auth.updateUser({data:{rol:'direccion'}}): un vendedor podía cargar costos oficiales. Y
--     `puede_editar_config()` dejaba entrar a Diseño. Ahora: service_role o `permitidos.rol = 'direccion'`, y nunca
--     una cuenta listada en `cuentas_no_humanas` (SEG-01c) — la cuenta QA tiene rol direccion y no debe cargar costos.
--   · HISTORIAL: el `on conflict do update` pisaba el costo anterior sin rastro. Ahora cada sobrescritura deja la fila
--     previa en public.producto_version_economia_historial (quién, cuándo, documento nuevo).
--   · PROCEDENCIA: `documento · fecha · sha256:<64 hex> · email` (antes 16 hex).
--   · ESCRITURA DIRECTA: la política pm_eco_all (cmd *, `puede_ver_economia()`) deja a Dirección —incluida la cuenta
--     QA— INSERT/UPDATE/DELETE directo por PostgREST sin procedencia. El cliente sólo LEE esta tabla (grep src/ y
--     supabase/functions 14-oct); las funciones que escriben son SECURITY DEFINER. Se revoca la escritura directa a
--     `authenticated`; la lectura queda igual.
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
--  p_filas: [{codigo, costo, moneda?, fecha?, formula_version?, producto_id?}, …]
--  (producto_id es obligatorio cuando el código está duplicado en productos)
-- ============================================================================
begin;

create table if not exists public.producto_version_economia_historial (
  id bigint generated always as identity primary key,
  producto_version_id bigint not null,
  costo_anterior numeric,
  formula_version_anterior text,
  fuente_anterior text,
  actualizado_anterior timestamptz,
  reemplazado_en timestamptz not null default now(),
  reemplazado_por text not null,
  documento_nuevo text not null
);
alter table public.producto_version_economia_historial enable row level security;
revoke all on table public.producto_version_economia_historial from public, anon, authenticated;
grant select on table public.producto_version_economia_historial to service_role;

create or replace function public.cargar_costos_oficiales(p_documento text, p_filas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private_api'
as $$
declare
  f jsonb; v_codigo text; v_costo numeric; v_moneda text; v_fecha date; v_pv bigint;
  n_ok int := 0; n_sin_producto int := 0; n_sin_costo int := 0; rechazadas jsonb := '[]'::jsonb;
  v_hash text; v_rol text; v_email text; v_no_humana boolean;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if coalesce(auth.role(), '') <> 'service_role' then
    -- El rol sale SÓLO de `permitidos` (lo administra Dirección), nunca de metadatos del JWT que el usuario edita.
    select lower(p.rol) into v_rol from public.permitidos p where lower(p.email) = v_email limit 1;
    if v_email = '' or coalesce(v_rol, '') <> 'direccion' then
      raise exception 'no autorizado: sólo Dirección carga costos oficiales';
    end if;
    -- Fail-closed: sin la lista de cuentas no humanas (SEG-01c) no se puede descartar la cuenta QA ⇒ no se carga.
    if to_regclass('public.cuentas_no_humanas') is null then
      raise exception 'no autorizado: falta public.cuentas_no_humanas (aplicar SEG-01c antes)';
    end if;
    execute 'select exists(select 1 from public.cuentas_no_humanas where lower(email) = $1)' into v_no_humana using v_email;
    if v_no_humana then
      raise exception 'no autorizado: % es una cuenta no humana (pruebas/proceso)', v_email;
    end if;
  end if;
  if coalesce(btrim(p_documento), '') = '' then raise exception 'documento requerido (nombre + fecha del reporte Intelisis)'; end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then raise exception 'p_filas debe ser un arreglo'; end if;
  -- pgcrypto vive en el esquema `extensions` en Supabase (verificado 2026-10-13): sin calificar, `digest` no existe
  -- con este search_path y la carga fallaba en la primera fila.
  v_hash := encode(extensions.digest(p_filas::text, 'sha256'), 'hex');

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
    -- 2026-10-13: hay códigos DUPLICADOS en productos (ATOM3, ATPU2M/3M/4M/75M, ATFAL150ABS: el artículo ERP y
    -- una ficha "App LT · …"). Con `limit 1` el costo caía en cualquiera de los dos. Ahora: con más de un producto
    -- activo para el código, se exige `producto_id` explícito en la fila; si no viene, se RECHAZA (no se adivina).
    if (select count(*) from public.productos p where p.codigo = v_codigo and p.activo) > 1 and nullif(f->>'producto_id', '') is null then
      rechazadas := rechazadas || jsonb_build_object('codigo', v_codigo, 'motivo', 'CODIGO_DUPLICADO',
        'productos', (select jsonb_agg(p.id order by p.id) from public.productos p where p.codigo = v_codigo and p.activo));
      n_sin_producto := n_sin_producto + 1; continue;
    end if;
    select coalesce(p.version_tecnica_vigente_id, (select pv.id from public.producto_versiones pv where pv.producto_id = p.id order by pv.creado desc limit 1))
      into v_pv from public.productos p
     where p.codigo = v_codigo and p.activo and (nullif(f->>'producto_id', '') is null or p.id = (f->>'producto_id')::bigint)
     limit 1;
    if v_pv is null then n_sin_producto := n_sin_producto + 1; rechazadas := rechazadas || jsonb_build_object('codigo', v_codigo, 'motivo', 'SIN_PRODUCTO'); continue; end if;
    -- Historial: la fila que se va a sobrescribir queda registrada antes (nunca se pierde un costo oficial).
    insert into public.producto_version_economia_historial (producto_version_id, costo_anterior, formula_version_anterior, fuente_anterior, actualizado_anterior, reemplazado_por, documento_nuevo)
    select e.producto_version_id, e.costo_oficial_referencia, e.formula_version, e.fuente, e.actualizado, coalesce(nullif(v_email, ''), 'service'), p_documento
      from public.producto_version_economia e where e.producto_version_id = v_pv;
    insert into public.producto_version_economia (producto_version_id, costo_oficial_referencia, formula_version, fuente, actualizado)
    values (v_pv, v_costo, coalesce(nullif(f->>'formula_version', ''), 'intelisis-reporte'),
            format('%s · %s · sha256:%s · %s', p_documento, v_fecha, v_hash, coalesce(nullif(v_email, ''), 'service')), now())
    on conflict (producto_version_id) do update
      set costo_oficial_referencia = excluded.costo_oficial_referencia, formula_version = excluded.formula_version, fuente = excluded.fuente, actualizado = now();
    n_ok := n_ok + 1;
  end loop;
  return jsonb_build_object('ok', true, 'documento', p_documento, 'hash', v_hash, 'cargados', n_ok, 'sin_producto', n_sin_producto, 'sin_costo', n_sin_costo, 'rechazadas', rechazadas);
end;
$$;
revoke all on function public.cargar_costos_oficiales(text, jsonb) from public, anon;
-- Reauditoría v2 · P2-01: la rama service_role (carga por proceso) se concede EXPLÍCITA. En producción ya la daba el
-- privilegio por omisión de `postgres` en public (pg_default_acl, verificado 14-oct: service_role=X); explícito no depende de él.
grant execute on function public.cargar_costos_oficiales(text, jsonb) to authenticated, service_role;

-- Escritura directa cerrada: sólo las funciones SECURITY DEFINER (esta carga, registrar_producto_desde_expediente)
-- escriben la economía oficial. La lectura de Dirección (política pm_eco_all) no cambia.
revoke insert, update, delete on table public.producto_version_economia from authenticated, anon;

commit;

-- ============================================================================
--  ROLLBACK (líneas `-- RB `): quita la función y devuelve la escritura directa. El historial se conserva.
-- RB begin;
-- RB drop function if exists public.cargar_costos_oficiales(text, jsonb);
-- RB grant insert, update, delete on table public.producto_version_economia to authenticated;
-- RB commit;
-- ============================================================================
