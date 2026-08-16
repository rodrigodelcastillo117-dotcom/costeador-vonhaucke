// ============================================================================
//  CALIBRA LA JERARQUÍA — mide y escupe la tabla, no la inventa.
//
//  Por qué existe: `OBJETIVO_LINEA` dice cuántas veces App LT debe costar cada
//  línea (el orden comercial que fijó Rodrigo). El factor que lleva el modelo
//  hasta ese objetivo se DESPEJA — pero se despejaba con UNA sola medición, y
//  esa medición se hizo sobre un ESCRITORIO. Resultado medido el 2026-08-16:
//  el escritorio cerraba en 8 de 8 líneas y el bench fallaba en 7 de 7
//  (Flex, la línea barata, cotizaba el bench a 3.39× App LT).
//
//  Un mueble no escala igual que otro: una banca comparte estructura entre dos
//  hileras y un escritorio no. Por eso ahora se mide POR FAMILIA.
//
//    node scripts/calibra-jerarquia.mjs           → enseña la tabla
//    node scripts/calibra-jerarquia.mjs --escribe → la deja en factoresLinea.js
// ============================================================================
import fs from 'node:fs';
import { LINEAS_REG, costearConfig } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';
import { FAMILIAS, familiaDe } from '../src/datos/factoresLinea.js';

const est = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT, piezas: {} };
globalThis.__SIN_FACTOR_LINEA = true;   // medir el modelo CRUDO, sin la calibración puesta

function comparable(reg, fam) {
  return (reg.productos || []).find((p) => familiaDe(p.id, p.nombre) === fam);
}

function medir(ruta, fam) {
  const reg = LINEAS_REG[ruta];
  const prod = reg && comparable(reg, fam);
  if (!prod) return null;
  const sel = {};
  if (prod.largos) sel.largoMM = prod.largos.includes(1200) ? 1200 : prod.largos[0];
  if (prod.fondos) sel.fondoMM = prod.fondos[0];
  if (prod.usuarios) sel.usuarios = prod.usuarios.includes(6) ? 6 : prod.usuarios[prod.usuarios.length - 1];
  for (const s of prod.selects || []) {
    const ids = s.opciones.map((o) => o.id);
    sel[s.key] = s.key === 'usuarios' ? (ids.includes('6') ? '6' : ids[ids.length - 1])
      : s.key === 'largo' ? (ids.includes('1200') ? '1200' : ids[0]) : ids[0];
  }
  const r = costearConfig(est, ruta, prod.id, sel, 1);
  if (!r || !r.precioUnitario) return null;
  // El bench se compara POR PUESTO; si no, una banca de 6 y una de 2 no se pueden
  // poner una al lado de la otra.
  const u = Number(sel.usuarios) || 1;
  return { v: fam === 'bench' ? r.precioUnitario / u : r.precioUnitario, papel: r.precioReal, prod: prod.id };
}

const base = {};
for (const f of FAMILIAS) base[f] = medir('applt', f);

const tabla = {};
for (const ruta of Object.keys(LINEAS_REG)) {
  const fila = {};
  for (const f of FAMILIAS) {
    const m = medir(ruta, f);
    // Si el precio viene del PAPEL, no se calibra: el papel ya manda sobre el
    // modelo y meterle factor sería moverle a un dato real.
    if (m && !m.papel && base[f]) fila[f] = Math.round((m.v / base[f].v) * 1000) / 1000;
  }
  if (Object.keys(fila).length) tabla[ruta] = fila;
}

console.log('MEDIDO_ANTES por familia (modelo crudo, sin factor, contra App LT):\n');
console.log('LÍNEA        ' + FAMILIAS.map((f) => f.padStart(11)).join(''));
for (const [ruta, fila] of Object.entries(tabla))
  console.log(ruta.padEnd(12) + FAMILIAS.map((f) => (fila[f] != null ? fila[f].toFixed(3) : '—').padStart(11)).join(''));

if (process.argv.includes('--escribe')) {
  const p = new URL('../src/datos/factoresLinea.js', import.meta.url).pathname;
  let s = fs.readFileSync(p, 'utf8');
  // Entre marcadores, para que el reemplazo no se coma lo que está al lado.
  const bloque = '/* CALIBRA:INICIO */\nexport const MEDIDO_ANTES = ' + JSON.stringify(tabla, null, 2) + ';\n/* CALIBRA:FIN */';
  if (!/\/\* CALIBRA:INICIO \*\/[\s\S]*?\/\* CALIBRA:FIN \*\//.test(s)) {
    console.error('✗ no encontré los marcadores CALIBRA en factoresLinea.js — no escribo nada');
    process.exit(1);
  }
  s = s.replace(/\/\* CALIBRA:INICIO \*\/[\s\S]*?\/\* CALIBRA:FIN \*\//, bloque);
  fs.writeFileSync(p, s);
  console.log('\n✓ escrito en src/datos/factoresLinea.js');
}
