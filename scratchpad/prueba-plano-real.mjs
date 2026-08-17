// EL CAMINO COMPLETO con el plano REAL que mandó Rodrigo:
//   lectura del PDF (ya hecha, en lectura.json) → áreas → acomodo → medición.
// 48 operativos en 8 islas, 5 privados, 2 salas de juntas.
import fs from 'node:fs';
import { areasDeLectura, revisarAreas } from '../src/datos/planoLeido.js';
import { expandirPiezas, dimsPieza } from '../src/datos/espacio.js';
import { acomodarLocal } from '../src/datos/planner.js';

// ⚠️ `areasDeLectura` devuelve METROS y el motor quiere MILÍMETROS. La app
// convierte con `aMM` (Acomodo.jsx) antes de acomodar; aquí hay que hacer lo
// mismo o el plano entero mide 5 × 5 mm y no cabe ni un tornillo.
const aMM = (areas) => areas.map((a) => ({
  nombre: a.nombre,
  ...(a.tipo ? { tipo: a.tipo } : {}),
  ...(Number.isFinite(a.nivel) ? { nivel: a.nivel } : {}),
  ...(Number.isFinite(a.x) && Number.isFinite(a.y) ? { x: Math.round(a.x * 1000), y: Math.round(a.y * 1000) } : {}),
  ancho: Math.round((a.ancho || 0) * 1000),
  largo: Math.round((a.largo || 0) * 1000),
  ...(a.poly ? { poly: a.poly.map(([x, y]) => [Math.round(x * 1000), Math.round(y * 1000)]) } : {}),
  ...(a.obstaculos?.length ? { obstaculos: a.obstaculos.map((o) => ({ x: Math.round(o.x * 1000), y: Math.round(o.y * 1000), w: Math.round(o.w * 1000), h: Math.round(o.h * 1000), tipo: o.tipo })) } : {}),
  ...(a.puertas?.length ? { puertas: a.puertas.map((p) => ({ x: Math.round(p.x * 1000), y: Math.round(p.y * 1000), ancho: Math.round(p.ancho * 1000) })) } : {}),
}));

const j = JSON.parse(fs.readFileSync('scratchpad/lectura.json', 'utf8'));
const { areas: enMetros } = areasDeLectura(j.lectura);
const areas = aMM(enMetros);
console.log(`ÁREAS: ${areas.length}`);
for (const a of areas) {
  const m2 = ((a.ancho / 1000) * (a.largo / 1000)).toFixed(1);
  console.log(`  ${String(a.nombre).padEnd(36)} ${String(Math.round(a.ancho)).padStart(6)} × ${String(Math.round(a.largo)).padEnd(6)} mm  ~${m2} m²${a.poly ? '  (forma real)' : ''}`);
}
const problemas = revisarAreas(j.lectura);
console.log(`\nREVISIÓN DEL LEVANTAMIENTO: ${problemas.length ? problemas.join(' · ') : 'sin problemas'}`);

// El programa que dice la hoja 2 del plano.
const partidas = [
  { id: 'b', nombre: 'Banca doble APP LT 1.50 · 6 usuarios', cantidad: 8, precioUnitario: 36260, w: 4500, d: 1200, ruta: 'applt' },
  { id: 'so', nombre: 'Silla operativa WIN', cantidad: 48, precioUnitario: 5210, w: 600, d: 600 },
  { id: 'g', nombre: 'Gaveta rodante Mox 3 cajones', cantidad: 48, precioUnitario: 4100, w: 400, d: 580, ruta: 'mox' },
  { id: 'e', nombre: 'Eclipse · Escritorio directivo 2.10 m mano derecha', cantidad: 5, precioUnitario: 31500, w: 2100, d: 900, ruta: 'eclipse' },
  { id: 'sd', nombre: 'Silla directiva Eclipse', cantidad: 5, precioUnitario: 8900, w: 650, d: 650 },
  { id: 'sv', nombre: 'Silla de visita CONCERTO', cantidad: 10, precioUnitario: 1950, w: 550, d: 550 },
  { id: 'mj1', nombre: 'Mesa de juntas APP LT 4.80 × 1.40', cantidad: 1, precioUnitario: 42000, w: 4800, d: 1400, ruta: 'applt' },
  { id: 'mj2', nombre: 'Mesa de juntas APP LT 2.40 × 1.20', cantidad: 1, precioUnitario: 16408, w: 2400, d: 1200, ruta: 'applt' },
  { id: 'sj', nombre: 'Silla de juntas CONCERTO', cantidad: 14, precioUnitario: 2100, w: 550, d: 550 },
];
const piezas = expandirPiezas(partidas);
const byId = Object.fromEntries(piezas.map((p) => [p.id, p]));
const t0 = Date.now();
const plan = acomodarLocal(areas, piezas, {});
console.log(`\nACOMODO: ${plan.colocacion.length} de ${piezas.length} piezas · caben=${plan.caben} · ${Date.now() - t0} ms`);
for (const a of plan.auditoria || []) console.log(`  ${a.ok ? '✓' : '✗'} ${a.check}: ${a.detalle}`);
if (plan.notas?.length) console.log('  notas:', plan.notas.join(' · '));

// --- ¿Las sillas quedaron en su puesto? ---
const caja = (c) => { const { pw, ph } = dimsPieza(byId[c.id], c.rot || 0); return { x: c.x, y: c.y, w: pw, d: ph, area: c.area, nombre: byId[c.id].nombre }; };
const cajas = plan.colocacion.map(caja);
const dist = (a, b) => Math.round(Math.hypot(
  Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w))),
  Math.max(0, Math.max(a.y - (b.y + b.d), b.y - (a.y + a.d)))));
const operativas = cajas.filter((c) => /Silla operativa/.test(c.nombre));
const trabajo = cajas.filter((c) => /Banca|Escritorio|Mesa de juntas/.test(c.nombre));
let sentadas = 0;
for (const s of operativas) {
  const mismo = trabajo.filter((m) => m.area === s.area);
  if (mismo.length && Math.min(...mismo.map((m) => dist(s, m))) <= 300) sentadas++;
}
console.log(`\nSILLAS OPERATIVAS SENTADAS: ${sentadas}/${operativas.length}`);

// --- Invariantes: nada encimado, nada fuera de su cuarto ---
let fuera = 0, encimados = 0;
for (const c of cajas) {
  const A = areas[c.area];
  if (!A || c.x < -1 || c.y < -1 || c.x + c.w > A.ancho + 1 || c.y + c.d > A.largo + 1) fuera++;
}
for (let i = 0; i < cajas.length; i++) {
  for (let k = i + 1; k < cajas.length; k++) {
    const a = cajas[i], b = cajas[k];
    if (a.area !== b.area) continue;
    if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.d && a.y + a.d > b.y) encimados++;
  }
}
console.log(`fuera de su cuarto: ${fuera}   ·   encimados: ${encimados}`);

// --- Reparto por cuarto ---
console.log('\nQUÉ QUEDÓ EN CADA CUARTO:');
for (let i = 0; i < areas.length; i++) {
  const dentro = cajas.filter((c) => c.area === i);
  if (!dentro.length) { console.log(`  ${String(areas[i].nombre).padEnd(36)} (vacío)`); continue; }
  const cuenta = {};
  for (const c of dentro) cuenta[c.nombre] = (cuenta[c.nombre] || 0) + 1;
  console.log(`  ${String(areas[i].nombre).padEnd(36)} ${Object.entries(cuenta).map(([n, v]) => `${v}× ${n.slice(0, 26)}`).join(' · ')}`);
}
