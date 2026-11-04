import { describe, it, expect } from 'vitest';
import { desgloseRealidad, realidadPieza } from './desgloseRealidad.js';
import { MATCH } from './materialMatch.js';

// insumos: real certificado, real viejo (certificable false), y uno sin precio.
const INS = {
  'mdf-cert': { id: 'mdf-cert', precio: 100, evidencia: { certificable: true, estado: 'aprobado' } },
  'mdf-viejo': { id: 'mdf-viejo', precio: 90, evidencia: { certificable: false, estado: 'aprobado' } },
  'herr': { id: 'herr', precio: 20, evidencia: { certificable: true } },
  'sinprecio': { id: 'sinprecio', precio: null },
};
const montoDe = (c, ins) => Number(c.cantidad || 1) * Number(ins.precio || 0);

describe('realidadPieza', () => {
  it('confirmado + certificable → real', () => {
    expect(realidadPieza({ insumoId: 'mdf-cert', material_confirmado: true }, INS).clase).toBe('real');
  });
  it('autollenado sin confirmar → por_confirmar', () => {
    expect(realidadPieza({ insumoId: 'mdf-cert', _match: { autollenado: true } }, INS).clase).toBe('por_confirmar');
  });
  it('propuesta compatible (memoria/amarre) sin confirmar → por_confirmar', () => {
    expect(realidadPieza({ insumoId: 'herr', _match: { clase: MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED } }, INS).clase).toBe('por_confirmar');
  });
  it('material confirmado pero precio no certificado → precio_viejo', () => {
    expect(realidadPieza({ insumoId: 'mdf-viejo', material_confirmado: true }, INS).clase).toBe('precio_viejo');
  });
  it('pieza inferida por IA sin confirmar → por_confirmar', () => {
    expect(realidadPieza({ insumoId: 'mdf-cert', material_confirmado: true, procedencia: 'INFERIDO' }, INS).clase).toBe('por_confirmar');
  });
  it('sin material con precio → pendiente', () => {
    expect(realidadPieza({ insumoId: 'sinprecio' }, INS).clase).toBe('pendiente');
    expect(realidadPieza({ insumoId: 'noexiste' }, INS).clase).toBe('pendiente');
  });
});

describe('desgloseRealidad', () => {
  it('parte el material en real vs supuesto y lista las piezas que arrastran', () => {
    const comps = [
      { nombre: 'Cubierta', insumoId: 'mdf-cert', material_confirmado: true, cantidad: 2 },      // real 200
      { nombre: 'Costado', insumoId: 'mdf-viejo', material_confirmado: true, cantidad: 1 },        // precio_viejo 90
      { nombre: 'Bisagra', insumoId: 'herr', _match: { autollenado: true }, cantidad: 3 },         // por_confirmar 60
      { nombre: 'Tapa', insumoId: 'sinprecio', cantidad: 1 },                                       // pendiente 0
      { nombre: 'Excluida', insumoId: 'mdf-cert', material_confirmado: true, cantidad: 9, excluida: true }, // ignorada
    ];
    const d = desgloseRealidad(comps, INS, montoDe);
    expect(d.realMonto).toBe(200);
    expect(d.supuestoMonto).toBe(150);          // 90 + 60
    expect(d.totalConocido).toBe(350);
    expect(d.pendientes).toBe(1);
    expect(d.piezasReales).toBe(1);
    expect(d.piezasSupuesto).toBe(2);
    expect(d.pctReal).toBe(57);                  // 200/350
    expect(d.haySupuesto).toBe(true);
    expect(d.hayPendiente).toBe(true);
    // los items supuesto/pendiente traen motivo; el real NO se lista
    const nombres = d.items.map((x) => x.nombre).sort();
    expect(nombres).toEqual(['Bisagra', 'Costado', 'Tapa']);
    expect(d.items.find((x) => x.nombre === 'Costado').clase).toBe('precio_viejo');
  });

  it('todo real → sin supuestos, 100%', () => {
    const comps = [{ nombre: 'A', insumoId: 'mdf-cert', material_confirmado: true, cantidad: 1 }];
    const d = desgloseRealidad(comps, INS, montoDe);
    expect(d.pctReal).toBe(100);
    expect(d.haySupuesto).toBe(false);
    expect(d.hayPendiente).toBe(false);
    expect(d.items).toHaveLength(0);
  });

  it('BOM vacío → cero sin romper', () => {
    const d = desgloseRealidad([], INS, montoDe);
    expect(d.totalConocido).toBe(0);
    expect(d.pctReal).toBe(null);
  });
});
