// Valida el reparto por cuartos con el plano REAL de Infiniti Center y los
// muebles que Rodrigo tenía cargados. Lo que revisaría él: que nada quede
// fuera de su cuarto, que los escritorios vayan a los privados, los benches al
// open space, la mesa a la sala de juntas, y que el baño quede vacío.
import { acomodarLocal } from '../src/datos/planner.js';
import { expandirPiezas, dimsPieza } from '../src/datos/espacio.js';

// Cuartos leídos del PDF (memoria pt.15).
const AREAS = [
  { nombre: 'Privado 1', ancho: 3900, largo: 3900 },
  { nombre: 'Privado 2', ancho: 3900, largo: 3900 },
  { nombre: 'Área 3 (sala inferior izquierda)', ancho: 5400, largo: 4000 },
  { nombre: 'Open space', ancho: 8000, largo: 6000 },
  { nombre: 'Sala de juntas', ancho: 6000, largo: 3550 },
  { nombre: 'Recepción / vestíbulo', ancho: 3600, largo: 2800 },
  { nombre: 'Baño', ancho: 2400, largo: 2100 },
  { nombre: 'Cocineta / área de apoyo', ancho: 2900, largo: 2400 },
];

const P = (id, nombre, cant, ruta) => ({ id, nombre, cantidad: cant, ruta, w: null, d: null });
const PARTIDAS = [
  P('a', 'Banca doble APP LT 1.05 · 4 usuarios', 3, 'applt'),
  P('b', 'Escritorio Directivo Eclipse 2.10 m', 2, 'eclipse'),
  P('c', 'Mesa de juntas APP LT 2.40 × 1.20', 1, 'applt'),
  P('d', 'Modulor · Archivero horizontal 0.75', 6, 'modulor'),
  P('e', 'Pac · Sillón sin brazos, tela', 8, 'pac'),
];

const piezas = expandirPiezas(PARTIDAS, 60);
const r = acomodarLocal(AREAS, piezas, {});
const by = Object.fromEntries(piezas.map((p) => [p.id, p]));

let fuera = 0, encimados = 0, enServicio = 0;
const porArea = {};
for (const c of r.colocacion) {
  const a = AREAS[c.area], p = by[c.id];
  const { pw, ph } = dimsPieza(p, c.rot);
  if (c.x < -1 || c.y < -1 || c.x + pw > a.ancho + 1 || c.y + ph > a.largo + 1) fuera++;
  if (/baño|cocineta/i.test(a.nombre)) enServicio++;
  (porArea[a.nombre] ||= []).push(p.tipo);
}
for (let i = 0; i < r.colocacion.length; i++)
  for (let j = i + 1; j < r.colocacion.length; j++) {
    const A = r.colocacion[i], B = r.colocacion[j];
    if (A.area !== B.area) continue;
    const a = dimsPieza(by[A.id], A.rot), b = dimsPieza(by[B.id], B.rot);
    if (A.x < B.x + b.pw && B.x < A.x + a.pw && A.y < B.y + b.ph && B.y < A.y + a.ph) encimados++;
  }

const cuenta = (arr) => Object.entries(arr.reduce((m, t) => ({ ...m, [t]: (m[t] || 0) + 1 }), {}))
  .map(([k, v]) => `${v} ${k}`).join(', ');

console.log('colocadas :', r.colocacion.length, '/', piezas.length, '· caben:', r.caben);
console.log('fuera de su cuarto :', fuera);
console.log('encimados          :', encimados);
console.log('en baño/cocineta   :', enServicio);
console.log('\n--- reparto ---');
for (const [nombre, tipos] of Object.entries(porArea)) console.log(`  ${nombre.padEnd(34)} ${cuenta(tipos)}`);
const vacios = AREAS.filter((a) => !porArea[a.nombre]).map((a) => a.nombre);
console.log('  (sin muebles):', vacios.join(', ') || 'ninguno');

const ok = fuera === 0 && encimados === 0 && enServicio === 0;
console.log(ok ? '\n✓ nada fuera de su cuarto, nada encimado, servicios respetados' : '\n✗ REVISAR');
process.exit(ok ? 0 : 1);
