import { describe, it, expect } from 'vitest';
import { resolverKits } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';
import { rotarFacing, layoutDoubleFace, layoutMeeting, SEAT } from '../../supabase/functions/acomodar-espacio-recovery/placementProfiles.js';

// ============================================================================
//  P0.2c · GAP2 (metadata semántica llega a la salida final de resolverKits) +
//  GAP3 (rotarFacing determinista y consistente con la geometría).
// ============================================================================
const mk = (id, rol, w, d, extra = {}) => ({ id, relation_role: rol, w, d, functional_group_id: 'g', zone_id: 'Z', ...extra });

function correr(anchor, nSeats, seatRol, area) {
  const sillas = Array.from({ length: nSeats }, (_, i) => mk('s' + i, seatRol, 600, 600));
  const r = resolverKits([area], [anchor, ...sillas]);
  const seats = r.colocacion.filter((c) => c.side && c.side !== 'FRONT');
  return { r, seats };
}

describe('P0.2c · GAP2 · la salida de resolverKits conserva slot/side/facing/anchor', () => {
  it('BENCH DOUBLE_FACE 8 → 4 side=A + 4 side=B, con slot_id + anchor_instance_id + facing', () => {
    const anchor = mk('b', 'ANCHOR_WORKSTATION', 6000, 1200, { user_capacity: 8, topology: 'DOUBLE_FACE', topology_source: 'USER_CONFIRMED' });
    const { seats } = correr(anchor, 8, 'WORK_SEAT', { nombre: 'Z', zone_id: 'Z', tipo: 'open', ancho: 12000, largo: 8000 });
    expect(seats.length).toBe(8);
    expect(seats.filter((c) => c.side === 'A').length).toBe(4);
    expect(seats.filter((c) => c.side === 'B').length).toBe(4);
    expect(seats.every((c) => c.slot_id)).toBe(true);
    expect(seats.every((c) => c.anchor_instance_id === 'b')).toBe(true);
    expect(seats.every((c) => c.facing)).toBe(true);
    expect(new Set(seats.map((c) => c.slot_id)).size).toBe(8);   // slots únicos
  });

  it('MEETING 10 → 4 A + 4 B + 1 HEAD_A + 1 HEAD_B, slots únicos, unidos al ancla', () => {
    const anchor = mk('m', 'ANCHOR_MEETING', 3000, 1200, { user_capacity: 10 });
    const { seats } = correr(anchor, 10, 'MEETING_SEAT', { nombre: 'Z', zone_id: 'Z', tipo: 'juntas', ancho: 9000, largo: 7000 });
    expect(seats.filter((c) => c.side === 'A').length).toBe(4);
    expect(seats.filter((c) => c.side === 'B').length).toBe(4);
    expect(seats.filter((c) => c.side === 'HEAD_A').length).toBe(1);
    expect(seats.filter((c) => c.side === 'HEAD_B').length).toBe(1);
    expect(seats.every((c) => c.anchor_instance_id === 'm')).toBe(true);
    expect(new Set(seats.map((c) => c.slot_id)).size).toBe(10);
  });
});

// Dirección del facing cardinal como vector (y hacia abajo, convención del solver).
const apuntaAlAncla = (seat, anchor, facing) => {
  const cx = seat.dx + seat.w / 2, cy = seat.dy + seat.d / 2;
  const ax = anchor.dx + anchor.w / 2, ay = anchor.dy + anchor.d / 2;
  if (facing === 'UP') return ay < cy;
  if (facing === 'DOWN') return ay > cy;
  if (facing === 'LEFT') return ax < cx;
  if (facing === 'RIGHT') return ax > cx;
  return false;
};
// Rotación 90° de un rect con la convención de rotarKit: (x,y,w,h)→(H-(y+h), x, h, w).
const rot90 = (p, H) => ({ dx: H - (p.dy + p.d), dy: p.dx, w: p.d, d: p.w, facing: p.facing ? rotarFacing(p.facing, 90) : undefined });

describe('P0.2c · GAP3 · rotarFacing determinista + consistente con la geometría', () => {
  it('mapeo cardinal: UP→RIGHT→DOWN→LEFT→UP', () => {
    expect(rotarFacing('UP', 90)).toBe('RIGHT');
    expect(rotarFacing('RIGHT', 90)).toBe('DOWN');
    expect(rotarFacing('DOWN', 90)).toBe('LEFT');
    expect(rotarFacing('LEFT', 90)).toBe('UP');
    expect(rotarFacing('UP', 180)).toBe('DOWN');
    expect(rotarFacing('UP', 270)).toBe('LEFT');
    expect(rotarFacing('UP', 0)).toBe('UP');
  });

  it('DOUBLE_FACE: las sillas miran a la mesa ANTES y DESPUÉS de rotar 90°; A/B siguen enfrentadas', () => {
    const lay = layoutDoubleFace(6000, 1200, 8);
    const H = lay.kitD;
    // ANTES: todas apuntan al ancla.
    for (const s of lay.seats) expect(apuntaAlAncla({ ...s, w: SEAT, d: SEAT }, lay.anchor, s.facing), `antes ${s.slot_id}`).toBe(true);
    // DESPUÉS: rotar ancla + sillas y re-verificar.
    const ancR = rot90({ ...lay.anchor }, H);
    for (const s of lay.seats) {
      const sR = rot90({ ...s, w: SEAT, d: SEAT }, H);
      expect(apuntaAlAncla(sR, ancR, sR.facing), `despues ${s.slot_id}`).toBe(true);
    }
    // A y B siguen con facings opuestos (enfrentadas) tras rotar.
    expect(rotarFacing('DOWN', 90)).not.toBe(rotarFacing('UP', 90));
  });

  it('MEETING: todas las sillas miran a la mesa tras rotar 90°', () => {
    const lay = layoutMeeting(3000, 1200, 10);
    const H = lay.kitD;
    const ancR = rot90({ ...lay.anchor }, H);
    for (const s of lay.seats) {
      const sR = rot90({ ...s, w: SEAT, d: SEAT }, H);
      expect(apuntaAlAncla(sR, ancR, sR.facing), `meeting ${s.slot_id}`).toBe(true);
    }
  });
});
