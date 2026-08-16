// AUDITORÍA GEOMÉTRICA del acomodo automático (solo lectura, no toca src/).
// node scratchpad/audit-geom.mjs
import { acomodarLocal } from '../src/datos/planner.js';
import { acomodarEnForma, dentroPoly } from '../src/datos/malla.js';
import { expandirPiezas, dimsPieza, huellaReal, tipoDe } from '../src/datos/espacio.js';
import { areasDeLectura, revisarAreas } from '../src/datos/planoLeido.js';

const ok = (b) => (b ? 'OK ' : 'MAL');
const m2 = (mm2) => (mm2 / 1e6).toFixed(2);

// ---------- utilidades de medición -----------------------------------------
function cajas(plan, byId, areas) {
  return (plan.colocacion || []).map((c) => {
    const p = byId[c.id];
    const { pw, ph } = dimsPieza(p, c.rot);
    return { id: c.id, nombre: p.nombre, tipo: p.tipo, area: c.area ?? 0,
      x0: c.x, y0: c.y, x1: c.x + pw, y1: c.y + ph, rot: c.rot };
  });
}
function traslapes(bs) {
  const out = [];
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    const a = bs[i], b = bs[j]; if (a.area !== b.area) continue;
    const ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
    const iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (ix > 20 && iy > 20) out.push({ a: a.nombre, b: b.nombre, m2: +m2(ix * iy) });
  }
  return out;
}
// separación mínima real entre dos muebles del mismo cuarto (mm, 0 = pegados)
function separacionMin(bs) {
  let peor = Infinity, par = null;
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    const a = bs[i], b = bs[j]; if (a.area !== b.area) continue;
    const dx = Math.max(a.x0 - b.x1, b.x0 - a.x1, 0);
    const dy = Math.max(a.y0 - b.y1, b.y0 - a.y1, 0);
    const d = Math.hypot(dx, dy);
    if (d < peor) { peor = d; par = [a.nombre, b.nombre]; }
  }
  return { d: peor, par };
}
function fueraDelPoly(bs, areas) {
  const out = [];
  for (const b of bs) {
    const a = areas[b.area]; if (!a) continue;
    if (b.x0 < -20 || b.y0 < -20 || b.x1 > a.ancho + 20 || b.y1 > a.largo + 20) { out.push({ ...b, por: 'bbox' }); continue; }
    if (a.poly && a.poly.length >= 3) {
      const esq = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]];
      if (esq.some(([x, y]) => !dentroPoly(a.poly, x, y))) out.push({ ...b, por: 'poly' });
    }
  }
  return out;
}
function chocaObstaculo(bs, areas) {
  const out = [];
  for (const b of bs) {
    for (const o of (areas[b.area]?.obstaculos || [])) {
      const ix = Math.min(b.x1, o.x + o.w) - Math.max(b.x0, o.x);
      const iy = Math.min(b.y1, o.y + o.h) - Math.max(b.y0, o.y);
      if (ix > 20 && iy > 20) out.push({ mueble: b.nombre, obst: o.tipo, m2: +m2(ix * iy) });
    }
  }
  return out;
}

// ============================================================================
console.log('\n===== CASO 1 · privado 3.5×4 con escritorio + credenza + 2 sillas visita');
{
  const areas = [{ nombre: 'Privado 1', tipo: 'privado', ancho: 3500, largo: 4000,
    puertas: [{ x: 3400, y: 500, ancho: 900 }] }];
  const piezas = [
    { id: 'd1', nombre: 'Anteo · Escritorio 1.80', w: 1800, d: 800, tipo: 'escritorio' },
    { id: 'c1', nombre: 'Anteo · Credenza', w: 1500, d: 450, tipo: 'guarda' },
    { id: 's1', nombre: 'Silla visita', w: 600, d: 600, tipo: 'asiento' },
    { id: 's2', nombre: 'Silla visita', w: 600, d: 600, tipo: 'asiento' },
  ];
  const byId = Object.fromEntries(piezas.map((p) => [p.id, p]));
  const r = acomodarLocal(areas, piezas, { ajustar: false });
  const bs = cajas(r, byId, areas);
  console.log('colocadas', r.colocacion.length, '/', piezas.length, r.notas);
  for (const b of bs) console.log(`  ${b.nombre.padEnd(28)} x=${b.x0} y=${b.y0} rot=${b.rot} (${b.x1 - b.x0}×${b.y1 - b.y0})`);
  console.log(' traslapes:', traslapes(bs));
  console.log(' fuera:', fueraDelPoly(bs, areas).map((f) => f.nombre));
  const s = separacionMin(bs);
  console.log(` separación mínima entre muebles: ${s.d} mm  ${ok(s.d >= 900)} (regla 900)`, s.par);
  const d = bs.find((b) => b.tipo === 'escritorio');
  console.log(` escritorio rot=${d?.rot} (puerta en x=3400,y=500 → debería mirar hacia allá)`);
}

// ============================================================================
console.log('\n===== CASO 2 · open space 20 m² con 20 puestos (¿avisa o encima?)');
{
  const areas = [{ nombre: 'Open space', tipo: 'open', ancho: 5000, largo: 4000 }];
  const piezas = Array.from({ length: 20 }, (_, k) => ({
    id: 'e' + k, nombre: 'App LT · Estación 1.50', w: 1500, d: 750, tipo: 'escritorio' }));
  const byId = Object.fromEntries(piezas.map((p) => [p.id, p]));
  const r = acomodarLocal(areas, piezas, { ajustar: false });
  const bs = cajas(r, byId, areas);
  console.log(' colocadas', r.colocacion.length, '/ 20 · caben=', r.caben);
  console.log(' notas:', r.notas);
  console.log(' traslapes:', traslapes(bs).length);
  console.log(' fuera:', fueraDelPoly(bs, areas).length);
}

// ============================================================================
console.log('\n===== CASO 3 · planta en L + columna (¿respeta forma?)');
{
  const areas = [{ nombre: 'Open space', tipo: 'open', ancho: 9000, largo: 6500,
    poly: [[0, 0], [9000, 0], [9000, 4000], [5600, 4000], [5600, 6500], [0, 6500]],
    obstaculos: [{ x: 3000, y: 2600, w: 400, h: 400, tipo: 'columna' }],
    puertas: [{ x: 200, y: 3000, ancho: 900 }] }];
  const piezas = [
    { id: 'b1', nombre: 'Banca doble 8 usuarios · ocupa 4.80 × 1.20 m', w: 4800, d: 1200, tipo: 'escritorio' },
    { id: 'b2', nombre: 'Banca doble 8 usuarios · ocupa 4.80 × 1.20 m', w: 4800, d: 1200, tipo: 'escritorio' },
    { id: 'a1', nombre: 'Archivero', w: 900, d: 450, tipo: 'guarda' },
    { id: 'a2', nombre: 'Archivero', w: 900, d: 450, tipo: 'guarda' },
  ];
  const byId = Object.fromEntries(piezas.map((p) => [p.id, p]));
  const r = acomodarLocal(areas, piezas, { ajustar: false });
  const bs = cajas(r, byId, areas);
  for (const b of bs) console.log(`  ${b.nombre.slice(0, 26).padEnd(28)} x=${b.x0} y=${b.y0} rot=${b.rot}`);
  console.log(' fuera del polígono:', fueraDelPoly(bs, areas));
  console.log(' choca columna:', chocaObstaculo(bs, areas));
  console.log(' auditoría:', r.auditoria.map((a) => `${a.ok ? '✓' : '⚠'} ${a.check}`).join(' | '));
}

// ============================================================================
console.log('\n===== CASO 4 · lectura de plano: cuarto sin geometría (¿avisa?)');
{
  const lectura = {
    envolvente: { ancho: 30000, largo: 20000 },
    areas: [
      { nombre: 'Open space', forma: 'poligono', puntos: [{ x: 0, y: 0 }, { x: 20000, y: 0 }, { x: 20000, y: 15000 }, { x: 0, y: 15000 }] },
      { nombre: 'Sala de juntas', forma: 'circulo', circulo: { cx: 10000, cy: 7000, r: 3500 } },
      { nombre: 'Privado 3', tipo: 'privado' },          // <- el modelo no lo pudo ubicar
      { nombre: 'Bodega', forma: 'poligono', puntos: [{ x: 1, y: 1 }] }, // <- basura
    ],
    puertas: [],
  };
  const { areas } = areasDeLectura(lectura);
  console.log(' áreas que entraron a la app:', areas.length, 'de', lectura.areas.length);
  console.log(' nombres:', areas.map((a) => a.nombre));
  console.log(' revisarAreas dice:', revisarAreas(lectura));
  console.log(' >>> ¿alguien avisó de "Privado 3" y "Bodega"?', revisarAreas(lectura).some((p) => /Privado 3|Bodega/.test(p)) ? 'sí' : 'NO — se perdieron en silencio');
  const oc = areas.find((a) => a.nombre === 'Open space');
  console.log(' obstáculo que le queda al open por la sala CIRCULAR Ø7:',
    oc.obstaculos, '→', (oc.obstaculos[0].w * oc.obstaculos[0].h).toFixed(1), 'm² bloqueados vs',
    (Math.PI * 3.5 * 3.5).toFixed(1), 'm² reales de la sala');
}

// ============================================================================
console.log('\n===== CASO 5 · el proyectista MUEVE una pieza encima de otra');
{
  const areas = [{ nombre: 'Open space', tipo: 'open', ancho: 8000, largo: 6000 }];
  const piezas = [
    { id: 'b1', nombre: 'Banca 4 usuarios · ocupa 3.00 × 1.20 m', w: 3000, d: 1200, tipo: 'escritorio' },
    { id: 'b2', nombre: 'Banca 4 usuarios · ocupa 3.00 × 1.20 m', w: 3000, d: 1200, tipo: 'escritorio' },
  ];
  const byId = Object.fromEntries(piezas.map((p) => [p.id, p]));
  const r = acomodarLocal(areas, piezas, { ajustar: false });
  console.log(' auditoría ANTES:', r.auditoria.map((a) => `${a.ok ? '✓' : '⚠'} ${a.check}`).join(' | '));
  // simula soltarEn(): mueve b2 justo encima de b1
  const b1 = r.colocacion.find((c) => c.id === 'b1');
  const plan2 = { ...r, colocacion: r.colocacion.map((c) => (c.id === 'b2' ? { ...c, x: b1.x + 100, y: b1.y + 100 } : c)) };
  console.log(' auditoría DESPUÉS del movimiento (¿cambió?):',
    plan2.auditoria.map((a) => `${a.ok ? '✓' : '⚠'} ${a.check}`).join(' | '));
  console.log(' traslape REAL:', traslapes(cajas(plan2, byId, areas)));
  console.log(' >>> plan.auditoria es el MISMO objeto:', plan2.auditoria === r.auditoria);
}

// ============================================================================
console.log('\n===== CASO 6 · soltar en el hueco de una L (¿lo ve la app?)');
{
  const areas = [{ nombre: 'Open L', tipo: 'open', ancho: 9000, largo: 6500,
    poly: [[0, 0], [9000, 0], [9000, 4000], [5600, 4000], [5600, 6500], [0, 6500]] }];
  const piezas = [{ id: 'e1', nombre: 'Escritorio 1.80', w: 1800, d: 800, tipo: 'escritorio' }];
  const byId = Object.fromEntries(piezas.map((p) => [p.id, p]));
  // el proyectista lo suelta en x=6800,y=5000 → dentro del bbox, FUERA del polígono
  const plan = { colocacion: [{ id: 'e1', area: 0, x: 6800, y: 5000, rot: 0 }], auditoria: [], notas: [] };
  const bs = cajas(plan, byId, areas);
  // el chequeo de Acomodo.jsx (solo bbox):
  const a = areas[0];
  const chequeoApp = bs.some((b) => b.x0 < -20 || b.y0 < -20 || b.x1 > a.ancho + 20 || b.y1 > a.largo + 20);
  console.log(' ¿el chequeo de la app lo reporta?', chequeoApp ? 'sí' : 'NO');
  console.log(' ¿está de verdad fuera del cuarto?', fueraDelPoly(bs, areas).length ? 'SÍ, fuera del polígono' : 'no');
}

// ============================================================================
console.log('\n===== CASO 7 · huellaReal / expandirPiezas con nombres reales');
{
  const casos = [
    ['App LT · Banca doble 8 usuarios', 1500, 750, 'escritorio'],
    ['App LT · Banca doble 8 usuarios · ocupa 6.00 × 1.50 m', 6000, 1500, 'escritorio'],
    ['Río · Bench 6u', 1400, 700, 'escritorio'],
    ['Sofá 3 plazas', 700, 800, 'asiento'],
    ['Mesa de juntas 12 personas', 3600, 1400, 'juntas'],
  ];
  for (const [n, w, d, t] of casos) console.log(`  ${n.padEnd(50)} → ${huellaReal(n, w, d, t).join(' × ')}`);
  console.log('  tipoDe("Mesa de juntas 12 personas") =', tipoDe({ nombre: 'Mesa de juntas 12 personas' }));
}
