// ============================================================================
//  P1 CONCURRENCIA · guardar_producto_maestro — evita el lost update.
//  PGlite es de UNA conexión: no reproduce dos conexiones simultáneas reales (eso
//  necesita Postgres con dos clientes). Aquí se prueba lo verificable en PGlite:
//   1. el fix ESTÁ en la función desplegada (advisory lock + FOR UPDATE + UPDATE
//      condicional por version),
//   2. la SEMÁNTICA del UPDATE condicional que previene el lost update: un 2º
//      UPDATE con la version vieja afecta 0 filas (→ VERSION_CONFLICT en la RPC),
//   3. regresión: el conflicto secuencial de version sigue detectándose.
//  La evidencia empírica de DOS conexiones concurrentes se hace contra Postgres real
//  (rama aislada / CI con servicio postgres), no en PGlite.
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const RAIZ = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');
const MIGRACION = 'supabase/migrations/20261109_guardar_producto_maestro_integridad.sql';
const DIRECCION = 'rodrigo@vh.mx';

const L_OK = [
  { desc: 'Lamina', insumoId: 'erp-lam', cantidad: 2.5, unidad: 'hoja', precioConfirmado: 800 },
  { desc: 'Pintura', insumoId: 'erp-pin', cantidad: 3, unidad: 'kg', precioConfirmado: 150 },
];
const CASTS = { p_lineas: '::jsonb', p_dims_mm: '::integer[]', p_material_real: '::numeric', p_factor_mo: '::numeric', p_factor_gif: '::numeric', p_cos_fab_calculado: '::numeric', p_cos_fab_real: '::numeric', p_version_anterior: '::integer', p_sustituir: '::boolean', p_sustituir_verificado: '::boolean' };
async function rpc(db, email, args) {
  const ks = Object.keys(args);
  const sql = `select public.guardar_producto_maestro(${ks.map((k, i) => `${k} => $${i + 1}${CASTS[k] || ''}`).join(', ')}) as r`;
  const params = ks.map((k) => { const v = args[k]; return (v !== null && typeof v === 'object') ? JSON.stringify(v) : v; });
  await db.exec(`select set_config('test.email', '${email}', false)`);
  try { return (await db.query(sql, params)).rows[0].r; }
  finally { await db.exec(`select set_config('test.email', '', false)`); }
}
const fallo = async (p) => { try { await p; } catch (e) { return e; } return null; };

async function base() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$
      select case when coalesce(current_setting('test.email', true),'')='' then null
        else jsonb_build_object('email', current_setting('test.email', true)) end $$;
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create table public.permitidos (email text primary key, rol text not null default 'vendedor');
    insert into public.permitidos(email, rol) values ('${DIRECCION}','direccion');
    create table public.cuentas_no_humanas (email text primary key, motivo text);
    create function public.puede_certificar_costo() returns boolean language sql stable as $$
      select coalesce((select lower(rol) from public.permitidos where lower(email)=lower(auth.jwt()->>'email'))='direccion', false)
         and not exists (select 1 from public.cuentas_no_humanas where lower(email)=lower(auth.jwt()->>'email')) $$;
    create table public.producto_maestro (
      clave text primary key, nombre text, dims_mm integer[], fuente text, cos_fab_real numeric,
      lineas jsonb, creado_por text, creado_en timestamptz not null default now(),
      actualizado_en timestamptz not null default now(), factor_mo numeric, factor_gif numeric,
      material_real numeric, tipo_bom text);
  `);
  await db.exec(leer(MIGRACION));
  return db;
}

describe('P1 concurrencia · guardar_producto_maestro', () => {
  let db;
  beforeAll(async () => { db = await base(); }, 60_000);
  afterAll(async () => { await db?.close(); });

  it('el fix ESTÁ en la función: advisory lock + FOR UPDATE + UPDATE condicional por version', async () => {
    const { def } = (await db.query(
      `select pg_get_functiondef('public.guardar_producto_maestro(text,text,jsonb,numeric,numeric,numeric,numeric,numeric,integer[],text,text,integer,boolean,boolean)'::regprocedure) as def`)).rows[0];
    expect(def).toMatch(/pg_advisory_xact_lock/);
    expect(def.toLowerCase()).toMatch(/for update/);
    expect(def).toMatch(/version = v_ver_actual/);
  });

  it('semántica del UPDATE condicional: un 2º UPDATE con la version vieja afecta 0 filas', async () => {
    await db.exec(`insert into public.producto_maestro(clave, lineas, material_real, tipo_bom, version)
                   values ('COND-1', '[]'::jsonb, 100, 'BOM_BORRADOR', 1)`);
    const u1 = await db.query(`update public.producto_maestro set version=2 where clave='COND-1' and version=1`);
    expect(u1.affectedRows).toBe(1);                       // la 1a (version esperada correcta) escribe
    const u2 = await db.query(`update public.producto_maestro set version=3 where clave='COND-1' and version=1`);
    expect(u2.affectedRows).toBe(0);                       // la 2a (version ya vieja) NO escribe → base del VERSION_CONFLICT
    expect((await db.query(`select version from public.producto_maestro where clave='COND-1'`)).rows[0].version).toBe(2);
  });

  it('regresión: el conflicto secuencial de version se detecta (RPC)', async () => {
    const r1 = await rpc(db, DIRECCION, { p_clave: 'CC-1', p_nombre: 'x', p_lineas: L_OK, p_factor_mo: 0.1, p_factor_gif: 0.25, p_material_real: 2450, p_tipo_bom: 'BOM_BORRADOR' });
    expect(r1.version).toBe(1);
    // sustituir con la version correcta → v2
    const r2 = await rpc(db, DIRECCION, { p_clave: 'CC-1', p_nombre: 'y', p_lineas: L_OK, p_factor_mo: 0.1, p_factor_gif: 0.25, p_material_real: 2450, p_tipo_bom: 'BOM_BORRADOR', p_sustituir: true, p_version_anterior: 1 });
    expect(r2.version).toBe(2);
    // sustituir con una version vieja (1, pero ya es 2) → VERSION_CONFLICT, sin escribir
    const e = await fallo(rpc(db, DIRECCION, { p_clave: 'CC-1', p_nombre: 'z', p_lineas: L_OK, p_factor_mo: 0.1, p_factor_gif: 0.25, p_material_real: 2450, p_tipo_bom: 'BOM_BORRADOR', p_sustituir: true, p_version_anterior: 1 }));
    expect(String(e?.message || '')).toMatch(/VERSION_CONFLICT/);
    expect((await db.query(`select version, nombre from public.producto_maestro where clave='CC-1'`)).rows[0].nombre).toBe('y');
  });
});
