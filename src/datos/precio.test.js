import { describe, it, expect } from 'vitest';
import { precioDesdeCosto, margenObjetivoDe, MARGEN_OBJETIVO_DEFAULT } from './precio.js';
import { PARAMETROS_DEFAULT, precioVenta } from '../motor/calculo.js';
import { precioDeLista } from './preciosVenta.js';

describe('precioDesdeCosto · una sola regla costo → precio', () => {
  it('costo desconocido (null/NaN/∞) ⇒ null, nunca 0', () => {
    for (const c of [null, undefined, NaN, Infinity, -1]) expect(precioDesdeCosto(c)).toBeNull();
  });
  it('clásico: margen sobre precio; por omisión margenObjetivo y si no 50', () => {
    expect(precioDesdeCosto(1000, { margen: 50 })).toBeCloseTo(2000, 6);
    expect(precioDesdeCosto(1000, { par: { margenObjetivo: 40 } })).toBeCloseTo(1666.6667, 3);
    expect(precioDesdeCosto(1000, { par: {} })).toBeCloseTo(1000 / (1 - MARGEN_OBJETIVO_DEFAULT / 100), 6);
    expect(margenObjetivoDe({})).toBe(50);
    expect(margenObjetivoDe({ margenObjetivo: 35 })).toBe(35);
    expect(margenObjetivoDe({ margenObjetivo: 'x' })).toBe(50);
  });
  it('margen imposible (≥100 o <0) ⇒ null (fail-closed), no Infinity ni $0', () => {
    expect(precioDesdeCosto(1000, { margen: 100 })).toBeNull();
    expect(precioDesdeCosto(1000, { margen: -5 })).toBeNull();
  });
  it('Intelisis: mismo número que la cascada histórica (precio 2 − 40 %)', () => {
    const par = { ...PARAMETROS_DEFAULT, modeloCosteo: 'intelisis' };
    const esperado = precioDeLista(precioVenta(1000, par).lista);
    expect(precioDesdeCosto(1000, { par, esIntelisis: true })).toBeCloseTo(esperado, 6);
  });
  it('clásico: mismo número que precioVenta().precio (lo que usaba Cocrear)', () => {
    const par = { ...PARAMETROS_DEFAULT, margenObjetivo: 50 };
    expect(precioDesdeCosto(1234, { par })).toBeCloseTo(precioVenta(1234, par).precio, 6);
  });
});
