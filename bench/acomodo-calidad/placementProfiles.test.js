import { describe, it, expect } from 'vitest';
import { perfilDeAncla, layoutDoubleFace, layoutMeeting, PROFILE_VERSION } from '../../supabase/functions/acomodar-espacio-recovery/placementProfiles.js';

// ============================================================================
//  P0.2c · PLACEMENT PROFILES — precedencia de provenance y NO-inferencia por
//  capacidad. La topología sólo es DOUBLE_FACE si el ancla la DECLARA.
// ============================================================================
describe('P0.2c · perfilDeAncla · provenance + no inferir por capacidad', () => {
  it('capacity=8 sin topología declarada → SINGLE_FACE curado (NUNCA double-face por capacidad)', () => {
    const p = perfilDeAncla({ relation_role: 'ANCHOR_WORKSTATION', user_capacity: 8 });
    expect(p.topology).toBe('SINGLE_FACE');
    expect(p.provenance).toBe('CURATED_RULE');
    expect(p.version).toBe(PROFILE_VERSION);
  });
  it('topología DECLARADA (catálogo) gana sobre la regla por rol', () => {
    const p = perfilDeAncla({ relation_role: 'ANCHOR_WORKSTATION', topology: 'DOUBLE_FACE', topology_source: 'CATALOG' });
    expect(p.topology).toBe('DOUBLE_FACE');
    expect(p.provenance).toBe('CATALOG');
    expect(p.confidence).toBe(1);
  });
  it('mesa → MEETING_TABLE curada; escritorio → DESK; recepción → RECEPTION', () => {
    expect(perfilDeAncla({ relation_role: 'ANCHOR_MEETING' }).topology).toBe('MEETING_TABLE');
    expect(perfilDeAncla({ relation_role: 'ANCHOR_DESK' }).topology).toBe('DESK');
    expect(perfilDeAncla({ relation_role: 'ANCHOR_RECEPTION' }).topology).toBe('RECEPTION');
  });
  it('rol desconocido → UNKNOWN (sin inventar topología)', () => {
    const p = perfilDeAncla({ relation_role: 'ANCHOR_RARO' });
    expect(p.topology).toBe('UNKNOWN');
    expect(p.provenance).toBe('UNKNOWN');
    expect(p.confidence).toBe(0);
  });
  it('topología inválida declarada se ignora → cae a la regla por rol', () => {
    const p = perfilDeAncla({ relation_role: 'ANCHOR_WORKSTATION', topology: 'NO_EXISTE' });
    expect(p.topology).toBe('SINGLE_FACE');
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
