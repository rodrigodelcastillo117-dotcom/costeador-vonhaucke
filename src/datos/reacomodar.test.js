import { describe, it, expect } from 'vitest';
import { reacomodar, fijasDe } from './reacomodar.js';
import { acomodarLocal } from './planner.js';

// ============================================================================
//  LO QUE ACOMODASTE A MANO NO SE BORRA
//  Rodrigo, 2026-08-17: "que al volver a armar NO se borre lo que edité a mano".
//  La prueba que importa: el mueble que el proyectista puso en un punto sigue
//  EXACTAMENTE en ese punto después de volver a acomodar, y ninguno de los que
//  el motor acomoda se le encima.
// ============================================================================
const AREAS = [
  { nombre: 'Open space', ancho: 12000, largo: 9000 },
  { nombre: 'Privado 1', ancho: 4000, largo: 3500 },
];
const PIEZAS = [
  ...Array.from({ length: 6 }, (_, i) => ({ id: 'e' + i, nombre: 'Escritorio', w: 1500, d: 750, tipo: 'escritorio' })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: 'g' + i, nombre: 'Archivero', w: 900, d: 450, tipo: 'guarda' })),
];
const byId = Object.fromEntries(PIEZAS.map((p) => [p.id, p]));

// El proyectista movió dos muebles con el dedo, a un lugar que él escogió.
const A_MANO = [
  { id: 'e0', area: 0, x: 5200, y: 4100, rot: 90, manual: true },
  { id: 'g0', area: 1, x: 300, y: 2600, rot: 0, manual: true },
];

const encimados = (colocacion) => {
  const cajas = colocacion.map((c) => {
    const p = byId[c.id];
    const gir = (c.rot || 0) % 180 !== 0;
    const w = gir ? p.d : p.w, h = gir ? p.w : p.d;
    return { area: c.area ?? 0, x0: c.x, y0: c.y, x1: c.x + w, y1: c.y + h };
  });
  const pares = [];
  for (let i = 0; i < cajas.length; i++) for (let j = i + 1; j < cajas.length; j++) {
    const a = cajas[i], b = cajas[j];
    if (a.area !== b.area) continue;
    if (Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 20 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 20) pares.push([i, j]);
  }
  return pares;
};

describe('re-acomodar respetando lo puesto a mano', () => {
  it('los muebles que moviste siguen en el MISMO punto, con el MISMO giro', () => {
    const r = reacomodar({ areas: AREAS, piezas: PIEZAS, colocacion: A_MANO, byId });
    for (const m of A_MANO) {
      const q = r.colocacion.find((c) => c.id === m.id);
      expect(q).toBeTruthy();
      expect([q.area, q.x, q.y, q.rot]).toEqual([m.area, m.x, m.y, m.rot]);
    }
  });

  it('el motor acomoda el RESTO y no le encima nada a lo que pusiste', () => {
    const r = reacomodar({ areas: AREAS, piezas: PIEZAS, colocacion: A_MANO, byId });
    expect(encimados(r.colocacion)).toEqual([]);
    expect(r.colocacion.length).toBe(PIEZAS.length);
  });

  it('la cuenta de la auditoría es la de TODAS las piezas, no sólo las que acomodó', () => {
    const r = reacomodar({ areas: AREAS, piezas: PIEZAS, colocacion: A_MANO, byId });
    const todas = r.auditoria.find((a) => a.check === 'Todas las piezas colocadas');
    expect(todas.detalle).toBe(`${PIEZAS.length} de ${PIEZAS.length}`);
    expect(r.auditoria.some((a) => a.check === 'Respeté lo que pusiste a mano')).toBe(true);
  });

  it('devuelve las áreas DE VERDAD, sin los muebles disfrazados de obstáculo', () => {
    const r = reacomodar({ areas: AREAS, piezas: PIEZAS, colocacion: A_MANO, byId });
    expect(r.areas).toEqual(AREAS);
    expect(r.areas.some((a) => (a.obstaculos || []).length)).toBe(false);
  });

  it('un mueble que ya NO está en la cotización libera su lugar', () => {
    const menos = PIEZAS.filter((p) => p.id !== 'e0');
    expect(fijasDe(A_MANO, menos).map((c) => c.id)).toEqual(['g0']);
  });

  it('sin nada a mano, es el acomodo de siempre', () => {
    const r = reacomodar({ areas: AREAS, piezas: PIEZAS, colocacion: [], byId });
    const base = acomodarLocal(AREAS, PIEZAS, {});
    expect(r.fijas).toBe(0);
    expect(r.colocacion).toEqual(base.colocacion);
  });

  // El proyectista que acomodó TODO con el dedo y luego toca "acomodar" por
  // costumbre: no queda nada que acomodar, y eso no puede tronar ni borrarle
  // el trabajo entero.
  it('con TODO puesto a mano, no queda nada que acomodar y nada se pierde', () => {
    const todas = PIEZAS.map((p, i) => ({ id: p.id, area: 0, x: 500 + i * 1600, y: 500, rot: 0, manual: true }));
    const r = reacomodar({ areas: AREAS, piezas: PIEZAS, colocacion: todas, byId });
    expect(r.colocacion).toHaveLength(PIEZAS.length);
    expect(r.fijas).toBe(PIEZAS.length);
    expect(r.caben).toBe(true);
  });

  it('y si pides empezar de cero, se ignora lo de mano', () => {
    const r = reacomodar({ areas: AREAS, piezas: PIEZAS, colocacion: A_MANO, byId, respetarManual: false });
    expect(r.fijas).toBe(0);
  });
});

// ============================================================================
//  LA SILLA NUEVA SÍ ENCUENTRA EL ESCRITORIO PUESTO A MANO
//  `acomodarLocal` sienta cada silla junto a su escritorio, pero sólo ve lo que
//  le toca acomodar a él: un escritorio fijo le llega disfrazado de obstáculo,
//  no como colocación, así que antes de este arreglo una silla agregada después
//  de mover su escritorio con el dedo se iba a acomodar como mueble suelto
//  contra cualquier muro, lejos de su escritorio.
// ============================================================================
describe('re-acomodar sienta la silla junto al escritorio puesto a mano', () => {
  const AREA1 = [{ nombre: 'Privado 1', ancho: 4000, largo: 4000 }];
  const ESCRITORIO = { id: 'esc1', nombre: 'Escritorio APP LT 1.50 x 0.75', w: 1500, d: 750, tipo: 'escritorio' };
  const SILLA = { id: 'silla1', nombre: 'Silla operativa WIN', w: 600, d: 600, tipo: 'asiento' };

  it('una silla NUEVA (sin manual) se sienta pegada al escritorio que ya está fijo', () => {
    const colocacionPrevia = [{ id: 'esc1', area: 0, x: 500, y: 500, rot: 0, manual: true }];
    const r = reacomodar({ areas: AREA1, piezas: [ESCRITORIO, SILLA], colocacion: colocacionPrevia, ajustar: false });
    const silla = r.colocacion.find((c) => c.id === 'silla1');
    expect(silla).toBeTruthy();
    // Pegada (< 100 mm de holgura) al escritorio, no tirada contra otro muro.
    const cerca = Math.abs(silla.x - 500) < 1000 && Math.abs(silla.y - 1250) < 1000;
    expect(cerca).toBe(true);
  });

  it('una silla que YA estaba puesta a mano no se mueve, aunque el escritorio también sea manual', () => {
    const colocacionPrevia = [
      { id: 'esc1', area: 0, x: 500, y: 500, rot: 0, manual: true },
      { id: 'silla1', area: 0, x: 3000, y: 3000, rot: 0, manual: true },
    ];
    const r = reacomodar({ areas: AREA1, piezas: [ESCRITORIO, SILLA], colocacion: colocacionPrevia, ajustar: false });
    const silla = r.colocacion.find((c) => c.id === 'silla1');
    expect([silla.x, silla.y, silla.rot]).toEqual([3000, 3000, 0]);
  });
});
