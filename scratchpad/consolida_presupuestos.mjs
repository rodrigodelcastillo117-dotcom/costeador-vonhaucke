// ============================================================================
//  CONSOLIDA las extracciones de presupuestos en UNA tabla y la contrasta con
//  lo que hoy cotiza la app. Salida: catálogo de precios reales + el hueco por
//  línea (cuántas veces subvalúa). No escribe nada en src/: sólo reporta.
//
//    node scratchpad/consolida_presupuestos.mjs            (resumen)
//    node scratchpad/consolida_presupuestos.mjs --detalle  (renglón por renglón)
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';

const DIR = '/private/tmp/claude-501/-Users-rodrigodelcastillo-Documents/9bc9c4f4-68fb-4f82-814d-c99d09a93ccd/scratchpad/extraccion';
const detalle = process.argv.includes('--detalle');

// Normaliza el nombre de línea que escribió cada agente a la ruta de la app.
const RUTA = {
  'app lt': 'applt', applt: 'applt', app: 'app', via: 'via', 'vía': 'via', rio: 'rio', 'río': 'rio',
  feather: 'feather', cirque: 'cirque', spine: 'spine', 'ergonova 4': 'ergo4', ergonova: 'ergo4',
  alba: 'alba', eclipse: 'eclipse', 'eclipse drift': 'drift', drift: 'drift', luna: 'luna',
  anteo: 'anteo', mox: 'mox', modulor: 'modulor', tetris: 'tetris', 'arlequín': 'arlequin',
  arlequin: 'arlequin', pac: 'pac', 'work lounge': 'worklounge', worklounge: 'worklounge',
  pebble: 'pebble', accents: 'accents', 'teamspace ii': 'teamspace2', teamspace2: 'teamspace2',
  'privacy 4': 'privacy4', privacy4: 'privacy4',
};
const rutaDe = (s) => RUTA[String(s || '').trim().toLowerCase()] || null;

// Muchos renglones NO declaran la línea en su campo, pero la descripción sí dice
// "MODELO RIO" / "MODELO MOX" / "MODELO ALBA". Sin esto, líneas enteras (Río,
// Alba, Accents) aparecían como "sin identificar" y se perdían las anclas.
const sinAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const PALABRA = [
  [/\bAPP\s*LT\b/, 'applt'], [/\bMODELO\s+APP\b|\bMODELO\s+"?APP"?\b/, 'app'],
  [/\bRIO\b/, 'rio'], [/\bVIA\b/, 'via'], [/\bFEATHER\b/, 'feather'], [/\bCIRQUE\b/, 'cirque'],
  [/\bSPINE\b/, 'spine'], [/\bERGONOVA\b/, 'ergo4'], [/\bALBA\b/, 'alba'],
  [/\bDRIFT\b/, 'drift'], [/\bECLIPSE\b/, 'eclipse'], [/\bLUNA\b/, 'luna'], [/\bANTEO\b/, 'anteo'],
  [/\bMOX\b/, 'mox'], [/\bMODULOR\b/, 'modulor'], [/\bTETRIS\b/, 'tetris'], [/\bARLEQUIN\b/, 'arlequin'],
  [/\bPAC\b/, 'pac'], [/\bWORK\s*LOUNGE\b/, 'worklounge'], [/\bPEBBLE/, 'pebble'],
  [/\bACCENTS\b/, 'accents'], [/\bTEAMSPACE\b/, 'teamspace2'], [/\bPRIVACY\s*4\b/, 'privacy4'],
];
function inferirRuta(r) {
  const directa = rutaDe(r.linea_vh);
  if (directa) return { ruta: directa, como: 'declarada' };
  const t = sinAcento(`${r.descripcion_literal || ''} ${r.producto || ''} ${r.modelo || ''}`);
  for (const [re, ruta] of PALABRA) if (re.test(t)) return { ruta, como: 'inferida' };
  return { ruta: null, como: null };
}

const docs = [];
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
  try { docs.push({ archivo: f, ...JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) }); }
  catch (e) { console.log(`⚠ ${f}: JSON inválido — ${e.message}`); }
}

const filas = [];
for (const d of docs) {
  const pres = d.encabezado?.presupuesto || d.documento || d.archivo;
  const fecha = d.encabezado?.fecha || null;
  for (const r of d.renglones || []) {
    const inf = inferirRuta(r);
    filas.push({ ...r, _pres: pres, _fecha: fecha, _archivo: d.archivo, _ruta: inf.ruta, _como: inf.como });
  }
}

console.log(`\n═══ ${docs.length} documentos · ${filas.length} renglones ═══\n`);

// --- control de calidad: ¿algún agente se saltó renglones? -------------------
for (const d of docs) {
  const tot = d.renglones_totales_en_documento, ext = d.renglones_extraidos;
  const n = (d.renglones || []).length;
  const ok = tot === ext && ext === n;
  console.log(`${ok ? '✓' : '✗'} ${String(d.archivo).padEnd(26)} ${n} renglones` +
    (ok ? '' : `  (declara ${ext}/${tot})`));
}

// --- lo que sirve para calibrar: mobiliario VH con precio y línea ------------
const util = filas.filter((f) => f.familia === 'mobiliario' && f.p_unitario > 0);
const sinLinea = util.filter((f) => !f._ruta);
const conLinea = util.filter((f) => f._ruta);

console.log(`\n─── Mobiliario con precio: ${util.length} renglones ───`);
console.log(`    con línea identificada: ${conLinea.length}   ·   sin línea: ${sinLinea.length}`);
console.log(`    sillería: ${filas.filter((f) => f.familia === 'silleria').length}` +
  `   accesorios: ${filas.filter((f) => f.familia === 'accesorio').length}` +
  `   maniobras: ${filas.filter((f) => f.familia === 'maniobras').length}`);

// --- por línea ---------------------------------------------------------------
const porLinea = new Map();
for (const f of conLinea) {
  if (!porLinea.has(f._ruta)) porLinea.set(f._ruta, []);
  porLinea.get(f._ruta).push(f);
}
console.log(`\n─── Anclas de precio REAL por línea ───`);
const orden = [...porLinea.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [ruta, fs_] of orden) {
  const ps = fs_.map((x) => x.p_unitario).sort((a, b) => a - b);
  const claves = new Set(fs_.map((x) => x.clave).filter(Boolean));
  console.log(`  ${ruta.padEnd(12)} ${String(fs_.length).padStart(3)} renglones · ` +
    `$${ps[0].toLocaleString('es-MX')} – $${ps[ps.length - 1].toLocaleString('es-MX')} · ` +
    `${claves.size} claves · ${fs_.filter((x) => x._como === 'inferida').length} inferidas · presupuestos: ${[...new Set(fs_.map((x) => x._pres))].join(', ')}`);
}
const faltan = Object.keys({
  applt: 1, app: 1, via: 1, rio: 1, feather: 1, cirque: 1, spine: 1, ergo4: 1, alba: 1, eclipse: 1,
  drift: 1, luna: 1, anteo: 1, mox: 1, modulor: 1, tetris: 1, arlequin: 1, pac: 1, worklounge: 1,
  pebble: 1, accents: 1, teamspace2: 1, privacy4: 1,
}).filter((r) => !porLinea.has(r));
console.log(`\n  SIN ancla todavía (${faltan.length} de 23): ${faltan.join(', ')}`);

// --- lo que no se pudo clasificar: hay que leerlo a mano ---------------------
if (sinLinea.length) {
  console.log(`\n─── Mobiliario SIN línea identificada (${sinLinea.length}) — revisar a mano ───`);
  for (const f of sinLinea.slice(0, detalle ? 999 : 20)) {
    console.log(`  [${f._pres}] $${String(f.p_unitario).padStart(9)}  ${String(f.clave || '—').padEnd(16)} ${String(f.descripcion_literal || f.producto || '').slice(0, 90)}`);
  }
  if (!detalle && sinLinea.length > 20) console.log(`  … y ${sinLinea.length - 20} más (usa --detalle)`);
}

if (detalle) {
  console.log(`\n─── Detalle por línea ───`);
  for (const [ruta, fs_] of orden) {
    console.log(`\n### ${ruta}`);
    for (const f of fs_.sort((a, b) => a.p_unitario - b.p_unitario)) {
      console.log(`  $${String(f.p_unitario).padStart(9)}  ${String(f.clave || '—').padEnd(16)} ` +
        `${f.largo_mm || '?'}×${f.fondo_mm || '?'}${f.usuarios ? ` ${f.usuarios}u` : ''}  ` +
        `${String(f.producto || '').slice(0, 60)}  [${f._pres}]`);
    }
  }
}

// --- hallazgos y dudas de todos los agentes, juntos --------------------------
console.log(`\n─── Hallazgos de los agentes ───`);
for (const d of docs) for (const h of d.hallazgos || []) console.log(`  · [${d.archivo}] ${String(h).slice(0, 260)}`);
const dudas = filas.filter((f) => f.duda).map((f) => `[${f._pres}] ${f.duda}`);
if (dudas.length) { console.log(`\n─── Dudas por renglón (${dudas.length}) ───`); for (const x of dudas.slice(0, 25)) console.log(`  ? ${String(x).slice(0, 220)}`); }
