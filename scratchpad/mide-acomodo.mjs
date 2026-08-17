// ¿El motor SIENTA las sillas en los puestos, o las arrima a los muros?
// Mide, no opina: distancia de cada silla operativa al escritorio más cercano.
import { expandirPiezas } from '../src/datos/espacio.js';
import { acomodarLocal } from '../src/datos/planner.js';

const partidas = [
  { id: 'p1', nombre: 'Banca doble APP LT 1.50 · 6 usuarios, biombos laterales', cantidad: 2, precioUnitario: 36260, w: 4500, d: 1200, ruta: 'applt' },
  { id: 'p2', nombre: 'Mesa de juntas APP LT 2.40 × 1.20', cantidad: 1, precioUnitario: 16408, w: 2400, d: 1200, ruta: 'applt' },
  { id: 'p3', nombre: 'Archivero Modulor 1.20 · 2 cajones', cantidad: 4, precioUnitario: 9460, w: 1200, d: 450, ruta: 'modulor' },
  { id: 'p4', nombre: 'Silla operativa WIN', cantidad: 12, precioUnitario: 5210, w: 600, d: 600 },
  { id: 'p5', nombre: 'Gaveta rodante Mox 3 cajones', cantidad: 12, precioUnitario: 4100, w: 400, d: 580, ruta: 'mox' },
  { id: 'p6', nombre: 'Silla de visita CONCERTO', cantidad: 2, precioUnitario: 1950, w: 550, d: 550 },
  { id: 'p7', nombre: 'Eclipse · Escritorio directivo 2.10 m mano derecha', cantidad: 1, precioUnitario: 31500, w: 2100, d: 900, ruta: 'eclipse' },
];
const areas = [
  { nombre: 'Open space', ancho: 12000, largo: 8000 },
  { nombre: 'Sala de juntas', ancho: 5000, largo: 4000 },
  { nombre: 'Dirección', ancho: 4200, largo: 3600 },
];
const piezas = expandirPiezas(partidas);
const plan = acomodarLocal(areas, piezas, {});
// La colocación sólo trae {id,x,y,rot,contra,area}: el nombre y las medidas
// viven en `piezas`. Hay que cruzarlas, y respetar `rot` (a 90° se intercambian
// ancho y fondo, que es el bug que ya costó una banca dibujada como una sola).
const porId = Object.fromEntries(piezas.map((p) => [p.id, p]));
const col = (plan.colocacion || []).map((c) => {
  const p = porId[c.id] || {};
  const girada = c.rot === 90 || c.rot === 270;
  return { ...c, nombre: p.nombre || '(sin nombre)',
    w: girada ? (p.d ?? 0) : (p.w ?? 0), d: girada ? (p.w ?? 0) : (p.d ?? 0) };
});
console.log('piezas colocadas:', col.length, 'de', piezas.length);

const esSilla = (p) => /silla/i.test(p.nombre || '');
const esTrabajo = (p) => /banca|bench|escritorio|mesa de juntas/i.test(p.nombre || '');
const sillas = col.filter(esSilla), mesas = col.filter(esTrabajo);
console.log(`\nsillas: ${sillas.length} · superficies de trabajo: ${mesas.length}`);

// Distancia entre rectángulos (0 si se tocan o traslapan).
const dist = (a, b) => {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.d), b.y - (a.y + a.d)));
  return Math.round(Math.hypot(dx, dy));
};
// ¿Está pegada a un muro de su área?
const areaDe = (p) => areas[p.area] || areas[0];
let sentadas = 0, alMuro = 0;
for (const s of sillas) {
  const mismasArea = mesas.filter((m) => m.area === s.area);
  const d = mismasArea.length ? Math.min(...mismasArea.map((m) => dist(s, m))) : Infinity;
  const A = areaDe(s);
  const pegada = Math.min(s.x, s.y, (A.ancho - (s.x + s.w)), (A.largo - (s.y + s.d))) <= 60;
  if (d <= 300) sentadas++;
  if (pegada) alMuro++;
  console.log(`  ${(s.nombre || '').slice(0, 34).padEnd(34)} área=${String(areaDe(s).nombre).padEnd(14)} a la mesa: ${d === Infinity ? '—' : d + ' mm'}${pegada ? '   ⚠ PEGADA AL MURO' : ''}`);
}
console.log(`\nRESULTADO: ${sentadas}/${sillas.length} sillas a menos de 300 mm de una superficie de trabajo.`);
console.log(`           ${alMuro}/${sillas.length} sillas pegadas a un muro.`);
