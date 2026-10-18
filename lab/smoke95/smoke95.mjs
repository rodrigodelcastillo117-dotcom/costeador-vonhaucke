// SMOKE REAL · RELEASE_9_5_GATE §5.5 pasos 1–5, contra PRODUCCIÓN (modo preparado), con una sesión humana.
// Correr desde la raíz del repo:  node lab/smoke95/smoke95.mjs
// Pide correo y contraseña en la terminal (la contraseña no se muestra ni se guarda). Crea UNA cotización
// "(lab ventana 9.5)" en borrador con un especial costeado por la Edge de producción, la usa y al final la archiva.
// Ninguna aprobación de precio, ninguna emisión. Evidencia (sin secretos): lab/smoke95/evidencia.json
import { createClient } from '@supabase/supabase-js';
import readline from 'node:readline';
import fs from 'node:fs';
import { validarIntentCosteo, intentDesdePieza } from '../../src/datos/validarIntentCosteo.js';
import { partidaAutoritativaDeCosteo } from '../../src/datos/agregarCosteo.js';

const URL_NUBE = 'https://mtuvnbgljwbsaizjjgzs.supabase.co';
const LLAVE = 'sb_publishable_lDPhCTatyJ2cap3FNEGs7A_uPapgg6y';
const SALIDA = new URL('./evidencia.json', import.meta.url);

function preguntar(texto, oculto = false) {
  return new Promise((ok) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto) rl._writeToOutput = (s) => { if (s.includes(texto)) rl.output.write(texto); };
    rl.question(texto, (r) => { rl.close(); if (oculto) process.stdout.write('\n'); ok(r.trim()); });
  });
}

const ev = { inicio: new Date().toISOString(), pasos: {} };
const paso = (k, ok, datos) => { ev.pasos[k] = { ok, ...datos }; console.log(`${ok ? 'PASS' : 'FAIL'}  ${k}  ${JSON.stringify(datos).slice(0, 220)}`); };
const guardar = () => fs.writeFileSync(SALIDA, JSON.stringify(ev, null, 2));

const email = process.env.SMOKE_EMAIL || await preguntar('Correo (Diseño o Dirección): ');
const password = await preguntar('Contraseña (no se muestra): ', true);
const sb = createClient(URL_NUBE, LLAVE, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: eLogin } = await sb.auth.signInWithPassword({ email, password });
if (eLogin) { console.log('No se pudo iniciar sesión:', eLogin.message); process.exit(1); }
ev.cuenta_dominio = email.split('@')[1];

let cotId = null;
try {
  // 1) Costear un especial con la Edge de PRODUCCIÓN (insumo ERP real con precio aprobado).
  const conf = (c) => ({ ...c, material_confirmado: true });
  const A = { nombre: 'Escritorio (lab ventana 9.5)', w: 1500, d: 700, piezas: 1, componentes: [
    conf({ nombre: 'Cubierta', insumoId: 'erp-agme4828ga', cantidad: 1, largoMM: 1500, anchoMM: 700 }),
    conf({ nombre: 'Lateral', insumoId: 'erp-agme4828ga', cantidad: 2, largoMM: 700, anchoMM: 680 }) ] };
  const v = validarIntentCosteo(intentDesdePieza(A, 1));
  if (!v.ok) throw new Error('intent inválido: ' + v.code);
  const t0 = Date.now();
  const { data: srv, error: eSrv } = await sb.functions.invoke('costear-servidor', { body: v.intent });
  if (eSrv) { let j = null; try { j = await eSrv.context?.json?.(); } catch (_e) { /* sin cuerpo */ } throw new Error('costear-servidor: ' + (j?.error || eSrv.message)); }
  ev.costeo = { ms: Date.now() - t0, estado: srv.estado, costeoId: srv.costeoId, versionMotor: srv.versionMotor, costo: srv.costo?.costoUnitario,
    conSpec: !!srv.especificacionTecnica, warnings: srv.warnings };
  paso('1_costear_registra_K', !!srv.ok && !!srv.costeoId && !!srv.especificacionTecnica, ev.costeo);

  // 2) La partida la arma EL MISMO código del cliente y se guarda en una cotización de laboratorio; luego se adjunta.
  const precio = Math.round((Number(srv.costo?.costoUnitario) || 1000) * 2);
  const a = await partidaAutoritativaDeCosteo({ costeo: A, resultado: { costoUnitario: srv.costo?.costoUnitario, componentesIgnorados: [] },
    precio, margen: 50, costearServidor: async () => srv, pendientes: () => [], nuevoId: () => 'lab95-p1' });
  if (!a.ok) throw new Error('partida: ' + a.error);
  const { data: cre, error: eCre } = await sb.rpc('crear_cotizacion_segura', { p_payload: {
    folio: null, cliente: '(lab ventana 9.5)', usuario: email, estado: 'borrador', partidas: [a.partida], totales: {} } });
  if (eCre) throw new Error('crear: ' + eCre.message);
  cotId = cre?.id; ev.cotizacion_id = cotId;
  const { data: adj, error: eAdj } = await sb.rpc('adjuntar_costeo_a_partida', {
    p_cotizacion_id: cotId, p_partida_id: 'lab95-p1', p_costeo_id: srv.costeoId, p_actualizado_esperado: cre.actualizado });
  paso('2_adjuntar_ok', !eAdj && adj?.ok === true, { error: eAdj?.message || null, estado: adj?.estado });

  // 3) Diagnóstico de autoridad: preparado y sin motivos para ese renglón.
  const { data: dg, error: eDg } = await sb.rpc('diagnostico_autoridad_costeo', { p_cotizacion_id: cotId });
  paso('3_diagnostico_preparado', !eDg && dg?.modo === 'preparado', { error: eDg?.message || null, ...dg });

  // 4) Cambiar la cantidad de un renglón del despiece en la partida guardada y volver a adjuntar ⇒ rechazo.
  const { data: c1 } = await sb.rpc('cotizacion_segura', { p_id: cotId });
  const partidas = JSON.parse(JSON.stringify(c1.partidas));
  partidas[0].especificacion_tecnica.componentes[0].cantidad = Number(partidas[0].especificacion_tecnica.componentes[0].cantidad || 1) + 1;
  const { data: up4, error: eUp4 } = await sb.rpc('actualizar_cotizacion_segura', { p_cotizacion_id: cotId, p_patch: { partidas }, p_actualizado_esperado: c1.actualizado });
  const { error: eAdj2 } = await sb.rpc('adjuntar_costeo_a_partida', {
    p_cotizacion_id: cotId, p_partida_id: 'lab95-p1', p_costeo_id: srv.costeoId, p_actualizado_esperado: up4?.actualizado ?? c1.actualizado });
  const { data: dg2 } = await sb.rpc('diagnostico_autoridad_costeo', { p_cotizacion_id: cotId });
  paso('4_despiece_cambiado_rechaza', !!eAdj2 && /recostea/i.test(eAdj2.message || ''), {
    guardado: eUp4 ? eUp4.message : 'ok', rechazo: eAdj2?.message || null, motivos_despues: dg2?.motivos });

  // 5) Guardar con la versión vieja desde "dos sesiones" ⇒ HTTP 409 PT409 en menos de 1 s, sin escribir.
  const { data: c2 } = await sb.rpc('cotizacion_segura', { p_id: cotId });
  const v0 = c2.actualizado;
  const r1 = await sb.rpc('actualizar_cotizacion_segura', { p_cotizacion_id: cotId, p_patch: { cliente: '(lab ventana 9.5) sesión A' }, p_actualizado_esperado: v0 });
  const t5 = Date.now();
  const r2 = await sb.rpc('actualizar_cotizacion_segura', { p_cotizacion_id: cotId, p_patch: { cliente: '(lab ventana 9.5) sesión B' }, p_actualizado_esperado: v0 });
  const ms5 = Date.now() - t5;
  const { data: c3 } = await sb.rpc('cotizacion_segura', { p_id: cotId });
  paso('5_version_vieja_409', !r1.error && r2.status === 409 && r2.error?.code === 'PT409' && ms5 < 1000 && c3.cliente === '(lab ventana 9.5) sesión A',
    { primera: r1.error?.code || r1.status, segunda_status: r2.status, segunda_code: r2.error?.code, ms: ms5, cliente_final: c3.cliente });
  const r3 = await sb.rpc('actualizar_cotizacion_segura', { p_cotizacion_id: cotId, p_patch: { cliente: 'x' }, p_actualizado_esperado: null });
  paso('5b_sin_version_22004', r3.error?.code === '22004', { status: r3.status, code: r3.error?.code });
} catch (e) {
  paso('error', false, { mensaje: String(e.message || e).slice(0, 300) });
} finally {
  if (cotId) {
    const { error: eArch } = await sb.from('cotizaciones').update({ activa: false }).eq('id', cotId);
    ev.archivada = !eArch; if (eArch) ev.error_archivar = eArch.message;
  }
  ev.fin = new Date().toISOString();
  ev.resumen = Object.entries(ev.pasos).map(([k, p]) => `${p.ok ? 'PASS' : 'FAIL'} ${k}`);
  guardar();
  await sb.auth.signOut();
  console.log(`\nEvidencia: ${SALIDA.pathname}`);
}
