import { describe, it, expect } from 'vitest';
import { perfilDeAncla, resolvePlacementProfile, layoutDoubleFace, layoutMeeting, PROFILE_VERSION } from '../../supabase/functions/acomodar-espacio-recovery/placementProfiles.js';

// ============================================================================
//  P0.2c · PLACEMENT PROFILES — precedencia de provenance y NO-inferencia por
//  capacidad. La topología sólo es DOUBLE_FACE si el ancla la DECLARA. (GAP4/GAP5)
// ============================================================================
describe('P0.2c · perfilDeAncla · GAP4 (UNKNOWN ≠ verdad curada)', () => {
  it('capacity=8 sin topología declarada → UNKNOWN + fallback LEGACY (NUNCA SINGLE_FACE "curado")', () => {
    const p = perfilDeAncla({ relation_role: 'ANCHOR_WORKSTATION', user_capacity: 8 });
    expect(p.topology).toBe('UNKNOWN');
    expect(p.provenance).toBe('UNKNOWN');
    expect(p.confidence).toBe(0);
    expect(p.fallback_layout_strategy).toBe('LEGACY_SINGLE_FACE');
    expect(p.version).toBe(PROFILE_VERSION);
  });
  it('bench declarado DOUBLE_FACE (USER_CONFIRMED de Rodrigo) → DOUBLE_FACE', () => {
    const p = perfilDeAncla({ relation_role: 'ANCHOR_WORKSTATION', topology: 'DOUBLE_FACE', topology_source: 'USER_CONFIRMED' });
    expect(p.topology).toBe('DOUBLE_FACE');
    expect(p.provenance).toBe('USER_CONFIRMED');
  });
  it('topología DECLARADA (catálogo) gana sobre la regla por rol', () => {
    const p = perfilDeAncla({ relation_role: 'ANCHOR_MEETING', topology: 'MEETING_TABLE', topology_source: 'CATALOG' });
    expect(p.provenance).toBe('CATALOG');
  });
  it('mesa → MEETING_TABLE curada; escritorio → DESK; recepción → RECEPTION', () => {
    expect(perfilDeAncla({ relation_role: 'ANCHOR_MEETING' }).topology).toBe('MEETING_TABLE');
    expect(perfilDeAncla({ relation_role: 'ANCHOR_DESK' }).topology).toBe('DESK');
    expect(perfilDeAncla({ relation_role: 'ANCHOR_RECEPTION' }).topology).toBe('RECEPTION');
  });
  it('rol desconocido → UNKNOWN (sin inventar topología)', () => {
    expect(perfilDeAncla({ relation_role: 'ANCHOR_RARO' }).topology).toBe('UNKNOWN');
  });
  it('topología inválida declarada se ignora → UNKNOWN para workstation (sin regla curada)', () => {
    expect(perfilDeAncla({ relation_role: 'ANCHOR_WORKSTATION', topology: 'NO_EXISTE' }).topology).toBe('UNKNOWN');
  });
});

describe('P0.2c · resolvePlacementProfile · precedencia determinista (GAP5)', () => {
  const C = (topology, provenance, confidence = 1) => ({ topology, provenance, confidence });
  it('CATALOG vs USER_CONFIRMED → gana CATALOG', () => {
    expect(resolvePlacementProfile([C('SINGLE_FACE', 'USER_CONFIRMED'), C('DOUBLE_FACE', 'CATALOG')]).provenance).toBe('CATALOG');
  });
  it('CURATED_RULE vs INFERRED → gana CURATED_RULE', () => {
    expect(resolvePlacementProfile([C('MEETING_TABLE', 'INFERRED'), C('MEETING_TABLE', 'CURATED_RULE')]).provenance).toBe('CURATED_RULE');
  });
  it('USER_CONFIRMED vs INFERRED → gana USER_CONFIRMED', () => {
    expect(resolvePlacementProfile([C('DOUBLE_FACE', 'INFERRED'), C('DOUBLE_FACE', 'USER_CONFIRMED')]).provenance).toBe('USER_CONFIRMED');
  });
  it('UNKNOWN nunca pisa: [UNKNOWN, INFERRED] → gana INFERRED', () => {
    expect(resolvePlacementProfile([C('SINGLE_FACE', 'UNKNOWN'), C('SINGLE_FACE', 'INFERRED')]).provenance).toBe('INFERRED');
  });
  it('sin candidatos válidos → UNKNOWN + fallback LEGACY', () => {
    const r = resolvePlacementProfile([]);
    expect(r.topology).toBe('UNKNOWN');
    expect(r.fallback_layout_strategy).toBe('LEGACY_SINGLE_FACE');
  });
  it('determinista: mismo input → mismo ganador', () => {
    const cands = [C('SINGLE_FACE', 'CURATED_RULE', 0.9), C('DOUBLE_FACE', 'CURATED_RULE', 0.9)];
    expect(resolvePlacementProfile(cands)).toEqual(resolvePlacementProfile(cands.slice().reverse()));
  });
});

describe('P0.2c · layouts de topología', () => {
  it('DOUBLE_FACE 8 → 4 lado A + 4 lado B con slot_id/side/facing', () => {
    const l = layoutDoubleFace(6000, 1200, 8);
    expect(l.seats.filter((s) => s.side === 'A').length).toBe(4);
    expect(l.seats.filter((s) => s.side === 'B').length).toBe(4);
    expect(l.activeSides).toEqual(['A', 'B']);
    expect(l.seats.every((s) => s.slot_id && s.facing)).toBe(true);
  });
  it('MEETING 10 → 4 + 4 + cabecera A + cabecera B', () => {
    const l = layoutMeeting(5000, 1200, 10);
    expect(l.seats.filter((s) => s.side === 'A').length).toBe(4);
    expect(l.seats.filter((s) => s.side === 'B').length).toBe(4);
    expect(l.seats.filter((s) => s.side === 'HEAD_A').length).toBe(1);
    expect(l.seats.filter((s) => s.side === 'HEAD_B').length).toBe(1);
  });
});
