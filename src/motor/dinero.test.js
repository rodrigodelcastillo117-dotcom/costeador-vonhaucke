import { describe, it, expect } from 'vitest';
import { aCentavosEnteros, deCentavosEnteros, dinero, sumarDinero, aplicarPct, porcentajeCentavos } from './dinero.js';

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


describe('porcentajes sobre centavos enteros', () => {
  it('12.5% de $100.01 queda reproducible al centavo', () => {
    expect(porcentajeCentavos(10001, 12.5)).toBe(1250);
  });

  it('IVA 16% sobre $83,062.00 produce exactamente $13,289.92', () => {
    expect(porcentajeCentavos(8306200, 16)).toBe(1328992);
  });

  it('rechaza bases fuera de enteros seguros', () => {
    expect(porcentajeCentavos(Number.MAX_SAFE_INTEGER + 1, 16)).toBeNull();
  });
});


describe('UNKNOWN no es ZERO en dinero canónico', () => {
  it('null/undefined/vacío no se convierten en 0 centavos', () => {
    expect(aCentavosEnteros(null)).toBeNull();
    expect(aCentavosEnteros(undefined)).toBeNull();
    expect(aCentavosEnteros('')).toBeNull();
    expect(Number.isNaN(dinero(null))).toBe(true);
  });

  it('porcentajes desconocidos fallan cerrado', () => {
    expect(Number.isNaN(aplicarPct(null, 16))).toBe(true);
    expect(Number.isNaN(aplicarPct(100, null))).toBe(true);
    expect(porcentajeCentavos(10000, null)).toBeNull();
  });
});
