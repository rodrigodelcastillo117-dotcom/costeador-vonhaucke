import { describe, it, expect } from 'vitest';
import { resolverKitsMulti } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';
import { invariantesCirculacion, evaluarRecovery } from '../../supabase/functions/acomodar-espacio-recovery/recovery-core.js';
import { juzgarCalidad } from '../../supabase/functions/acomodar-espacio-recovery/qualityJudge.js';
import { juzgarSemantico } from '../../supabase/functions/acomodar-espacio-recovery/semanticPlacementJudge.js';

const mk = (id, rol, w, d, extra = {}) => ({ id, relation_role: rol, w, d, functional_group_id: 'g', zone_id: 'Z', ...extra });

describe('P0.2c · GAP20 · circulación INTRA-KIT ≠ pasillo INTER-KIT', () => {
  it('DOUBLE_FACE 8 (bien colocado): NO hay CIRCULATION_TIGHT intra-kit', () => {
    const areas = [{ nombre: 'Z', zone_id: 'Z', tipo: 'open', ancho: 7000, largo: 4000 }];
    const piezas = [mk('b', 'ANCHOR_WORKSTATION', 6000, 1400, { user_capacity: 8, placement_profile: { topology: 'DOUBLE_FACE', provenance: 'USER_CONFIRMED', version: 'PP_V1' } }), ...Array.from({ length: 8 }, (_, i) => mk('s' + i, 'WORK_SEAT', 600, 600))];
    const m = resolverKitsMulti(areas, piezas);
    const circ = invariantesCirculacion(areas, m.piezas, m.colocacion);
    expect(circ.length).toBe(0);
  });

  it('MEETING 10 (bien colocado): NO hay CIRCULATION_TIGHT entre sillas/mesa del mismo kit', () => {
    const areas = [{ nombre: 'Z', zone_id: 'Z', tipo: 'juntas', ancho: 6000, largo: 4000 }];
    const piezas = [mk('m', 'ANCHOR_MEETING', 3000, 1200, { user_capacity: 10, placement_profile: { topology: 'MEETING_TABLE', provenance: 'CATALOG', version: 'PP_V1' } }), ...Array.from({ length: 10 }, (_, i) => mk('s' + i, 'MEETING_SEAT', 600, 600))];
    const m = resolverKitsMulti(areas, piezas);
    const circ = invariantesCirculacion(areas, m.piezas, m.colocacion);
    expect(circ.length).toBe(0);
    expect(evaluarRecovery(areas, m.piezas, m.colocacion).status).toBe('PASS');
  });

  it('dos kits DISTINTOS a <1000 mm → SÍ CIRCULATION_TIGHT (inter-kit)', () => {
    const areas = [{ nombre: 'Z', zone_id: 'Z', tipo: 'open', ancho: 6000, largo: 3000 }];
    // dos anclas de grupos funcionales distintos, enfrentadas con hueco 500 mm.
    const piezas = [
      { id: 'a1', relation_role: 'ANCHOR_DESK', w: 1000, d: 1000, functional_group_id: 'g1', zone_id: 'Z' },
      { id: 'a2', relation_role: 'ANCHOR_DESK', w: 1000, d: 1000, functional_group_id: 'g2', zone_id: 'Z' },
    ];
    const colocacion = [
      { id: 'a1', area: 0, x: 0, y: 0, rot: 0 },
      { id: 'a2', area: 0, x: 1500, y: 0, rot: 0 },   // hueco 500 mm en x
    ];
    const circ = invariantesCirculacion(areas, piezas, colocacion);
    expect(circ.length).toBeGreaterThan(0);
    expect(circ[0].code).toBe('CIRCULATION_TIGHT');
    expect(circ[0].scope).toBe('INTER_KIT');
  });

  it('GAP30 · DOS anclas del MISMO functional_group_id son kits distintos → SÍ aisle inter-kit', () => {
    const areas = [{ nombre: 'Z', zone_id: 'Z', tipo: 'open', ancho: 6000, largo: 3000 }];
    // mismo functional_group_id 'g' pero DOS anclas → dos kits físicos.
    const piezas = [
      { id: 'A1', relation_role: 'ANCHOR_DESK', w: 1000, d: 1000, functional_group_id: 'g', zone_id: 'Z' },
      { id: 'A2', relation_role: 'ANCHOR_DESK', w: 1000, d: 1000, functional_group_id: 'g', zone_id: 'Z' },
    ];
    const colocacion = [
      { id: 'A1', area: 0, x: 0, y: 0, rot: 0 },
      { id: 'A2', area: 0, x: 1500, y: 0, rot: 0 },   // hueco 500 mm entre dos ANCLAS
    ];
    const circ = invariantesCirculacion(areas, piezas, colocacion);
    expect(circ.length).toBeGreaterThan(0);           // NO exentas por compartir grupo
    expect(circ[0].scope).toBe('INTER_KIT');
  });

  it('GAP30 · un ancla + SUS dependientes (mismo grupo) → NO aisle intra-kit', () => {
    const areas = [{ nombre: 'Z', zone_id: 'Z', tipo: 'open', ancho: 6000, largo: 3000 }];
    const piezas = [
      { id: 'A1', relation_role: 'ANCHOR_WORKSTATION', w: 1000, d: 1000, functional_group_id: 'g', zone_id: 'Z' },
      { id: 'A2', relation_role: 'ANCHOR_WORKSTATION', w: 1000, d: 1000, functional_group_id: 'g', zone_id: 'Z' },
      { id: 's1', relation_role: 'WORK_SEAT', w: 600, d: 600, functional_group_id: 'g', anchor_instance_id: 'A1', zone_id: 'Z' },
    ];
    const colocacion = [
      { id: 'A1', area: 0, x: 0, y: 0, rot: 0 },
      { id: 's1', area: 0, x: 1200, y: 0, rot: 0 },   // dep de A1 a 200 mm de A1 → intra-kit, OK
      { id: 'A2', area: 0, x: 4000, y: 0, rot: 0 },   // lejos, no interfiere
    ];
    const circ = invariantesCirculacion(areas, piezas, colocacion);
    // s1 pertenece a A1 (su ancla) → NO aisle con A1.
    expect(circ.some((i) => String(i.id).includes('s1') && String(i.id).includes('A1'))).toBe(false);
  });

  it('dos piezas del MISMO grupo a <1000 mm → NO CIRCULATION_TIGHT', () => {
    const areas = [{ nombre: 'Z', zone_id: 'Z', tipo: 'open', ancho: 6000, largo: 3000 }];
    const piezas = [
      { id: 'a1', relation_role: 'ANCHOR_WORKSTATION', w: 1000, d: 1000, functional_group_id: 'g', zone_id: 'Z' },
      { id: 's1', relation_role: 'WORK_SEAT', w: 600, d: 600, functional_group_id: 'g', anchor_instance_id: 'a1', zone_id: 'Z' },
    ];
    const colocacion = [
      { id: 'a1', area: 0, x: 0, y: 0, rot: 0 },
      { id: 's1', area: 0, x: 1200, y: 0, rot: 0 },   // hueco 200 mm, pero MISMO grupo
    ];
    expect(invariantesCirculacion(areas, piezas, colocacion).length).toBe(0);
  });
});

describe('P0.2c · GAP23 · QualityJudge symmetry por TOPOLOGÍA', () => {
  it('MEETING 10 canónico 4+4+1+1 → symmetry ≈ 1 (no 0.25)', () => {
    const areas = [{ nombre: 'Z', zone_id: 'Z', tipo: 'juntas', ancho: 6000, largo: 4000 }];
    const piezas = [mk('m', 'ANCHOR_MEETING', 3000, 1200, { user_capacity: 10, placement_profile: { topology: 'MEETING_TABLE', provenance: 'CATALOG', version: 'PP_V1' } }), ...Array.from({ length: 10 }, (_, i) => mk('s' + i, 'MEETING_SEAT', 600, 600))];
    const m = resolverKitsMulti(areas, piezas);
    const sem = juzgarSemantico(areas, m.piezas, m.colocacion);
    const q = juzgarCalidad(areas, m.piezas, m.colocacion, { semantic: sem });
    expect(q.components.symmetry.score).toBeGreaterThanOrEqual(0.99);
    const sides = {};
    for (const c of m.colocacion.filter((c) => c.side)) sides[c.side] = (sides[c.side] || 0) + 1;
    expect(sides).toEqual({ A: 4, B: 4, HEAD_A: 1, HEAD_B: 1 });
  });

  it('DOUBLE_FACE desbalanceado (sintético 3 vs 1) → symmetry < 1', () => {
    const areas = [{ nombre: 'Z', zone_id: 'Z', tipo: 'open', ancho: 7000, largo: 4000 }];
    const piezas = [mk('b', 'ANCHOR_WORKSTATION', 3000, 1400, { user_capacity: 4 }), ...Array.from({ length: 4 }, (_, i) => mk('s' + i, 'WORK_SEAT', 600, 600, { anchor_instance_id: 'b' }))];
    const colocacion = [
      { id: 'b', area: 0, x: 1000, y: 1500, rot: 0, topology: 'DOUBLE_FACE' },
      { id: 's0', area: 0, x: 1000, y: 900, rot: 0, side: 'A', facing: 'DOWN', anchor_instance_id: 'b' },
      { id: 's1', area: 0, x: 1650, y: 900, rot: 0, side: 'A', facing: 'DOWN', anchor_instance_id: 'b' },
      { id: 's2', area: 0, x: 2300, y: 900, rot: 0, side: 'A', facing: 'DOWN', anchor_instance_id: 'b' },
      { id: 's3', area: 0, x: 1000, y: 2900, rot: 0, side: 'B', facing: 'UP', anchor_instance_id: 'b' },
    ];
    const q = juzgarCalidad(areas, piezas, colocacion, { semantic: { issues: [] } });
    expect(q.components.symmetry.score).toBeLessThan(1);  // A=3, B=1 → 1/3
  });
});
