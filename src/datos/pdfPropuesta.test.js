// N15 — garantías del PDF de propuesta: client-safe y snapshot inmutable.
import { describe, it, expect } from 'vitest';
import { partidasClientSafePDF, datosDesdeSnapshot } from './pdfPropuesta.js';
import { esClientSafe } from './economia.js';

describe('pdfPropuesta client-safe', () => {
  it('partidasClientSafePDF quita TODA clave económica interna', () => {
    const sucias = [{
      nombre: 'Escritorio', cantidad: 2, precioUnitario: 5000, importe: 10000,
      costoUnitario: 2200, margen: 0.56, costoDerivado: 2100,
      pieza: { factores: { directa: 1.2 }, horas: 3 }, proveedor: 'ACME',
      insumos: [{ nombre: 'MDF', precioBase: 120 }],
    }];
    const limpias = partidasClientSafePDF(sucias);
    expect(esClientSafe(limpias)).toBe(true);
    // conserva lo que el cliente SÍ ve
    expect(limpias[0].nombre).toBe('Escritorio');
    expect(limpias[0].cantidad).toBe(2);
    expect(limpias[0].precioUnitario).toBe(5000);
  });

  it('no rompe partidas ya limpias', () => {
    const ok = [{ nombre: 'Silla WIN', cantidad: 4, precioUnitario: 1800 }];
    expect(esClientSafe(partidasClientSafePDF(ok))).toBe(true);
  });

  it('datosDesdeSnapshot arma datos client-safe desde snapshot inmutable', () => {
    const snap = {
      folio: 'COT-2026-001', cliente: 'ACME',
      partidas: [{ nombre: 'Banca', cantidad: 1, precioUnitario: 9000, costoUnitario: 4000, margen: 0.55 }],
      totales: { precioLista: 9000, descuento: 0, subtotal: 9000, iva: 1440, ivaPct: 16, total: 10440 },
      piezas: 1,
      acomodo: { plan: true },
    };
    const datos = datosDesdeSnapshot(snap, { fecha: '2026-10-02' });
    expect(datos.cot.folio).toBe('COT-2026-001');
    expect(datos.cot.cliente).toBe('ACME');
    expect(datos.cot.fecha).toBe('2026-10-02');
    expect(datos.totales.total).toBe(10440); // dinero intacto
    expect(datos.nPzas).toBe(1);
    expect(esClientSafe(datos.partidas)).toBe(true); // sin economía
    expect(datos.partidas[0].precioUnitario).toBe(9000); // precio de venta conservado
  });

  it('datosDesdeSnapshot calcula nPzas si falta', () => {
    const datos = datosDesdeSnapshot({ partidas: [{ cantidad: 3 }, { cantidad: 2 }] });
    expect(datos.nPzas).toBe(5);
  });

  it('datosDesdeSnapshot tolera snapshot vacío sin truenar', () => {
    const datos = datosDesdeSnapshot(null);
    expect(datos.partidas).toEqual([]);
    expect(datos.totales).toEqual({});
    expect(datos.cot.folio).toBe('');
  });
});
