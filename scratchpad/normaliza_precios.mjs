// ============================================================================
//  NORMALIZA todos los presupuestos a UNA sola base: LISTA BRUTA.
//
//  Regla de negocio (confirmada por Rodrigo, 2026-08-15):
//    · Presupuesto que IMPRIME la columna Desc. 40% → su P.Unitario YA es bruta.
//    · Presupuesto que NO imprime descuento → su P.Unitario ya trae el 40%
//      adentro (es NETO) → bruta = P.Unitario / 0.60.
//
//  La prueba de que la regla es correcta: el MISMO módulo App LT cotizado en
//  los dos formatos tiene que dar el mismo bruto. Eso es lo que mide este
//  script, decodificando la clave paramétrica.
//
//  Clave App LT (descifrada del presupuesto 226030134 Mixue):
//    TATO | TAPG | TAPS ...  +  U  +  LL  +  FF   →   U usuarios,
//    largo LL×100 mm, fondo FF×100 mm.  Ej. TATO84812ABCT01 = 8 u, 4800, 1200.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';

const DIR = '/private/tmp/claude-501/-Users-rodrigodelcastillo-Documents/9bc9c4f4-68fb-4f82-814d-c99d09a93ccd/scratchpad/extraccion';
const A_BRUTA = 1 / 0.6;

const docs = [];
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
  try { docs.push({ archivo: f, ...JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) }); } catch { /* el consolidado ya avisa */ }
}
const conDescuento = (d) => (d.renglones || []).some((r) => (r.descuento_pct || 0) >= 5);

// Descifra la clave paramétrica. Devuelve null si la clave no sigue el patrón.
export function descifrarClave(clave) {
  const m = /^(TATO|TAPG|TAPS|TAPO)(\d)(\d{2})(\d{1,2})/.exec(String(clave || '').toUpperCase());
  if (!m) return null;
  const [, fam, u, ll, ff] = m;
  const largo = +ll * 100, fondo = +ff * 100;
  // Un fondo de 60 mm o un largo de 100 mm no existen: la clave no era paramétrica.
  if (largo < 900 || largo > 6000 || fondo < 500 || fondo > 1500) return null;
  return { familia: fam, usuarios: +u, largoMM: largo, fondoMM: fondo };
}

const filas = [];
for (const d of docs) {
  const conD = conDescuento(d);
  const pres = d.encabezado?.presupuesto || d.archivo;
  const fecha = d.encabezado?.fecha || null;
  for (const r of d.renglones || []) {
    if (r.familia !== 'mobiliario' || !(r.p_unitario > 0)) continue;
    filas.push({
      ...r,
      _pres: pres, _fecha: fecha, _conD: conD,
      bruta: conD ? r.p_unitario : r.p_unitario * A_BRUTA,
      base: conD ? 'impresa' : 'derivada (÷0.60)',
      cfg: descifrarClave(r.clave),
    });
  }
}

console.log(`\n═══ ${filas.length} renglones de mobiliario, normalizados a lista bruta ═══`);
console.log(`  con descuento impreso: ${[...new Set(filas.filter((f) => f._conD).map((f) => f._pres))].join(', ')}`);
console.log(`  ya netos (×1.667)   : ${[...new Set(filas.filter((f) => !f._conD).map((f) => f._pres))].join(', ')}`);

// ---- LA PRUEBA: el mismo módulo App LT en los dos formatos ------------------
const conCfg = filas.filter((f) => f.cfg);
console.log(`\n─── Claves paramétricas descifradas: ${conCfg.length} ───`);
const grupos = new Map();
for (const f of conCfg) {
  const k = `${f.cfg.usuarios}u ${f.cfg.largoMM}×${f.cfg.fondoMM}`;
  if (!grupos.has(k)) grupos.set(k, []);
  grupos.get(k).push(f);
}
let pruebas = 0, suma = 0;
for (const [k, g] of [...grupos.entries()].sort()) {
  const formatos = new Set(g.map((f) => f._conD));
  console.log(`\n  ${k}`);
  for (const f of g.sort((a, b) => b.bruta - a.bruta)) {
    console.log(`    $${f.bruta.toFixed(0).padStart(8)} bruta  (${f.base.padEnd(17)}) ` +
      `imp. $${String(f.p_unitario).padStart(9)}  ${String(f.clave).padEnd(18)} [${f._pres} ${f._fecha || ''}]`);
  }
  if (formatos.size === 2) {           // aparece en los DOS formatos: contrasta
    const a = g.filter((f) => f._conD).map((f) => f.bruta);
    const b = g.filter((f) => !f._conD).map((f) => f.bruta);
    const prom = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const razon = prom(b) / prom(a);
    pruebas++; suma += razon;
    console.log(`    → CONTRASTE entre formatos: ${(razon * 100).toFixed(1)}% ${Math.abs(1 - razon) < 0.1 ? '✓ cuadra' : '✗ NO cuadra'}`);
  }
}
if (pruebas) {
  const m = suma / pruebas;
  console.log(`\n─── Veredicto: ${pruebas} módulo(s) cotizado(s) en los dos formatos · coincidencia media ${(m * 100).toFixed(1)}% ───`);
  console.log(Math.abs(1 - m) < 0.1
    ? '  ✓ La regla ÷0.60 reconstruye la lista bruta. Se puede cargar el price-book.'
    : '  ✗ La regla no reconstruye la bruta. NO cargar.');
} else {
  console.log('\n  (Ningún módulo con clave paramétrica aparece en los dos formatos: sin prueba cruzada.)');
}

// ---- Volcado por línea, ya en bruta, para mapear contra el catálogo ---------
if (process.argv.includes('--por-linea')) {
  const RUTA = { 'app lt': 'applt', app: 'app', 'vía': 'via', via: 'via', rio: 'rio', 'río': 'rio',
    feather: 'feather', cirque: 'cirque', spine: 'spine', 'ergonova 4': 'ergo4', ergonova: 'ergo4',
    alba: 'alba', eclipse: 'eclipse', 'eclipse drift': 'drift', drift: 'drift', luna: 'luna',
    anteo: 'anteo', mox: 'mox', modulor: 'modulor', tetris: 'tetris', 'arlequín': 'arlequin',
    pac: 'pac', 'work lounge': 'worklounge', pebble: 'pebble', accents: 'accents',
    'teamspace ii': 'teamspace2', 'privacy 4': 'privacy4' };
  const N = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const PAL = [[/\bAPP\s*LT\b/, 'applt'], [/\bRIO\b/, 'rio'], [/\bCIRQUE\b/, 'cirque'], [/\bALBA\b/, 'alba'],
    [/\bMODULOR\b/, 'modulor'], [/\bMOX\b/, 'mox'], [/\bPEBBLE/, 'pebble'], [/\bACCENTS\b/, 'accents'],
    [/\bWORK\s*LOUNGE\b/, 'worklounge'], [/\bECLIPSE\b/, 'eclipse'], [/\bERGONOVA\b/, 'ergo4'],
    [/\bANTEO\b/, 'anteo'], [/\bLUNA\b/, 'luna'], [/\bDRIFT\b/, 'drift'], [/\bSPINE\b/, 'spine'],
    [/\bFEATHER\b/, 'feather'], [/\bTETRIS\b/, 'tetris'], [/\bPRIVACY\s*4\b/, 'privacy4'],
    [/\bTEAMSPACE\b/, 'teamspace2'], [/\bMODELO\s+APP\b/, 'app']];
  const ruta = (f) => RUTA[String(f.linea_vh || '').toLowerCase()]
    || (PAL.find(([re]) => re.test(N(`${f.descripcion_literal} ${f.producto}`))) || [])[1] || null;
  const solo = process.argv[process.argv.indexOf('--por-linea') + 1];
  const g = new Map();
  for (const f of filas) { const r = ruta(f); if (!r) continue; if (!g.has(r)) g.set(r, []); g.get(r).push(f); }
  for (const [r, xs] of [...g].sort()) {
    if (solo && solo !== r) continue;
    console.log(`\n### ${r}  (${xs.length})`);
    for (const f of xs.sort((a, b) => a.bruta - b.bruta)) {
      console.log(`  $${f.bruta.toFixed(0).padStart(8)} bruta  ${String(f.clave || '—').padEnd(17)} ` +
        `${f.largo_mm || '?'}×${f.fondo_mm || '?'}${f.alto_mm ? '×' + f.alto_mm : ''}${f.usuarios ? ` ${f.usuarios}u` : ''}  [${f._pres}]`);
      console.log(`      ${String(f.descripcion_literal || '').slice(0, 135)}`);
    }
  }
}
