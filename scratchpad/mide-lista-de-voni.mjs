// La lista EXACTA que Voni armó en la prueba de Rodrigo (sale de su captura de
// "Sin ubicar en el plano"), contra su plano real. Para ver dónde cae cada cosa.
import fs from 'node:fs';
import { areasDeLectura } from '../src/datos/planoLeido.js';
import { expandirPiezas, dimsPieza, tipoDe } from '../src/datos/espacio.js';
import { acomodarLocal } from '../src/datos/planner.js';

const aMM = (areas) => areas.map((a) => ({
  nombre: a.nombre,
  ...(a.tipo ? { tipo: a.tipo } : {}),
  ...(a.dentroDe ? { dentroDe: a.dentroDe } : {}),
  ...(a.contiene ? { contiene: a.contiene } : {}),
  ...(Number.isFinite(a.x) && Number.isFinite(a.y) ? { x: Math.round(a.x * 1000), y: Math.round(a.y * 1000) } : {}),
  ancho: Math.round((a.ancho || 0) * 1000), largo: Math.round((a.largo || 0) * 1000),
  ...(a.poly ? { poly: a.poly.map(([x, y]) => [Math.round(x * 1000), Math.round(y * 1000)]) } : {}),
  ...(a.obstaculos?.length ? { obstaculos: a.obstaculos.map((o) => ({ x: Math.round(o.x * 1000), y: Math.round(o.y * 1000), w: Math.round(o.w * 1000), h: Math.round(o.h * 1000), tipo: o.tipo })) } : {}),
}));

const j = JSON.parse(fs.readFileSync('scratchpad/lectura.json', 'utf8'));
const areas = aMM(areasDeLectura(j.lectura).areas);

// TAL CUAL la captura de Rodrigo.
const partidas = [
  { id: 'b', nombre: 'Banca doble APP LT 1.80 · 12 usuarios · ocupa 10.80 × 1.20 m', cantidad: 4, precioUnitario: 1, w: 10800, d: 1200, ruta: 'applt' },
  { id: 'r', nombre: 'Recepción', cantidad: 1, precioUnitario: 1, w: 2420, d: 830 },
  { id: 'a', nombre: 'Modulor · Archivero horizontal 0.75 2 puertas · Melamina y canto ABS', cantidad: 53, precioUnitario: 1, w: 750, d: 476, ruta: 'modulor' },
  { id: 'so', nombre: 'Silla operativa · GAMMA-E', cantidad: 48, precioUnitario: 1, w: 600, d: 600 },
  { id: 'sv', nombre: 'Silla de visita · CONCERTO', cantidad: 14, precioUnitario: 1, w: 550, d: 550 },
  { id: 'sd', nombre: 'Silla directiva ALPHA', cantidad: 5, precioUnitario: 1, w: 650, d: 650 },
  { id: 'cr', nombre: 'Eclipse Credenza baja 2.10 × 0.60 m · mano Derecha', cantidad: 5, precioUnitario: 1, w: 2100, d: 600, ruta: 'eclipse' },
  { id: 'e', nombre: 'Eclipse Escritorio Directivo 2.10 m · mano Derecha', cantidad: 5, precioUnitario: 1, w: 2100, d: 900, ruta: 'eclipse' },
];
console.log('TIPO que le toca a cada partida:');
for (const p of partidas) console.log(`  ${String(p.nombre).slice(0, 44).padEnd(46)} -> ${tipoDe(p)}`);

const piezas = expandirPiezas(partidas);
const byId = Object.fromEntries(piezas.map((p) => [p.id, p]));
const plan = acomodarLocal(areas, piezas, {});
console.log(`\nACOMODO: ${plan.colocacion.length} de ${piezas.length} · caben=${plan.caben}`);
if (plan.notas?.length) console.log('  ', plan.notas.join(' · '));

console.log('\nQUÉ QUEDÓ EN CADA CUARTO:');
for (let i = 0; i < areas.length; i++) {
  const dentro = plan.colocacion.filter((c) => c.area === i);
  const cuenta = {};
  for (const c of dentro) { const n = byId[c.id].nombre.slice(0, 30); cuenta[n] = (cuenta[n] || 0) + 1; }
  const txt = Object.entries(cuenta).map(([n, v]) => `${v}× ${n}`).join(' · ');
  console.log(`  ${String(areas[i].nombre).padEnd(38)} ${txt || '(vacío)'}`);
}
const falta = {};
const puestas = new Set(plan.colocacion.map((c) => c.id));
for (const p of piezas) if (!puestas.has(p.id)) falta[p.nombre.slice(0, 34)] = (falta[p.nombre.slice(0, 34)] || 0) + 1;
if (Object.keys(falta).length) console.log('\nNO CABEN:', JSON.stringify(falta, null, 1));
