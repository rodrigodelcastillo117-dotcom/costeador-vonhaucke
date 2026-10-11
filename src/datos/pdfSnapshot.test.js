// ============================================================================
//  VH-042 (2026-10-11) · EL PDF SALE DEL SNAPSHOT CONSERVADO.
//  Mandato §4: "El PDF debe reflejar la misma revisión guardada y los mismos
//  totales aprobados". Y el servidor (emitir_revision_v2) exige:
//    total == precioLista − descuento + contingencia + maniobras + flete + iva   (exacto)
//    round(precioLista, 2) == Σ round(precioUnitario × cantidad, 2)
//  Estas pruebas espejan esas dos reglas en el cliente: un snapshot que las rompa
//  nunca debió salir de aquí.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { snapshotEmitido } from './revisiones.js';
import { totalesCotizacion } from './totales.js';
import { datosDesdeSnapshot } from './pdfPropuesta.js';
import { esClientSafe } from './economia.js';

const r2 = (x) => Math.round(x * 100) / 100;
const reglaServidor = (snap) => {
  const t = snap.totales;
  const suma = t.precioLista - t.descuento + t.contingencia + t.maniobras + t.flete + t.iva;
  const pl = (snap.partidas || []).reduce((a, p) => a + r2(p.precioUnitario * p.cantidad), 0);
  return { totalCuadra: snap.total === suma, precioListaCuadra: r2(t.precioLista) === r2(pl) };
};

const estadoDe = (partidas, cot = {}) => ({
  insumos: { a: { id: 'a', precio: 1 } },
  parametros: { ivaPorcentaje: 16, anticipoPorcentaje: 50 },
  cotizacion: { cliente: 'Tradeco', folio: 'T-7', fecha: '11 de octubre de 2026', partidas, descuentoPct: 15, ...cot },
});

describe('VH-042 · PDF = snapshot = totales aprobados', () => {
  const partidas = [
    { id: 'p1', nombre: 'Banca', cantidad: 2, precioUnitario: 17600, costoUnitario: 8000, margen: 50 },
    { id: 'p2', nombre: 'Silla', cantidad: 12, precioUnitario: 5210, costoUnitario: 2000, margen: 40 },
  ];
  const estado = estadoDe(partidas);

  it('el snapshot trae la MISMA escalera que la pantalla (totales.js), con anticipo y fecha', () => {
    const snap = snapshotEmitido(estado);
    const t = totalesCotizacion(partidas, estado.cotizacion, estado.parametros);
    expect(snap.total).toBe(t.totalRedondeado);
    expect(snap.totales.total).toBe(t.totalRedondeado);
    expect(snap.totales.anticipo).toBe(t.anticipo);
    expect(snap.totales.anticipoPct).toBe(50);
    expect(snap.fecha).toBe('11 de octubre de 2026');
  });

  it('los datos del PDF salen del snapshot, client-safe, con los mismos totales', () => {
    const snap = snapshotEmitido(estado);
    const d = datosDesdeSnapshot(snap, { fecha: estado.cotizacion.fecha, exclusionesBOM: ['Luz LED'] });
    expect(d.cot.cliente).toBe('Tradeco');
    expect(d.cot.folio).toBe('T-7');
    expect(d.totales.total).toBe(snap.total);
    expect(d.totales.anticipo).toBe(snap.totales.anticipo);
    expect(d.nPzas).toBe(14);
    expect(d.exclusionesBOM).toEqual(['Luz LED']);
    expect(esClientSafe(d.partidas)).toBe(true);
    expect(d.partidas[0]).not.toHaveProperty('costoUnitario');
  });

  it('cumple las dos reglas exactas del servidor con precios en pesos', () => {
    const snap = snapshotEmitido(estado);
    expect(reglaServidor(snap)).toEqual({ totalCuadra: true, precioListaCuadra: true });
  });

  it('cumple las dos reglas exactas del servidor también con precios con CENTAVOS', () => {
    const conCentavos = [{ id: 'p1', nombre: 'Especial', cantidad: 3, precioUnitario: 2469.12 }];
    const snap = snapshotEmitido(estadoDe(conCentavos, { descuentoPct: 0 }));
    expect(reglaServidor(snap)).toEqual({ totalCuadra: true, precioListaCuadra: true });
  });
});
