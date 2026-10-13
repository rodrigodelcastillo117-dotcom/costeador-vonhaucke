// COCREAR 10 · precio sugerido de un mueble co-creado: margen de política con piso de 25 %.
import { describe, it, expect } from 'vitest';
import { precioSugeridoCocreado, pisoMargenDe, PISO_MARGEN_DEFAULT } from './precio.js';
import { PARAMETROS_DEFAULT } from '../motor/calculo.js';

describe('precioSugeridoCocreado', () => {
  it('usa el margen de política sobre precio (50 % por omisión): 1,000 → 2,000', () => {
    const r = precioSugeridoCocreado(1000, { par: PARAMETROS_DEFAULT });
    expect(r.margen).toBe(50);
    expect(r.precio).toBeCloseTo(2000, 6);
    expect(r.motivo).toBeNull();
  });

  it('nunca baja del piso de margen de 25 %', () => {
    const r = precioSugeridoCocreado(1000, { par: { margenObjetivo: 10 } });
    expect(r.piso).toBe(PISO_MARGEN_DEFAULT);
    expect(r.margen).toBe(25);
    expect(r.precio).toBeCloseTo(1000 / 0.75, 6);
    expect(r.motivo).toMatch(/piso/);
  });

  it('respeta un piso configurado por Dirección (margenMinimo)', () => {
    expect(pisoMargenDe({ margenMinimo: 30 })).toBe(30);
    expect(precioSugeridoCocreado(700, { par: { margenObjetivo: 20, margenMinimo: 30 } }).margen).toBe(30);
  });

  it('costo incompleto ⇒ precio null ("Por confirmar"), nunca $0', () => {
    for (const c of [null, undefined, NaN, Infinity, 0, -5]) {
      const r = precioSugeridoCocreado(c, { par: PARAMETROS_DEFAULT });
      expect(r.precio).toBeNull();
      expect(r.motivo).toMatch(/Por confirmar/);
    }
  });

  it('un margen de política imposible (≥ 100 %) no inventa precio', () => {
    expect(precioSugeridoCocreado(1000, { par: { margenObjetivo: 100 } }).precio).toBeNull();
  });
});
