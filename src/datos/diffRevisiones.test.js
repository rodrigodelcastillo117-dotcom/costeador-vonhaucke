import { describe, it, expect } from 'vitest';
import { diffRevisiones } from './diffRevisiones.js';

// N16: Rev1 (80 sillas) -> Rev2 (60 sillas) debe dar -20 sillas y el delta de dinero exacto.
describe('diffRevisiones (N16)', () => {
  const rev1 = {
    partidas: [
      { source_ref: 'silla-x', nombre: 'Silla', cantidad: 80, precioUnitario: 4210 },
      { source_ref: 'mesa-y', nombre: 'Mesa', cantidad: 2, precioUnitario: 27346 },
    ],
    totales: { precioLista: 391412, descuento: 0, maniobras: 0, flete: 10000, iva: 64226 },
    total: 465638,
  };
  const rev2 = {
    partidas: [
      { source_ref: 'silla-x', nombre: 'Silla', cantidad: 60, precioUnitario: 4210 },
      { source_ref: 'mesa-y', nombre: 'Mesa', cantidad: 2, precioUnitario: 27346 },
      { source_ref: 'credenza-z', nombre: 'Credenza', cantidad: 1, precioUnitario: 15000 },
    ],
    totales: { precioLista: 322212, descuento: 0, maniobras: 0, flete: 5500, iva: 52434 },
    total: 380146,
  };

  it('detecta la silla cambiada: -20 unidades y -$84,200', () => {
    const d = diffRevisiones(rev1, rev2);
    const silla = d.lineas.find((l) => l.nombre === 'Silla');
    expect(silla.tipo).toBe('cambiada');
    expect(silla.deltaCantidad).toBe(-20);
    expect(silla.deltaImporte).toBe(-20 * 4210); // -84,200
  });

  it('detecta la credenza agregada y la mesa sin cambios', () => {
    const d = diffRevisiones(rev1, rev2);
    expect(d.lineas.find((l) => l.nombre === 'Credenza').tipo).toBe('agregada');
    expect(d.lineas.find((l) => l.nombre === 'Mesa')).toBeUndefined(); // sin cambio => no aparece
    expect(d.resumen).toEqual({ lineasAgregadas: 1, lineasQuitadas: 0, lineasCambiadas: 1 });
  });

  it('deltas de dinero exactos (flete, iva, total)', () => {
    const d = diffRevisiones(rev1, rev2);
    expect(d.deltas.flete).toBe(-4500);
    expect(d.deltas.iva).toBe(52434 - 64226);
    expect(d.deltas.total).toBe(380146 - 465638); // -85,492
  });

  it('quitar una partida se refleja como quitada con delta negativo', () => {
    const d = diffRevisiones(rev1, { partidas: [rev1.partidas[1]], totales: {}, total: 0 });
    const silla = d.lineas.find((l) => l.nombre === 'Silla');
    expect(silla.tipo).toBe('quitada');
    expect(silla.deltaImporte).toBe(-80 * 4210);
  });
});
