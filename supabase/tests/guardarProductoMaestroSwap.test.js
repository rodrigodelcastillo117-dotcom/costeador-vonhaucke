// ============================================================================
//  PREFLIGHT DEL SWAP · guardar_producto_maestro: 10 args (prod) → 14 args (nueva).
//  Verifica EN PostgreSQL real (PGlite) que la migración:
//    1. deja UNA sola función (dropea la firma vieja de 10 args),
//    2. un call del CLIENTE VIEJO (10 args nombrados) RESUELVE a la nueva (no "function is not
//       unique") y sigue pudiendo CREAR, pero ya NO sobrescribe en silencio (contrato seguro).
//  Es la prueba de "compatibilidad de la RPC con las llamadas existentes / clientes en vuelo".
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const RAIZ = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');
const RPC_VIEJA = 'supabase/migrations/20261108_guardar_producto_maestro.sql';
const RPC_NUEVA = 'supabase/migrations/20261109_guardar_producto_maestro_integridad.sql';
const DIRECCION = 'rodrigo@vh.mx';

const L_OK = [
  { desc: 'Lamina', insumoId: 'erp-lam', cantidad: 2.5, unidad: 'hoja', precioConfirmado: 800 },
  { desc: 'Pintura', insumoId: 'erp-pin', cantidad: 3, unidad: 'kg', precioConfirmado: 150 },
];

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
  return db;
}
const nFunciones = async (db) => (await db.query(
  `select count(*)::int n, max(pronargs)::int args from pg_proc where proname='guardar_producto_maestro'`)).rows[0];
// Llama como el CLIENTE VIEJO: exactamente los 10 args nombrados de la RPC de 20261108.
async function callVieja(db, email, { clave, tipo = 'BOM_DETALLADO_VERIFICADO' }) {
  const sql = `select public.guardar_producto_maestro(
    p_clave => $1, p_nombre => $2, p_lineas => $3::jsonb, p_factor_mo => $4::numeric, p_factor_gif => $5::numeric,
    p_material_real => $6::numeric, p_cos_fab_real => $7::numeric, p_dims_mm => $8::integer[],
    p_tipo_bom => $9, p_fuente => $10) as r`;
  const params = [clave, 'Mueble', JSON.stringify(L_OK), 0.1, 0.25, 2450, null, null, tipo, 'viejo'];
  await db.exec(`select set_config('test.email', '${email}', false)`);
  try { return (await db.query(sql, params)).rows[0].r; }
  finally { await db.exec(`select set_config('test.email', '', false)`); }
}
const fallo = async (p) => { try { await p; } catch (e) { return e; } return null; };

describe('PREFLIGHT swap · 10 args (prod) → 14 args (nueva), sin romper al cliente viejo', () => {
  let db;
  beforeAll(async () => { db = await base(); await db.exec(leer(RPC_VIEJA)); }, 60_000);
  afterAll(async () => { await db?.close(); });

  it('ANTES: existe UNA función de 10 args (como prod) y el cliente viejo crea', async () => {
    const f = await nFunciones(db);
    expect(f.n).toBe(1); expect(f.args).toBe(10);
    const r = await callVieja(db, DIRECCION, { clave: 'VIEJO-1' });
    expect(r.ok).toBe(true);
  });

  it('DESPUÉS de la migración: UNA sola función de 14 args (la vieja fue dropeada)', async () => {
    await db.exec(leer(RPC_NUEVA));
    const f = await nFunciones(db);
    expect(f.n).toBe(1);               // no hay dos sobrecargas
    expect(f.args).toBe(14);           // y es la nueva
  });

  it('el CLIENTE VIEJO (10 args nombrados) resuelve a la nueva: crea sí, pero NO sobrescribe en silencio', async () => {
    // crea una clave nueva: funciona (los 4 params extra por defecto)
    const r = await callVieja(db, DIRECCION, { clave: 'VIEJO-2' });
    expect(r.ok).toBe(true);
    expect(r.version).toBe(1);         // es la RPC nueva (devuelve version)
    // intentar re-guardar la MISMA clave (lo que antes sobrescribía en silencio) ahora se rechaza
    const e = await fallo(callVieja(db, DIRECCION, { clave: 'VIEJO-2' }));
    expect(String(e?.message || '')).toMatch(/ya existe/i);
    // y un VERIFICADO con pendiente sigue rechazándose aunque venga del cliente viejo
    const sql = `select public.guardar_producto_maestro(
      p_clave => $1, p_nombre => $2, p_lineas => $3::jsonb, p_factor_mo => $4::numeric, p_factor_gif => $5::numeric,
      p_material_real => $6::numeric, p_tipo_bom => $7) as r`;
    const conPendiente = JSON.stringify([L_OK[0], { desc: 'sin sku', insumoId: null, cantidad: null, unidad: '', pendiente: true }]);
    await db.exec(`select set_config('test.email', '${DIRECCION}', false)`);
    const e2 = await fallo(db.query(sql, ['VIEJO-3', 'x', conPendiente, 0.1, 0.25, 2450, 'BOM_DETALLADO_VERIFICADO']));
    await db.exec(`select set_config('test.email', '', false)`);
    expect(String(e2?.message || '')).toMatch(/rechazado/i);
  });
});
