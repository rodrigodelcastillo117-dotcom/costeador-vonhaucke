// La rejilla de corte usa las medidas del FORMATO del insumo (2026-10-13, RC). Antes usaba siempre 2440×1220:
// un 5×8 (2440×1525) o una lámina 3×10 (3048×914) se nesteaban como si fueran 4×8.
import { describe, it, expect } from 'vitest';
import { calcular, piezasPorTablero, parametrosDeFormato, PARAMETROS_DEFAULT, sugerenciaMedida } from './calculo.js';

const F48 = { tipo: 'tablero', nombre: 'tablero 1.22 x 2.44', medida: 2.9768, largoMM: 2440, anchoMM: 1220 };
const F58 = { tipo: 'tablero', nombre: 'tablero 1.52 x 2.44', medida: 3.721, largoMM: 2440, anchoMM: 1525 };
const L310 = { tipo: 'lamina', nombre: 'lamina 3 x 10 ft', medida: 41.5, largoMM: 3048, anchoMM: 914 };
const ins = (id, formato, precio, extra = {}) => ({ id, nombre: id, unidad: 'hoja', precio, formato, fraccion: true, mermaCorte: 6, ...extra });
const costoMaterial = (insumo, comps) => {
  const r = calcular({ nombre: 'x', componentes: comps.map((c) => ({ nombre: 'pieza', insumoId: insumo.id, cantidad: 1, ...c })) }, 1, { [insumo.id]: insumo }, PARAMETROS_DEFAULT);
  return (r.detalleInsumos || []).find((d) => d.insumoId === insumo.id);
};

describe('rejilla por formato del insumo', () => {
  it('4×8: idéntico a la rejilla global (ningún curado de tablero cambia)', () => {
    for (const [l, a] of [[650, 450], [1800, 450], [630, 580], [1200, 600], [590, 430]]) {
      expect(piezasPorTablero(l, a, parametrosDeFormato(PARAMETROS_DEFAULT, ins('m', F48, 1)))).toBe(piezasPorTablero(l, a, PARAMETROS_DEFAULT));
    }
    // y sin medidas en el formato (láminas 4×8 en kg) se usan las globales
    expect(parametrosDeFormato(PARAMETROS_DEFAULT, ins('l', { tipo: 'lamina', medida: 28.4 }, 1))).toBe(PARAMETROS_DEFAULT);
  });
  it('5×8: una pieza de 1100×700 rinde 4 por hoja (como 4×8 rendía 3)', () => {
    const p58 = parametrosDeFormato(PARAMETROS_DEFAULT, ins('m58', F58, 645.37));
    expect(p58.tableroAnchoMM).toBe(1525);
    expect(piezasPorTablero(1100, 700, PARAMETROS_DEFAULT)).toBe(3);   // 4×8 útil 1200×2420: 1 × 3
    expect(piezasPorTablero(1100, 700, p58)).toBe(4);                  // 5×8 útil 1505×2420: 2 × 2
    // una pieza de 1500×700 "no cabía" en 4×8 (1200 útil) y en 5×8 sí
    expect(piezasPorTablero(1500, 1300, PARAMETROS_DEFAULT)).toBe(0);
    expect(piezasPorTablero(1500, 1300, p58)).toBe(1);
  });
  it('lámina 3×10: una tira de 3000×400 cabe (antes "no cabe" y caía al aprovechamiento genérico)', () => {
    const p310 = parametrosDeFormato(PARAMETROS_DEFAULT, ins('l310', L310, 900));
    expect(piezasPorTablero(3000, 400, PARAMETROS_DEFAULT)).toBe(0);
    expect(piezasPorTablero(3000, 400, p310)).toBe(2);
  });
  it('costo con el motor completo: 4 piezas 1100×700 → 4×8 = 4/3 hoja; 5×8 = 1 hoja', () => {
    const c48 = costoMaterial(ins('m48', F48, 306), [{ largoMM: 1100, anchoMM: 700, piezas: 4 }]);
    const c58 = costoMaterial(ins('m58', F58, 306), [{ largoMM: 1100, anchoMM: 700, piezas: 4 }]);
    expect(c48.unidades).toBeCloseTo(4 / 3, 9);
    expect(c48.costo).toBeCloseTo(408, 6);
    expect(c58.unidades).toBeCloseTo(1, 9);
    expect(c58.costo).toBeCloseTo(306, 6);
  });
  it('sugerenciaMedida usa el mismo formato', () => {
    const r = sugerenciaMedida(1100, 700, ins('m58', F58, 1), {});
    expect(r.actual).toBe(4);
  });
});
