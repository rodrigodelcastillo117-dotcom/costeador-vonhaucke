import { describe, it, expect } from 'vitest';
import { aCentavosEnteros, deCentavosEnteros, dinero, sumarDinero, aplicarPct } from './dinero.js';

describe('dinero canónico · pennies and cents', () => {
  it('cuantiza a centavos de forma estable', () => {
    expect(aCentavosEnteros(1.005)).toBe(101);
    expect(dinero(1.005)).toBe(1.01);
    expect(deCentavosEnteros(1874900)).toBe(18749);
  });

  it('suma en enteros de centavo, no floats acumulativos', () => {
    expect(sumarDinero([0.1, 0.2])).toBe(0.3);
    expect(sumarDinero([10.015, 20.015])).toBe(30.04);
  });

  it('porcentajes cruzan frontera monetaria a dos decimales', () => {
    expect(aplicarPct(99.99, 16)).toBe(16);
  });

  it('falla cerrado con dinero no finito', () => {
    expect(Number.isNaN(dinero(NaN))).toBe(true);
    expect(Number.isNaN(sumarDinero([10, Infinity]))).toBe(true);
  });
});
