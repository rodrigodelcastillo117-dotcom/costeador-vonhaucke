// VH-148 · prueba REAL de dos conexiones: dos clientes supabase-js con sesiones de GoTrue (JWT reales) contra
// PostgREST y Postgres 16, con el SQL de la rama (VH-148 + VH-148b + SEG-01 + SEG-01c rev4). Datos QA, nada comercial.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import pg from './node_modules/pg/lib/index.js';
import { createClient } from '../../../node_modules/@supabase/supabase-js/dist/index.mjs';
import { promesaComercialDeCosteo } from '../../../src/datos/promesaComercial.js';

const URL = 'http://127.0.0.1:59990';
const SECRET = fs.readFileSync('./jwt_secret', 'utf8').trim();
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (claims) => { const h = b64({ alg: 'HS256', typ: 'JWT' }); const p = b64({ iss: 'qa148', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...claims });
  return `${h}.${p}.${crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`; };
const ANON = jwt({ role: 'anon' }); const SERVICE = jwt({ role: 'service_role' });
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const db = new pg.Client({ connectionString: 'postgres://postgres@127.0.0.1:54329/postgres' }); await db.connect();
const ahora = () => new Date().toISOString();
const ev = { generado: ahora(), entorno: {}, casos: [] };
const paso = (caso, p) => { caso.pasos.push({ t: ahora(), ...p }); };
const err = (e) => (e ? { code: e.code, message: e.message, details: e.details ?? null } : null);

// --- sesiones reales -----------------------------------------------------------------------------------------
async function sesion(email) {
  const pw = crypto.randomBytes(18).toString('base64url');   // nunca se imprime
  const admin = createClient(URL, SERVICE, opts);
  const { error: e1 } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
  if (e1 && !/already/i.test(e1.message)) throw e1;
  if (e1) { const { data } = await admin.auth.admin.listUsers(); const u = data.users.find((x) => x.email === email); await admin.auth.admin.updateUserById(u.id, { password: pw }); }
  const c = createClient(URL, ANON, opts);
  const { data, error } = await c.auth.signInWithPassword({ email, password: pw });
  if (error) throw error;
  return { c, email, uid: data.user.id, jwtIat: JSON.parse(Buffer.from(data.session.access_token.split('.')[1], 'base64url')).iat };
}
const A = await sesion('qa148-direccion@vonhaucke.test');   // Dirección
const B = await sesion('qa148-ventas@vonhaucke.test');      // Vendedor dueño de la cotización
const C = await sesion('qa148-diseno@vonhaucke.test');      // Diseño
ev.entorno = {
  postgres: (await db.query('select version() v')).rows[0].v.split(',')[0],
  gotrue: (await (await fetch(URL + '/auth/v1/health')).json()).version,
  postgrest: execSync('./postgrest --version').toString().trim(), supabase_js: '2.112.3',
  sesiones: [A, B, C].map((s) => ({ email: s.email, uid: s.uid, rol: null })),
  sql: ['baseVh148b (producción 14-oct)', 'PROPUESTA_p103b', 'PROPUESTA_vh148', 'PROPUESTA_vh148b', 'PROPUESTA_seg01', 'PROPUESTA_seg01c (rev4)'],
};
for (const s of ev.entorno.sesiones) s.rol = (await db.query('select rol from public.permitidos where email=$1', [s.email])).rows[0].rol;
const svc = createClient(URL, SERVICE, opts);
const fila = async (id) => (await db.query('select to_json(actualizado)#>>\'{}\' as actualizado, cliente, partidas from public.cotizaciones where id=$1', [id])).rows[0];
const leerV = async (s, id) => { const { data, error } = await s.c.rpc('cotizacion_segura', { p_id: id }); if (error) throw error; return data.actualizado; };
const guardar = (s, id, patch, v) => s.c.rpc('actualizar_cotizacion_segura', { p_cotizacion_id: id, p_patch: patch, ...(v === undefined ? {} : { p_actualizado_esperado: v }) });
const sembrarCot = async (partidas) => (await db.query(`insert into public.cotizaciones(usuario, cliente, folio, partidas, total, piezas)
  values ($1, 'QA-VH148 · prueba de dos conexiones (sin datos comerciales)', 'QA-VH148', $2::jsonb, 10000, 1) returning id`, [B.email, JSON.stringify(partidas)])).rows[0].id;
const PARTIDA = { id: 'p1', nombre: 'QA-VH148 Escritorio de prueba', w: 1200, d: 600, cantidad: 1, precioUnitario: 10000, materiales: ['m16'], piezas: ['Cubierta'] };

// --- Caso 1: conflicto de COTIZACIÓN (A Dirección vs B vendedor dueño) -------------------------------------------
{
  const caso = { caso: '1 · cotización: dos sesiones guardan desde la MISMA versión', pasos: [] }; ev.casos.push(caso);
  const id = await sembrarCot([PARTIDA]);
  const vA = await leerV(A, id); const vB = await leerV(B, id);
  paso(caso, { quien: 'A y B', accion: 'leen cotizacion_segura', version_A: vA, version_B: vB });
  const rA = await guardar(A, id, { cliente: 'QA-VH148 · editado por A' }, vA);
  paso(caso, { quien: 'A', accion: 'guarda con su versión', esperado: 'ok', status: rA.status, error: err(rA.error), version_nueva: rA.data?.actualizado ?? null });
  const rB = await guardar(B, id, { cliente: 'QA-VH148 · editado por B (pisaría a A)' }, vB);
  paso(caso, { quien: 'B', accion: 'guarda con la versión VIEJA', esperado: 'PT409 (HTTP 409) CONFLICTO_VERSION', status: rB.status, error: err(rB.error), revision_esperada_por_B: vB });
  const rN = await guardar(B, id, { cliente: 'QA-VH148 · sin versión' }, null);
  paso(caso, { quien: 'B', accion: 'guarda sin versión (p_actualizado_esperado = null)', esperado: '22004 VERSION_REQUIRED', status: rN.status, error: err(rN.error) });
  const f = await fila(id);
  caso.final = { cliente: f.cliente, actualizado: f.actualizado };
  caso.ok = !rA.error && rB.error?.code === 'PT409' && rN.error?.code === '22004' && f.cliente === 'QA-VH148 · editado por A' && f.actualizado === rA.data?.actualizado;
}
// --- Caso 1b: carrera SIMULTÁNEA, misma versión, 10 rondas ---------------------------------------------------------
{
  const caso = { caso: '1b · cotización: A y B guardan al MISMO tiempo desde la misma versión (10 rondas)', pasos: [] }; ev.casos.push(caso);
  const id = await sembrarCot([PARTIDA]);
  let todas = true;
  for (let i = 1; i <= 10; i++) {
    const v = await leerV(A, id);
    const [ra, rb] = await Promise.all([guardar(A, id, { cliente: `QA-VH148 carrera ${i} · A` }, v), guardar(B, id, { cliente: `QA-VH148 carrera ${i} · B` }, v)]);
    const ganadores = [ra, rb].filter((r) => !r.error).length; const conflictos = [ra, rb].filter((r) => r.error?.code === 'PT409').length;
    const f = await fila(id); const gano = !ra.error ? 'A' : !rb.error ? 'B' : null;
    const coherente = ganadores === 1 && conflictos === 1 && f.cliente === `QA-VH148 carrera ${i} · ${gano}` && f.actualizado === (gano === 'A' ? ra : rb).data.actualizado;
    todas &&= coherente;
    paso(caso, { ronda: i, version_comun: v, gano, ganadores, conflictos, error_perdedor: err((gano === 'A' ? rb : ra).error), final: f.cliente, coherente });
  }
  caso.ok = todas;
}
// --- Caso 2: conflicto de EXPEDIENTE (A Dirección vs C Diseño), por RPC y por escritura directa -------------------
{
  const caso = { caso: '2 · expediente: dos sesiones editan la MISMA revisión', pasos: [] }; ev.casos.push(caso);
  const { id } = (await db.query(`insert into public.expedientes(creado_por, nombre, estado, bom, costo, revision)
    values ($1, 'QA-VH148 Credenza de prueba', 'borrador', '[{"pieza":"tapa"}]'::jsonb, '{"costoUnitario":5000}'::jsonb, 1) returning id`, [C.email])).rows[0];
  await db.query('insert into public.expediente_revisiones(expediente_id, rev, creado_por, nombre) values ($1, 1, $2, $3)', [id, C.email, 'QA-VH148 Credenza de prueba']);
  const rA = await A.c.rpc('actualizar_expediente_seguro', { p_expediente_id: id, p_patch: { nombre: 'QA-VH148 Credenza · A' }, p_revision_esperada: 1 });
  paso(caso, { quien: 'A', accion: 'RPC actualizar_expediente_seguro con revisión 1', esperado: 'ok (rev 2)', status: rA.status, error: err(rA.error), data: rA.data ?? null });
  const rC = await C.c.rpc('actualizar_expediente_seguro', { p_expediente_id: id, p_patch: { nombre: 'QA-VH148 Credenza · C (pisaría a A)' }, p_revision_esperada: 1 });
  paso(caso, { quien: 'C', accion: 'RPC con la revisión VIEJA (1)', esperado: 'PT409', status: rC.status, error: err(rC.error) });
  const rD = await C.c.from('expedientes').update({ nombre: 'QA-VH148 Credenza · C directo', revision: 2 }).eq('id', id).select('revision');
  paso(caso, { quien: 'C', accion: 'UPDATE directo por PostgREST con revision = 2 (la que ya escribió A)', esperado: 'PT409', status: rD.status, error: err(rD.error) });
  const [x, y] = await Promise.all([
    A.c.rpc('actualizar_expediente_seguro', { p_expediente_id: id, p_patch: { nombre: 'QA-VH148 Credenza · carrera A' }, p_revision_esperada: 2 }),
    C.c.rpc('actualizar_expediente_seguro', { p_expediente_id: id, p_patch: { nombre: 'QA-VH148 Credenza · carrera C' }, p_revision_esperada: 2 }),
  ]);
  paso(caso, { quien: 'A y C', accion: 'carrera simultánea con revisión 2', esperado: 'uno gana, otro PT409', A: err(x.error) ?? 'ok', C: err(y.error) ?? 'ok' });
  const f = (await db.query('select revision, nombre from public.expedientes where id=$1', [id])).rows[0];
  const revs = (await db.query('select rev, nombre from public.expediente_revisiones where expediente_id=$1 order by rev', [id])).rows;
  caso.final = { expediente: f, historial: revs };
  const gano = !x.error ? 'A' : 'C';
  caso.ok = !rA.error && rC.error?.code === 'PT409' && rD.error?.code === 'PT409' && [x, y].filter((r) => !r.error).length === 1
    && [x, y].filter((r) => r.error?.code === 'PT409').length === 1 && f.revision === 3 && f.nombre === `QA-VH148 Credenza · carrera ${gano}`
    && revs.map((r) => r.rev).join(',') === '1,2,3';
}
// --- Caso 3: vínculo de costeo con VERSIÓN VIEJA (A vincula, B guardó en medio) -----------------------------------
{
  const caso = { caso: '3 · adjuntar_costeo_a_partida con versión vieja', pasos: [] }; ev.casos.push(caso);
  const reg = async () => {
    const { data, error } = await svc.from('costeos_servidor').insert({
      creado_por: A.email, rol: 'direccion', bom_hash: 'qa148', cantidad: 1, costo_unitario: 6000, estado: 'certificado', aprobacion_humana: true,
      precios: [{ insumo_id: 'm16', precio_id: 900, precio_usado: 612.4, approved_by: 'qa148-direccion@vonhaucke.test', humana: true }],
      insumos_usados: ['m16'], version_motor: 'motor-1', identidad_origen: { nombre: PARTIDA.nombre, w: 1200, d: 600 },
      componentes_costeados: [{ nombre: 'Cubierta', insumoId: 'm16' }], promesa_origen: promesaComercialDeCosteo(PARTIDA), promesa_version: 'v1',
    }).select('id, promesa_version, promesa_huella').single();
    if (error) throw error; return data;
  };
  const K = await reg();
  paso(caso, { quien: 'servidor (service_role)', accion: 'registra el costeo K', K: K.id, promesa_version: K.promesa_version, promesa_huella: K.promesa_huella });
  const id = await sembrarCot([{ ...PARTIDA, costeoId: K.id }]);
  const v0 = await leerV(A, id);
  paso(caso, { quien: 'A', accion: 'lee la versión tras su guardado', version: v0 });
  const rB = await guardar(B, id, { partidas: [{ ...PARTIDA, costeoId: K.id, precioUnitario: 9900 }] }, await leerV(B, id));
  paso(caso, { quien: 'B', accion: 'guarda en medio (cambia precio)', status: rB.status, error: err(rB.error), version_nueva: rB.data?.actualizado ?? null });
  const r1 = await A.c.rpc('adjuntar_costeo_a_partida', { p_cotizacion_id: id, p_partida_id: 'p1', p_costeo_id: K.id, p_actualizado_esperado: v0 });
  const vig1 = (await db.query('select count(*)::int n from public.partida_costeo_vigente where costeo_id=$1', [K.id])).rows[0].n;
  paso(caso, { quien: 'A', accion: 'adjunta con la versión VIEJA', esperado: 'PT409 (HTTP 409) y nada vinculado', revision_esperada_por_A: v0, revision_real: rB.data?.actualizado, status: r1.status, error: err(r1.error), vinculos_vigentes: vig1 });
  const r0 = await A.c.rpc('adjuntar_costeo_a_partida', { p_cotizacion_id: id, p_partida_id: 'p1', p_costeo_id: K.id, p_actualizado_esperado: null });
  paso(caso, { quien: 'A', accion: 'adjunta sin versión', esperado: '22004', status: r0.status, error: err(r0.error) });
  const v1 = await leerV(A, id);
  const r2 = await A.c.rpc('adjuntar_costeo_a_partida', { p_cotizacion_id: id, p_partida_id: 'p1', p_costeo_id: K.id, p_actualizado_esperado: v1 });
  paso(caso, { quien: 'A', accion: 'control: recarga y adjunta con la versión fresca', esperado: 'ok', status: r2.status, error: err(r2.error), data: r2.data ?? null });
  // Carrera: B guarda y A adjunta un K2 nuevo AL MISMO tiempo desde la misma versión.
  const K2 = await reg(); const v2 = await leerV(A, id);
  const [ra, rb] = await Promise.all([
    A.c.rpc('adjuntar_costeo_a_partida', { p_cotizacion_id: id, p_partida_id: 'p1', p_costeo_id: K2.id, p_actualizado_esperado: v2 }),
    guardar(B, id, { partidas: [{ ...PARTIDA, costeoId: K.id, precioUnitario: 9800 }] }, v2),
  ]);
  const f = await fila(id);
  const vig = (await db.query('select costeo_id from public.partida_costeo_vigente where cotizacion_id=$1', [id])).rows.map((r) => r.costeo_id);
  paso(caso, { quien: 'A y B', accion: 'carrera: A adjunta K2 y B guarda, misma versión', esperado: 'uno gana, otro PT409', A: err(ra.error) ?? 'ok', B: err(rb.error) ?? 'ok', vigente: vig, precio_final: f.partidas[0].precioUnitario, costeoId_final: f.partidas[0].costeoId });
  caso.final = { actualizado: f.actualizado, partida: f.partidas[0], vigente: vig };
  const unoGano = [ra, rb].filter((r) => !r.error).length === 1 && [ra, rb].filter((r) => r.error?.code === 'PT409').length === 1;
  const coherente = !ra.error ? (vig[0] === K2.id && f.partidas[0].costeoId === K2.id) : (vig[0] === K.id && f.partidas[0].precioUnitario === 9800);
  caso.ok = !rB.error && r1.error?.code === 'PT409' && vig1 === 0 && r0.error?.code === '22004' && !r2.error && unoGano && coherente;
}
ev.ok = ev.casos.every((c) => c.ok);
process.exitCode = ev.ok ? 0 : 1;
fs.writeFileSync(process.argv[2] || './evidencia.json', JSON.stringify(ev, null, 2));
console.log(JSON.stringify({ ok: ev.ok, casos: ev.casos.map((c) => [c.caso, c.ok]) }, null, 1));
await db.end();
