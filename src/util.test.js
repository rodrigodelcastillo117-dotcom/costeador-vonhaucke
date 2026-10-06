import { describe, it, expect } from 'vitest';
import { claseCosto, pesos, pesos2, pct, pct1 } from './util.js';

describe('claseCosto · de dónde salió el costo de una partida', () => {
  it('costo real del despiece → "real", se muestra tal cual', () => {
    const cc = claseCosto({ costoUnitario: 5000, margen: 30, precioUnitario: 8000 });
    expect(cc).toEqual({ clase: 'real', sinCosto: false, aprox: false });
  });

  it('pieza de banco (precio real, costo desconocido) → "desconocido"', () => {
    const cc = claseCosto({ deBanco: true, costoUnitario: 0, precioUnitario: 17600 });
    expect(cc.clase).toBe('desconocido');
    expect(cc.sinCosto).toBe(true);
  });

  it('costo derivado del precio (proxy) → "derivado", se muestra con ≈', () => {
    const cc = claseCosto({ costoUnitario: 4888, costoDerivado: true, margen: 45, precioUnitario: 17600 });
    expect(cc.clase).toBe('derivado');
    expect(cc.aprox).toBe(true);
    expect(cc.sinCosto).toBe(false);
  });

  it('costo 0 no es margen del 100%: cuenta como desconocido', () => {
    expect(claseCosto({ costoUnitario: 0, margen: null, precioUnitario: 100 }).clase).toBe('desconocido');
  });

  it('sin margen calculado → desconocido (no se inventa)', () => {
    expect(claseCosto({ costoUnitario: 500, margen: null, precioUnitario: 900 }).sinCosto).toBe(true);
  });

  it('partida nula no explota', () => {
    expect(claseCosto(null).clase).toBe('desconocido');
  });
});


describe('formato visual · UNKNOWN no es ZERO', () => {
  it('dinero desconocido se muestra como guion', () => {
    for (const v of [null, undefined, '', NaN, Infinity]) {
      expect(pesos(v)).toBe('—');
      expect(pesos2(v)).toBe('—');
    }
    expect(pesos2(0)).toBe('$0.00');
  });

  it('porcentaje desconocido se muestra como guion', () => {
    expect(pct(null)).toBe('—');
    expect(pct1(undefined)).toBe('—');
    expect(pct(0)).toBe('0%');
    expect(pct1(0)).toBe('0.0%');
  });
});
