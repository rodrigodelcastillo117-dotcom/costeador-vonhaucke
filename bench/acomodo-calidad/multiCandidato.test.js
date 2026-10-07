import { describe, it, expect } from 'vitest';
import { resolverKits, resolverKitsMulti, mejorCandidato } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';
import { juzgarSemantico } from '../../supabase/functions/acomodar-espacio-recovery/semanticPlacementJudge.js';

// ============================================================================
//  P0.2c · BLOCK 5 · BÚSQUEDA MULTI-CANDIDATO → JUECES EN CAPAS → GANADOR.
//  Cierra GAP13-A/D SIN "interior-first" (el candidato interior-consciente es UNO
//  más a juzgar; sólo gana si el juez lo confirma) y SIN tocar el camino por
//  defecto (byte-idéntico → el banco congelado no puede regresar).
// ============================================================================
const mk = (id, rol, w, d, extra = {}) => ({ id, relation_role: rol, w, d, functional_group_id: 'g', zone_id: 'OP', ...extra });
const df8 = () => [
  mk('b', 'ANCHOR_WORKSTATION', 6000, 1400, { user_capacity: 8, placement_profile: { topology: 'DOUBLE_FACE', provenance: 'USER_CONFIRMED', version: 'PP_V1' } }),
  ...Array.from({ length: 8 }, (_, i) => mk('s' + i, 'WORK_SEAT', 600, 600)),
];
const singleFace2 = () => [
  mk('b', 'ANCHOR_WORKSTATION', 3000, 1200, { user_capacity: 2, placement_profile: { topology: 'SINGLE_FACE', provenance: 'CATALOG', version: 'PP_V1' } }),
  ...Array.from({ length: 2 }, (_, i) => mk('s' + i, 'WORK_SEAT', 600, 600)),
];
const sev = (sem, s) => (sem.issues || []).filter((i) => i.severity === s).length;

describe('P0.2c · BLOCK 5 · multi-candidato cierra GAP13-A/D', () => {
  it('bench DOBLE CARA pegado al muro (defecto A/D): el camino por defecto FALLA semánticamente', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 7000, largo: 4000 }];
    const base = resolverKits(areas, df8());                       // orden por defecto (row)
    const sem = juzgarSemantico(areas, base.piezas, base.colocacion);
    expect(sem.status).toBe('FAIL');                               // 4 lados activos contra el muro
    expect(sev(sem, 'fail')).toBeGreaterThan(0);
    expect((sem.issues || []).some((i) => i.code === 'ACTIVE_SIDE_BLOCKED_BY_WALL')).toBe(true);
  });

  it('multi-candidato elige la colocación con acceso en AMBOS lados → PASS (FAIL→PASS)', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 7000, largo: 4000 }];
    const m = resolverKitsMulti(areas, df8());
    const sem = juzgarSemantico(areas, m.piezas, m.colocacion);
    expect(sem.status).toBe('PASS');                               // GAP13-A/D CERRADO
    expect(sev(sem, 'fail')).toBe(0);
    expect(m.seleccion.ganador_orden).toBe('center');             // ganó por el juez, no por regla fija
    expect(m.metodo).toBe('kit-solver-multi-v1');
    // el ganador coloca TODO lo que colocaba el base (no empeora cobertura)
    expect(m.unplaced.length).toBeLessThanOrEqual(resolverKits(areas, df8()).unplaced.length);
  });

  it('determinismo: resolverKitsMulti da el mismo ganador en corridas repetidas', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 7000, largo: 4000 }];
    const a = resolverKitsMulti(areas, df8());
    const b = resolverKitsMulti(areas, df8());
    expect(a.seleccion.ganador_orden).toBe(b.seleccion.ganador_orden);
    expect(JSON.stringify(a.colocacion)).toBe(JSON.stringify(b.colocacion));
  });
});

describe('P0.2c · BLOCK 5 · NO regresión (el determinista gana los empates)', () => {
  it('camino por defecto BYTE-IDÉNTICO: resolverKits sin opts === con orden undefined', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 7000, largo: 4000 }];
    const a = resolverKits(areas, df8());
    const b = resolverKits(areas, df8(), { orden: undefined });
    expect(JSON.stringify(a.colocacion)).toBe(JSON.stringify(b.colocacion));
  });

  it('cuando el default ya es óptimo (single-face en cuarto abierto), multi conserva #0 (row)', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 3200, largo: 2600 }];
    const base = resolverKits(areas, singleFace2());
    const semBase = juzgarSemantico(areas, base.piezas, base.colocacion);
    expect(semBase.status).toBe('PASS');                           // el default ya pasa
    const m = resolverKitsMulti(areas, singleFace2());
    expect(m.seleccion.ganador_idx).toBe(0);                       // empate semántico/calidad → base
    expect(m.seleccion.ganador_orden).toBe('row');
    expect(JSON.stringify(m.colocacion)).toBe(JSON.stringify(base.colocacion));
  });

  it('el ganador nunca coloca MENOS piezas que el candidato determinista', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 7000, largo: 4000 }];
    const m = resolverKitsMulti(areas, df8());
    const base = m.seleccion.por_candidato.find((c) => c.idx === 0);
    const ganador = m.seleccion.por_candidato.find((c) => c.orden === m.seleccion.ganador_orden);
    expect(ganador.placed).toBeGreaterThanOrEqual(base.placed);
  });
});

describe('P0.2c · BLOCK 5 · orden de jueces HARD → SEMANTIC → COMPLETENESS → QUALITY', () => {
  // Ejemplo OBLIGATORIO del mandato: A=20/20 placed pero semantic FAIL; B=19/20 placed
  // semantic PASS. A NUNCA puede ser el ganador final (la incoherencia semántica no se
  // compensa con más piezas colocadas). El resultado puede ser PARCIAL, nunca incoherente.
  const A = { idx: 0, orden: 'row', eval: { hardOk: true, hard_issues: 0, placed: 20, sem_status: 'FAIL', semFail: 4, semReview: 0, semOk: false, quality: 95 } };
  const B = { idx: 1, orden: 'center', eval: { hardOk: true, hard_issues: 0, placed: 19, sem_status: 'PASS', semFail: 0, semReview: 0, semOk: true, quality: 80 } };

  it('semantic PASS (19/20) gana a semantic FAIL (20/20)', () => {
    expect(mejorCandidato(A, B)).toBe(B);
    expect(mejorCandidato(B, A)).toBe(B);   // simétrico
  });

  it('HARD manda sobre SEMANTIC: hard inválido pierde aunque sea semantic PASS', () => {
    const hardBad = { idx: 2, orden: 'reverse', eval: { hardOk: false, hard_issues: 1, placed: 20, sem_status: 'PASS', semFail: 0, semReview: 0, semOk: true, quality: 99 } };
    expect(mejorCandidato(hardBad, A)).toBe(A);     // A (hardOk, semFail) > hardBad (hard inválido)
  });

  it('COMPLETENESS sobre QUALITY: a igualdad de gates, más piezas gana aunque baje el score', () => {
    const masPiezas = { idx: 0, orden: 'row', eval: { hardOk: true, hard_issues: 0, placed: 20, sem_status: 'PASS', semFail: 0, semReview: 0, semOk: true, quality: 70 } };
    const menosPiezasMejorScore = { idx: 1, orden: 'center', eval: { hardOk: true, hard_issues: 0, placed: 18, sem_status: 'PASS', semFail: 0, semReview: 0, semOk: true, quality: 99 } };
    expect(mejorCandidato(masPiezas, menosPiezasMejorScore)).toBe(masPiezas);
  });
});
