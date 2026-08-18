// ============================================================================
//  LA MECÁNICA DE PRECIO DE LÍNEA (base Lista vs FULL, piso, descuento).
//  Aquí vive el dinero: cada regla que Rodrigo dictó el 2026-08-18 queda cuidada.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { cotizarArticulo, descuentoMaximo } from './cotizarLinea.js';
import { articuloPorClave } from './preciosLinea.js';

// Un artículo con mínimo real: APP CIECDO02991446 -> full 950, lista 500, min 399.
const CLAVE = 'CIECDO02991446';
// Un artículo con mínimo 0 (no se descuenta): CIRQUE CIEPAT06E61508 -> full 350, lista 240, min 0.
const CLAVE_MIN0 = 'CIEPAT06E61508';

describe('cotizar un artículo de línea', () => {
  it('base LISTA sin descuento = Precio Lista', () => {
    expect(cotizarArticulo(CLAVE).precio).toBe(500);
    expect(cotizarArticulo(CLAVE, { base: 'lista', descuentoPct: 0 }).precio).toBe(500);
  });

  it('base LISTA con descuento que respeta el piso', () => {
    // 500 - 10% = 450, sigue arriba del piso 399.
    const r = cotizarArticulo(CLAVE, { base: 'lista', descuentoPct: 10 });
    expect(r.precio).toBe(450);
    expect(r.topadoAlPiso).toBe(false);
  });

  it('base LISTA: el descuento NUNCA baja del piso (lo topa y lo marca)', () => {
    // 500 - 50% = 250, por debajo del piso 399 -> se topa en 399.
    const r = cotizarArticulo(CLAVE, { base: 'lista', descuentoPct: 50 });
    expect(r.precio).toBe(399);
    expect(r.topadoAlPiso).toBe(true);
  });

  it('mínimo 0 = no se descuenta: el piso es la lista', () => {
    const r = cotizarArticulo(CLAVE_MIN0, { base: 'lista', descuentoPct: 30 });
    expect(r.piso).toBe(240);         // = lista
    expect(r.precio).toBe(240);       // no baja de la lista
    expect(r.topadoAlPiso).toBe(true);
  });

  it('base FULL parte del Precio 2 y el descuento es LIBRE (sin tope)', () => {
    // full 950 - 60% = 380, por debajo del piso 399, pero en FULL es libre:
    // NO se topa, sólo se avisa con bajoPiso.
    const r = cotizarArticulo(CLAVE, { base: 'full', descuentoPct: 60 });
    expect(r.bruto).toBe(950);
    expect(r.precio).toBe(380);
    expect(r.topadoAlPiso).toBe(false);
    expect(r.bajoPiso).toBe(true);
  });

  it('descuento fuera de rango se acota (nada de recargos ni precios negativos)', () => {
    expect(cotizarArticulo(CLAVE, { base: 'full', descuentoPct: -20 }).precio).toBe(950);
    expect(cotizarArticulo(CLAVE, { base: 'full', descuentoPct: 999 }).precio).toBe(0);
  });

  it('clave que no existe -> null', () => {
    expect(cotizarArticulo('NO-EXISTE')).toBe(null);
  });

  it('descuento máximo en base LISTA llega al piso; en FULL es libre (null)', () => {
    // piso 399 sobre lista 500 -> 1 - 399/500 = 20%.
    expect(descuentoMaximo(CLAVE, 'lista')).toBe(20);
    expect(descuentoMaximo(CLAVE, 'full')).toBe(null);
    expect(descuentoMaximo(CLAVE_MIN0, 'lista')).toBe(0);   // no se descuenta
  });
});
