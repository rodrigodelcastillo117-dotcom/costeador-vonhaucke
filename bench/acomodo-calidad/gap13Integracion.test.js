import { describe, it, expect } from 'vitest';
import { resolverKits } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';
import { juzgarSemantico, esFinalValido } from '../../supabase/functions/acomodar-espacio-recovery/semanticPlacementJudge.js';

// ============================================================================
//  P0.2c · GAP13 · INTEGRACIÓN resolverKits → juzgarSemantico (output REAL del
//  solver, no colocaciones manuales).
//
//  NOTA (dependencia de BLOCK 5): el solver actual coloca por first-fit en (0,0),
//  dejando el lado activo de un bench DOUBLE_FACE / MEETING pegado al muro → el
//  juez semántico lo marca FAIL (correcto). Producir un acomodo DOUBLE_FACE/MEETING
//  semánticamente LIMPIO desde el solver requiere preferencia de acceso (multi-
//  candidate del BLOCK 5): una reordenación ingenua "interior primero" REGRESA el
//  banco P0.2b (falsosPASS=1, factPASS=46/49) — demostrado y revertido. Por eso
//  GAP13-A/D (double-face/meeting correcto → Semantic PASS end-to-end) queda
//  BLOCKED on BLOCK 5. Aquí se prueba lo que el solver actual SÍ puede demostrar.
// ============================================================================
const mk = (id, rol, w, d, extra = {}) => ({ id, relation_role: rol, w, d, functional_group_id: 'g', zone_id: 'Z', ...extra });
const seats = (n) => Array.from({ length: n }, (_, i) => mk('s' + i, 'WORK_SEAT', 600, 600));

describe('P0.2c · GAP13 · resolverKits → Semantic Judge', () => {
  it('B · DOUBLE_FACE 8 por el solver → geométrico colocado pero Semantic FAIL (lado activo al muro)', () => {
    const piezas = [mk('b', 'ANCHOR_WORKSTATION', 6000, 1200, { user_capacity: 8, topology: 'DOUBLE_FACE', topology_source: 'USER_CONFIRMED' }), ...seats(8)];
    const areas = [{ nombre: 'Z', zone_id: 'Z', tipo: 'open', ancho: 12000, largo: 8000 }];
    const sol = resolverKits(areas, piezas);
    expect(sol.unplaced.length).toBe(0);
    const sem = juzgarSemantico(areas, sol.piezas, sol.colocacion);
    expect(sem.status).toBe('FAIL');
    expect(sem.issues.map((i) => i.code)).toContain('ACTIVE_SIDE_BLOCKED_BY_WALL');
    expect(esFinalValido('PASS', sem)).toBe(false);
  });

  it('C · workstation SIN topología (UNKNOWN+fallback) por el solver → Semantic REVIEW_REQUIRED', () => {
    const piezas = [mk('b', 'ANCHOR_WORKSTATION', 6000, 1200, { user_capacity: 4 }), ...seats(4)];
    const areas = [{ nombre: 'Z', zone_id: 'Z', tipo: 'open', ancho: 12000, largo: 8000 }];
    const sol = resolverKits(areas, piezas);
    const anc = sol.colocacion.find((c) => c.id === 'b');
    expect(anc.topology).toBe('UNKNOWN');
    const sem = juzgarSemantico(areas, sol.piezas, sol.colocacion);
    expect(sem.status).toBe('REVIEW_REQUIRED');
    expect(sem.issues.map((i) => i.code)).toContain('SEMANTIC_PROFILE_UNKNOWN');
  });

  it("A' · SINGLE_FACE declarado por el solver → Semantic PASS (lado activo mira al interior)", () => {
    const piezas = [mk('b', 'ANCHOR_WORKSTATION', 6000, 1200, { user_capacity: 4, topology: 'SINGLE_FACE', topology_source: 'USER_CONFIRMED' }), ...seats(4)];
    const areas = [{ nombre: 'Z', zone_id: 'Z', tipo: 'open', ancho: 12000, largo: 8000 }];
    const sol = resolverKits(areas, piezas);
    const sem = juzgarSemantico(areas, sol.piezas, sol.colocacion);
    expect(sem.status).toBe('PASS');
    expect(esFinalValido('PASS', sem)).toBe(true);
  });
});
