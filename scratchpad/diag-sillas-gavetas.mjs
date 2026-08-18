// Diagnóstico DURO: corre el plano real de Rodrigo CON gavetas y mide dónde
// quedan sillas y gavetas. El fixture de prueba no trae gavetas, por eso nunca
// se cuidaron. Aquí sí. (2026-08-18)
import { expandirPiezas, dimsPieza, tipoDe } from '../src/datos/espacio.js';
import { acomodarLocal } from '../src/datos/planner.js';

const PASILLO = 'Pasillo de circulación / Área abierta';
const AREAS_M = [
  { nombre: 'Privado 1', tipo: 'privado', ancho: 4.5, largo: 5 },
  { nombre: 'Privado 2', tipo: 'privado', ancho: 3.5, largo: 6 },
  { nombre: 'Privado 3', tipo: 'privado', ancho: 5, largo: 5 },
  { nombre: 'Privado 4', tipo: 'privado', ancho: 4, largo: 5.5 },
  { nombre: 'Privado 5', tipo: 'privado', ancho: 5, largo: 5.5 },
  { nombre: 'Sala Juntas 1', tipo: 'juntas', ancho: 7, largo: 6 },
  { nombre: 'Sala Juntas 2', tipo: 'juntas', ancho: 7, largo: 5 },
  { nombre: 'Recepción', tipo: 'recepcion', ancho: 7, largo: 8 },
  { nombre: PASILLO, tipo: 'open', ancho: 23, largo: 14, contiene: 8 },
  ...[1,2,3,4,5,6,7,8].map((n) => ({ nombre: `Área Op. ${n}`, tipo: 'open', ancho: 4.5, largo: 3.5, dentroDe: PASILLO })),
];
const aMM = (as) => as.map((a) => ({ ...a, ancho: Math.round(a.ancho*1000), largo: Math.round(a.largo*1000) }));

const partidas = [
  { id: 'b', nombre: 'Banca doble APP LT 1.50 · 6 usuarios', cantidad: 8, precioUnitario: 1, w: 4500, d: 1200, ruta: 'applt' },
  { id: 'so', nombre: 'Silla operativa · GAMMA-E', cantidad: 48, precioUnitario: 1, w: 600, d: 600 },
  { id: 'ped', nombre: 'Pedestal 2 cajones', cantidad: 48, precioUnitario: 1, w: 420, d: 580 },
  { id: 'e', nombre: 'Eclipse Escritorio Directivo 2.10 m', cantidad: 5, precioUnitario: 1, w: 2100, d: 900, ruta: 'eclipse' },
  { id: 'sd', nombre: 'Silla directiva ALPHA', cantidad: 5, precioUnitario: 1, w: 650, d: 650 },
  { id: 'sv', nombre: 'Silla de visita · CONCERTO', cantidad: 10, precioUnitario: 1, w: 550, d: 550 },
  { id: 'arc', nombre: 'Archivero de piso 2 gavetas', cantidad: 5, precioUnitario: 1, w: 900, d: 450 },
  { id: 'mj0', nombre: 'Mesa de juntas APP LT 10 personas', cantidad: 1, precioUnitario: 1, w: 3000, d: 1200, ruta: 'applt' },
  { id: 'mj1', nombre: 'Mesa de juntas APP LT 8 personas', cantidad: 1, precioUnitario: 1, w: 2600, d: 1200, ruta: 'applt' },
  { id: 'mos', nombre: 'Recepción · mostrador', cantidad: 1, precioUnitario: 1, w: 2420, d: 830 },
];
const piezas = expandirPiezas(partidas);
const byId = Object.fromEntries(piezas.map((p) => [p.id, p]));
const plan = acomodarLocal(aMM(AREAS_M), piezas, {});
const areasMM = aMM(AREAS_M);

const caja = (c) => { const { pw, ph } = dimsPieza(byId[c.id], c.rot || 0); return { x: c.x, y: c.y, w: pw, d: ph, area: c.area, id: c.id, nombre: byId[c.id].nombre, tipo: tipoDe(byId[c.id]) }; };
const cajas = plan.colocacion.map(caja);
const hueco = (a, b) => {
  const gx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const gy = Math.max(b.y - (a.y + a.d), a.y - (b.y + b.d));
  if (gx > 0 && gy > 0) return Math.hypot(gx, gy);
  return Math.max(gx, gy);
};
const solapa = (a, b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.d && a.y+a.d > b.y;

console.log(`Piezas: ${piezas.length}, colocadas: ${plan.colocacion.length}, sin colocar: ${piezas.length - plan.colocacion.length}`);

let encimados = 0, paresEnc = [];
for (let i=0;i<cajas.length;i++) for (let j=i+1;j<cajas.length;j++) {
  if (cajas[i].area===cajas[j].area && solapa(cajas[i],cajas[j])) { encimados++; if (paresEnc.length<6) paresEnc.push(`${cajas[i].nombre.slice(0,18)} x ${cajas[j].nombre.slice(0,18)} (area ${cajas[i].area})`); }
}
console.log(`\nENCIMADOS: ${encimados}`);
paresEnc.forEach((p) => console.log('   . ' + p));

const guardas = cajas.filter((c) => c.tipo === 'guarda');
const anclas = cajas.filter((c) => c.tipo === 'escritorio' || c.tipo === 'juntas' || /banca|bench/i.test(c.nombre));
let sueltas = 0, detSuelta = [];
for (const g of guardas) {
  const m = anclas.filter((a) => a.area === g.area);
  const dmin = m.length ? Math.min(...m.map((a) => hueco(g, a))) : Infinity;
  if (dmin > 250) { sueltas++; if (detSuelta.length<6) detSuelta.push(`${g.nombre.slice(0,20)} en area ${g.area}: a ${dmin===Infinity?'inf':Math.round(dmin)}mm de la estacion mas cercana`); }
}
console.log(`\nGAVETAS: ${guardas.length} . SUELTAS (>25cm de una estacion): ${sueltas}`);
detSuelta.forEach((d) => console.log('   . ' + d));

const sillas = cajas.filter((c) => /silla operativa/i.test(c.nombre));
const bancas = cajas.filter((c) => /banca|bench/i.test(c.nombre));
let sillasSueltas = 0, sillasEncimadas = 0;
for (const s of sillas) {
  const m = bancas.filter((b) => b.area === s.area);
  const dmin = m.length ? Math.min(...m.map((b) => hueco(s, b))) : Infinity;
  if (m.some((b) => solapa(s, b))) sillasEncimadas++;
  else if (dmin > 300) sillasSueltas++;
}
console.log(`\nSILLAS OPERATIVAS: ${sillas.length} . encimadas con su banca: ${sillasEncimadas} . sueltas (>30cm): ${sillasSueltas}`);

// Sillas de visita y directivas: ¿pegadas a su escritorio en el privado?
const escritorios = cajas.filter((c) => c.tipo === 'escritorio');
for (const [re, lbl] of [[/silla directiva/i,'DIRECTIVAS'],[/silla de visita/i,'VISITA']]) {
  const ss = cajas.filter((c) => re.test(c.nombre));
  let lejos = 0, enc = 0;
  for (const s of ss) {
    const m = escritorios.filter((e) => e.area === s.area);
    const dmin = m.length ? Math.min(...m.map((e) => hueco(s, e))) : Infinity;
    if (m.some((e) => solapa(s, e))) enc++;
    else if (dmin > 400) lejos++;
  }
  console.log(`SILLAS ${lbl}: ${ss.length} . encimadas con escritorio: ${enc} . lejos (>40cm): ${lejos}`);
}

// Reparto de guardas: ¿en cuántas áreas distintas cayeron?
const areasConGuarda = [...new Set(guardas.map((g) => g.area))];
console.log(`\nREPARTO DE GAVETAS: ${guardas.length} archiveros en ${areasConGuarda.length} area(s): ${areasConGuarda.map((a)=>areasMM[a]?.nombre).join(', ')}`);

// Posición relativa gaveta↔escritorio en el mismo privado
console.log('\nGAVETA vs ESCRITORIO en cada privado:');
for (const g of guardas) {
  const e = escritorios.find((e) => e.area === g.area);
  if (!e) { console.log(`   area ${g.area}: sin escritorio`); continue; }
  const gapX = Math.max(e.x - (g.x+g.w), g.x - (e.x+e.w));
  const gapY = Math.max(e.y - (g.y+g.d), g.y - (e.y+e.d));
  console.log(`   ${areasMM[g.area].nombre}: escritorio@(${e.x},${e.y}) ${e.w}x${e.d} · gaveta@(${g.x},${g.y}) ${g.w}x${g.d} · gapX=${gapX} gapY=${gapY}`);
}

console.log('\nPOR AREA OPERATIVA (isla):');
for (let i=0;i<areasMM.length;i++) {
  if (!/Área Op/.test(areasMM[i].nombre)) continue;
  const dentro = cajas.filter((c) => c.area === i);
  const nb = dentro.filter((c)=>/banca/i.test(c.nombre)).length;
  const ns = dentro.filter((c)=>/silla operativa/i.test(c.nombre)).length;
  const ng = dentro.filter((c)=>c.tipo==='guarda').length;
  console.log(`   ${areasMM[i].nombre}: ${nb} banca, ${ns} sillas, ${ng} gavetas`);
}
