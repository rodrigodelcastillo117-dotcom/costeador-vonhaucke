import { describe, it, expect } from 'vitest';
import { leerBorradorPedido, guardarBorradorPedido, borrarBorradorPedido, CLAVE_BORRADOR_PEDIDO } from './borradorPedido.js';

const memoria = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };

describe('borrador del pedido a Voni: sobrevive navegar y recargar en la misma pestaña', () => {
  it('guarda y relee el texto tal cual', () => {
    const s = memoria();
    expect(guardarBorradorPedido('2 escritorios de 1.50\ny una credenza', s)).toBe(true);
    expect(leerBorradorPedido(s)).toBe('2 escritorios de 1.50\ny una credenza');
  });
  it('en blanco retira la clave (no deja basura)', () => {
    const s = memoria();
    guardarBorradorPedido('algo', s);
    guardarBorradorPedido('   ', s);
    expect(s.m.has(CLAVE_BORRADOR_PEDIDO)).toBe(false);
    expect(leerBorradorPedido(s)).toBe('');
  });
  it('borrar lo quita', () => {
    const s = memoria();
    guardarBorradorPedido('algo', s);
    borrarBorradorPedido(s);
    expect(leerBorradorPedido(s)).toBe('');
  });
  it('recorta lo absurdamente largo y nunca lanza (sin storage o storage roto)', () => {
    const s = memoria();
    guardarBorradorPedido('x'.repeat(50_000), s);
    expect(leerBorradorPedido(s).length).toBe(20_000);
    const roto = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('lleno'); }, removeItem: () => { throw new Error('x'); } };
    expect(leerBorradorPedido(roto)).toBe('');
    expect(guardarBorradorPedido('a', roto)).toBe(false);
    expect(() => borrarBorradorPedido(roto)).not.toThrow();
    expect(guardarBorradorPedido('a', null)).toBe(false);
    expect(leerBorradorPedido(null)).toBe('');
  });
});
