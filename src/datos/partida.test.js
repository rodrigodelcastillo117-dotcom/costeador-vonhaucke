import { describe, it, expect } from 'vitest';
import { crearPartida, validarPartida } from './partida.js';
import { escaneaEconomia, esClaveEconomiaServidor } from './economia.js';

describe('crearPartida · un solo contrato', () => {
  const ia = { nombre: 'Banca APP LT 6', cantidad: '2', precioUnitario: 48000, costoUnitario: 21000, margen: 30, costoDerivado: true,
    producto_id: 15, producto_version_id: 1933, lista_precio_item_id: 7, source_type: 'linea', source_ref: 'APL-120', precio_lista_snapshot: 48000,
    precioReal: true, catalogo: { clave: 'APL-120', lista: 48000, minimo: 40000, full: 80000 }, avisos: ['x'], sugerido: true };

  it('conserva la identidad de Producto Maestro que Voni perdía', () => {
    const p = crearPartida(ia, { veCostos: true, origen: 'ia' });
    expect(p).toMatchObject({ producto_id: 15, producto_version_id: 1933, lista_precio_item_id: 7, source_type: 'linea', source_ref: 'APL-120', precio_lista_snapshot: 48000, origen: 'ia' });
    expect(p.cantidad).toBe(2);
    expect(p.costoUnitario).toBe(21000);
    expect(p.margen).toBe(30);
    expect(p.costoDerivado).toBe(true);
    expect(p.catalogo.full).toBe(80000);
  });

  it('unifica las tres grafías de identidad y distingue clave de línea de Producto Maestro', () => {
    const a = crearPartida({ nombre: 'x', precioUnitario: 1, productVersionId: '1933', productoId: '15' }, { veCostos: true });
    expect(a.producto_id).toBe(15); expect(a.producto_version_id).toBe(1933); expect(a.productoId).toBeNull();
    const b = crearPartida({ nombre: 'x', precioUnitario: 1, productoId: 'banca_sencilla', product_version_id: 9, product_id: 3 }, { veCostos: true });
    expect(b.productoId).toBe('banca_sencilla'); expect(b.claveLinea).toBe('banca_sencilla'); expect(b.producto_id).toBe(3); expect(b.producto_version_id).toBe(9);
  });

  it('vendedor: NUNCA economía, pero sí precio, precioReal, identidad y snapshot de lista', () => {
    const p = crearPartida({ ...ia, pieza: { componentes: [{ nombre: 'c' }], factorDirecta: 55, horas: { pm: 1 } }, deBanco: false }, { veCostos: false, origen: 'ia' });
    expect(p.sellerSafe).toBe(true);
    expect(p).not.toHaveProperty('costoUnitario'); expect(p).not.toHaveProperty('margen'); expect(p).not.toHaveProperty('costoDerivado');
    expect(p.precioUnitario).toBe(48000);
    expect(p.precioReal).toBe(true);
    expect(p.precio_lista_snapshot).toBe(48000);
    expect(p.producto_version_id).toBe(1933);
    expect(p.catalogo).toEqual({ clave: 'APL-120', lista: 48000, minimo: 40000 });
    expect(p.pieza).toEqual({ componentes: [{ nombre: 'c' }] });   // la estructura técnica sí viaja
    // Cero claves de economía SEGÚN EL SERVIDOR (precioReal es procedencia y se conserva a propósito).
    const econ = escaneaEconomia(p).map((r) => r.split('.').pop()).filter((k) => esClaveEconomiaServidor(k) && k !== 'precioReal');
    expect(econ).toEqual([]);
  });

  it('banco al vendedor: sin costo aunque la entrada lo traiga (fuga RC3)', () => {
    const p = crearPartida({ nombre: 'Silla', cantidad: 3, precioUnitario: 1800, costoUnitario: 500, margen: 40, deBanco: true }, { veCostos: false });
    expect(p).not.toHaveProperty('costoUnitario'); expect(p).not.toHaveProperty('margen'); expect(p.origen).toBe('banco');
  });

  it('cantidad entera ≥ 1, precio > 0 o null, costo 0 = desconocido, render sólo URL', () => {
    const p = crearPartida({ nombre: 'x', cantidad: 0, precioUnitario: 0, costoUnitario: 0, render: 'data:image/png;base64,AAA' }, { veCostos: true });
    expect(p.cantidad).toBe(1); expect(p.precioUnitario).toBeNull(); expect(p.costoUnitario).toBeNull(); expect(p.render).toBeNull();
    const q = crearPartida({ nombre: 'x', cantidad: 2.6, precioUnitario: '1234.5', render: 'https://x/y.png' }, { veCostos: true });
    expect(q.cantidad).toBe(3); expect(q.precioUnitario).toBe(1234.5); expect(q.render).toBe('https://x/y.png');
  });

  it('origen se infiere cuando no se da', () => {
    expect(crearPartida({ nombre: 'a', deBanco: true }).origen).toBe('banco');
    expect(crearPartida({ nombre: 'a', piezaId: 'addon-electrico' }).origen).toBe('addon');
    expect(crearPartida({ nombre: 'a', deLinea: true }).origen).toBe('linea');
    expect(crearPartida({ nombre: 'a', sugerido: true }).origen).toBe('ia');
    expect(crearPartida({ nombre: 'a' }).origen).toBe('costeo');
  });
});

describe('validarPartida', () => {
  it('una partida bien formada no tiene problemas', () => {
    expect(validarPartida(crearPartida({ nombre: 'x', cantidad: 1, precioUnitario: 10, producto_id: 1, producto_version_id: 2 }))).toEqual([]);
  });
  it('detecta lo que la emisión rechazaría', () => {
    const campos = validarPartida({ nombre: '', cantidad: 0, precioUnitario: null, producto_id: 5, piezasSinMaterial: 2, render: 'data:x', sellerSafe: true, costoUnitario: 1 }).map((i) => i.campo);
    expect(campos).toEqual(expect.arrayContaining(['nombre', 'cantidad', 'precioUnitario', 'producto_version_id', 'piezasSinMaterial', 'render', 'costoUnitario']));
  });
});
