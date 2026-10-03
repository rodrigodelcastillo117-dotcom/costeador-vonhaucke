// ============================================================================
//  DINERO FAIL-CLOSED (revisión 2026-10-04, tras crítica externa).
//  Regla corregida: el motor NO "arregla" en silencio una configuración financiera
//  imposible. Un margen ≥100% / <0 / NaN o un costo no finito → **NaN (cálculo
//  inválido)**, que la UI y la emisión BLOQUEAN. Un precio válido es finito.
//  NUNCA se convierte un precio corrupto en un $0/número barato (eso sería fail-open).
// ============================================================================
import { describe, it, expect } from 'vitest';
import { precioDe, precioVenta, utilidadDe } from './calculo.js';
import { totalesCotizacion } from '../datos/totales.js';
import { problemasDeEmision } from '../datos/senales.js';

describe('precioDe — válido→finito, inválido→NaN (bloquea, no inventa número)', () => {
  it('margen 50% normal → 2000 (finito)', () => {
    expect(precioDe(1000, 50)).toBeCloseTo(2000, 6);
  });
  it('margen 100% → NaN (imposible, no Infinity ni número capado)', () => {
    expect(Number.isNaN(precioDe(1000, 100))).toBe(true);
  });
  it('margen 150% → NaN', () => {
    expect(Number.isNaN(precioDe(1000, 150))).toBe(true);
  });
  it('margen negativo → NaN', () => {
    expect(Number.isNaN(precioDe(1000, -10))).toBe(true);
  });
  it('margen NaN → NaN', () => {
    expect(Number.isNaN(precioDe(1000, NaN))).toBe(true);
  });
  it('costo no finito → NaN', () => {
    expect(Number.isNaN(precioDe(NaN, 50))).toBe(true);
    expect(Number.isNaN(precioDe(Infinity, 50))).toBe(true);
  });
  it('utilidadDe hereda la invalidez (NaN) con margen imposible', () => {
    expect(Number.isNaN(utilidadDe(1000, 100))).toBe(true);
  });
});

describe('precioVenta — costo no finito → precio inválido (NaN), no $0', () => {
  it('costo NaN (clásico) → NaN', () => {
    const r = precioVenta(NaN, { modeloCosteo: 'clasico', margenObjetivo: 50 });
    expect(Number.isNaN(r.precio)).toBe(true);
  });
  it('costo Infinity (intelisis) → NaN', () => {
    const r = precioVenta(Infinity, { modeloCosteo: 'intelisis', utilidadPct: 20, factorPrecioLista: 3 });
    expect(Number.isNaN(r.precio)).toBe(true);
  });
  it('costo válido → precio finito', () => {
    const r = precioVenta(1000, { modeloCosteo: 'clasico', margenObjetivo: 50 });
    expect(Number.isFinite(r.precio)).toBe(true);
  });
});

describe('totalesCotizacion — una línea inválida se MARCA (no se disfraza de total barato)', () => {
  it('línea con precio Infinity → hayLineaInvalida y no suma esa línea', () => {
    const t = totalesCotizacion([
      { precioUnitario: 1000, cantidad: 2 },
      { precioUnitario: Infinity, cantidad: 1 },
    ], {}, {});
    expect(t.hayLineaInvalida).toBe(true);
    expect(t.precioLista).toBe(2000);
  });
  it('línea con precio NaN → hayLineaInvalida', () => {
    const t = totalesCotizacion([{ precioUnitario: NaN, cantidad: 1 }], {}, {});
    expect(t.hayLineaInvalida).toBe(true);
  });
  it('partidas válidas → sin marca', () => {
    const t = totalesCotizacion([{ precioUnitario: 500, cantidad: 3 }], {}, {});
    expect(t.hayLineaInvalida).toBe(false);
    expect(t.precioLista).toBe(1500);
  });
});

describe('problemasDeEmision — un precio inválido BLOQUEA la emisión (fail-closed)', () => {
  it('precio NaN → bloqueado', () => {
    expect(problemasDeEmision([{ nombre: 'X', cantidad: 1, precioUnitario: NaN }]).length).toBeGreaterThan(0);
  });
  it('precio Infinity → bloqueado', () => {
    expect(problemasDeEmision([{ nombre: 'X', cantidad: 1, precioUnitario: Infinity }]).length).toBeGreaterThan(0);
  });
  it('precio y cantidad válidos → sin problema', () => {
    expect(problemasDeEmision([{ nombre: 'X', cantidad: 2, precioUnitario: 1000 }]).length).toBe(0);
  });
});
