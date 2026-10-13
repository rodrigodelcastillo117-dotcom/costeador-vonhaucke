import { describe, it, expect } from 'vitest';
import { topologiaDeProducto } from './placementTopologia.js';

// VH-112 · "Banca doble" en español también es DOUBLE_FACE (INFERRED); el id de catálogo sigue siendo CATALOG.
it('"Banca doble APP LT 1.50 · 8 usuarios" ⇒ DOUBLE_FACE inferida; id bench-doble ⇒ CATALOG; "Escritorio" ⇒ null', () => {
  expect(topologiaDeProducto({ nombre: 'Banca doble APP LT 1.50 · 8 usuarios · ocupa 6.00 × 1.20 m', piezaId: 'linea-banca_doble' })).toMatchObject({ topology: 'DOUBLE_FACE', provenance: 'INFERRED' });
  expect(topologiaDeProducto({ id: 'p9-app-lt-bench-doble-23340', nombre: 'App LT · Bench doble' })).toMatchObject({ topology: 'DOUBLE_FACE', provenance: 'CATALOG' });
  expect(topologiaDeProducto({ nombre: 'Escritorio APP LT 1.50 × 0.75' })).toBe(null);
});

// VH-153 · módulos operativos App LT de fondo 1200 (4u/6u/8u/10u/12u) ⇒ DOUBLE_FACE con procedencia CATALOG
// (receta del producto: cubierta banca doble + omega doble para fondo > 600). Un escritorio App LT de 900 ⇒ null.
it('op-12u-7200x1200-cristal (por id o por producto del banco) ⇒ DOUBLE_FACE CATALOG; op-4u también; esc-varios-1800x900 ⇒ null', () => {
  expect(topologiaDeProducto({ productoId: 'op-12u-7200x1200-cristal' })).toMatchObject({ topology: 'DOUBLE_FACE', provenance: 'CATALOG' });
  expect(topologiaDeProducto({ piezaId: 'op-4u-3000x1200' })).toMatchObject({ topology: 'DOUBLE_FACE', provenance: 'CATALOG' });
  expect(topologiaDeProducto({ id: 'op-12u-7200x1200-cristal', linea: 'App LT', categoria: 'Operativos / Bench', tipo: 'modulo', medidas: '7200 × 1200 mm' }).evidence).toMatch(/fondo 1200/);
  expect(topologiaDeProducto({ productoId: 'esc-varios-1800x900' })).toBe(null);
});

describe('VH-153b · la partida real de Cotizar encuentra el módulo App LT por piezaId o id de instancia', () => {
  it('productoId numérico (1898) + piezaId del banco, sin categoría ni medidas → DOUBLE_FACE CATALOG', () => {
    const partida = { productoId: 1898, piezaId: 'op-12u-7200x1200-cristal', id: 'operativo|ANCHOR_WORKSTATION|#0::op-12u-7200x1200-cristal', nombre: 'Módulo operativo App LT 12 usuarios (biombo cristal)', linea: 'App LT', usuarios: 12 };
    const t = topologiaDeProducto(partida);
    expect(t?.topology).toBe('DOUBLE_FACE');
    expect(t?.provenance).toBe('CATALOG');
  });
  it('sólo el id de instancia con sufijo "-1" también lo encuentra; un operativo fondo 600 no', () => {
    expect(topologiaDeProducto({ id: 'operativo|ANCHOR_WORKSTATION|#0::op-12u-7200x1200-cristal-1' })?.topology).toBe('DOUBLE_FACE');
    expect(topologiaDeProducto({ productoId: 77, piezaId: 'op-1u-1500x600' })?.topology ?? null).not.toBe('DOUBLE_FACE');
  });
});
