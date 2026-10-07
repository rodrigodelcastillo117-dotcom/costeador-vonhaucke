import { describe, it, expect } from 'vitest';
import { layoutDoubleFace, layoutMeeting } from '../../supabase/functions/acomodar-espacio-recovery/placementProfiles.js';
import { juzgarSemantico, esFinalValido } from '../../supabase/functions/acomodar-espacio-recovery/semanticPlacementJudge.js';

// ============================================================================
//  P0.2c · BLOCK 3 · SEMANTIC PLACEMENT JUDGE — casos semánticos (subset §21).
// ============================================================================
function dobleFace(ox, oy, aw, ad, n, { topology = 'DOUBLE_FACE' } = {}) {
  const lay = layoutDoubleFace(aw, ad, n);
  const piezas = [{ id: 'b', relation_role: 'ANCHOR_WORKSTATION', w: aw, d: ad }];
  const col = [{ id: 'b', area: 0, x: ox + lay.anchor.dx, y: oy + lay.anchor.dy, rot: 0, topology, anchor_instance_id: null }];
  lay.seats.forEach((s, i) => {
    piezas.push({ id: 's' + i, relation_role: 'WORK_SEAT', w: 600, d: 600 });
    col.push({ id: 's' + i, area: 0, x: ox + s.dx, y: oy + s.dy, rot: 0, side: s.side, facing: s.facing, slot_id: s.slot_id, anchor_instance_id: 'b' });
  });
  return { piezas, col };
}
function mesa(ox, oy, aw, ad, n) {
  const lay = layoutMeeting(aw, ad, n);
  const piezas = [{ id: 'm', relation_role: 'ANCHOR_MEETING', w: aw, d: ad }];
  const col = [{ id: 'm', area: 0, x: ox + lay.anchor.dx, y: oy + lay.anchor.dy, rot: 0, topology: 'MEETING_TABLE', anchor_instance_id: null }];
  lay.seats.forEach((s, i) => {
    piezas.push({ id: 's' + i, relation_role: 'MEETING_SEAT', w: 600, d: 600 });
    col.push({ id: 's' + i, area: 0, x: ox + s.dx, y: oy + s.dy, rot: 0, side: s.side, facing: s.facing, slot_id: s.slot_id, anchor_instance_id: 'm' });
  });
  return { piezas, col };
}
const AREA = (ancho, largo, extra = {}) => [{ nombre: 'Z', zone_id: 'Z', tipo: 'open', ancho, largo, ...extra }];

describe('P0.2c · Semantic Judge', () => {
  it('A · DOUBLE_FACE 8 correcto (4+4) con acceso libre → PASS', () => {
    const { piezas, col } = dobleFace(0, 1000, 6000, 1200, 8);
    const r = juzgarSemantico(AREA(7000, 5000), piezas, col);
    expect(r.status).toBe('PASS');
    expect(esFinalValido('PASS', r)).toBe(true);
  });

  it('C · lado activo pegado al muro (sin acceso) → ACTIVE_SIDE_BLOCKED_BY_WALL, FAIL', () => {
    const { piezas, col } = dobleFace(0, 0, 6000, 1200, 8);   // side A en y=0 → acceso cruza muro
    const r = juzgarSemantico(AREA(7000, 5000), piezas, col);
    expect(r.status).toBe('FAIL');
    expect(r.issues.map((i) => i.code)).toContain('ACTIVE_SIDE_BLOCKED_BY_WALL');
    expect(esFinalValido('PASS', r)).toBe(false);   // geometría PASS pero semántica FAIL
  });

  it('B · 8 sillas en una cara (orientación incorrecta de un lado) → FAIL', () => {
    const { piezas, col } = dobleFace(0, 1000, 6000, 1200, 8);
    for (const c of col) if (c.side === 'B') c.facing = 'DOWN';   // deberían mirar UP
    const r = juzgarSemantico(AREA(7000, 5000), piezas, col);
    expect(r.status).toBe('FAIL');
    expect(r.issues.map((i) => i.code)).toContain('DEPENDENT_WRONG_ORIENTATION');
  });

  it('Q · topología UNKNOWN → REVIEW_REQUIRED (nunca PASS silencioso)', () => {
    const { piezas, col } = dobleFace(0, 1000, 6000, 1200, 8, { topology: 'UNKNOWN' });
    const r = juzgarSemantico(AREA(7000, 5000), piezas, col);
    expect(r.status).toBe('REVIEW_REQUIRED');
    expect(r.issues.map((i) => i.code)).toContain('SEMANTIC_PROFILE_UNKNOWN');
    expect(esFinalValido('PASS', r)).toBe(false);
  });

  it('SLOT_DOUBLE_OCCUPIED → FAIL', () => {
    const { piezas, col } = dobleFace(0, 1000, 6000, 1200, 8);
    col[2].slot_id = col[1].slot_id;   // dos sillas en el mismo slot
    const r = juzgarSemantico(AREA(7000, 5000), piezas, col);
    expect(r.issues.map((i) => i.code)).toContain('SLOT_DOUBLE_OCCUPIED');
    expect(r.status).toBe('FAIL');
  });

  it('G · MEETING 10 (4+4+1+1) con acceso libre → PASS', () => {
    const { piezas, col } = mesa(1000, 1000, 3000, 1200, 10);
    const r = juzgarSemantico(AREA(8000, 6000), piezas, col);
    expect(r.status).toBe('PASS');
  });

  it('D · cabecera (HEAD) contra muro pero lados activos libres → PASS (cabecera es pasiva)', () => {
    const { piezas, col } = mesa(0, 1000, 3000, 1200, 10);
    const r = juzgarSemantico(AREA(8000, 6000), piezas, col);
    expect(r.issues.some((i) => i.code.startsWith('ACTIVE_SIDE_BLOCKED') && i.side && i.side.startsWith('HEAD'))).toBe(false);
    expect(r.status).toBe('PASS');
  });
});
