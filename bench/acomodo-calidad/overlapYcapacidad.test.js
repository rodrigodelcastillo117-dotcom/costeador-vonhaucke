import { describe, it, expect } from 'vitest';
import { evaluarRecovery } from '../../supabase/functions/acomodar-espacio-recovery/recovery-core.js';
import { juzgar } from '../acomodo/judge.js';   // juez NEUTRAL congelado

const AREA = [{ nombre: 'Z', zone_id: 'Z', tipo: 'open', ancho: 8000, largo: 6000 }];
const hasOverlap = (er) => (er.issues || []).some((i) => i.code === 'OVERLAP');
const neutralPASS = (piezas, col) => juzgar(AREA, piezas, col).status === 'PASS';
const recOverlap = (piezas, col) => hasOverlap(evaluarRecovery(AREA, piezas, col, { requested: piezas.length }));

describe('P0.2c · GAP44/GAP48 · overlap LEGAL sólo gaveta↔su propio anchor (hard = juez neutral)', () => {
  it('gaveta BAJO su propio anchor → recovery NO OVERLAP y neutral PASS', () => {
    const piezas = [
      { id: 'b', relation_role: 'ANCHOR_WORKSTATION', w: 2000, d: 800, functional_group_id: 'g', zone_id: 'Z' },
      { id: 'gv', relation_role: 'UNDERDESK_STORAGE', w: 400, d: 500, functional_group_id: 'g', anchor_instance_id: 'b', zone_id: 'Z' },
    ];
    const col = [
      { id: 'b', area: 0, x: 1000, y: 1000, rot: 0 },
      { id: 'gv', area: 0, x: 1100, y: 1100, rot: 0 },   // dentro de la huella del bench
    ];
    expect(recOverlap(piezas, col)).toBe(false);          // overlap LEGAL
    expect(neutralPASS(piezas, col)).toBe(true);          // el neutral también lo acepta
  });

  it('dos sillas mismo kit, slot_id DISTINTO + metadata coherente, misma coordenada → HARD FAIL', () => {
    // El SemanticJudge valida slot/side/facing pero NO prueba la coordenada física; el HARD
    // gate SÍ: dos sillas con slot_ids distintos y facing coherente, pero físicamente encimadas.
    const piezas = [
      { id: 'b', relation_role: 'ANCHOR_WORKSTATION', w: 2000, d: 800, functional_group_id: 'g', zone_id: 'Z' },
      { id: 's0', relation_role: 'WORK_SEAT', w: 600, d: 600, functional_group_id: 'g', anchor_instance_id: 'b', zone_id: 'Z', slot_id: 'A0', side: 'A', facing: 'UP' },
      { id: 's1', relation_role: 'WORK_SEAT', w: 600, d: 600, functional_group_id: 'g', anchor_instance_id: 'b', zone_id: 'Z', slot_id: 'A1', side: 'A', facing: 'UP' },
    ];
    const col = [
      { id: 'b', area: 0, x: 1000, y: 1000, rot: 0 },
      { id: 's0', area: 0, x: 1000, y: 2000, rot: 0, slot_id: 'A0', side: 'A', facing: 'UP' },
      { id: 's1', area: 0, x: 1000, y: 2000, rot: 0, slot_id: 'A1', side: 'A', facing: 'UP' },   // MISMA coordenada
    ];
    expect(recOverlap(piezas, col)).toBe(true);           // NO exento por ser "mismo kit"
    expect(neutralPASS(piezas, col)).toBe(false);         // el neutral también lo rechaza
  });

  it('dependientes que comparten SÓLO functional_group_id (sin ownership gaveta↔anchor) → HARD FAIL', () => {
    // GAP44 #5: compartir functional_group_id NO otorga exemption. Dos sillas encimadas.
    const piezas = [
      { id: 's0', relation_role: 'WORK_SEAT', w: 600, d: 600, functional_group_id: 'g', zone_id: 'Z' },
      { id: 's1', relation_role: 'WORK_SEAT', w: 600, d: 600, functional_group_id: 'g', zone_id: 'Z' },
    ];
    const col = [
      { id: 's0', area: 0, x: 1000, y: 1000, rot: 0 },
      { id: 's1', area: 0, x: 1050, y: 1050, rot: 0 },   // encimadas, mismo grupo, sin ancla
    ];
    expect(recOverlap(piezas, col)).toBe(true);
  });

  it('silla vs su anchor (encimada) → recovery OVERLAP (silla NO es gaveta)', () => {
    const piezas = [
      { id: 'b', relation_role: 'ANCHOR_WORKSTATION', w: 2000, d: 800, functional_group_id: 'g', zone_id: 'Z' },
      { id: 's0', relation_role: 'WORK_SEAT', w: 600, d: 600, functional_group_id: 'g', anchor_instance_id: 'b', zone_id: 'Z' },
    ];
    const col = [
      { id: 'b', area: 0, x: 1000, y: 1000, rot: 0 },
      { id: 's0', area: 0, x: 1100, y: 1100, rot: 0 },   // silla encima del tablero
    ];
    expect(recOverlap(piezas, col)).toBe(true);
    expect(neutralPASS(piezas, col)).toBe(false);
  });

  it('gaveta de A1 encimada sobre el anchor A2 (otro kit) → recovery OVERLAP', () => {
    const piezas = [
      { id: 'A1', relation_role: 'ANCHOR_WORKSTATION', w: 2000, d: 800, functional_group_id: 'g', zone_id: 'Z' },
      { id: 'A2', relation_role: 'ANCHOR_WORKSTATION', w: 2000, d: 800, functional_group_id: 'g', zone_id: 'Z' },
      { id: 'gv1', relation_role: 'UNDERDESK_STORAGE', w: 400, d: 500, functional_group_id: 'g', anchor_instance_id: 'A1', zone_id: 'Z' },
    ];
    const col = [
      { id: 'A1', area: 0, x: 500, y: 500, rot: 0 },
      { id: 'A2', area: 0, x: 4000, y: 500, rot: 0 },
      { id: 'gv1', area: 0, x: 4100, y: 600, rot: 0 },   // gaveta de A1 sobre A2 → ilegal
    ];
    expect(recOverlap(piezas, col)).toBe(true);           // no es "su propio anchor"
  });
});

describe('P0.2c · GAP45 · user_capacity (máximo) ≠ required_seats (demanda explícita)', () => {
  const area = [{ nombre: 'Z', zone_id: 'Z', tipo: 'juntas', ancho: 8000, largo: 6000 }];
  const mesa = (extra) => {
    const piezas = [
      { id: 'm', relation_role: 'ANCHOR_MEETING', w: 2400, d: 1200, functional_group_id: 'g', zone_id: 'Z', ...extra },
      ...Array.from({ length: 4 }, (_, i) => ({ id: 's' + i, relation_role: 'MEETING_SEAT', w: 600, d: 600, functional_group_id: 'g', anchor_instance_id: 'm', zone_id: 'Z' })),
    ];
    const col = [
      { id: 'm', area: 0, x: 2000, y: 2000, rot: 0 },
      { id: 's0', area: 0, x: 2000, y: 1300, rot: 0 }, { id: 's1', area: 0, x: 2700, y: 1300, rot: 0 },
      { id: 's2', area: 0, x: 2000, y: 3300, rot: 0 }, { id: 's3', area: 0, x: 2700, y: 3300, rot: 0 },
    ];
    return { piezas, col };
  };
  const hasIncomplete = (er) => (er.issues || []).some((i) => i.code === 'GROUP_CAPACITY_INCOMPLETE');

  it('user_capacity=8 + 4 sillas (sin demanda explícita) → VÁLIDO (no INCOMPLETE)', () => {
    const { piezas, col } = mesa({ user_capacity: 8 });
    expect(hasIncomplete(evaluarRecovery(area, piezas, col, { requested: piezas.length }))).toBe(false);
  });

  it('required_seats=8 + sólo 4 sillas → INCOMPLETE (demanda explícita no satisfecha)', () => {
    const { piezas, col } = mesa({ user_capacity: 8, required_seats: 8 });
    expect(hasIncomplete(evaluarRecovery(area, piezas, col, { requested: piezas.length }))).toBe(true);
  });
});
