// ============================================================================
//  Base AISLADA para probar las PROPUESTAS VH-146 / VH-147 (PGlite = PostgreSQL real en WASM, en memoria).
//  Carga el esquema REAL de `insumos_catalogo` e `insumo_precios` (DDL copiado del baseline 01_tablas.sql,
//  con sus CHECK y la columna generada cost_unit_price_mxn), los triggers reales de insumo_precios
//  (calc_source_hash, sync_precio_legacy, guard_precio_no_autofirma, append_only), `aprobar_precio` real,
//  la vista `catalogo_vigente` DE PRODUCCIÓN (04_vistas.sql) y `insumo_motor`/`catalogo_motor` de VH-088.
//  auth/roles están simulados (como en preservaEconomia.test.js). Nada toca producción.
// ============================================================================
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const RAIZ = new URL('../../../', import.meta.url);
export const leer = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');

export const DIRECCION = 'direccion@vh.mx';
export const VENDEDOR = 'ventas@vh.mx';

/** DDL completo de una tabla del baseline (hasta el `);` que la cierra). */
export function tablaDeBaseline(nombre) {
  const sql = leer('supabase/schema/baseline/01_tablas.sql');
  const ini = sql.indexOf(`CREATE TABLE public.${nombre} (`);
  if (ini < 0) throw new Error(`no está la tabla ${nombre} en el baseline`);
  const fin = sql.indexOf('\n);', ini);
  return sql.slice(ini, fin + 3);
}

/** Definición completa de una función `public.*` del baseline 03_funciones.sql. */
export function funcionDeBaseline(nombre) {
  const sql = leer('supabase/schema/baseline/03_funciones.sql');
  const ini = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${nombre}(`);
  if (ini < 0) throw new Error(`no está ${nombre} en el baseline`);
  const fin = sql.indexOf('\n;\n', ini);
  return sql.slice(ini, fin) + ';';
}

/** Definición completa de una función `private_api.*` del baseline 08_private_api.sql. */
export function privateApiDeBaseline(nombre) {
  const sql = leer('supabase/schema/baseline/08_private_api.sql');
  const ini = sql.indexOf(`CREATE OR REPLACE FUNCTION private_api.${nombre}(`);
  if (ini < 0) throw new Error(`no está private_api.${nombre} en el baseline`);
  const fin = sql.indexOf('$function$;', ini);
  return sql.slice(ini, fin + '$function$;'.length);
}

/** La vista `catalogo_vigente` tal cual está en producción (baseline 04_vistas.sql). */
export function vistaCatalogoVigenteProduccion() {
  const sql = leer('supabase/schema/baseline/04_vistas.sql');
  const ini = sql.indexOf('CREATE OR REPLACE VIEW public.catalogo_vigente');
  const fin = sql.indexOf('\nCOMMENT ON VIEW public.catalogo_vigente', ini);
  if (ini < 0 || fin < 0) throw new Error('no está catalogo_vigente en el baseline');
  return sql.slice(ini, fin);
}

/** Una función `create or replace function <schema>.<nombre>(` ... `$$;` de un archivo de migración. */
export function funcionDeMigracion(rel, nombreCalificado) {
  const sql = leer(rel);
  const re = new RegExp(`create or replace function ${nombreCalificado.replace('.', '\\.')}\\(`, 'i');
  const m = re.exec(sql);
  if (!m) throw new Error(`no está ${nombreCalificado} en ${rel}`);
  const fin = sql.indexOf('$$;', m.index);
  return sql.slice(m.index, fin + 3);
}

/** Bloque de ROLLBACK comentado de una PROPUESTA: líneas entre `>>> ROLLBACK <tag>` y `<<< FIN ROLLBACK <tag>` sin el prefijo `-- `. */
export function rollbackDePropuesta(rel, tag) {
  const lineas = leer(rel).split('\n');
  const ini = lineas.findIndex((l) => l.includes(`>>> ROLLBACK ${tag}`));
  const fin = lineas.findIndex((l) => l.includes(`<<< FIN ROLLBACK ${tag}`));
  if (ini < 0 || fin < 0) throw new Error(`sin marcadores de rollback ${tag} en ${rel}`);
  return lineas.slice(ini + 1, fin).map((l) => l.replace(/^-- ?/, '')).join('\n');
}

/**
 * Base aislada con el esquema real de catálogo + precios y la vista de producción.
 * @param {{conVh088?: boolean}} opts  conVh088 (default true) carga insumo_motor/catalogo_motor y resolver_costo_insumo.
 */
export async function baseCatalogoAislada({ conVh088 = true } = {}) {
  const db = new PGlite({ extensions: { pgcrypto } });
  const x = (s) => db.exec(s);
  await x(`
    create schema auth; create schema private_api; create schema extensions;
    create extension if not exists pgcrypto with schema extensions;
    -- Roles de Supabase (sin login) para que los GRANT de las migraciones no fallen.
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    end $$;
    -- auth simulado: quién soy lo dice la sesión de prueba (test.email).
    create function auth.uid() returns uuid language sql stable as $$
      select case when coalesce(current_setting('test.email', true), '') = '' then null
        else md5(current_setting('test.email', true))::uuid end $$;
    -- FINAL-100 H4: el rol vive en el claim role del JWT (contrato vivo en prod: auth.jwt()->>role).
    -- auth.role() queda como LECTURA de ese mismo claim, sin divergir (sec02 B), por si algun SQL legacy lo invoca.
    create function auth.jwt() returns jsonb language sql stable as $$
      select case when coalesce(current_setting('test.email', true), '') = ''
        then jsonb_build_object('role', 'anon')
        else jsonb_build_object('email', current_setting('test.email', true), 'role', 'authenticated') end $$;
    create function auth.role() returns text language sql stable as $$
      select auth.jwt() ->> 'role' $$;
    create table public.permitidos (email text primary key, rol text not null default 'vendedor');
    insert into public.permitidos values ('${DIRECCION}', 'direccion'), ('${VENDEDOR}', 'vendedor');
    create function private_api.rol_actual() returns text language sql stable as $$
      select lower(p.rol) from public.permitidos p where lower(p.email) = lower(auth.jwt()->>'email') limit 1 $$;
    create function private_api.puede_editar_config() returns boolean language sql stable as $$ select private_api.rol_actual() in ('direccion','diseno') $$;
    create function public.puede_editar_config() returns boolean language sql stable as $$ select private_api.puede_editar_config() $$;
    create function public.puede_certificar_costo() returns boolean language sql stable as $$ select private_api.rol_actual() = 'direccion' $$;
    create table public.config (id text primary key, datos jsonb);
    insert into public.config values ('vonhaucke', '{"insumos": {"legacy-config-only": {"precio": 99, "unidad": "pza"}}}'::jsonb);
  `);
  await x(tablaDeBaseline('insumos_catalogo'));
  await x(tablaDeBaseline('insumo_precios'));
  for (const f of ['calc_source_hash', 'sync_precio_legacy', 'guard_precio_no_autofirma', 'insumo_precios_append_only', 'aprobar_precio']) {
    await x(funcionDeBaseline(f));
  }
  await x(`
    CREATE TRIGGER trg_calc_source_hash BEFORE INSERT ON insumo_precios FOR EACH ROW EXECUTE FUNCTION calc_source_hash();
    CREATE TRIGGER trg_insumo_precios_append_only BEFORE DELETE OR UPDATE ON insumo_precios FOR EACH ROW EXECUTE FUNCTION insumo_precios_append_only();
    CREATE TRIGGER trg_precio_no_autofirma BEFORE INSERT OR UPDATE ON insumo_precios FOR EACH ROW EXECUTE FUNCTION guard_precio_no_autofirma();
    CREATE TRIGGER trg_sync_precio_legacy BEFORE INSERT OR UPDATE ON insumo_precios FOR EACH ROW EXECUTE FUNCTION sync_precio_legacy();
  `);
  await x(vistaCatalogoVigenteProduccion());
  await x(`GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.catalogo_vigente TO authenticated;
           GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.catalogo_vigente TO service_role;`);
  if (conVh088) {
    await x(funcionDeMigracion('supabase/migrations/20261012043000_vh088_catalogo_motor.sql', 'private_api.insumo_motor'));
    await x(funcionDeMigracion('supabase/migrations/20261012043000_vh088_catalogo_motor.sql', 'private_api.catalogo_motor'));
    await x(privateApiDeBaseline('resolver_costo_insumo'));
  }
  return db;
}

export const como = async (db, email, fn) => {
  await db.exec(`select set_config('test.email', '${email}', false)`);
  try { return await fn(); } finally { await db.exec(`select set_config('test.email', '', false)`); }
};
export const fila = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];
export const filas = async (db, sql, params = []) => (await db.query(sql, params)).rows;
