import { describe, it, expect } from 'vitest';
import { acomodarLocal } from './planner.js';
import { areasDeM2 } from './espacioNuevo.js';

// ============================================================================
//  PISOS  ·  Rodrigo, 2026-08-17: "en un edificio el piso 2 va ENCIMA del 1".
//  Y antes de dibujarlos, hay que AMUEBLARLOS: con tres plantas iguales el
//  reparto metía los 17 muebles en la primera y dejaba dos de bodega, porque el
//  desempate era "el cuarto más grande primero" y las tres medían lo mismo.
// ============================================================================
const aMM = (as) => as.map((a) => ({
  nombre: a.nombre, ancho: Math.round(a.ancho * 1000), largo: Math.round(a.largo * 1000),
  ...(Number.isFinite(a.nivel) ? { nivel: a.nivel } : {}),
}));

const PROYECTO = [
  ...Array.from({ length: 3 }, (_, i) => ({ id: 'b' + i, w: 7500, d: 1200, tipo: 'escritorio' })),
  ...Array.from({ length: 3 }, (_, i) => ({ id: 'j' + i, w: 3600, d: 1200, tipo: 'juntas' })),
  ...Array.from({ length: 9 }, (_, i) => ({ id: 'g' + i, w: 900, d: 450, tipo: 'guarda' })),
];

describe('un proyecto de varios pisos', () => {
  it('los pisos traen su NIVEL, que es lo que hace que el 3D los apile', () => {
    expect(areasDeM2(400, 3).map((a) => a.nivel)).toEqual([0, 1, 2]);
  });

  it('con UN piso no hay nivel: no hay torre que dibujar', () => {
    expect(areasDeM2(400, 1)[0].nivel).toBeUndefined();
    expect(areasDeM2(400, 0.5)[0].nivel).toBeUndefined();
  });

  it('NINGÚN piso se queda vacío', () => {
    const areas = aMM(areasDeM2(400, 3));
    const r = acomodarLocal(areas, PROYECTO, {});
    const porPiso = areas.map((_, i) => r.colocacion.filter((c) => c.area === i).length);
    expect(r.colocacion).toHaveLength(PROYECTO.length);
    expect(porPiso.every((n) => n > 0)).toBe(true);
  });

  it('y ninguno se lleva más de la mitad del proyecto', () => {
    const areas = aMM(areasDeM2(400, 3));
    const r = acomodarLocal(areas, PROYECTO, {});
    const porPiso = areas.map((_, i) => r.colocacion.filter((c) => c.area === i).length);
    expect(Math.max(...porPiso)).toBeLessThanOrEqual(Math.ceil(PROYECTO.length / 2));
  });
});
