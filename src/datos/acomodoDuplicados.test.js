import { describe, it, expect, vi } from 'vitest';
import { construirPayloadAcomodo } from './acomodoPayload.js';
import { evaluarInvariantesAcomodo } from './acomodoInvariantes.js';
import { resolverAcomodo } from './acomodoOrquestador.js';

// ============================================================================
//  GAP 1 · duplicados end-to-end. El MISMO piezasExtra alimenta payload +
//  program_hash + agregador + stale. Golden: duplicar → guardar → reload → cero
//  GHOST → hash idéntico → posición manual preservada.
// ============================================================================
const PARTIDAS = [
  { id: 'b', nombre: 'Bench operativo', cantidad: 1, w: 6000, d: 1200, relation_role: 'ANCHOR_WORKSTATION', functional_group_id: 'gA' },
  { id: 'w', nombre: 'Silla operativa WIN', cantidad: 1, relation_role: 'WORK_SEAT', functional_group_id: 'gA' },
];
const AREAS_M = [{ nombre: 'OPERATIVA', ancho: 8, largo: 4 }];
const DUP = { id: 'dup-1', nombre: 'Silla operativa WIN', w: 600, d: 600, tipo: 'asiento' };

describe('GAP1 · duplicados alimentan payload/hash/agregador', () => {
  it('el duplicado entra al payload y al program_hash', () => {
    const sin = construirPayloadAcomodo({ partidas: PARTIDAS, areasM: AREAS_M });
    const con = construirPayloadAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, piezasExtra: [DUP] });
    expect(con.piezas.some((p) => p.id === 'dup-1')).toBe(true);
    expect(con.requested).toBe(sin.requested + 1);
    expect(con.program_hash).not.toBe(sin.program_hash);   // el dup cambia el hash
  });

  it('colocar un duplicado NO es GHOST (está en el payload)', () => {
    const payload = construirPayloadAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, piezasExtra: [DUP] });
    const plan = { colocacion: [
      { id: 'b-1', area: 0, x: 0, y: 0 },
      { id: 'w-1', area: 0, x: 0, y: 1500 },
      { id: 'dup-1', area: 0, x: 2000, y: 1500, manual: true },
    ], render_ready: true, layoutSpec: { status: 'PASS', validation: { render_ready: true } } };
    const r = evaluarInvariantesAcomodo({ payload, plan });
    expect(r.ghosts).toEqual([]);
    expect(r.status).toBe('PASS');
  });

  it('reload: mismos inputs → program_hash/floor_hash IDÉNTICOS', () => {
    const a = construirPayloadAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, piezasExtra: [DUP] });
    const b = construirPayloadAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, piezasExtra: [DUP] });
    expect(b.program_hash).toBe(a.program_hash);
    expect(b.floor_hash).toBe(a.floor_hash);
  });

  it('posición manual del duplicado preservada tras reload (hashes iguales, cero ghost)', async () => {
    const payload = construirPayloadAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, piezasExtra: [DUP] });
    const planGuardado = {
      colocacion: [
        { id: 'b-1', area: 0, x: 0, y: 0 },
        { id: 'w-1', area: 0, x: 0, y: 1500 },
        { id: 'dup-1', area: 0, x: 2500, y: 1500, rot: 0, manual: true },
      ],
      program_hash: payload.program_hash,
      floor_hash: payload.floor_hash,
    };
    const solveQueMueve = vi.fn();
    const r = await resolverAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, piezasExtra: [DUP], solve: solveQueMueve, planGuardado });
    expect(solveQueMueve).not.toHaveBeenCalled();     // hashes iguales → no re-resuelve
    expect(r.conservadoManual).toBe(true);
    expect(r.evaluacion.ghosts).toEqual([]);          // el dup NO es ghost
    const dup = r.plan.colocacion.find((c) => c.id === 'dup-1');
    expect(dup.x).toBe(2500); expect(dup.y).toBe(1500);
  });
});
