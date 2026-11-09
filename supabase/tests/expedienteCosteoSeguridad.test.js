// ============================================================================
//  P0 SEGURIDAD · expediente_costeo — prueba adversarial en Postgres (PGlite).
//
//  PARTE A (REPRO): sobre el contrato VIEJO (20261111) demuestra el defecto:
//    un usuario B sobrescribe y RECLAMA el expediente de A (control transfer),
//    y el error VERSION_CONFLICT le FILTRA la version de la fila ajena.
//  PARTE B (FIX): sobre el contrato NUEVO (20261111 + 20261112_seguridad)
//    demuestra el cierre: aislamiento total por dueño, sin colision de claves,
//    dueño inmutable, concurrencia optimista, historial, roles y compat con la
//    unica fila QA preexistente. Ninguna migracion esta aplicada a prod.
// ============================================================================
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const RAIZ = new URL('../../', import.meta.url);
const MIG_VIEJA = 'supabase/migrations/20261111_expediente_costeo.sql';
const MIG_FIX   = 'supabase/migrations/20261112_expediente_costeo_seguridad.sql';
const A = 'a@vh.mx';   // usuario A (dueño legitimo)
const B = 'b@vh.mx';   // usuario B (atacante)
const EXP_A = { clave: 'TELSVH120', interpretacion: { producto: 'Vitrina A' }, secreto: 'de A' };
const EXP_B = { clave: 'TELSVH120', interpretacion: { producto: 'Vitrina B' }, marca: 'de B' };

async function rpc(db, email, fn, args) {
  const ks = Object.keys(args);
  const sql = `select public.${fn}(${ks.map((k, i) => `${k} => $${i + 1}${k === 'p_expediente' ? '::jsonb' : k === 'p_version_anterior' ? '::integer' : ''}`).join(', ')}) as r`;
  const params = ks.map((k) => { const v = args[k]; return (v !== null && typeof v === 'object') ? JSON.stringify(v) : v; });
  await db.exec(`select set_config('test.email', '${email}', false)`);
  try { return (await db.query(sql, params)).rows[0].r; }
  finally { await db.exec(`select set_config('test.email', '', false)`); }
}
const fallo = async (p) => { try { await p; } catch (e) { return e; } return null; };

async function scaffold() {
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$
      select case when coalesce(current_setting('test.email', true),'')='' then null
        else jsonb_build_object('email', current_setting('test.email', true)) end $$;
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
  `);
  return db;
}
async function baseVieja() { const db = await scaffold(); await db.exec(readFileSync(new URL(MIG_VIEJA, RAIZ), 'utf8')); return db; }
async function baseNueva(seedLegacy) {
  const db = await scaffold();
  await db.exec(readFileSync(new URL(MIG_VIEJA, RAIZ), 'utf8'));
  if (seedLegacy) await db.exec(seedLegacy);   // fila heredada ANTES del fix (como prod)
  await db.exec(readFileSync(new URL(MIG_FIX, RAIZ), 'utf8'));
  return db;
}

describe('P0 expediente_costeo · PARTE A — reproduccion del defecto (contrato viejo)', () => {
  let db; beforeEach(async () => { db = await baseVieja(); });

  it('B puede SOBRESCRIBIR y RECLAMAR el expediente de A (control transfer)', async () => {
    // A crea su expediente.
    const g = await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_A });
    expect(g.version).toBe(1);
    // A lo ve.
    expect((await rpc(db, A, 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' })).expediente.secreto).toBe('de A');

    // ATAQUE de B: no es dueño, pero guarda por clave+version -> el contrato viejo lo PERMITE.
    const gB = await rpc(db, B, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_B, p_version_anterior: 1 });
    expect(gB.ok).toBe(true);   // DEFECTO: B sobrescribio la fila de A

    // Consecuencia: A YA NO puede reabrir (perdio el control); B si.
    expect(await rpc(db, A, 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' })).toBeNull();      // A fuera
    expect((await rpc(db, B, 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' })).expediente.marca).toBe('de B'); // B dentro
  });

  it('el error VERSION_CONFLICT FILTRA la version de la fila ajena', async () => {
    await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_A });        // v1
    await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_A, p_version_anterior: 1 }); // v2
    // B pregunta sin saber la version -> el mensaje le revela "version 2".
    const e = await fallo(rpc(db, B, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_B }));
    expect(String(e?.message || '')).toMatch(/version 2/);   // DEFECTO: fuga de informacion
  });
});

describe('P0 expediente_costeo · PARTE B — cierre (contrato nuevo, fix)', () => {
  let db; beforeEach(async () => { db = await baseNueva(); });

  it('B NO puede sobrescribir ni reclamar el expediente de A — filas aisladas por dueño', async () => {
    await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_A });   // fila de A
    // B "guarda la misma clave": crea su PROPIA fila, NO toca la de A.
    const gB = await rpc(db, B, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_B });
    expect(gB.version).toBe(1);   // fila nueva de B (no un overwrite de la v1 de A)

    // A conserva su expediente y su control.
    const rA = await rpc(db, A, 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' });
    expect(rA.expediente.secreto).toBe('de A');   // intacto
    expect(rA.version).toBe(1);
    // B ve el suyo, nunca el de A.
    expect((await rpc(db, B, 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' })).expediente.marca).toBe('de B');

    // Hay DOS filas distintas, una por dueño (sin colision de clave comercial).
    const n = (await db.query(`select count(*)::int c from public.expediente_costeo where clave='TELSVH120'`)).rows[0].c;
    expect(n).toBe(2);
  });

  it('acceso cruzado denegado: B no lee la fila de A por ninguna via de la RPC', async () => {
    await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_A });
    // B aun no tiene fila -> reabrir devuelve null (no la de A).
    expect(await rpc(db, B, 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' })).toBeNull();
  });

  it('dueño inmutable: tras varios guardados de A, creado_por sigue siendo A', async () => {
    await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_A });
    await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: { ...EXP_A, v: 2 }, p_version_anterior: 1 });
    const row = (await db.query(`select creado_por, actualizado_por, version from public.expediente_costeo where clave='TELSVH120'`)).rows[0];
    expect(row.creado_por).toBe(A);
    expect(row.version).toBe(2);
  });

  it('concurrencia optimista preservada: version vieja -> VERSION_CONFLICT sin fuga de numero', async () => {
    await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_A });              // v1
    await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_A, p_version_anterior: 1 }); // v2
    const e = await fallo(rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_A, p_version_anterior: 1 }));
    expect(String(e?.message || '')).toMatch(/VERSION_CONFLICT/);
    expect(String(e?.message || '')).not.toMatch(/version \d/);   // ya NO filtra la version
    expect((await rpc(db, A, 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' })).version).toBe(2);   // el conflicto no escribio
  });

  it('historial append-only: cada guardado deja una copia inmutable, aislada por dueño', async () => {
    await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_A });              // v1
    await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: { ...EXP_A, v: 2 }, p_version_anterior: 1 }); // v2
    await rpc(db, B, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_B });              // B v1
    const hA = (await db.query(`select count(*)::int c from public.expediente_costeo_historial where creado_por=$1`, [A])).rows[0].c;
    const hB = (await db.query(`select count(*)::int c from public.expediente_costeo_historial where creado_por=$1`, [B])).rows[0].c;
    expect(hA).toBe(2); expect(hB).toBe(1);
  });

  it('sin autenticar -> rechazado (guardar y reabrir)', async () => {
    expect(String((await fallo(rpc(db, '', 'guardar_expediente_costeo', { p_clave: 'X', p_expediente: EXP_A })))?.message || '')).toMatch(/no autenticado/);
    expect(String((await fallo(rpc(db, '', 'reabrir_expediente_costeo', { p_clave: 'X' })))?.message || '')).toMatch(/no autenticado/);
  });

  it('roles: execute concedido a authenticated, revocado a anon/public', async () => {
    const q = async (role, fn) => (await db.query(
      `select has_function_privilege($1, oid, 'execute') e from pg_proc where proname=$2 and pronamespace='public'::regnamespace`, [role, fn])).rows[0].e;
    expect(await q('authenticated', 'guardar_expediente_costeo')).toBe(true);
    expect(await q('anon', 'guardar_expediente_costeo')).toBe(false);
    expect(await q('authenticated', 'reabrir_expediente_costeo')).toBe(true);
    expect(await q('anon', 'reabrir_expediente_costeo')).toBe(false);
  });

  it('RLS: politica de la tabla es por creado_por INMUTABLE (no por actualizado_por mutable)', async () => {
    const pol = (await db.query(`select qual from pg_policies where tablename='expediente_costeo' and policyname='expediente_costeo_owner'`)).rows[0];
    expect(pol).toBeTruthy();
    expect(String(pol.qual)).toMatch(/creado_por/);
    expect(String(pol.qual)).not.toMatch(/actualizado_por/);   // el dueño no depende del ultimo editor
  });
});

describe('P0 expediente_costeo · PARTE B — compatibilidad con la fila QA preexistente', () => {
  // Simula prod: la tabla ya tiene la fila QA de qa-direccion ANTES de aplicar el fix.
  const QA = 'qa-direccion@vonhaucke.mx';
  const seed = `insert into public.expediente_costeo (clave, version, expediente, creado_por, actualizado_por)
                values ('TELSVH120', 3, '{"clave":"TELSVH120","qa":true}'::jsonb, '${QA}', '${QA}');`;

  it('la fila QA sobrevive al fix y su dueño la sigue reabriendo (sin perder version)', async () => {
    const db = await baseNueva(seed);
    const r = await rpc(db, QA, 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' });
    expect(r).toBeTruthy();
    expect(r.version).toBe(3);
    expect(r.expediente.qa).toBe(true);
    // Y ya aislada: otro usuario no la ve.
    expect(await rpc(db, 'otro@vh.mx', 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' })).toBeNull();
    await db.close();
  });

  it('tras el fix, un atacante NO puede reclamar la fila QA (crea la suya propia)', async () => {
    const db = await baseNueva(seed);
    // Atacante intenta sobrescribir la fila QA conocida.
    const g = await rpc(db, B, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_B, p_version_anterior: 3 });
    expect(g.version).toBe(1);   // creo su PROPIA fila v1; no toco la QA v3
    // La fila QA sigue intacta y de su dueño.
    const rQA = await rpc(db, QA, 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' });
    expect(rQA.version).toBe(3);
    expect(rQA.expediente.qa).toBe(true);
    await db.close();
  });
});
