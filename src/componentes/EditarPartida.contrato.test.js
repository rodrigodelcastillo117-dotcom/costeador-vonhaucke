// VH-045: lo que sale del diálogo de edición pasa por el contrato de partida.
import { describe, it, expect } from 'vitest';
import { partidaEditada } from './EditarPartida.jsx';
import { validarPartida } from '../datos/partida.js';

const original = {
  id: 'p_1', origen: 'linea', ruta: 'ejecutiva', productoId: 'EJ-150', deLinea: true,
  producto_id: 44, producto_version_id: 9, lista_precio_item_id: 7, source_type: 'producto_maestro',
  nombre: 'Escritorio 1.50', cantidad: 2, precioUnitario: 12000, precioReal: true,
  render: 'https://x.supabase.co/storage/v1/object/public/renders/partidas/p_1/1.png',
  nota: 'sugerido por IA', confianza: 0.7,
};
const nuevo = {
  nombre: 'Escritorio 1.80', config: { ancho: 180 }, costoUnitario: 7000, precioUnitario: 14000, margen: 50,
  w: 180, d: 70, precioReal: false, catalogo: null, variantes: null,
  piezasSinMaterial: 0, nombresSinMaterial: [], estadoCosto: 'completo',
};

describe('partidaEditada → crearPartida', () => {
  it('Dirección: conserva economía, identidad de Producto Maestro y render URL; limpia nota/confianza de la IA', () => {
    const p = partidaEditada(original, nuevo, 3, false);
    expect(p).toMatchObject({
      id: 'p_1', origen: 'linea', nombre: 'Escritorio 1.80', cantidad: 3, precioUnitario: 14000,
      costoUnitario: 7000, margen: 50, w: 180, d: 70, precioReal: false,
      producto_id: 44, producto_version_id: 9, lista_precio_item_id: 7, source_type: 'producto_maestro',
      productoId: 'EJ-150', render: original.render, nota: null, confianza: null, sellerSafe: false,
      config: { ancho: 180 },
    });
    expect(validarPartida(p)).toEqual([]);
  });

  it('Vendedor: sin costo ni margen (ni la clave), misma identidad, mismo precio', () => {
    const p = partidaEditada(original, nuevo, 3, true);
    expect(p).not.toHaveProperty('costoUnitario');
    expect(p).not.toHaveProperty('margen');
    expect(p.sellerSafe).toBe(true);
    expect(p).toMatchObject({ precioUnitario: 14000, producto_id: 44, producto_version_id: 9, cantidad: 3, nombre: 'Escritorio 1.80' });
    expect(validarPartida(p)).toEqual([]);
  });

  it('costeo incompleto: precio null se conserva como pendiente y la validación lo marca (fail-closed)', () => {
    const p = partidaEditada(original, { ...nuevo, precioUnitario: null, costoUnitario: null, piezasSinMaterial: 2, nombresSinMaterial: ['Cubierta', 'Faldón'], estadoCosto: 'incompleto' }, 1, false);
    expect(p.precioUnitario).toBeNull();
    expect(p.costoUnitario).toBeNull();
    expect(p.piezasSinMaterial).toBe(2);
    const campos = validarPartida(p).map((i) => i.campo);
    expect(campos).toContain('precioUnitario');
    expect(campos).toContain('piezasSinMaterial');
  });

  it('un render base64 heredado no sobrevive al guardar', () => {
    const p = partidaEditada({ ...original, render: 'data:image/png;base64,AAAA' }, nuevo, 1, true);
    expect(p.render).toBeNull();
  });
});
