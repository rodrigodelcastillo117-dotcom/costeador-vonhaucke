import { describe, it, expect } from 'vitest';
import { CONTRATO, cruzaMuro, invariantesMuros, invariantesCirculacion, evaluarRecovery, proponerReparacion } from './recovery-core.js';

const area = (extra = {}) => ({ nombre: 'A', ancho: 6000, largo: 4000, ...extra });
const silla = (id) => ({ id, w: 600, d: 600 });

describe('recovery-core · contrato versionado', () => {
  it('declara versiones de entrada/salida y pasillo mínimo', () => {
    expect(CONTRATO.input_version).toBe('ACOMODO_INPUT_V1');
    expect(CONTRATO.output_version).toBe('PLACEMENT_SPEC_V2_RECOVERY');
    expect(CONTRATO.min_pasillo_mm).toBe(1000);
  });
});

describe('recovery-core · MUROS (first-class)', () => {
  it('cruzaMuro detecta un muro que atraviesa el rect', () => {
    const rect = { x: 0, y: 0, w: 600, h: 600 };
    expect(cruzaMuro(rect, { x1: 300, y1: -100, x2: 300, y2: 700 })).toBe(true);
    expect(cruzaMuro(rect, { x1: 2000, y1: 0, x2: 2000, y2: 700 })).toBe(false);
  });
  it('invariantesMuros marca WALL_CROSS por pieza', () => {
    const areas = [area({ muros: [{ x1: 300, y1: -100, x2: 300, y2: 700 }] })];
    const piezas = [silla('s-1')];
    const issues = invariantesMuros(areas, piezas, [{ id: 's-1', area: 0, x: 0, y: 0 }]);
    expect(issues.map((i) => i.code)).toContain('WALL_CROSS');
  });
});

describe('recovery-core · CIRCULACIÓN (ancho de pasillo duro)', () => {
  const areas = [area()];
  const piezas = [silla('a'), silla('b')];
  it('hueco < 1000 mm entre piezas enfrentadas → CIRCULATION_TIGHT', () => {
    const issues = invariantesCirculacion(areas, piezas, [{ id: 'a', area: 0, x: 0, y: 0 }, { id: 'b', area: 0, x: 1100, y: 0 }]);
    expect(issues.map((i) => i.code)).toContain('CIRCULATION_TIGHT');
    expect(issues[0].huecoMM).toBe(500);
  });
  it('hueco ≥ 1000 mm → sin problema', () => {
    const issues = invariantesCirculacion(areas, piezas, [{ id: 'a', area: 0, x: 0, y: 0 }, { id: 'b', area: 0, x: 1700, y: 0 }]);
    expect(issues).toHaveLength(0);
  });
  it('a tope (hueco 0) no es pasillo angosto', () => {
    const issues = invariantesCirculacion(areas, piezas, [{ id: 'a', area: 0, x: 0, y: 0 }, { id: 'b', area: 0, x: 600, y: 0 }]);
    expect(issues).toHaveLength(0);
  });
});

describe('recovery-core · evaluarRecovery (agrega todo)', () => {
  const areas = [area({ puertas: [{ x: 0, y: 0, ancho: 900 }], obstaculos: [{ x: 5000, y: 3000, w: 500, h: 500 }] })];
  const piezas = [silla('a'), silla('b'), silla('c')];
  const planOk = [
    { id: 'a', area: 0, x: 0, y: 1500 },
    { id: 'b', area: 0, x: 1600, y: 1500 },   // pasillo 1000 con a
    { id: 'c', area: 0, x: 3200, y: 1500 },
  ];

  it('plan válido → PASS + render_ready + versión de salida', () => {
    const r = evaluarRecovery(areas, piezas, planOk);
    expect(r.status).toBe('PASS');
    expect(r.render_ready).toBe(true);
    expect(r.output_version).toBe('PLACEMENT_SPEC_V2_RECOVERY');
    expect(r.placed).toBe(3);
  });
  it('bloquea puerta → FAIL', () => {
    const r = evaluarRecovery(areas, piezas, [{ id: 'a', area: 0, x: 0, y: 0 }, ...planOk.slice(1)]);
    expect(r.status).toBe('FAIL');
    expect(r.issues.map((i) => i.code)).toContain('BLOCKS_DOOR');
  });
  it('pieza faltante → PARTIAL (nunca PASS)', () => {
    const r = evaluarRecovery(areas, piezas, planOk.slice(0, 2));
    expect(r.status).toBe('PARTIAL');
    expect(r.render_ready).toBe(false);
    expect(r.unplaced).toEqual(['c']);
  });
  it('repair agotado con falla → NEEDS_REVIEW', () => {
    const r = evaluarRecovery(areas, piezas, [{ id: 'a', area: 0, x: 0, y: 1500 }, { id: 'b', area: 0, x: 400, y: 1500 }, { id: 'c', area: 0, x: 3200, y: 1500 }], { repairAgotado: true });
    expect(r.status).toBe('NEEDS_REVIEW');
    expect(r.render_ready).toBe(false);
  });
});

describe('recovery-core · proponerReparacion (reparación REAL · audit F)', () => {
  const areas = [{ nombre: 'A', ancho: 6000, largo: 4000 }];
  const piezas = [{ id: 'a', w: 600, d: 600 }, { id: 'b', w: 600, d: 600 }];

  it('un solape se repara: conserva/recoloca y elimina el OVERLAP', () => {
    const mal = [{ id: 'a', area: 0, x: 0, y: 0 }, { id: 'b', area: 0, x: 0, y: 0 }];
    const evalPrev = evaluarRecovery(areas, piezas, mal, { requested: 2 });
    expect(evalPrev.status).toBe('FAIL');
    const rep = proponerReparacion({ areas, piezas, colocacionPrev: mal, evalPrev });
    expect(rep.movidas.length).toBeGreaterThan(0);                 // cambió algo concreto
    const evalNew = evaluarRecovery(areas, piezas, rep.colocacion, { requested: 2 });
    expect(evalNew.issues.some((i) => i.code === 'OVERLAP')).toBe(false);
  });

  it('plan ya válido → NO finge intento (movidas vacío)', () => {
    const bien = [{ id: 'a', area: 0, x: 0, y: 0 }, { id: 'b', area: 0, x: 2000, y: 0 }];
    const evalPrev = evaluarRecovery(areas, piezas, bien, { requested: 2 });
    const rep = proponerReparacion({ areas, piezas, colocacionPrev: bien, evalPrev });
    expect(rep.movidas).toHaveLength(0);
  });

  it('pieza faltante se coloca en espacio libre', () => {
    const falta = [{ id: 'a', area: 0, x: 0, y: 0 }];
    const evalPrev = evaluarRecovery(areas, piezas, falta, { requested: 2 });
    expect(evalPrev.status).toBe('PARTIAL');
    const rep = proponerReparacion({ areas, piezas, colocacionPrev: falta, evalPrev });
    expect(rep.colocacion.some((c) => c.id === 'b')).toBe(true);
  });

  it('respeta la zona destino (zone_id) al recolocar', () => {
    const areas2 = [{ nombre: 'A', zone_id: 'ZA', ancho: 4000, largo: 4000 }, { nombre: 'B', zone_id: 'ZB', ancho: 4000, largo: 4000 }];
    const piezas2 = [{ id: 'x', w: 600, d: 600, zone_id: 'ZB' }];
    const rep = proponerReparacion({ areas: areas2, piezas: piezas2, colocacionPrev: [], evalPrev: { issues: [] } });
    const x = rep.colocacion.find((c) => c.id === 'x');
    expect(x.area).toBe(1);   // zona ZB
  });
});
