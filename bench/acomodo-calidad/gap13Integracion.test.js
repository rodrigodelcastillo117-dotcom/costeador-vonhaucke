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
  // COT-P0-027b (Parte XI §4): esta expectativa documentaba el DEFECTO (el solver
  // determinista pegaba el lado activo al muro y el juez lo tiraba). Era una expectativa
  // antigua INCORRECTA como golden: un acomodo con sillas inutilizables no es un resultado
  // válido del solver. Ahora el acceso forma parte del conjunto legal (GAP19 aplicado al
  // acceso) y el camino determinista ya no produce lados activos contra el muro.
  it('B · DOUBLE_FACE 8 por el solver → colocado SIN lado activo contra el muro (acceso en el conjunto legal)', () => {
    const piezas = [mk('b', 'ANCHOR_WORKSTATION', 6000, 1200, { user_capacity: 8, topology: 'DOUBLE_FACE', topology_source: 'USER_CONFIRMED' }), ...seats(8)];
    const areas = [{ nombre: 'Z', zone_id: 'Z', tipo: 'open', ancho: 12000, largo: 8000 }];
    const sol = resolverKits(areas, piezas);
    expect(sol.unplaced.length).toBe(0);
    const sem = juzgarSemantico(areas, sol.piezas, sol.colocacion);
    expect(sem.issues.filter((i) => /BLOCKED_BY/.test(i.code))).toEqual([]);
    expect(sem.status).toBe('PASS');
    expect(esFinalValido('PASS', sem)).toBe(true);
    // y cada silla tiene acceso físico > 0 por su lado de acceso (geometría, no sólo el código)
    for (const c of sol.colocacion.filter((c) => c.side)) expect(c.y, c.id).toBeGreaterThan(0);
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
