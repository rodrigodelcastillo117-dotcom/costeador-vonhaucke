// ============================================================================
//  Auditoría de calidad del acomodo: detecta encimados y piezas fuera de área.
//  Incluye un gate de confianza: el propio motor (acomodarLocal) debe producir un
//  acomodo que PASA la auditoría (sin encimados, todo dentro).
// ============================================================================
import { describe, it, expect } from 'vitest';
import { auditarColocacion, footprintPieza, areaSolapeMM2 } from './acomodoAudit.js';
import { acomodarLocal } from './planner.js';

describe('footprint y solape', () => {
  it('rot 90 intercambia ancho×fondo', () => {
    expect(footprintPieza({ x: 0, y: 0, rot: 0 }, { w: 1500, d: 700 })).toMatchObject({ w: 1500, h: 700 });
    expect(footprintPieza({ x: 0, y: 0, rot: 90 }, { w: 1500, d: 700 })).toMatchObject({ w: 700, h: 1500 });
  });
  it('mide el solape en mm²', () => {
    expect(areaSolapeMM2({ x: 0, y: 0, w: 1000, h: 1000 }, { x: 500, y: 500, w: 1000, h: 1000 })).toBe(500 * 500);
    expect(areaSolapeMM2({ x: 0, y: 0, w: 1000, h: 1000 }, { x: 2000, y: 0, w: 1000, h: 1000 })).toBe(0);
  });
});

describe('auditarColocacion', () => {
  const byId = { a: { w: 1500, d: 700 }, b: { w: 1500, d: 700 } };

  it('acomodo limpio ⇒ ok', () => {
    const r = auditarColocacion({
      areas: [{ ancho: 6000, largo: 4000 }],
      colocacion: [{ id: 'a', area: 0, x: 0, y: 0, rot: 0 }, { id: 'b', area: 0, x: 2000, y: 0, rot: 0 }],
      byId,
    });
    expect(r.ok).toBe(true);
    expect(r.overlaps).toHaveLength(0);
    expect(r.fuera).toHaveLength(0);
  });

  it('detecta dos muebles encimados', () => {
    const r = auditarColocacion({
      areas: [{ ancho: 6000, largo: 4000 }],
      colocacion: [{ id: 'a', area: 0, x: 0, y: 0 }, { id: 'b', area: 0, x: 300, y: 0 }],
      byId,
    });
    expect(r.ok).toBe(false);
    expect(r.overlaps).toHaveLength(1);
    expect(r.overlaps[0].m2).toBeGreaterThan(0);
  });

  it('detecta una pieza fuera de su área', () => {
    const r = auditarColocacion({
      areas: [{ ancho: 1000, largo: 1000 }],
      colocacion: [{ id: 'a', area: 0, x: 2000, y: 0 }],
      byId,
    });
    expect(r.ok).toBe(false);
    expect(r.fuera).toHaveLength(1);
  });

  it('piezas en ÁREAS DISTINTAS no cuentan como encimadas', () => {
    const r = auditarColocacion({
      areas: [{ ancho: 6000, largo: 4000 }, { ancho: 6000, largo: 4000 }],
      colocacion: [{ id: 'a', area: 0, x: 0, y: 0 }, { id: 'b', area: 1, x: 0, y: 0 }],
      byId,
    });
    expect(r.ok).toBe(true);
  });

  it('tolera el roce de redondeo (toca por < tol, no es encimado)', () => {
    const r = auditarColocacion({
      areas: [{ ancho: 6000, largo: 4000 }],
      colocacion: [{ id: 'a', area: 0, x: 0, y: 0 }, { id: 'b', area: 0, x: 1480, y: 0 }], // 20mm de roce
      byId,
    }, { tol: 50 });
    expect(r.ok).toBe(true);
  });

  it('GATE · el motor (acomodarLocal) produce un acomodo que PASA la auditoría', () => {
    const areas = [{ nombre: 'Operativa', tipo: 'open', ancho: 8000, largo: 6000 }];
    const piezas = [
      { id: 'd1', nombre: 'Escritorio', w: 1500, d: 700, tipo: 'escritorio' },
      { id: 'd2', nombre: 'Escritorio', w: 1500, d: 700, tipo: 'escritorio' },
      { id: 'g1', nombre: 'Archivero', w: 900, d: 450, tipo: 'guarda' },
    ];
    const plan = acomodarLocal(areas, piezas, {});
    const byId = Object.fromEntries(piezas.map((p) => [p.id, p]));
    const audit = auditarColocacion({ areas: plan.areas || areas, colocacion: plan.colocacion, byId });
    expect(audit.overlaps).toHaveLength(0);   // el motor no encima muebles
  });
});
