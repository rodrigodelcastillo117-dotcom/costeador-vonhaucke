// ============================================================================
//  BASE AISLADA DE EMISIÓN (PGlite = PostgreSQL real en WASM). Nada toca producción.
//  Extraída tal cual de supabase/tests/seguridadGateEmisionSnapshot.test.js (2026-10-14) para reutilizarla en
//  src/datos/emissionExactCentsSql.test.js. Cuerpos de private_api: copia EXACTA de producción
//  (fixtures/private_api_emision_prod_20261013.sql, md5 en MD5_PROD); wrappers públicos y triggers: baseline.
// ============================================================================
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

export const RAIZ = new URL('../../../', import.meta.url);   // supabase/tests/fixtures → raíz del repo
export const leer = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');

export function defDeBaseline(nombre) {
  const sql = leer('supabase/schema/baseline/03_funciones.sql');
  const ini = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${nombre}(`);
  if (ini < 0) throw new Error(`no está ${nombre} en el baseline`);
  const fin = sql.indexOf('\n;\n', ini);
  return sql.slice(ini, fin) + ';';
}

// md5(pg_get_functiondef) leídos de producción (mtuvnbgljwbsaizjjgzs) el 2026-10-13.
export const MD5_PROD = {
  'private_api.evaluar_emision_cotizacion': '9c660b09ca099af557436ef54edbb1de',
  'private_api.emitir_revision_v2': 'fb26c9d515ac6116ae87ed44350c3615',
  'private_api.hash_revision': '6290c18df505348c1509e6dc878cf13d',
  'private_api.verificar_aprobacion': 'c9da5e92404bd24f8e7e9d7d09121a31',
  'private_api.requiere_aprobacion_snapshot': '31274e5596116d91659b2253a36d40a6',
  'private_api.asignar_folio_oficial': '33acd273d08c8c45f07b04954d86729e',
};

export const DIRECCION = 'rodrigo@vh.mx', VENDEDOR = 'ventas@vh.mx';

export async function baseAislada() {
  const db = new PGlite();
  const x = (s) => db.exec(s);
  await x(`
    create schema auth; create schema private_api;
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create function auth.uid() returns uuid language sql stable as $$
      select case when coalesce(current_setting('test.email', true), '') = '' then null
        else md5(current_setting('test.email', true))::uuid end $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select case when coalesce(current_setting('test.email', true), '') = '' then null
        else jsonb_build_object('email', current_setting('test.email', true)) end $$;
    create table public.permitidos (email text primary key, nombre text, rol text not null default 'vendedor', creado timestamptz not null default now());
    create table public.cotizaciones (
      id bigserial primary key, creado timestamptz not null default now(), actualizado timestamptz not null default now(),
      usuario text, cliente text, folio text, estado text not null default 'borrador',
      partidas jsonb not null default '[]'::jsonb, acomodo jsonb, totales jsonb, total numeric not null default 0,
      piezas integer not null default 0, huella_mp text, activa boolean not null default true, folio_oficial text,
      cliente_id bigint, contacto_id bigint, proyecto_id bigint);
    create table public.cotizaciones_revisiones (
      id bigint generated always as identity primary key, cotizacion_id bigint, folio text, cliente text,
      revision integer not null, emitida_en timestamptz not null default now(), usuario text, total numeric,
      hash text not null, snapshot jsonb not null, tipo text not null default 'generado',
      constraint uq_revision_por_cotizacion unique (cotizacion_id, revision));
    create table public.aprobaciones (
      id bigint generated always as identity primary key, cotizacion_id bigint, revision_hash text,
      estado text not null default 'PENDIENTE', descuento_solicitado numeric, motivo text, solicitado_por text,
      resuelto_por text, creado timestamptz not null default now(), resuelto_en timestamptz, reglas_version integer);
    create table public.reglas_comerciales (
      id bigint generated always as identity primary key, version integer not null,
      descuento_max_sin_aprobacion numeric not null, margen_minimo_pct numeric, estado text not null default 'approved',
      vigencia_desde date not null default current_date, vigencia_hasta date, aprobado_por text,
      aprobado_en timestamptz not null default now(), fuente text);
    -- Tablas del mundo canónico (sólo para que el SQL compile; este escenario es legacy, sin producto_id).
    create table public.productos (id bigint primary key, source_type text, version_tecnica_vigente_id bigint);
    create table public.producto_versiones (id bigint primary key, producto_id bigint, estado_tecnico text);
    create table public.producto_version_economia (producto_version_id bigint primary key, costo_oficial_referencia numeric);
    create table public.lista_precio_items (id bigint primary key, piso_minimo numeric);
    create sequence public.folio_oficial_seq;
    create function private_api.rol_actual() returns text language sql stable as $$
      select lower(p.rol) from public.permitidos p where lower(p.email)=lower(auth.jwt()->>'email') limit 1 $$;
    create function private_api.puede_entrar() returns boolean language sql stable as $$ select private_api.rol_actual() is not null $$;
    create function private_api.puede_editar_config() returns boolean language sql stable as $$ select private_api.rol_actual() in ('direccion','diseno') $$;
    create function private_api.puede_ver_economia() returns boolean language sql stable as $$ select private_api.rol_actual() = 'direccion' $$;
    create function public.puede_entrar() returns boolean language sql stable as $$ select private_api.puede_entrar() $$;
    create function public.puede_editar_config() returns boolean language sql stable as $$ select private_api.puede_editar_config() $$;
    create function public.puede_ver_economia() returns boolean language sql stable as $$ select private_api.puede_ver_economia() $$;
    insert into public.permitidos(email, rol) values ('${DIRECCION}','direccion'), ('${VENDEDOR}','vendedor');
    -- Política vigente: descuento máx. 10%, margen mínimo 30%.
    insert into public.reglas_comerciales(version, descuento_max_sin_aprobacion, margen_minimo_pct, vigencia_desde)
      values (1, 10, 30, current_date - 1);
  `);
  for (const f of ['normalizar_cost_status_partidas', 'pin_product_versions_in_partidas']) await x(defDeBaseline(f));
  // Triggers de cotizaciones + jsonb_sin_economia: cuerpos de producción (fixture existente de VH-035/VH-148).
  await x(leer('supabase/tests/fixtures/private_api_prod_20261013.sql'));
  // Gate de emisión: cuerpos EXACTOS de producción.
  await x(leer('supabase/tests/fixtures/private_api_emision_prod_20261013.sql'));
  for (const f of ['reglas_comerciales_vigentes', 'revisiones_autor', 'strip_seller_economics_on_revision_write',
    'evaluar_emision_cotizacion', 'emitir_revision_v2', 'hash_revision', 'verificar_aprobacion',
    'requiere_aprobacion_snapshot', 'asignar_folio_oficial']) await x(defDeBaseline(f));
  await x(`
    create trigger trg_guard_cotizacion_estado_directo before insert or update on public.cotizaciones for each row execute function private_api.guard_cotizacion_estado_directo();
    create trigger trg_normalize_economics_status before insert or update on public.cotizaciones for each row execute function public.normalize_economics_on_cotizacion_write();
    create trigger trg_pin_product_versions before insert or update on public.cotizaciones for each row execute function public.pin_product_versions_on_cotizacion_write();
    create trigger trg_strip_seller_economics before insert or update on public.cotizaciones for each row execute function public.strip_seller_economics_on_cotizacion_write();
    create trigger trg_revisiones_autor before insert or update on public.cotizaciones_revisiones for each row execute function public.revisiones_autor();
    create trigger trg_strip_seller_economics_revision before insert or update on public.cotizaciones_revisiones for each row execute function public.strip_seller_economics_on_revision_write();
  `);
  return db;
}

// Sesión simulada: auth.jwt() lee test.email; emitir_revision_v2/revisiones_autor leen request.jwt.claims.
export const como = async (db, email, fn) => {
  await db.exec(`select set_config('test.email', '${email}', false), set_config('request.jwt.claims', '${JSON.stringify({ email })}', false)`);
  try { return await fn(); } finally { await db.exec(`select set_config('test.email', '', false), set_config('request.jwt.claims', '', false)`); }
};
export const uno = async (db, email, sql, params) => como(db, email, async () => (await db.query(sql, params)).rows[0]);
export const evaluar = async (db, email, id, snap) =>
  (await uno(db, email, 'select public.evaluar_emision_cotizacion($1, $2::jsonb) as g', [id, JSON.stringify(snap)])).g;
export const emitir = async (db, email, id, snap) =>
  (await uno(db, email, 'select public.emitir_revision_v2($1, $2::jsonb) as r', [id, JSON.stringify(snap)])).r;
export const folio = async (db, email, id) =>
  (await uno(db, email, 'select public.asignar_folio_oficial($1) as f', [id])).f;

