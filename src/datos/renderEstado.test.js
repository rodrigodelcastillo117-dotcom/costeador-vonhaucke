// N8 — estado y versionado de renders. Puro.
import { describe, it, expect } from 'vitest';
import {
  nuevoRender, marcarGenerando, marcarListo, marcarError,
  estaDesactualizado, evaluarRender, historial, hashContenido,
  TIPOS_RENDER, ESTADOS_RENDER,
} from './renderEstado.js';

describe('hashContenido', () => {
  it('estable ante orden de llaves', () => {
    expect(hashContenido({ a: 1, b: 2 })).toBe(hashContenido({ b: 2, a: 1 }));
    expect(hashContenido({ a: 1 })).not.toBe(hashContenido({ a: 2 }));
  });
});

describe('transiciones de estado', () => {
  it('GENERAR -> GENERANDO -> LISTO', () => {
    let r = nuevoRender({ tipo: TIPOS_RENDER.AMBIENTE, bom_hash: 'b1' });
    expect(r.estado).toBe(ESTADOS_RENDER.GENERAR);
    r = marcarGenerando(r); expect(r.estado).toBe(ESTADOS_RENDER.GENERANDO);
    r = marcarListo(r, 'http://img/1.png'); expect(r.estado).toBe(ESTADOS_RENDER.LISTO);
    expect(r.url).toBe('http://img/1.png');
  });
  it('ERROR guarda el mensaje', () => {
    const r = marcarError(nuevoRender({}), 'timeout');
    expect(r.estado).toBe(ESTADOS_RENDER.ERROR);
    expect(r.error).toBe('timeout');
  });
});

describe('STALE (DESACTUALIZADO)', () => {
  it('LISTO queda DESACTUALIZADO si cambia una huella', () => {
    const r = marcarListo(nuevoRender({ bom_hash: 'b1', config_hash: 'c1' }), 'u');
    expect(estaDesactualizado(r, { bom_hash: 'b1', config_hash: 'c1' })).toBe(false);
    expect(estaDesactualizado(r, { bom_hash: 'b2', config_hash: 'c1' })).toBe(true);
    expect(evaluarRender(r, { bom_hash: 'b2' }).estado).toBe(ESTADOS_RENDER.DESACTUALIZADO);
  });
  it('no marca falso-positivo cuando la huella actual es null', () => {
    const r = marcarListo(nuevoRender({ bom_hash: 'b1' }), 'u');
    expect(estaDesactualizado(r, { config_hash: 'c9' })).toBe(false);
  });
  it('un render GENERANDO nunca está DESACTUALIZADO', () => {
    const r = marcarGenerando(nuevoRender({ bom_hash: 'b1' }));
    expect(estaDesactualizado(r, { bom_hash: 'zzz' })).toBe(false);
  });
});

describe('historial', () => {
  it('ordena por fecha desc, recalcula estado y marca vigente (no borra)', () => {
    const viejo = { ...marcarListo(nuevoRender({ bom_hash: 'b1' }), 'u1'), fecha: '2026-01-01T00:00:00Z' };
    const nuevo = { ...marcarListo(nuevoRender({ bom_hash: 'b2' }), 'u2'), fecha: '2026-06-01T00:00:00Z' };
    const h = historial([viejo, nuevo], { bom_hash: 'b2' });
    expect(h).toHaveLength(2); // conserva ambos
    expect(h[0].fecha > h[1].fecha).toBe(true);
    const n2 = h.find((x) => x.url === 'u2');
    expect(n2.estado).toBe(ESTADOS_RENDER.LISTO);
    expect(n2.vigente).toBe(true);
    const v1 = h.find((x) => x.url === 'u1');
    expect(v1.estado).toBe(ESTADOS_RENDER.DESACTUALIZADO);
  });
});
