// ============================================================================
//  DINERO FINITO (audit P1-08). Un resultado monetario NO FINITO (Infinity/NaN)
//  jamás debe salir del motor ni de la autoridad de totales: JSON.stringify lo
//  volvería `null` y podría pasar como "estado válido + precio null". Estas
//  pruebas fijan que todo precio/total es finito aun con input extremo o inválido.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { precioDe, precioVenta, utilidadDe } from './calculo.js';
import { totalesCotizacion } from '../datos/totales.js';

describe('precioDe nunca devuelve no-finito', () => {
  it('margen 100% → finito (acotado, no Infinity)', () => {
    const p = precioDe(1000, 100);
    expect(Number.isFinite(p)).toBe(true);
    expect(p).toBeGreaterThan(1000);
  });
  it('margen 150% → finito', () => {
    expect(Number.isFinite(precioDe(1000, 150))).toBe(true);
  });
  it('costo NaN → finito (0)', () => {
    expect(Number.isFinite(precioDe(NaN, 50))).toBe(true);
  });
  it('margen NaN → finito', () => {
    expect(Number.isFinite(precioDe(1000, NaN))).toBe(true);
  });
  it('margen 50% normal sigue correcto (2000)', () => {
    expect(precioDe(1000, 50)).toBeCloseTo(2000, 6);
  });
  it('utilidadDe tampoco es no-finito con margen 100%', () => {
    expect(Number.isFinite(utilidadDe(1000, 100))).toBe(true);
  });
});

describe('precioVenta nunca devuelve no-finito', () => {
  it('costo NaN (clasico) → precio finito', () => {
    const r = precioVenta(NaN, { modeloCosteo: 'clasico', margenObjetivo: 50 });
    expect(Number.isFinite(r.precio)).toBe(true);
    expect(Number.isFinite(r.lista)).toBe(true);
  });
  it('costo Infinity (intelisis) → precio finito', () => {
    const r = precioVenta(Infinity, { modeloCosteo: 'intelisis', utilidadPct: 20, factorPrecioLista: 3 });
    expect(Number.isFinite(r.precio)).toBe(true);
  });
});

describe('totalesCotizacion nunca produce total no-finito', () => {
  it('una partida con precio Infinity no rompe el total y se marca', () => {
    const partidas = [
      { precioUnitario: 1000, cantidad: 2 },      // 2000 válido
      { precioUnitario: Infinity, cantidad: 1 },  // inválida → cuenta 0
    ];
    const t = totalesCotizacion(partidas, {}, {});
    expect(Number.isFinite(t.total)).toBe(true);
    expect(Number.isFinite(t.totalRedondeado)).toBe(true);
    expect(t.hayLineaInvalida).toBe(true);
    // El lista sólo contó la partida válida (2000), no Infinity.
    expect(t.precioLista).toBe(2000);
  });
  it('partidas válidas → sin marca de línea inválida', () => {
    const t = totalesCotizacion([{ precioUnitario: 500, cantidad: 3 }], {}, {});
    expect(t.hayLineaInvalida).toBe(false);
    expect(t.precioLista).toBe(1500);
  });
});
