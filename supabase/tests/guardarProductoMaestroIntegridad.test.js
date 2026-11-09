// ============================================================================
//  P0 · guardar_producto_maestro — INTEGRIDAD + VERSIONADO (2026-11-09).
//  PGlite (PostgreSQL real en WASM). Nada toca producción.
//
//  ANTES  = la RPC de producción (20261108_guardar_producto_maestro.sql):
//     · confía en el tipo_bom del navegador → acepta VERIFICADO con pendientes.
//     · ON CONFLICT DO UPDATE → sobrescribe una clave existente en silencio,
//       sin versión, sin confirmación, sin rastro.
//  DESPUÉS = la migración propuesta (20261109_guardar_producto_maestro_integridad.sql):
//     · rechaza VERIFICADO si hay una línea pendiente (integridad server-side).
//     · exige p_sustituir + p_version_anterior para sobrescribir (VERSION_CONFLICT).
//     · exige p_sustituir_verificado para pisar un VERIFICADO.
//     · separa cos_fab_calculado (factores) de cos_fab_real (medido).
//     · historial append-only de quién guardó qué.
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const RAIZ = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');
const RPC_PROD = 'supabase/migrations/20261108_guardar_producto_maestro.sql';
const RPC_NUEVA = 'supabase/migrations/20261109_guardar_producto_maestro_integridad.sql';

const DIRECCION = 'rodrigo@vh.mx', VENDEDOR = 'ventas@vh.mx';

async function baseAislada() {
  const db = new PGlite({ extensions: { pgcrypto } });
  const x = (s) => db.exec(s);
  await x(`
    create schema auth; create schema extensions;
    create extension if not exists pgcrypto with schema extensions;
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create function auth.jwt() returns jsonb language sql stable as $$
      select case when coalesce(current_setting('test.email', true), '') = '' then null
        else jsonb_build_object('email', current_setting('test.email', true)) end $$;
    create table public.permitidos (email text primary key, rol text not null default 'vendedor');
    insert into public.permitidos(email, rol) values ('${DIRECCION}','direccion'), ('${VENDEDOR}','vendedor');
    create table public.cuentas_no_humanas (email text primary key, motivo text);
    -- puede_certificar_costo: Dirección persona real (no cuenta de prueba). Igual semántica que producción.
    create function public.puede_certificar_costo() returns boolean language sql stable as $$
      select coalesce((select lower(rol) from public.permitidos where lower(email)=lower(auth.jwt()->>'email'))='direccion', false)
         and not exists (select 1 from public.cuentas_no_humanas where lower(email)=lower(auth.jwt()->>'email')) $$;
    create table public.producto_maestro (
      clave text primary key, nombre text, dims_mm integer[], fuente text,
      cos_fab_real numeric, lineas jsonb, creado_por text,
      creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now(),
      factor_mo numeric, factor_gif numeric, material_real numeric, tipo_bom text);
  `);
  return db;
}

const CASTS = {
  p_lineas: '::jsonb', p_dims_mm: '::integer[]', p_material_real: '::numeric',
  p_factor_mo: '::numeric', p_factor_gif: '::numeric', p_cos_fab_calculado: '::numeric',
  p_cos_fab_real: '::numeric', p_version_anterior: '::integer',
  p_sustituir: '::boolean', p_sustituir_verificado: '::boolean',
};
// Llama la RPC por argumentos nombrados, como el cliente (supabase-js rpc).
async function guardar(db, email, args) {
  const ks = Object.keys(args);
  const sql = `select public.guardar_producto_maestro(${ks.map((k, i) => `${k} => $${i + 1}${CASTS[k] || ''}`).join(', ')}) as r`;
  const params = ks.map((k) => {
    const v = args[k];
    return (v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
  });
  await db.exec(`select set_config('test.email', '${email}', false)`);
  try { return (await db.query(sql, params)).rows[0].r; }
  finally { await db.exec(`select set_config('test.email', '', false)`); }
}
const fallo = async (p) => { try { await p; } catch (e) { return e; } return null; };
const filaPM = async (db, clave) => (await db.query('select * from public.producto_maestro where clave=$1', [clave])).rows[0];

// BOM completo (todas las líneas con insumoId, cantidad>0 y unidad) y uno con una pendiente.
const L_OK = [
  { desc: 'Lamina', insumoId: 'erp-lam', cantidad: 2.5, unidad: 'hoja', precioConfirmado: 800 },
  { desc: 'Pintura', insumoId: 'erp-pin', cantidad: 3, unidad: 'kg', precioConfirmado: 150 },
];
const L_CON_PENDIENTE = [
  { desc: 'Lamina', insumoId: 'erp-lam', cantidad: 2.5, unidad: 'hoja', precioConfirmado: 800 },
  { desc: 'Refuerzo sin identidad', insumoId: null, cantidad: null, unidad: '', pendiente: true },
];
const base = { p_factor_mo: 0.1, p_factor_gif: 0.25, p_material_real: 2450 };

describe('ANTES · RPC de producción (20261108): confía en el cliente y sobrescribe en silencio', () => {
  let db;
  beforeAll(async () => { db = await baseAislada(); await db.exec(leer(RPC_PROD)); }, 60_000);
  afterAll(async () => { await db?.close(); });

  it('acepta VERIFICADO con una línea PENDIENTE (el defecto de integridad)', async () => {
    const r = await guardar(db, DIRECCION, { p_clave: 'DEF-1', p_nombre: 'x', p_lineas: L_CON_PENDIENTE, p_tipo_bom: 'BOM_DETALLADO_VERIFICADO', ...base });
    expect(r.ok).toBe(true);
    expect((await filaPM(db, 'DEF-1')).tipo_bom).toBe('BOM_DETALLADO_VERIFICADO'); // incompleto, "verificado"
  });

  it('sobrescribe una clave existente SIN versión ni confirmación (el defecto de overwrite)', async () => {
    await guardar(db, DIRECCION, { p_clave: 'DEF-2', p_nombre: 'orig', p_lineas: L_OK, p_tipo_bom: 'BOM_DETALLADO_VERIFICADO', ...base });
    const r = await guardar(db, DIRECCION, { p_clave: 'DEF-2', p_nombre: 'PISADO', p_lineas: [L_OK[0]], p_tipo_bom: 'BOM_DETALLADO_VERIFICADO', ...base });
    expect(r.ok).toBe(true);
    expect((await filaPM(db, 'DEF-2')).nombre).toBe('PISADO'); // se pisó, nadie se enteró
  });
});

describe('DESPUÉS · migración nueva: integridad + versionado fail-closed', () => {
  let db;
  beforeAll(async () => { db = await baseAislada(); await db.exec(leer(RPC_NUEVA)); }, 60_000);
  afterAll(async () => { await db?.close(); });

  it('un vendedor NO puede guardar (puerta de Dirección)', async () => {
    const e = await fallo(guardar(db, VENDEDOR, { p_clave: 'V-1', p_nombre: 'x', p_lineas: L_OK, ...base }));
    expect(e?.message).toMatch(/no autorizado/i);
  });

  it('VERIFICADO con una pendiente se RECHAZA (integridad server-side, no confía en el cliente)', async () => {
    const e = await fallo(guardar(db, DIRECCION, { p_clave: 'N-1', p_nombre: 'x', p_lineas: L_CON_PENDIENTE, p_tipo_bom: 'BOM_DETALLADO_VERIFICADO', ...base }));
    expect(e?.message).toMatch(/rechazado/i);
    expect(await filaPM(db, 'N-1')).toBeUndefined(); // no se guardó nada
  });

  it('el mismo BOM con pendiente SÍ se guarda como BORRADOR (nada se pierde; no certifica)', async () => {
    const r = await guardar(db, DIRECCION, { p_clave: 'N-2', p_nombre: 'x', p_lineas: L_CON_PENDIENTE, p_tipo_bom: 'BOM_BORRADOR', ...base });
    expect(r.ok).toBe(true);
    expect(r.version).toBe(1);
    expect(r.pendientes).toBe(1);
    expect((await filaPM(db, 'N-2')).tipo_bom).toBe('BOM_BORRADOR');
    // el historial registró quién lo guardó y con cuántas pendientes
    const h = (await db.query('select * from public.producto_maestro_historial where clave=$1', ['N-2'])).rows;
    expect(h.length).toBe(1);
    expect(h[0].guardado_por).toBe(DIRECCION);
    expect(h[0].n_pendientes).toBe(1);
  });

  it('cos_fab_real NO se inventa: sin referencia medida queda null; cos_fab_calculado sale de factores', async () => {
    await guardar(db, DIRECCION, { p_clave: 'N-3', p_nombre: 'x', p_lineas: L_OK, p_tipo_bom: 'BOM_DETALLADO_VERIFICADO', p_version_anterior: null, ...base });
    const f = await filaPM(db, 'N-3');
    expect(f.cos_fab_real).toBeNull();
    expect(Number(f.cos_fab_calculado)).toBeCloseTo(2450 * 1.35, 2);
  });

  it('sobrescribir exige confirmación y versión: sin p_sustituir falla; versión vieja → VERSION_CONFLICT', async () => {
    await guardar(db, DIRECCION, { p_clave: 'N-4', p_nombre: 'orig', p_lineas: L_OK, p_tipo_bom: 'BOM_BORRADOR', ...base });
    // sin p_sustituir → rechazo
    const e1 = await fallo(guardar(db, DIRECCION, { p_clave: 'N-4', p_nombre: 'y', p_lineas: L_OK, p_tipo_bom: 'BOM_BORRADOR', ...base }));
    expect(e1?.message).toMatch(/ya existe/i);
    // con p_sustituir pero versión equivocada → VERSION_CONFLICT
    const e2 = await fallo(guardar(db, DIRECCION, { p_clave: 'N-4', p_nombre: 'y', p_lineas: L_OK, p_tipo_bom: 'BOM_BORRADOR', p_sustituir: true, p_version_anterior: 99, ...base }));
    expect(e2?.message).toMatch(/VERSION_CONFLICT/);
    expect((await filaPM(db, 'N-4')).nombre).toBe('orig'); // nada cambió
    // con versión correcta → sustituye y sube a version 2
    const r = await guardar(db, DIRECCION, { p_clave: 'N-4', p_nombre: 'nuevo', p_lineas: L_OK, p_tipo_bom: 'BOM_BORRADOR', p_sustituir: true, p_version_anterior: 1, ...base });
    expect(r.version).toBe(2);
    expect((await filaPM(db, 'N-4')).nombre).toBe('nuevo');
  });

  it('pisar un VERIFICADO exige confirmación extra (p_sustituir_verificado)', async () => {
    await guardar(db, DIRECCION, { p_clave: 'N-5', p_nombre: 'cert', p_lineas: L_OK, p_tipo_bom: 'BOM_DETALLADO_VERIFICADO', ...base });
    const e = await fallo(guardar(db, DIRECCION, { p_clave: 'N-5', p_nombre: 'z', p_lineas: L_OK, p_tipo_bom: 'BOM_BORRADOR', p_sustituir: true, p_version_anterior: 1, ...base }));
    expect(e?.message).toMatch(/VERIFICADO/);
    const r = await guardar(db, DIRECCION, { p_clave: 'N-5', p_nombre: 'z', p_lineas: L_OK, p_tipo_bom: 'BOM_BORRADOR', p_sustituir: true, p_sustituir_verificado: true, p_version_anterior: 1, ...base });
    expect(r.version).toBe(2);
    // historial append-only: no se puede borrar ni actualizar
    const e2 = await fallo(db.query(`delete from public.producto_maestro_historial where clave='N-5'`));
    expect(e2?.message).toMatch(/append-only/);
  });
});
