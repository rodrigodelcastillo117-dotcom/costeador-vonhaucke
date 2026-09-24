import { describe, it, expect } from 'vitest';
import { totalesCotizacion } from './totales.js';

// Dos renglones sencillos; los pct entran por `cot` o por `par`.
const partidas = [
  { precioUnitario: 17600, cantidad: 2 },  // 35,200
  { precioUnitario: 5210, cantidad: 12 },  // 62,520
];                                          // precioLista = 97,720

describe('totales · la única autoridad de dinero', () => {
  it('sin ajustes: total = suma + IVA, redondeado al peso', () => {
    const t = totalesCotizacion(partidas, {}, { ivaPorcentaje: 16 });
    expect(t.precioLista).toBe(97720);
    expect(t.descuento).toBe(0);
    expect(t.iva).toBeCloseTo(97720 * 0.16, 5);
    expect(t.totalRedondeado).toBe(97720 + Math.round(97720 * 0.16));
  });

  it('con descuento e IVA: el total baja por el descuento (no es la suma cruda)', () => {
    const t = totalesCotizacion(partidas, { descuentoPct: 15 }, { ivaPorcentaje: 16 });
    // 97,720 −15% = 83,062 · +16% IVA = 96,352
    expect(t.subtotal).toBe(83062);
    expect(t.totalRedondeado).toBe(96352);
    expect(t.totalRedondeado).toBeLessThan(t.precioLista);
  });

  it('INVARIANTE: el total es la suma de los MISMOS renglones redondeados', () => {
    const par = { ivaPorcentaje: 16 };
    const cot = { descuentoPct: 12, maniobrasPct: 3, fletePct: 10 };
    const t = totalesCotizacion(partidas, cot, par);
    const suma = Math.round(t.precioLista) - Math.round(t.descuento)
      + Math.round(t.contingencia) + Math.round(t.maniobras)
      + Math.round(t.flete) + Math.round(t.iva);
    expect(t.totalRedondeado).toBe(suma);
  });

  it('maniobras y flete van SOBRE el subtotal ya descontado, como en el papel', () => {
    const t = totalesCotizacion(partidas, { descuentoPct: 10, maniobrasPct: 3, fletePct: 10 }, {});
    expect(t.maniobras).toBeCloseTo(t.subtotal * 0.03, 5);
    expect(t.flete).toBeCloseTo(t.subtotal * 0.10, 5);
  });

  it('el pct de la cotización manda sobre el default de parámetros', () => {
    const t = totalesCotizacion(partidas, { descuentoPct: 20 }, { descuentoPorcentaje: 5, ivaPorcentaje: 16 });
    expect(t.descuentoPct).toBe(20);
  });

  it('el default de parámetros se usa cuando la cotización no trae pct', () => {
    const t = totalesCotizacion(partidas, {}, { maniobrasPorcentaje: 3, fletePorcentaje: 10, ivaPorcentaje: 16 });
    expect(t.maniobrasPct).toBe(3);
    expect(t.fletePct).toBe(10);
  });

  it('anticipo sale del total YA redondeado (anticipo + saldo = total impreso)', () => {
    const t = totalesCotizacion(partidas, { descuentoPct: 15 }, { ivaPorcentaje: 16, anticipoPorcentaje: 50 });
    const saldo = t.totalRedondeado - t.anticipo;
    expect(t.anticipo + saldo).toBe(t.totalRedondeado);
    expect(t.anticipo).toBe(Math.round(t.totalRedondeado * 0.5));
  });

  it('sin renglones no explota ni inventa dinero', () => {
    const t = totalesCotizacion([], {}, {});
    expect(t.precioLista).toBe(0);
    expect(t.totalRedondeado).toBe(0);
    expect(t.anticipo).toBe(0);
  });

  it('nunca produce NaN aunque falten precio o cantidad', () => {
    const t = totalesCotizacion([{ precioUnitario: 100 }, { cantidad: 3 }], {}, { ivaPorcentaje: 16 });
    expect(Number.isNaN(t.totalRedondeado)).toBe(false);
    expect(t.precioLista).toBe(0); // ambos renglones incompletos → 0
  });
});
