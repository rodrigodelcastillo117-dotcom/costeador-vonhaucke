import { describe, it, expect } from 'vitest';
import { BANCO } from '../../src/datos/banco.js';
import { expandirPiezas } from '../../src/datos/espacio.js';
import { clasificarFuenteTopologia, topologiaDeProducto, inventarioFuentes } from '../../src/datos/placementTopologia.js';
import { resolverKits } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';

// ============================================================================
//  P0.2c · GAP6 (producto→topología→resolverKits, SIN inyectar topology) +
//  GAP7 (rotación 90° REAL en el solver) + contrato de metadata + fuentes.
// ============================================================================

describe('P0.2c · GAP6 · topología desde el catálogo real → resolverKits', () => {
  it('App LT Bench doble (p9-app-lt-bench-doble-23340, 8 usuarios) → DOUBLE_FACE CATALOG, sin inyección', () => {
    const row = BANCO.find((p) => p.id === 'p9-app-lt-bench-doble-23340');
    expect(row, 'la fila real del catálogo existe').toBeTruthy();
    expect(row.usuarios).toBe(8);
    expect(topologiaDeProducto(row)).toEqual({ topology: 'DOUBLE_FACE', provenance: 'CATALOG', evidence: 'p9-app-lt-bench-doble-23340' });
  });

  it('E2E: partida derivada del catálogo → expandirPiezas → resolverKits → 4A + 4B', () => {
    const partidas = [
      { id: 'bd', productoId: 'p9-app-lt-bench-doble-23340', nombre: 'App LT · Bench doble', w: 4800, d: 1200, cantidad: 1, relation_role: 'ANCHOR_WORKSTATION', functional_group_id: 'g', user_capacity: 8, zone_id: 'OP' },
      ...Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, nombre: 'Silla operativa', w: 600, d: 600, cantidad: 1, relation_role: 'WORK_SEAT', functional_group_id: 'g', zone_id: 'OP' })),
    ];
    const piezas = expandirPiezas(partidas);
    const anchor = piezas.find((p) => p.relation_role === 'ANCHOR_WORKSTATION');
    expect(anchor.placement_profile).toEqual({ topology: 'DOUBLE_FACE', provenance: 'CATALOG', evidence: 'p9-app-lt-bench-doble-23340' });

    const sol = resolverKits([{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 12000, largo: 8000 }], piezas);
    const seats = sol.colocacion.filter((c) => c.side === 'A' || c.side === 'B');
    expect(seats.filter((c) => c.side === 'A').length).toBe(4);
    expect(seats.filter((c) => c.side === 'B').length).toBe(4);
    const anc = sol.colocacion.find((c) => c.id === anchor.id);
    expect(anc.topology).toBe('DOUBLE_FACE');
    expect(anc.provenance).toBe('CATALOG');
  });
});

describe('P0.2c · GAP6 · clasificación de fuentes (SOURCE_FOUND/PARTIAL/MISSING)', () => {
  it('bench doble → SOURCE_FOUND; operativo 8u sin "doble" → SOURCE_PARTIAL; silla sin dims → SOURCE_MISSING', () => {
    const benchDoble = BANCO.find((p) => p.id === 'p9-app-lt-bench-doble-23340');
    const op8 = BANCO.find((p) => p.id === 'op-8u-4800x1200-cristal');
    const silla = BANCO.find((p) => p.categoria === 'Sillería' && !p.medidas) || { categoria: 'Sillería' };
    expect(clasificarFuenteTopologia(benchDoble)).toBe('SOURCE_FOUND');
    expect(clasificarFuenteTopologia(op8)).toBe('SOURCE_PARTIAL');
    expect(clasificarFuenteTopologia(silla)).toBe('SOURCE_MISSING');
  });
  it('inventario: hay al menos una familia SOURCE_FOUND real', () => {
    const inv = inventarioFuentes();
    expect(inv.SOURCE_FOUND.some((id) => /bench-doble/.test(id))).toBe(true);
  });
});

const rectDe = (entry, pieza) => {
  const g = entry.rot === 90 || entry.rot === 270;
  return { dx: entry.x, dy: entry.y, w: g ? pieza.d : pieza.w, d: g ? pieza.w : pieza.d };
};
const apunta = (seat, anchor, facing) => {
  const cx = seat.dx + seat.w / 2, cy = seat.dy + seat.d / 2;
  const ax = anchor.dx + anchor.w / 2, ay = anchor.dy + anchor.d / 2;
  if (facing === 'UP') return ay < cy;
  if (facing === 'DOWN') return ay > cy;
  if (facing === 'LEFT') return ax < cx;
  if (facing === 'RIGHT') return ax > cx;
  return false;
};

describe('P0.2c · GAP7 · rotación 90° REAL en resolverKits', () => {
  it('área que sólo admite rot=90 → el solver elige rot=90 y conserva slot/side/facing-rotado mirando al ancla', () => {
    const piezas = [
      { id: 'b', relation_role: 'ANCHOR_WORKSTATION', functional_group_id: 'g', zone_id: 'OP', w: 6000, d: 1200, user_capacity: 8, topology: 'DOUBLE_FACE', topology_source: 'USER_CONFIRMED' },
      ...Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, relation_role: 'WORK_SEAT', functional_group_id: 'g', zone_id: 'OP', w: 600, d: 600 })),
    ];
    const sol = resolverKits([{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 2600, largo: 6500 }], piezas);
    expect(sol.unplaced.length, 'cupo completo rotado').toBe(0);
    const byId = new Map(piezas.map((p) => [String(p.id), p]));
    const anchorEntry = sol.colocacion.find((c) => c.id === 'b');
    expect(anchorEntry.rot).toBe(90);
    const seats = sol.colocacion.filter((c) => c.side === 'A' || c.side === 'B');
    expect(seats.length).toBe(8);
    expect(seats.filter((c) => c.side === 'A').length).toBe(4);
    expect(seats.every((c) => c.rot === 90)).toBe(true);
    expect(seats.every((c) => c.slot_id)).toBe(true);
    expect(seats.every((c) => c.anchor_instance_id === 'b')).toBe(true);
    expect(new Set(seats.map((c) => c.slot_id)).size).toBe(8);
    expect(seats.every((c) => c.facing === 'LEFT' || c.facing === 'RIGHT')).toBe(true);
    const ancR = rectDe(anchorEntry, byId.get('b'));
    for (const c of seats) expect(apunta(rectDe(c, byId.get(String(c.id))), ancR, c.facing), `${c.slot_id} mira al ancla`).toBe(true);
  });
});

describe('P0.2c · contrato de metadata (topology/provenance viven en el ANCLA)', () => {
  it('el ancla lleva topology+provenance; la silla se ata por anchor_instance_id (sin duplicar verdad)', () => {
    const piezas = [
      { id: 'b', relation_role: 'ANCHOR_WORKSTATION', functional_group_id: 'g', zone_id: 'OP', w: 6000, d: 1200, user_capacity: 8, topology: 'DOUBLE_FACE', topology_source: 'USER_CONFIRMED' },
      ...Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, relation_role: 'WORK_SEAT', functional_group_id: 'g', zone_id: 'OP', w: 600, d: 600 })),
    ];
    const sol = resolverKits([{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 12000, largo: 8000 }], piezas);
    const anc = sol.colocacion.find((c) => c.id === 'b');
    const seat = sol.colocacion.find((c) => c.side === 'A' || c.side === 'B');
    expect(anc.topology).toBe('DOUBLE_FACE');
    expect(seat.topology).toBeNull();
    expect(seat.anchor_instance_id).toBe('b');
  });
});
