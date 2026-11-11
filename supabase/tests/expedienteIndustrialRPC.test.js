// ============================================================================
//  CASO A · el EXPEDIENTE INDUSTRIAL (puente VONI + confirmacion CAD) contra el RPC REAL
//  (Postgres via PGlite), no serializacion en memoria. Guardar -> reabrir con integridad
//  exacta -> dos sesiones -> VERSION_CONFLICT sin sobrescribir -> aislamiento por usuario.
//  Corre la migracion real 20261111_expediente_costeo.sql (RPC gobernadas).
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expedienteIndustrialDesdeDespiece } from '../../src/datos/expedienteIndustrialDesdeDespiece.js';
import { recostearExpediente } from '../../src/datos/pantallaIngenieria.js';

const RAIZ = new URL('../../', import.meta.url);
const MIG = 'supabase/migrations/20261111_expediente_costeo.sql';
const catalogoLamina = [{ id: 'lam18', calibre: 18, acero: 'negra', formato: { largoMM: 3050, anchoMM: 1220 }, precio: 571.54, certificable: true }];
const insumos = { lam: { nombre: 'Lamina cal.18', seccion: 'metal' } };

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
  await db.exec(readFileSync(new URL(MIG, RAIZ), 'utf8'));
  return db;
}

// Expediente industrial REAL: puente desde un despiece con una pieza pendiente de CAD, + confirmacion.
function expedienteConfirmado() {
  const despiece = [
    { clave: 'LAT#0', desc: 'Lateral', insumoId: 'lam', cantidad: 1, seccion: 'metal', largoMM: 700, anchoMM: 400 },
    { clave: 'CAJA#1', desc: 'Caja 3D', insumoId: 'lam', cantidad: 1, seccion: 'metal', fabricada: true },
  ];
  const v1 = expedienteIndustrialDesdeDespiece(despiece, { clave: 'IND-RPC', insumosERP: insumos, catalogoLamina });
  return recostearExpediente(v1, { tipo: 'desarrollo', clave: 'CAJA#1', desarrollo_mm: [600, 400], fuente: 'CAD' });
}

describe('CASO A · expediente industrial contra RPC real (Postgres/PGlite)', () => {
  let db;
  beforeAll(async () => { db = await base(); }, 60_000);
  afterAll(async () => { await db?.close(); });

  it('guardar expediente industrial CONFIRMADO -> reabrir con integridad exacta', async () => {
    const exp = expedienteConfirmado();
    expect(exp.confirmaciones.length).toBe(1);
    const g = await rpc(db, 'rodrigo@vh.mx', 'guardar_expediente_costeo', { p_clave: 'IND-RPC', p_expediente: exp });
    expect(g.ok).toBe(true); expect(g.version).toBe(1);
    const r = await rpc(db, 'rodrigo@vh.mx', 'reabrir_expediente_costeo', { p_clave: 'IND-RPC' });
    expect(r.version).toBe(1);
    expect(r.expediente.confirmaciones.length).toBe(1);                 // la confirmacion CAD sobrevivio
    expect(r.expediente.confirmaciones[0].clave).toBe('CAJA#1');        // y es la pieza correcta
    expect(r.expediente.inputs.piezasBOM.length).toBe(2);              // BOM intacto
    expect(r.expediente.costo_industrial).toBeTruthy();                // costo intacto
  });

  it('dos sesiones: la 2a con version vieja -> VERSION_CONFLICT y NO sobrescribe', async () => {
    const prev = (await rpc(db, 'rodrigo@vh.mx', 'reabrir_expediente_costeo', { p_clave: 'IND-RPC' })).expediente;
    const g2 = await rpc(db, 'rodrigo@vh.mx', 'guardar_expediente_costeo', { p_clave: 'IND-RPC', p_expediente: { ...prev, edito: 'A' }, p_version_anterior: 1 });
    expect(g2.version).toBe(2);
    const e = await fallo(rpc(db, 'rodrigo@vh.mx', 'guardar_expediente_costeo', { p_clave: 'IND-RPC', p_expediente: { ...prev, edito: 'B' }, p_version_anterior: 1 }));
    expect(String(e?.message || '')).toMatch(/VERSION_CONFLICT/);
    const r = await rpc(db, 'rodrigo@vh.mx', 'reabrir_expediente_costeo', { p_clave: 'IND-RPC' });
    expect(r.version).toBe(2); expect(r.expediente.edito).toBe('A');   // gano A; B no pudo sobrescribir
  });

  it('aislamiento: otro usuario NO ve ni modifica el expediente ajeno', async () => {
    const r = await rpc(db, 'otro@vh.mx', 'reabrir_expediente_costeo', { p_clave: 'IND-RPC' });
    expect(r).toBeNull();
  });
});
