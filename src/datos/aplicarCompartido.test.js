import { describe, it, expect } from 'vitest';
import { aplicarCompartido, esInsumoErp } from './aplicarCompartido.js';

describe('aplicarCompartido (VH-145)', () => {
  const base = { insumos: { mdf: { id: 'mdf', precio: 400 }, 'erp-mdf18h': { id: 'erp-mdf18h', clasificacion: 'erp', precio: 725.4 }, viejo: { id: 'viejo', precio: 1 } }, parametros: { nomina: 100, x: 1 }, piezas: { a: 1 } };
  it('un refresco de config conserva los insumos ERP elegidos a mano y reemplaza el resto', () => {
    const r = aplicarCompartido(base, { insumos: { mdf: { id: 'mdf', precio: 437 } }, insumosFuente: 'catalogo' });
    expect(r.insumos.mdf.precio).toBe(437);
    expect(r.insumos['erp-mdf18h'].precio).toBe(725.4);
    expect(r.insumos.viejo).toBeUndefined();
    expect(r.insumosFuente).toBe('catalogo');
  });
  it('si lo nuevo ya trae el ERP, gana lo nuevo', () => {
    const r = aplicarCompartido(base, { insumos: { 'erp-mdf18h': { id: 'erp-mdf18h', clasificacion: 'erp', precio: 730 } } });
    expect(r.insumos['erp-mdf18h'].precio).toBe(730);
  });
  it('los parámetros se funden y las piezas se reemplazan; sin insumos no toca el mapa', () => {
    const r = aplicarCompartido(base, { parametros: { x: 2 }, piezas: { b: 2 } });
    expect(r.parametros).toEqual({ nomina: 100, x: 2 });
    expect(r.piezas).toEqual({ b: 2 });
    expect(r.insumos).toBe(base.insumos);
  });
  it('esInsumoErp por clasificación o prefijo', () => {
    expect(esInsumoErp('erp-x', { id: 'erp-x' })).toBe(true);
    expect(esInsumoErp('mdf', { id: 'mdf', clasificacion: 'erp' })).toBe(true);
    expect(esInsumoErp('mdf', { id: 'mdf' })).toBe(false);
  });
});
