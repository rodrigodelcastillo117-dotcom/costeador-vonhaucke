// ============================================================================
//  P0 SEGURIDAD · expediente_costeo — prueba adversarial en Postgres (PGlite).
//
//  PARTE A (REPRO): sobre el contrato VIEJO (20261111, por EMAIL) demuestra el
//    defecto: un usuario B sobrescribe y RECLAMA el expediente de A, y el error
//    VERSION_CONFLICT le FILTRA la version de la fila ajena.
//  PARTE B (FIX): sobre el contrato NUEVO (20261111 + 20261112) demuestra el
//    cierre con DUEÑO = auth.uid() (UUID INMUTABLE): aislamiento total por dueño,
//    sin colision de claves, dueño inmutable, concurrencia optimista, historial,
//    roles y compat con la fila QA preexistente (backfill email->uid). Ninguna
//    migracion esta aplicada a prod.
// ============================================================================
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const RAIZ = new URL('../../', import.meta.url);
const MIG_VIEJA = 'supabase/migrations/20261111_expediente_costeo.sql';
const MIG_FIX   = 'supabase/migrations/20261112_expediente_costeo_seguridad.sql';
// Usuarios con UUID inmutable + email (auditoria).
const A  = { uid: '11111111-1111-1111-1111-111111111111', email: 'a@vh.mx' };
const B  = { uid: '22222222-2222-2222-2222-222222222222', email: 'b@vh.mx' };
const QA = { uid: '33333333-3333-3333-3333-333333333333', email: 'qa-direccion@vonhaucke.mx' };
const EXP_A = { clave: 'TELSVH120', interpretacion: { producto: 'Vitrina A' }, secreto: 'de A' };
const EXP_B = { clave: 'TELSVH120', interpretacion: { producto: 'Vitrina B' }, marca: 'de B' };

async function rpc(db, user, fn, args) {
  const ks = Object.keys(args);
  const sql = `select public.${fn}(${ks.map((k, i) => `${k} => $${i + 1}${k === 'p_expediente' ? '::jsonb' : k === 'p_version_anterior' ? '::integer' : ''}`).join(', ')}) as r`;
  const params = ks.map((k) => { const v = args[k]; return (v !== null && typeof v === 'object') ? JSON.stringify(v) : v; });
  const uid = user && user.uid ? user.uid : '';
  const email = user && user.email ? user.email : (typeof user === 'string' ? user : '');
  await db.exec(`select set_config('test.uid', '${uid}', false), set_config('test.email', '${email}', false)`);
  try { return (await db.query(sql, params)).rows[0].r; }
  finally { await db.exec(`select set_config('test.uid', '', false), set_config('test.email', '', false)`); }
}
const fallo = async (p) => { try { await p; } catch (e) { return e; } return null; };

async function scaffold() {
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$
      select case when coalesce(current_setting('test.email', true),'')='' then '{}'::jsonb
        else jsonb_build_object('email', current_setting('test.email', true)) end $$;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.uid', true),'')::uuid $$;
    create table auth.users (id uuid primary key, email text);
    insert into auth.users (id, email) values
      ('${A.uid}','${A.email}'), ('${B.uid}','${B.email}'), ('${QA.uid}','${QA.email}');
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

describe('P0 expediente_costeo · PARTE A — reproduccion del defecto (contrato viejo, por email)', () => {
  let db; beforeEach(async () => { db = await baseVieja(); });

  it('B puede SOBRESCRIBIR y RECLAMAR el expediente de A (control transfer)', async () => {
    const g = await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_A });
    expect(g.version).toBe(1);
    expect((await rpc(db, A, 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' })).expediente.secreto).toBe('de A');
    const gB = await rpc(db, B, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_B, p_version_anterior: 1 });
    expect(gB.ok).toBe(true);   // DEFECTO: B sobrescribio la fila de A
    expect(await rpc(db, A, 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' })).toBeNull();      // A fuera
    expect((await rpc(db, B, 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' })).expediente.marca).toBe('de B'); // B dentro
  });

  it('el error VERSION_CONFLICT FILTRA la version de la fila ajena', async () => {
    await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_A });
    await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_A, p_version_anterior: 1 });
    const e = await fallo(rpc(db, B, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_B }));
    expect(String(e?.message || '')).toMatch(/version 2/);   // DEFECTO: fuga de informacion
  });
});

describe('P0 expediente_costeo · PARTE B — cierre (contrato nuevo, dueño = auth.uid())', () => {
  let db; beforeEach(async () => { db = await baseNueva(); });

  it('B NO puede sobrescribir ni reclamar el expediente de A — filas aisladas por uid', async () => {
    await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_A });
    const gB = await rpc(db, B, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_B });
    expect(gB.version).toBe(1);   // fila nueva de B, no overwrite de A

    const rA = await rpc(db, A, 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' });
    expect(rA.expediente.secreto).toBe('de A'); expect(rA.version).toBe(1);
    expect((await rpc(db, B, 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' })).expediente.marca).toBe('de B');

    const n = (await db.query(`select count(*)::int c from public.expediente_costeo where clave='TELSVH120'`)).rows[0].c;
    expect(n).toBe(2);
    // Dos propietarios distintos (uid), no colision por clave comercial.
    const props = (await db.query(`select count(distinct propietario)::int c from public.expediente_costeo where clave='TELSVH120'`)).rows[0].c;
    expect(props).toBe(2);
  });

  it('acceso cruzado denegado: B no lee la fila de A por ninguna via de la RPC', async () => {
    await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_A });
    expect(await rpc(db, B, 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' })).toBeNull();
  });

  it('dueño INMUTABLE: tras varios guardados de A, propietario sigue siendo el uid de A; cambiar email NO transfiere', async () => {
    await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_A });
    await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: { ...EXP_A, v: 2 }, p_version_anterior: 1 });
    const row = (await db.query(`select propietario, version from public.expediente_costeo where clave='TELSVH120'`)).rows[0];
    expect(row.propietario).toBe(A.uid); expect(row.version).toBe(2);
    // Si el EMAIL de A se reasignara a B (mismo email, distinto uid), B NO accede (dueño es el uid).
    const bConEmailDeA = { uid: B.uid, email: A.email };
    expect(await rpc(db, bConEmailDeA, 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' })).toBeNull();
  });

  it('concurrencia optimista preservada: version vieja -> VERSION_CONFLICT sin fuga de numero', async () => {
    await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_A });
    await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_A, p_version_anterior: 1 });
    const e = await fallo(rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_A, p_version_anterior: 1 }));
    expect(String(e?.message || '')).toMatch(/VERSION_CONFLICT/);
    expect(String(e?.message || '')).not.toMatch(/version \d/);
    expect((await rpc(db, A, 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' })).version).toBe(2);
  });

  it('historial append-only por propietario', async () => {
    await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_A });
    await rpc(db, A, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: { ...EXP_A, v: 2 }, p_version_anterior: 1 });
    await rpc(db, B, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_B });
    const hA = (await db.query(`select count(*)::int c from public.expediente_costeo_historial where propietario=$1`, [A.uid])).rows[0].c;
    const hB = (await db.query(`select count(*)::int c from public.expediente_costeo_historial where propietario=$1`, [B.uid])).rows[0].c;
    expect(hA).toBe(2); expect(hB).toBe(1);
  });

  it('sin autenticar (sin uid) -> rechazado (guardar y reabrir)', async () => {
    expect(String((await fallo(rpc(db, { uid: '', email: '' }, 'guardar_expediente_costeo', { p_clave: 'X', p_expediente: EXP_A })))?.message || '')).toMatch(/no autenticado/);
    expect(String((await fallo(rpc(db, { uid: '', email: '' }, 'reabrir_expediente_costeo', { p_clave: 'X' })))?.message || '')).toMatch(/no autenticado/);
  });

  it('roles: execute concedido a authenticated, revocado a anon/public', async () => {
    const q = async (role, fn) => (await db.query(
      `select has_function_privilege($1, oid, 'execute') e from pg_proc where proname=$2 and pronamespace='public'::regnamespace`, [role, fn])).rows[0].e;
    expect(await q('authenticated', 'guardar_expediente_costeo')).toBe(true);
    expect(await q('anon', 'guardar_expediente_costeo')).toBe(false);
    expect(await q('authenticated', 'reabrir_expediente_costeo')).toBe(true);
    expect(await q('anon', 'reabrir_expediente_costeo')).toBe(false);
  });

  it('RLS: politica de la tabla es por propietario (auth.uid()), no por email', async () => {
    const pol = (await db.query(`select qual from pg_policies where tablename='expediente_costeo' and policyname='expediente_costeo_owner'`)).rows[0];
    expect(pol).toBeTruthy();
    expect(String(pol.qual)).toMatch(/propietario/);
    expect(String(pol.qual)).not.toMatch(/actualizado_por/);
  });
});

describe('P0 expediente_costeo · PARTE B — compatibilidad con la fila QA preexistente (backfill email->uid)', () => {
  const seed = `insert into public.expediente_costeo (clave, version, expediente, creado_por, actualizado_por)
                values ('TELSVH120', 3, '{"clave":"TELSVH120","qa":true}'::jsonb, '${QA.email}', '${QA.email}');`;

  it('la fila QA sobrevive al fix; se le asigna propietario=uid y su dueño la reabre', async () => {
    const db = await baseNueva(seed);
    const prop = (await db.query(`select propietario from public.expediente_costeo where clave='TELSVH120'`)).rows[0].propietario;
    expect(prop).toBe(QA.uid);   // backfill email->uid desde auth.users
    const r = await rpc(db, QA, 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' });
    expect(r).toBeTruthy(); expect(r.version).toBe(3); expect(r.expediente.qa).toBe(true);
    expect(await rpc(db, A, 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' })).toBeNull();
    await db.close();
  });

  it('tras el fix, un atacante NO puede reclamar la fila QA (crea la suya propia)', async () => {
    const db = await baseNueva(seed);
    const g = await rpc(db, B, 'guardar_expediente_costeo', { p_clave: 'TELSVH120', p_expediente: EXP_B, p_version_anterior: 3 });
    expect(g.version).toBe(1);   // su propia fila v1; no toco la QA v3
    const rQA = await rpc(db, QA, 'reabrir_expediente_costeo', { p_clave: 'TELSVH120' });
    expect(rQA.version).toBe(3); expect(rQA.expediente.qa).toBe(true);
    await db.close();
  });

  it('backfill fail-closed: una fila con email que NO mapea a auth.users aborta la migracion', async () => {
    const db = await scaffold();
    await db.exec(readFileSync(new URL(MIG_VIEJA, RAIZ), 'utf8'));
    await db.exec(`insert into public.expediente_costeo (clave, version, expediente, creado_por, actualizado_por)
                   values ('HUERFANA', 1, '{"x":1}'::jsonb, 'desconocido@nadie.mx', 'desconocido@nadie.mx');`);
    const e = await fallo(db.exec(readFileSync(new URL(MIG_FIX, RAIZ), 'utf8')));
    expect(String(e?.message || '')).toMatch(/MIGRACION_ABORTADA/);
    await db.close();
  });
});
