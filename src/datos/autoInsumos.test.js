import { describe, it, expect } from 'vitest';
import { conAcompanantes } from './autoInsumos.js';

describe('conAcompanantes — adhesivo automático de superficie sólida', () => {
  it('solid surface sin adhesivo → agrega el adhesivo', () => {
    const r = conAcompanantes([{ nombre: 'Cubierta', insumoId: 'solid-surface', largoMM: 3600, anchoMM: 750 }]);
    expect(r.some((c) => c.insumoId === 'adhesivo-solid-surface' && c._auto)).toBe(true);
  });
  it('variante azul también dispara el adhesivo', () => {
    const r = conAcompanantes([{ nombre: 'Cubierta', insumoId: 'solid-surface-azul' }]);
    expect(r.some((c) => c.insumoId === 'adhesivo-solid-surface')).toBe(true);
  });
  it('si el adhesivo ya está, no lo duplica', () => {
    const base = [{ insumoId: 'solid-surface' }, { insumoId: 'adhesivo-solid-surface', cantidad: 3 }];
    const r = conAcompanantes(base);
    expect(r.filter((c) => c.insumoId === 'adhesivo-solid-surface').length).toBe(1);
    expect(r.find((c) => c.insumoId === 'adhesivo-solid-surface').cantidad).toBe(3); // respeta el del usuario
  });
  it('sin superficie sólida → no agrega nada', () => {
    const base = [{ insumoId: 'mdf-16' }, { insumoId: 'ptr' }];
    expect(conAcompanantes(base)).toHaveLength(2);
  });
  it('entrada vacía o basura → no rompe', () => {
    expect(conAcompanantes()).toEqual([]);
    expect(conAcompanantes(null)).toEqual([]);
    expect(conAcompanantes([null, { insumoId: '' }])).toHaveLength(2);
  });
  it('no muta el arreglo de entrada', () => {
    const base = [{ insumoId: 'solid-surface' }];
    conAcompanantes(base);
    expect(base).toHaveLength(1);
  });
});
