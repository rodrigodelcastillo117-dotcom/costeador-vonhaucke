import { describe, it, expect } from 'vitest';
import { layoutDoubleFace, layoutMeeting } from '../../supabase/functions/acomodar-espacio-recovery/placementProfiles.js';
import { juzgarSemantico, esFinalValido } from '../../supabase/functions/acomodar-espacio-recovery/semanticPlacementJudge.js';

// ============================================================================
//  P0.2c · BLOCK 3 · SEMANTIC PLACEMENT JUDGE — unit tests (§21 + GAP8/GAP9).
// ============================================================================
function dobleFace(ox, oy, aw, ad, n, { topology = 'DOUBLE_FACE' } = {}) {
  const lay = layoutDoubleFace(aw, ad, n);
  const piezas = [{ id: 'b', relation_role: 'ANCHOR_WORKSTATION', w: aw, d: ad }];
  const col = [{ id: 'b', area: 0, x: ox + lay.anchor.dx, y: oy + lay.anchor.dy, rot: 0, topology, anchor_instance_id: null }];
  lay.seats.forEach((s, i) => {
    piezas.push({ id: 's' + i, relation_role: 'WORK_SEAT', w: 600, d: 600, anchor_instance_id: 'b' });
    col.push({ id: 's' + i, area: 0, x: ox + s.dx, y: oy + s.dy, rot: 0, side: s.side, facing: s.facing, slot_id: s.slot_id, anchor_instance_id: 'b' });
  });
  return { piezas, col };
}
function mesa(ox, oy, aw, ad, n) {
  const lay = layoutMeeting(aw, ad, n);
  const piezas = [{ id: 'm', relation_role: 'ANCHOR_MEETING', w: aw, d: ad }];
  const col = [{ id: 'm', area: 0, x: ox + lay.anchor.dx, y: oy + lay.anchor.dy, rot: 0, topology: 'MEETING_TABLE', anchor_instance_id: null }];
  lay.seats.forEach((s, i) => {
    piezas.push({ id: 's' + i, relation_role: 'MEETING_SEAT', w: 600, d: 600, anchor_instance_id: 'm' });
    col.push({ id: 's' + i, area: 0, x: ox + s.dx, y: oy + s.dy, rot: 0, side: s.side, facing: s.facing, slot_id: s.slot_id, anchor_instance_id: 'm' });
  });
  return { piezas, col };
}
const AREA = (ancho, largo, extra = {}) => [{ nombre: 'Z', zone_id: 'Z', tipo: 'open', ancho, largo, ...extra }];
const codes = (r) => r.issues.map((i) => i.code);

describe('P0.2c · Semantic Judge · acceso + orientación', () => {
  it('A · DOUBLE_FACE 8 (4+4) con acceso libre → PASS', () => {
    const { piezas, col } = dobleFace(0, 1000, 6000, 1200, 8);
    const r = juzgarSemantico(AREA(7000, 5000), piezas, col);
    expect(r.status).toBe('PASS');
    expect(esFinalValido('PASS', r)).toBe(true);
  });
  it('C · lado activo pegado al muro (flush) → ACTIVE_SIDE_BLOCKED_BY_WALL, FAIL', () => {
    const { piezas, col } = dobleFace(0, 0, 6000, 1200, 8);
    const r = juzgarSemantico(AREA(7000, 5000), piezas, col);
    expect(r.status).toBe('FAIL');
    expect(codes(r)).toContain('ACTIVE_SIDE_BLOCKED_BY_WALL');
  });
  it('B · orientación incorrecta de un lado → DEPENDENT_WRONG_ORIENTATION, FAIL', () => {
    const { piezas, col } = dobleFace(0, 1000, 6000, 1200, 8);
    for (const c of col) if (c.side === 'B') c.facing = 'DOWN';
    const r = juzgarSemantico(AREA(7000, 5000), piezas, col);
    expect(r.status).toBe('FAIL');
    expect(codes(r)).toContain('DEPENDENT_WRONG_ORIENTATION');
  });
  it('Q · topología UNKNOWN → REVIEW_REQUIRED', () => {
    const { piezas, col } = dobleFace(0, 1000, 6000, 1200, 8, { topology: 'UNKNOWN' });
    const r = juzgarSemantico(AREA(7000, 5000), piezas, col);
    expect(r.status).toBe('REVIEW_REQUIRED');
    expect(codes(r)).toContain('SEMANTIC_PROFILE_UNKNOWN');
  });
});

describe('P0.2c · Semantic Judge · GAP8 (HEAD de junta es ASIENTO activo)', () => {
  it('MEETING 10 con acceso libre (heads incluidos) → PASS', () => {
    const { piezas, col } = mesa(1000, 1000, 3000, 1200, 10);
    expect(juzgarSemantico(AREA(8000, 6000), piezas, col).status).toBe('PASS');
  });
  it('HEAD_A inutilizable contra muro → FAIL (ya NO es pasivo)', () => {
    const { piezas, col } = mesa(0, 1000, 3000, 1200, 10);   // head_A en x=0
    const r = juzgarSemantico(AREA(8000, 6000), piezas, col);
    expect(r.status).toBe('FAIL');
    expect(r.issues.some((i) => i.code === 'ACTIVE_SIDE_BLOCKED_BY_WALL' && i.side === 'HEAD_A')).toBe(true);
  });
  it('HEAD_B inutilizable contra obstáculo → FAIL', () => {
    const { piezas, col } = mesa(1000, 1000, 3000, 1200, 10);
    const area = AREA(8000, 6000, { obstaculos: [{ x: 5200, y: 1000, w: 400, h: 3000 }] });
    const r = juzgarSemantico(area, piezas, col);
    expect(r.issues.some((i) => i.code === 'ACTIVE_SIDE_BLOCKED_BY_OBSTACLE' && i.side === 'HEAD_B')).toBe(true);
  });
  it('D · extremo del ANCLA (bench) contra muro, SIN silla en ese extremo → PASS', () => {
    const { piezas, col } = dobleFace(1000, 1000, 6000, 1200, 8);   // extremo der en x=7000 = muro
    const r = juzgarSemantico(AREA(7000, 5000), piezas, col);
    expect(r.status).toBe('PASS');
  });
});

describe('P0.2c · Semantic Judge · GAP9 (slots requeridos / mal slot / topología)', () => {
  it('SLOT_UNFILLED_REQUIRED: falta un asiento requerido → FAIL', () => {
    const { piezas, col } = dobleFace(0, 1000, 6000, 1200, 8);
    const col2 = col.filter((c) => c.id !== 's0');
    const r = juzgarSemantico(AREA(7000, 5000), piezas, col2);
    expect(codes(r)).toContain('SLOT_UNFILLED_REQUIRED');
    expect(r.status).toBe('FAIL');
  });
  it('DEPENDENT_WRONG_SLOT: silla en un slot que no existe en el profile → FAIL', () => {
    const { piezas, col } = dobleFace(0, 1000, 6000, 1200, 8);
    col.find((c) => c.id === 's0').slot_id = 'slot_inexistente';
    const r = juzgarSemantico(AREA(7000, 5000), piezas, col);
    expect(codes(r)).toContain('DEPENDENT_WRONG_SLOT');
    expect(r.status).toBe('FAIL');
  });
  it('SLOT_DOUBLE_OCCUPIED: dos sillas en el mismo slot → FAIL', () => {
    const { piezas, col } = dobleFace(0, 1000, 6000, 1200, 8);
    col.find((c) => c.id === 's1').slot_id = col.find((c) => c.id === 's0').slot_id;
    const r = juzgarSemantico(AREA(7000, 5000), piezas, col);
    expect(codes(r)).toContain('SLOT_DOUBLE_OCCUPIED');
  });
  it('ANCHOR_TOPOLOGY_BROKEN: DOUBLE_FACE con todas las sillas de un lado → FAIL', () => {
    const { piezas, col } = dobleFace(0, 1000, 6000, 1200, 8);
    for (const c of col) if (c.side === 'B') c.side = 'A';
    const r = juzgarSemantico(AREA(7000, 5000), piezas, col);
    expect(codes(r)).toContain('ANCHOR_TOPOLOGY_BROKEN');
    expect(r.status).toBe('FAIL');
  });
  it('KIT_FUNCTIONAL_RELATION_BROKEN: MEETING_SEAT en ancla de workstation → FAIL', () => {
    const { piezas, col } = dobleFace(0, 1000, 6000, 1200, 8);
    piezas.find((p) => p.id === 's0').relation_role = 'MEETING_SEAT';
    const r = juzgarSemantico(AREA(7000, 5000), piezas, col);
    expect(codes(r)).toContain('KIT_FUNCTIONAL_RELATION_BROKEN');
    expect(r.status).toBe('FAIL');
  });
});

describe('P0.2c · Semantic Judge · GAP12 (hard vs quality clearance)', () => {
  it('acceso estrecho (0 < clear < 600) → QUALITY, NO fail (sigue PASS)', () => {
    const { piezas, col } = dobleFace(0, 300, 6000, 1200, 8);
    const r = juzgarSemantico(AREA(7000, 5000), piezas, col);
    expect(r.status).toBe('PASS');
    expect(r.issues.some((i) => i.code === 'ACTIVE_SIDE_ACCESS_TIGHT' && i.severity === 'quality')).toBe(true);
  });
});
