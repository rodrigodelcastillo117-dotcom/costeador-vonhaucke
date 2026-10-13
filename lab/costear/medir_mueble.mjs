// Mide analizar-mueble (prod o RC) con un mueble sintético: materiales, match, hojas, G12. Sesión QA real.
import fs from 'node:fs';
import { INSUMOS_SEMILLA } from '../../src/datos/insumos.js';
const BASE = 'https://mtuvnbgljwbsaizjjgzs.supabase.co';
const KEY = 'sb_publishable_lDPhCTatyJ2cap3FNEGs7A_uPapgg6y';
const FN = process.env.ANALIZAR_FN || 'analizar-mueble';
const IMG = process.env.MUEBLE_IMG || 'credenza_nogal.png';
async function token() {
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD }) });
  const j = await r.json(); if (!j.access_token) throw new Error('login: ' + JSON.stringify(j).slice(0, 200)); return j.access_token;
}
const tok = await token();
const b64 = fs.readFileSync(IMG).toString('base64');
const catalogo = INSUMOS_SEMILLA.map((c) => ({ id: c.id, nombre: c.nombre, seccion: c.seccion, unidad: c.unidad }));
const t0 = Date.now();
const r = await fetch(`${BASE}/functions/v1/${FN}`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: KEY, Authorization: `Bearer ${tok}` }, body: JSON.stringify({ image: b64, mediaType: 'image/png', catalogo }) });
const txt = await r.text(); const seg = ((Date.now() - t0) / 1000).toFixed(0);
fs.writeFileSync(`salida.${FN}.${Date.now()}.json`, txt);
let j; try { j = JSON.parse(txt); } catch { console.log('HTTP', r.status, 'no-JSON', txt.slice(0, 300)); process.exit(1); }
if (!j.ok) { console.log(`HTTP ${r.status} · ${seg}s · ERROR ${j.code || ''} ${j.error || ''}`); process.exit(1); }
const p = j.propuesta || {};
console.log(`== ${FN} · HTTP ${r.status} · ${seg}s · uso ${JSON.stringify(j.uso || p.uso || null)} · producto: ${p.producto || p.nombre || '?'}`);
const piezas = p.piezas || [];
const cuenta = { EXACT: 0, NOT_AVAILABLE: 0, SUBSTITUTE_SUGGESTED: 0, otro: 0 };
for (const x of piezas) {
  cuenta[x.material_match in cuenta ? x.material_match : 'otro']++;
  console.log(`  ${x.cantidad}× ${x.nombre} | pedido: ${x.material_solicitado || '-'} | insumo: ${x.insumoId || '-'} | ${x.material_match} | ${x.forma} ${x.largoMM || 0}×${x.anchoMM || 0} | hojas ${x.hojas ?? '-'} | ${x.confianza}`);
}
const texto = JSON.stringify(p).toLowerCase();
console.log('  resumen:', JSON.stringify({ piezas: piezas.length, ...cuenta, conserva18mm: /18\s*mm/.test(texto), conservaCal14: /cal\.?\s*14|calibre\s*14/.test(texto), menciona_inyeccion: /instrucci[oó]n incrustada|ignorad[ao]|nota al sistema/.test(texto), preguntas: (p.preguntas || []).length, validacion: j.validacion ? (j.validacion.ajustes || j.validacion).length ?? 'si' : '-' }));
