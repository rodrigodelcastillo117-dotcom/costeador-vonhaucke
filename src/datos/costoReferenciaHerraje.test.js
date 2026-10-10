import { describe, expect, it } from 'vitest';
import { costoReferenciaHerraje } from './costoReferenciaHerraje.js';

describe('referencias económicas compradas por pieza sin alterar BOM', () => {
  const insumo = { id: 'bisagra', unidad: 'pza', precio: 10 };
  it('usa precio positivo y cantidad conocida (fixture sintético)', () => {
    expect(costoReferenciaHerraje({ cantidad: 4 }, insumo, 1)).toBe(40);
  });
  it('no inventa cantidad, precio, compra por hoja ni unidad de tramo', () => {
    expect(costoReferenciaHerraje({}, insumo, 1)).toBeNull();
    expect(costoReferenciaHerraje({ cantidad: 4 }, { ...insumo, precio: 0 })).toBeNull();
    expect(costoReferenciaHerraje({ cantidad: 4 }, { ...insumo, unidad: 'm' })).toBeNull();
    expect(costoReferenciaHerraje({ cantidad: 4 }, { ...insumo, formato: { tipo:'tramo' } })).toBeNull();
    expect(costoReferenciaHerraje({ cantidad: 4 }, { ...insumo, precio: Infinity })).toBeNull();
  });
});
