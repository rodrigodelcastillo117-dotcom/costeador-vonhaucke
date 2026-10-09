import { describe, it, expect } from 'vitest';
import { limpiarSensibles } from '../App.jsx';

// ============================================================================
//  P0-B (ChatGPT audit) · SELLER-SAFE del ESTADO COMPLETO.
//
//  ANTES: limpiarSensibles saneaba insumos/parametros/finanzas, pero dejaba
//  intactos estado.piezas[*].costoUnitario y estado.cotizacion.partidas[*].
//  {costoUnitario,margen,costoDerivado,…}. Un vendedor que entraba tras
//  Dirección en la MISMA pestaña conservaba costo/margen en memoria y —vía el
//  autosave local— en localStorage. Aquí se verifica que NINGÚN campo económico
//  interno sobrevive en NINGÚN nivel del estado saneado. El precio de VENTA sí.
// ============================================================================
const ESTADO_DIRECCION = {
  insumos: {
    tablero: { nombre: 'Melamina', precio: 544, precioBase: 500, proveedor: 'EcoLegno', unidad: 'hoja' },
  },
  parametros: { ivaPorcentaje: 16, margenObjetivo: 0.35 },
  finanzas: { utilidad: 123456 },
  piezas: {
    'pieza-1': {
      id: 'pieza-1', nombre: 'Escritorio', precioUnitario: 8900,
      costoUnitario: 5210, margen: 0.41, costoDerivado: true, costoPendiente: false,
      componentes: [{ insumoId: 'tablero', costo: 544, precioProveedor: 544, cantidad: 2 }],
    },
  },
  cotizacion: {
    cliente: 'ACME', folio: 'VH-001',
    partidas: [
      {
        id: 'part-1', nombre: 'Escritorio ejecutivo', cantidad: 3,
        precioUnitario: 8900,                 // VENTA → el vendedor SÍ lo ve
        costoUnitario: 5210, margen: 0.41, costoDerivado: true, costoImplicito: 5000,
        partes: [{ nombre: 'cubierta', costo: 544, proveedor: 'EcoLegno' }],
      },
    ],
  },
};

// Recoge, en todo el árbol, el valor de cualquier clave económica interna.
const CLAVES = ['costoUnitario', 'costo', 'margen', 'costoDerivado', 'costoPendiente', 'costoImplicito', 'precioCompra', 'precioProveedor', 'proveedor'];
function fugas(obj, ruta = '$') {
  const out = [];
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    if (CLAVES.includes(k) && v != null && v !== false && !(typeof v === 'object')) out.push(`${ruta}.${k}=${v}`);
    if (v && typeof v === 'object') out.push(...fugas(v, `${ruta}.${k}`));
  }
  return out;
}

describe('seller-safe · limpiarSensibles sanea el ESTADO COMPLETO (P0-B)', () => {
  const limpio = limpiarSensibles(ESTADO_DIRECCION);

  it('REGRESIÓN NÚCLEO: ningún costo/margen/proveedor interno sobrevive en NINGÚN nivel', () => {
    expect(fugas(limpio)).toEqual([]);
  });

  it('piezas: costoUnitario/margen/costoDerivado eliminados; nombre conservado', () => {
    const pz = limpio.piezas['pieza-1'];
    expect(pz.costoUnitario).toBeUndefined();
    expect(pz.margen).toBeUndefined();
    expect(pz.costoDerivado).toBeUndefined();
    expect(pz.nombre).toBe('Escritorio');
  });

  it('partidas: costo/margen interno fuera; PRECIO DE VENTA conservado (el vendedor sí lo ve)', () => {
    const p = limpio.cotizacion.partidas[0];
    expect(p.costoUnitario).toBeUndefined();
    expect(p.margen).toBeUndefined();
    expect(p.costoImplicito).toBeUndefined();
    expect(p.precioUnitario).toBe(8900);        // venta: NO se toca
    expect(p.nombre).toBe('Escritorio ejecutivo');
    expect(p.cantidad).toBe(3);
  });

  it('insumos: precio/precioBase/proveedor fuera; finanzas nulas', () => {
    expect(limpio.insumos.tablero.precio).toBeUndefined();
    expect(limpio.insumos.tablero.proveedor).toBeUndefined();
    expect(limpio.insumos.tablero.unidad).toBe('hoja');   // no-económico se conserva
    expect(limpio.finanzas).toBeNull();
  });

  it('estructura preservada: cliente/folio de la cotización siguen ahí', () => {
    expect(limpio.cotizacion.cliente).toBe('ACME');
    expect(limpio.cotizacion.folio).toBe('VH-001');
  });
});
