import { describe, it, expect } from 'vitest';
import { rellenar } from './rellenar.js';
import { esSillaDeVisita, esSillaDeTrabajo } from './planner.js';

// ============================================================================
//  "PONES UNA Y TE OFRECE PONER TODAS" (Rodrigo, 2026-08-17)
//  "Poner los escritorios y sillas tú mismo está tedioso… si ve que puse 1
//   silla WIN en el operativo, que me pregunte si relleno todas."
// ============================================================================
const SILLA = { id: 's0', nombre: 'Silla operativa · WIN', w: 620, d: 620, tipo: 'asiento' };
const AREA = { ancho: 12000, largo: 9000 };

describe('rellenar el resto', () => {
  it('pone las que faltan sin encimar nada', () => {
    const ids = Array.from({ length: 10 }, (_, i) => 's' + (i + 1));
    const out = rellenar({ ids, pieza: SILLA, area: AREA, iArea: 0, colocadas: [], byId: { s0: SILLA } });
    expect(out).toHaveLength(10);
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i], b = out[j];
        const encima = a.x < b.x + SILLA.w && a.x + SILLA.w > b.x && a.y < b.y + SILLA.d && a.y + SILLA.d > b.y;
        expect(encima).toBe(false);
      }
    }
  });

  it('no se sale del cuarto', () => {
    const ids = Array.from({ length: 6 }, (_, i) => 's' + (i + 1));
    const chico = { ancho: 3000, largo: 3000 };
    const out = rellenar({ ids, pieza: SILLA, area: chico, iArea: 0, colocadas: [], byId: { s0: SILLA } });
    for (const c of out) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + SILLA.w).toBeLessThanOrEqual(chico.ancho);
      expect(c.y + SILLA.d).toBeLessThanOrEqual(chico.largo);
    }
  });

  it('devuelve MENOS —no revienta— cuando ya no cabe', () => {
    const ids = Array.from({ length: 200 }, (_, i) => 's' + (i + 1));
    const chico = { ancho: 2000, largo: 2000 };
    const out = rellenar({ ids, pieza: SILLA, area: chico, iArea: 0, colocadas: [], byId: { s0: SILLA } });
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThan(200);
  });

  it('no se encima con lo que YA estaba en el cuarto', () => {
    const escritorio = { id: 'e1', nombre: 'Escritorio', w: 1800, d: 800, tipo: 'escritorio' };
    const byId = { s0: SILLA, e1: escritorio };
    const colocadas = [{ id: 'e1', area: 0, x: 1000, y: 1000, rot: 0 }];
    const ids = Array.from({ length: 8 }, (_, i) => 's' + (i + 1));
    const out = rellenar({ ids, pieza: SILLA, area: AREA, iArea: 0, colocadas, byId });
    for (const c of out) {
      const encima = c.x < 1000 + 1800 && c.x + SILLA.w > 1000 && c.y < 1000 + 800 && c.y + SILLA.d > 1000;
      expect(encima).toBe(false);
    }
  });
});

describe('qué silla es cuál', () => {
  it('la de visita va aparte de la operativa', () => {
    const visita = { tipo: 'asiento', nombre: 'Silla de visita · CONCERTO' };
    const oper = { tipo: 'asiento', nombre: 'Silla operativa · WIN' };
    const sillon = { tipo: 'asiento', nombre: 'Sillón' };
    expect(esSillaDeVisita(visita)).toBe(true);
    expect(esSillaDeVisita(oper)).toBe(false);
    expect(esSillaDeTrabajo(sillon)).toBe(false);   // un sillón es de lounge
  });
});
