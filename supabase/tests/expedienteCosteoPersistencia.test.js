// ============================================================================
//  PERSISTENCIA del expediente de costeo (p5) — contrato SQL en Postgres (PGlite).
//  Prueba la RPC propuesta: GUARDAR (v1) -> REABRIR -> re-GUARDAR (v2) -> conflicto
//  de version -> aislamiento por usuario. La migracion esta PROPUESTA (no en prod).
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const RAIZ = new URL('../../', import.meta.url);
const MIG = 'supabase/migrations/20261111_expediente_costeo.sql';
const EXP = { clave: 'TELSVH120', interpretacion: { producto: 'Vitrina' }, costo_industrial: { total: { parcial_mxn: 5504.84 } } };

async function rpc(db, email, fn, args) {
  const ks = Object.keys(args);
  const sql = `select public.${fn}(${ks.map((k, i) => `${k} => $${i + 1}${k === 'p_expediente' ? '::jsonb' : k === 'p_version_anterior' ? '::integer' : ''}`).join(', ')}) as r`;
  const params = ks.map((k) => { const v = args[k]; return (v !== null && typeof v === 'object') ? JSON.stringify(v) : v; });
  await db.exec(`select set_config('test.email', '${email}', false)`);
  try { return (await db.query(sql, params)).rows[0].r; }
  finally { await db.exec(`select set_config('test.email', '', false)`); }
}
const fallo = async (p) => { try { await p; } catch (e) { return e; } return null; };

async function base() {
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$
      select case when coalesce(current_setting('test.email', true),'')='' then null
        else jsonb_build_object('email', current_setting('test.email', true)) end $$;
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
  `);
  // la migracion usa auth.jwt(); RLS no aplica en PGlite (superuser), pero las RPC sí.
  await db.exec(readFileSync(new URL(MIG, RAIZ), 'utf8'));
  return db;
}

describe('expediente_costeo · persistencia (contrato SQL)', () => {
  let db;
  beforeAll(async () => { db = await base(); }, 60_000);
  afterAll(async () => { await db?.close(); });

  it('GUARDAR crea v1 y REABRIR lo devuelve', async () => {
    const g = await rpc(db, 'rodrigo@vh.mx', 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP });
    expect(g.ok).toBe(true); expect(g.version).toBe(1);
    const r = await rpc(db, 'rodrigo@vh.mx', 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' });
    expect(r.version).toBe(1);
    expect(r.expediente.costo_industrial.total.parcial_mxn).toBe(5504.84);   // no perdio datos
  });

  it('re-GUARDAR con la version correcta -> v2; con version vieja -> VERSION_CONFLICT', async () => {
    const g2 = await rpc(db, 'rodrigo@vh.mx', 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: { ...EXP, v: 2 }, p_version_anterior: 1 });
    expect(g2.version).toBe(2);
    const e = await fallo(rpc(db, 'rodrigo@vh.mx', 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: { ...EXP, v: 3 }, p_version_anterior: 1 }));
    expect(String(e?.message || '')).toMatch(/VERSION_CONFLICT/);
    const r = await rpc(db, 'rodrigo@vh.mx', 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' });
    expect(r.version).toBe(2);   // el conflicto no escribio
  });

  it('REABRIR de otro usuario no ve el expediente ajeno', async () => {
    const r = await rpc(db, 'otro@vh.mx', 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' });
    expect(r).toBeNull();
  });

  it('GUARDAR sin autenticar (sin email) se rechaza', async () => {
    const e = await fallo(rpc(db, '', 'guardar_expediente_costeo', { p_clave: 'X', p_expediente: EXP }));
    expect(String(e?.message || '')).toMatch(/no autenticado/);
  });
});
