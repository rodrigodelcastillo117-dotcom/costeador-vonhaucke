// ============================================================================
//  VH-033 (2026-10-11) · El acomodo perdía sillas con piso de sobra.
//  Reproducido antes del fix: 48 de 72 en sala de 23×14 m; 0 de 49 en "Sala de
//  capacitación". Regla del mandato §4: "No basta con decir 'caben 72'. Deben verse
//  realmente colocados 72, o especificar cuántos se colocaron y por qué faltan".
// ============================================================================
import { describe, it, expect } from 'vitest';
import { expandirPiezas, dimsPieza } from './espacio.js';
import { acomodarLocal } from './planner.js';
import { violacionesSemanticas } from './floorSpec.js';

const byId = (piezas) => Object.fromEntries(piezas.map((p) => [p.id, p]));
function encimadas(r, piezas) {
  const m = byId(piezas); const cajas = r.colocacion.map((c) => { const { pw, ph } = dimsPieza(m[c.id], c.rot || 0); return { id: c.id, a: c.area, x: c.x, y: c.y, w: pw, d: ph }; });
  let n = 0;
  for (let i = 0; i < cajas.length; i++) for (let j = i + 1; j < cajas.length; j++) {
    const A = cajas[i], B = cajas[j]; if (A.a !== B.a) continue;
    const tol = 20;
    if (A.x < B.x + B.w - tol && A.x + A.w - tol > B.x && A.y < B.y + B.d - tol && A.y + A.d - tol > B.y) n++;
  }
  return n;
}
// Invariante: pedidas = colocadas + sinColocar, sin duplicados ni fantasmas.
function invariante(r, piezas) {
  const ids = r.colocacion.map((c) => c.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(new Set([...ids, ...r.sinColocar]).size).toBe(piezas.length);
  expect(ids.length + r.sinColocar.length).toBe(piezas.length);
  expect(r.caben).toBe(r.sinColocar.length === 0);
}

describe('VH-033 · sillas con piso de sobra', () => {
  it('24 escritorios + 48 sillas en 23×14 m: las 72 colocadas, nada encimado', () => {
    const piezas = expandirPiezas([
      { id: 'e', nombre: 'Escritorio operativo 1.20', cantidad: 24, precioUnitario: 1, w: 1200, d: 600 },
      { id: 'so', nombre: 'Silla operativa · GAMMA-E', cantidad: 48, precioUnitario: 1, w: 600, d: 600 },
    ]);
    const areas = [{ nombre: 'Área operativa', tipo: 'operativa', ancho: 23000, largo: 14000 }];
    const r = acomodarLocal(areas, piezas, {});
    invariante(r, piezas);
    expect(r.colocacion.length).toBe(72);
    expect(encimadas(r, piezas)).toBe(0);
    expect(violacionesSemanticas(r.colocacion, areas, byId(piezas))).toHaveLength(0);
  });

  it('"Sala de capacitación" (1 escritorio + 48 sillas, 14×12 m): el nombre ya no la vuelve sala de consejo', () => {
    const piezas = expandirPiezas([
      { id: 'so', nombre: 'Silla operativa · GAMMA-E', cantidad: 48, precioUnitario: 1, w: 600, d: 600 },
      { id: 'e', nombre: 'Escritorio operativo 1.20', cantidad: 1, precioUnitario: 1, w: 1200, d: 600 },
    ]);
    const areas = [{ nombre: 'Sala de capacitación', ancho: 14000, largo: 12000 }];
    const r = acomodarLocal(areas, piezas, {});
    invariante(r, piezas);
    expect(r.colocacion.length).toBe(49);
    expect(encimadas(r, piezas)).toBe(0);
  });

  it('"Silla ALPHA" ×10 junto a una sala de juntas: las 10 se colocan en piso libre', () => {
    const piezas = expandirPiezas([
      { id: 'mj', nombre: 'Mesa de juntas 8 personas', cantidad: 1, precioUnitario: 1, w: 2600, d: 1200 },
      { id: 's', nombre: 'Silla ALPHA', cantidad: 10, precioUnitario: 1, w: 600, d: 600 },
    ]);
    const areas = [{ nombre: 'Sala de Juntas', ancho: 7000, largo: 6000 }];
    const r = acomodarLocal(areas, piezas, {});
    invariante(r, piezas);
    expect(r.colocacion.length).toBe(11);
  });

  it('lo que de verdad no cabe se reporta por nombre, y la cuenta cuadra', () => {
    const piezas = expandirPiezas([
      { id: 'e', nombre: 'Escritorio operativo 1.20', cantidad: 40, precioUnitario: 1, w: 1200, d: 600 },
      { id: 'so', nombre: 'Silla operativa', cantidad: 40, precioUnitario: 1, w: 600, d: 600 },
    ]);
    const areas = [{ nombre: 'Área operativa', tipo: 'operativa', ancho: 6000, largo: 5000 }];
    const r = acomodarLocal(areas, piezas, {});
    invariante(r, piezas);
    expect(r.caben).toBe(false);
    expect(r.sinColocar.length).toBeGreaterThan(0);
    expect(r.notas.join(' ')).toMatch(/no caben en el plano: /);
    expect(r.auditoria.find((a) => a.check === 'Todas las piezas colocadas').detalle).toBe(`${r.colocacion.length} de ${piezas.length}`);
  });
});
