// AUDITORÍA 2 · ¿de verdad hay 38 muebles duplicados en el banco?
// Duplicado = mismo NOMBRE + mismas MEDIDAS + mismos USUARIOS, precio distinto.
// Ésa es la colisión que puede hacer que el mismo pedido salga a dos precios:
// Voni elige un id u otro y nadie sabe por qué.
import { BANCO } from '../src/datos/banco.js';

const llave = (p) => [p.nombre, p.medidas || '—', p.usuarios ?? '—'].join(' | ');
const g = new Map();
for (const p of BANCO) {
  const k = llave(p);
  if (!g.has(k)) g.set(k, []);
  g.get(k).push(p);
}

const dupes = [...g.entries()].filter(([, v]) => v.length > 1);
const piezasEnColision = dupes.reduce((a, [, v]) => a + v.length, 0);

console.log(`BANCO: ${BANCO.length} piezas`);
console.log(`GRUPOS en colisión: ${dupes.length}`);
console.log(`PIEZAS dentro de esos grupos: ${piezasEnColision}`);
console.log('');

let maxRatio = 0, peor = null;
const filas = [];
for (const [k, v] of dupes.sort((a, b) => {
  const ra = Math.max(...a[1].map(x => x.precio)) / Math.min(...a[1].map(x => x.precio));
  const rb = Math.max(...b[1].map(x => x.precio)) / Math.min(...b[1].map(x => x.precio));
  return rb - ra;
})) {
  const precios = v.map(x => x.precio);
  const min = Math.min(...precios), max = Math.max(...precios);
  const ratio = max / min;
  if (ratio > maxRatio) { maxRatio = ratio; peor = k; }
  filas.push({ k, ratio, v });
  console.log(`── ${k}`);
  console.log(`   ${v.length} filas · $${min.toLocaleString()} → $${max.toLocaleString()} · ${ratio.toFixed(2)}×`);
  for (const x of v) console.log(`     · ${x.id}   $${String(x.precio).padStart(7)}   fuente ${x.fuente}${x.clave ? '  clave ' + x.clave : ''}`);
}

console.log('');
console.log(`PEOR COLISIÓN: ${peor} (${maxRatio.toFixed(2)}×)`);

// Colisiones "silenciosas": mismo NOMBRE exacto, sin importar medidas — que es
// lo único que ve Voni al leer el catálogo compacto si no le mandan medidas.
const gn = new Map();
for (const p of BANCO) { const k = p.nombre; if (!gn.has(k)) gn.set(k, []); gn.get(k).push(p); }
const porNombre = [...gn.entries()].filter(([, v]) => v.length > 1);
console.log('');
console.log(`Mismo NOMBRE con >1 precio: ${porNombre.length} nombres, ${porNombre.reduce((a, [, v]) => a + v.length, 0)} piezas`);
const top = porNombre.map(([k, v]) => ({ k, n: v.length, min: Math.min(...v.map(x => x.precio)), max: Math.max(...v.map(x => x.precio)) }))
  .sort((a, b) => (b.max / b.min) - (a.max / a.min)).slice(0, 12);
for (const t of top) console.log(`   ${t.k} — ${t.n} filas, $${t.min.toLocaleString()}…$${t.max.toLocaleString()} (${(t.max / t.min).toFixed(1)}×)`);

// ¿Y la sillería en concreto? Es la acusación literal: "la misma silla a dos precios".
console.log('');
const sillas = BANCO.filter(p => p.tipo === 'silla');
console.log(`SILLAS en banco: ${sillas.length}`);
const gs = new Map();
for (const p of sillas) { const k = p.nombre; if (!gs.has(k)) gs.set(k, []); gs.get(k).push(p); }
for (const [k, v] of [...gs.entries()].filter(([, v]) => v.length > 1)) {
  console.log(`   ${k}: ${v.map(x => `${x.id}=$${x.precio}`).join('  ')}`);
}
