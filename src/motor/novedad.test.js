import { describe, it, expect } from 'vitest';
import { factorNovedad, NOVEDAD, costoAlbaDificultad, costoPorHoras, TARIFAS_PLANTA } from './dificultad.js';

// Premium de "primera vez / nunca hecho": escala el TRABAJO (horas/MO), nunca el material.
// PROVISIONAL — valores a calibrar con trabajos bespoke reales. Default conocido (×1) = sin cambio.
describe('factorNovedad — ≥1, acotado [1,2], nunca abarata', () => {
  it('niveles', () => {
    expect(factorNovedad('conocido')).toBe(1);
    expect(factorNovedad('primera_vez')).toBe(1.15);
    expect(factorNovedad('nuevo')).toBe(1.35);
    expect(factorNovedad('muy_nuevo')).toBe(1.6);
  });
  it('ausente/basura/≤0 → 1; nunca NaN; tope en 2', () => {
    expect(factorNovedad(undefined)).toBe(1);
    expect(factorNovedad('xyz')).toBe(1);
    expect(factorNovedad(0.5)).toBe(1);   // nunca abarata
    expect(factorNovedad(-3)).toBe(1);
    expect(factorNovedad(9)).toBe(2);     // tope
  });
});

describe('costoAlbaDificultad con novedad — escala MO/GI, NO el material', () => {
  it('conocido (×1) = exactamente la cuenta de siempre', () => {
    const a = costoAlbaDificultad(1000, 'general', 'normal', 'conocido');
    expect(a.material).toBe(1000);
    expect(a.mo).toBe(200);      // 20%
    expect(a.gi).toBe(600);      // 3×MO
    expect(a.fab).toBe(1800);
  });
  it('primera_vez sube MO y GI 15%; el material queda intacto', () => {
    const a = costoAlbaDificultad(1000, 'general', 'normal', 'primera_vez');
    expect(a.material).toBe(1000);
    expect(a.mo).toBeCloseTo(230, 6);    // 200 × 1.15
    expect(a.gi).toBeCloseTo(690, 6);    // 600 × 1.15
    expect(a.fab).toBeCloseTo(1920, 6);
    expect(a.novedad).toBe(1.15);
  });
  it('novedad se COMBINA con dificultad (producto), reportadas por separado', () => {
    const a = costoAlbaDificultad(1000, 'general', 'dificil', 'nuevo'); // 1.3 × 1.35
    expect(a.mo).toBeCloseTo(200 * 1.3 * 1.35, 6);
    expect(a.dificultad).toBe(1.3);
    expect(a.novedad).toBe(1.35);
  });
  it('cristal: la novedad mueve su MO (1%) pero el GI sigue fijo 5% del material', () => {
    const a = costoAlbaDificultad(1000, 'cristal', 'normal', 'muy_nuevo');
    expect(a.gi).toBe(50);                       // 5% del material, NO escala
    expect(a.mo).toBeCloseTo(10 * 1.6, 6);       // 1% × 1.6
  });
});

describe('costoPorHoras con novedad — escala HORAS (MO + indirectos de planta)', () => {
  it('primera_vez sube 15% horas → MO, GI y horas 15%; material intacto', () => {
    const base = costoPorHoras(1000, { pm: 10, carpinteria: 4 });
    const nv = costoPorHoras(1000, { pm: 10, carpinteria: 4 }, TARIFAS_PLANTA, 'primera_vez');
    expect(nv.material).toBe(1000);
    expect(nv.mo).toBeCloseTo(base.mo * 1.15, 4);
    expect(nv.gi).toBeCloseTo(base.gi * 1.15, 4);
    expect(nv.horas).toBeCloseTo(base.horas * 1.15, 4);
    expect(nv.novedad).toBe(1.15);
  });
});
