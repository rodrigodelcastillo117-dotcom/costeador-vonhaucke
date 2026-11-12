import { describe, it, expect } from 'vitest';
import { registrosErpDesdeOrdenesCompra, fechaISOorden } from './erpOrdenesCompra.js';

// Encabezados reales del reporte "Órdenes de Compra" de Intelisis (verificado contra el
// archivo de noviembre 2026). El costo que importa es "Costo Unitario" (SIN IVA):
// Sub Total = Cantidad × Costo Unitario, y el IVA va en "Impuestos (MN)".
const HEADER = ['Movimiento', 'Proveedor', 'Nombre', 'Fecha Emisión', 'Articulo', 'Descripción',
  'Opción', 'DescOpcion', 'Cantidad', 'Unidad', 'Costo Unitario', 'Descuentos (MN)',
  'Sub Total (MN)', 'Impuestos (MN)', 'Importe Total (MN)', 'Detalles_del_Material', 'Estatus'];

function hojaOC(rows) { return [{ nombre: 'Hoja1', filas: [HEADER, ...rows] }]; }

describe('registrosErpDesdeOrdenesCompra — lee la orden de compra como última compra', () => {
  it('toma Costo Unitario (sin IVA), NUNCA Sub Total ni Importe Total', () => {
    const r = registrosErpDesdeOrdenesCompra(hojaOC([
      ['OC 3', 'PR03', 'Prov C', '2026-11-05 00:00:00', 'MDACBI03000003', 'BISAGRA PUERTA', '', '', '8', 'pieza', '275.4', '0', '2203.2', '352.5', '2555.7', 'proj', 'PENDIENTE'],
    ]));
    expect(r.esOrdenesCompra).toBe(true);
    expect(r.registros).toHaveLength(1);
    expect(r.registros[0].costo_uc).toBe(275.4);        // unitario, no 2203.2 (subtotal) ni 2555.7 (con IVA)
    expect(r.registros[0].unidad).toBe('pieza');
    expect(r.registros[0].estatus).toBe('ALTA');        // comprado = activo (NO el 'PENDIENTE' de la orden)
    expect(r.registros[0].fecha_uc).toBe('2026-11-05');
  });

  it('un artículo en varias órdenes → se queda con la FECHA MÁS RECIENTE (última compra)', () => {
    const r = registrosErpDesdeOrdenesCompra(hojaOC([
      ['OC 1', 'PR01', 'Prov A', '2026-11-04 00:00:00', 'MVLCRI01', 'CRISTAL X', '', '', '4', 'pieza', '100', '0', '400', '64', '464', 'proj', 'CONCLUIDO'],
      ['OC 2', 'PR02', 'Prov B', '2026-11-10 00:00:00', 'MVLCRI01', 'CRISTAL X', '', '', '2', 'pieza', '120', '0', '240', '38.4', '278.4', 'proj', 'PENDIENTE'],
      ['OC 3', 'PR03', 'Prov C', '2026-11-05 00:00:00', 'MVLCRI01', 'CRISTAL X', '', '', '1', 'pieza', '110', '0', '110', '17.6', '127.6', 'proj', 'PENDIENTE'],
    ]));
    expect(r.registros).toHaveLength(1);
    expect(r.registros[0].costo_uc).toBe(120);          // la del 10-nov, la más reciente
    expect(r.registros[0].fecha_uc).toBe('2026-11-10');
    expect(r.resumen.colapsadas).toBe(2);
  });

  it('distingue por Opción (mismo artículo, distinta opción = dos insumos)', () => {
    const r = registrosErpDesdeOrdenesCompra(hojaOC([
      ['OC 1', 'PR01', 'A', '2026-11-05 00:00:00', 'MCMXSA', 'SILLA', 'J3508', 'ASIENTO NEGRO', '20', 'pieza', '1447.7', '0', '28954', '4632', '33586', 'proj', 'PENDIENTE'],
      ['OC 2', 'PR01', 'A', '2026-11-05 00:00:00', 'MCMXSA', 'SILLA', 'J3509', 'ASIENTO AZUL', '5', 'pieza', '1500', '0', '7500', '1200', '8700', 'proj', 'PENDIENTE'],
    ]));
    expect(r.registros).toHaveLength(2);
    expect(r.registros.find((x) => x.opcion === 'J3508').costo_uc).toBe(1447.7);
    expect(r.registros.find((x) => x.opcion === 'J3509').costo_uc).toBe(1500);
  });

  it('ignora filas sin artículo; cuenta sin costo', () => {
    const r = registrosErpDesdeOrdenesCompra(hojaOC([
      ['OC 1', 'PR01', 'A', '2026-11-05 00:00:00', '', 'FILA BASURA', '', '', '', '', '', '', '', '', '', '', ''],
      ['OC 2', 'PR02', 'B', '2026-11-05 00:00:00', 'MVLX', 'SIN COSTO', '', '', '1', 'pieza', '', '', '', '', '', 'proj', 'PENDIENTE'],
    ]));
    expect(r.registros).toHaveLength(1);                 // la basura sin artículo se cae
    expect(r.registros[0].costo_uc).toBeNull();
    expect(r.resumen.sinCosto).toBe(1);
  });

  it('un archivo que NO es orden de compra → esOrdenesCompra:false, sin registros', () => {
    const r = registrosErpDesdeOrdenesCompra([{ nombre: 'Hoja1', filas: [['Articulo', 'Costo Última Compra'], ['MVLX', '10']] }]);
    expect(r.esOrdenesCompra).toBe(false);
    expect(r.registros).toHaveLength(0);
    expect(r.resumen.error).toBe('NO_OC_TABLE');
  });

  it('fechaISOorden normaliza Date, datetime string e ISO', () => {
    expect(fechaISOorden(new Date('2026-11-05T00:00:00Z'))).toBe('2026-11-05');
    expect(fechaISOorden('2026-11-05 00:00:00')).toBe('2026-11-05');
    expect(fechaISOorden('2026-11-05')).toBe('2026-11-05');
    expect(fechaISOorden('')).toBe('');
    expect(fechaISOorden(null)).toBe('');
  });
});
