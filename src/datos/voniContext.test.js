import { describe, it, expect } from 'vitest';
import { construirVoniContext, porQueNoPuedoEmitir } from './voniContext.js';
import { bloqueosDeEmision, problemasDeEmision } from './senales.js';

const ok = { nombre: 'Cubierta', cantidad: 1, precioUnitario: 1000 };
const sinPrecio = { nombre: 'Base', cantidad: 2, precioUnitario: 0 };
const sinMaterial = { nombre: 'Módulo', cantidad: 1, precioUnitario: 500, piezasSinMaterial: 1, nombresSinMaterial: ['Acometida'] };

describe('bloqueosDeEmision — estructurado, fuente única', () => {
  it('partida válida → sin bloqueos; problemasDeEmision concuerda', () => {
    expect(bloqueosDeEmision([ok])).toEqual([]);
    expect(problemasDeEmision([ok])).toEqual([]);
  });
  it('precio 0 → PRECIO_INVALIDO con porqué y cómo corregir', () => {
    const b = bloqueosDeEmision([sinPrecio]);
    expect(b[0].code).toBe('PRECIO_INVALIDO');
    expect(b[0].porque).toBeTruthy();
    expect(b[0].corregir).toBeTruthy();
  });
  it('pieza sin material → SIN_MATERIAL y menciona la pieza', () => {
    const b = bloqueosDeEmision([sinMaterial]);
    expect(b.some((x) => x.code === 'SIN_MATERIAL')).toBe(true);
    expect(b.find((x) => x.code === 'SIN_MATERIAL').titulo).toContain('Acometida');
  });
  it('problemasDeEmision deriva de bloqueosDeEmision (mismos textos)', () => {
    const parts = [sinPrecio, sinMaterial];
    expect(problemasDeEmision(parts)).toEqual(bloqueosDeEmision(parts).map((x) => x.titulo));
  });
});

describe('construirVoniContext — filtrado por rol', () => {
  it('vendedor NO ve costo/margen; sí puede render', () => {
    const c = construirVoniContext({ usuario: { rol: 'vendedor' }, cotizacion: { partidas: [ok] } });
    expect(c.capacidades.ve_costo).toBe(false);
    expect(c.capacidades.ve_margen).toBe(false);
    expect(c.capacidades.puede_generar_render).toBe(true);
    expect(c.capacidades.puede_emitir).toBe(true);
  });
  it('direccion SÍ ve costo', () => {
    const c = construirVoniContext({ usuario: { rol: 'direccion' }, cotizacion: { partidas: [ok] } });
    expect(c.capacidades.ve_costo).toBe(true);
  });
  it('rol desconocido no puede render', () => {
    const c = construirVoniContext({ usuario: { rol: 'invitado' } });
    expect(c.capacidades.puede_generar_render).toBe(false);
  });
});

describe('porQueNoPuedoEmitir — herramienta canónica determinista', () => {
  it('sin partidas → no emitible con mensaje claro', () => {
    const r = porQueNoPuedoEmitir({ cotizacion: { partidas: [] } });
    expect(r.puedeEmitir).toBe(false);
    expect(r.resumen).toMatch(/no tiene partidas/i);
  });
  it('todo válido → emitible', () => {
    const r = porQueNoPuedoEmitir({ cotizacion: { partidas: [ok] } });
    expect(r.puedeEmitir).toBe(true);
    expect(r.bloqueos).toEqual([]);
  });
  it('con bloqueos → explica cuántos y cada uno con corregir', () => {
    const r = porQueNoPuedoEmitir({ cotizacion: { partidas: [ok, sinPrecio, sinMaterial] } });
    expect(r.puedeEmitir).toBe(false);
    expect(r.bloqueos.length).toBeGreaterThanOrEqual(2);
    expect(r.bloqueos.every((b) => b.titulo && b.corregir)).toBe(true);
  });
});
