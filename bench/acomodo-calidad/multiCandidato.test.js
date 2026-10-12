import { describe, it, expect } from 'vitest';
import { resolverKits, resolverKitsMulti, mejorCandidato, attachCertificates } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';
import { juzgarSemantico } from '../../supabase/functions/acomodar-espacio-recovery/semanticPlacementJudge.js';
import { evaluarRecovery } from '../../supabase/functions/acomodar-espacio-recovery/recovery-core.js';

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

describe('P0.2c · GAP45/GAP47 · publicable FAIL-CLOSED ante soft-budget (clean winner + timeout)', () => {
  const area = [{ nombre: 'Z', zone_id: 'Z', tipo: 'privado', ancho: 20000, largo: 20000 }];
  const desk = () => [
    { id: 'b', relation_role: 'ANCHOR_DESK', w: 1600, d: 800, user_capacity: 1, functional_group_id: 'g', zone_id: 'Z', placement_profile: { topology: 'DESK', provenance: 'CATALOG', version: 'PP_V1' } },
    { id: 's0', relation_role: 'EXECUTIVE_SEAT', w: 600, d: 600, functional_group_id: 'g', zone_id: 'Z' },
  ];

  it('POSITIVO: ganador limpio dentro de presupuesto → publicable=true, sin review', () => {
    const m = resolverKitsMulti(area, desk());
    expect(m.seleccion.winner_clean).toBe(true);
    expect(m.seleccion.metrics.budget_exceeded).toBe(false);
    expect(m.seleccion.publicable).toBe(true);
    expect(m.seleccion.quality_review_required).toBe(false);
  });

  it('FÓRMULA (determinista): publicable === winner_clean ∧ !quality_review_required; budget → review', () => {
    // Prueba el contrato por IDENTIDAD de fórmula (no por coincidencia de reloj): aunque
    // winner_clean sea true, si quality_review_required (p.ej. soft-budget) → publicable=false.
    // Esto cubre exactamente "clean winner + timeout" sin depender de un timing frágil.
    const stress = [];
    for (let g = 0; g < 6; g++) {
      stress.push({ id: 'b' + g, relation_role: 'ANCHOR_WORKSTATION', w: 6000, d: 1400, user_capacity: 8, functional_group_id: 'g' + g, zone_id: 'Z', placement_profile: { topology: 'DOUBLE_FACE', provenance: 'USER_CONFIRMED', version: 'PP_V1' } });
      for (let i = 0; i < 8; i++) stress.push({ id: `s${g}_${i}`, relation_role: 'WORK_SEAT', w: 600, d: 600, functional_group_id: 'g' + g, zone_id: 'Z' });
    }
    const big = [{ nombre: 'Z', zone_id: 'Z', tipo: 'open', ancho: 100000, largo: 100000 }];

    for (const cfg of [{ a: area, p: desk() }, { a: big, p: stress, opts: { maxMultiMs: 1 } }]) {
      const sel = resolverKitsMulti(cfg.a, cfg.p, cfg.opts).seleccion;
      // IDENTIDAD de la fórmula publicable (fail-closed). Si winner_clean ∧ review → publicable=false.
      expect(sel.publicable).toBe(sel.winner_clean === true && !sel.quality_review_required);
      // budget excedido ⟹ review ⟹ NO publicable (aunque el ganador sea limpio).
      if (sel.metrics.budget_exceeded) {
        expect(sel.quality_review_required).toBe(true);
        expect(sel.publicable).toBe(false);
      }
      // nunca la contradicción publicable ∧ (review | budget_exceeded).
      expect(sel.publicable && (sel.quality_review_required || sel.metrics.budget_exceeded)).toBe(false);
    }
  });
});

describe('P0.2c · GAP38 · certificar al ganador NO cambia el layout (winner_eval ↔ returned)', () => {
  const idsFaltan = (sol) => { const s = new Set(); for (const u of (sol.unplaced || [])) for (const id of (u.piezas || [])) s.add(String(id)); for (const id of (sol.unassigned || [])) s.add(String(id)); return s.size; };
  it('el layout evaluado es el retornado; re-certificar es idempotente sobre la colocación', () => {
    // área demasiado angosta para el bench doble cara 8 → kit no cabe (unplaced con certificado).
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 5000, largo: 4000 }];
    const m = resolverKitsMulti(areas, df8());
    expect(m.unplaced.length).toBeGreaterThan(0);                       // hay faltantes → hubo que certificar
    expect(m.unplaced.every((u) => u.certificado)).toBe(true);         // el ganador quedó certificado
    // winner_eval describe EXACTAMENTE el layout retornado (no un layout re-buscado).
    const er = evaluarRecovery(areas, m.piezas, m.colocacion, { requested: df8().length });
    const sem = juzgarSemantico(areas, m.piezas, m.colocacion);
    expect(m.seleccion.ganador_eval.hardOk).toBe((er.issues || []).filter((i) => i.severity === 'fail').length === 0);
    expect(m.seleccion.ganador_eval.sem_status).toBe(sem.status);
    expect(m.seleccion.ganador_eval.placed).toBe(df8().length - idsFaltan(m));
    // adjuntar certificados NO toca la colocación (byte-idéntica antes/después).
    const antes = JSON.stringify(m.colocacion);
    attachCertificates(m, areas);
    expect(JSON.stringify(m.colocacion)).toBe(antes);
  });
});

describe('P0.2c · BLOCK 5 · orden de jueces HARD → SEMANTIC → COMPLETENESS → QUALITY', () => {
  // Ejemplo OBLIGATORIO del mandato: A=20/20 placed pero semantic FAIL; B=19/20 placed
  // semantic PASS. A NUNCA puede ser el ganador final (la incoherencia semántica no se
  // compensa con más piezas colocadas). El resultado puede ser PARCIAL, nunca incoherente.
  const A = { idx: 0, orden: 'row', eval: { hardOk: true, hard_issues: 0, placed: 20, sem_status: 'FAIL', semRank: 0, semFail: 4, semReview: 0, quality: 95 } };
  const B = { idx: 1, orden: 'center', eval: { hardOk: true, hard_issues: 0, placed: 19, sem_status: 'PASS', semRank: 2, semFail: 0, semReview: 0, quality: 80 } };

  it('semantic PASS (19/20) gana a semantic FAIL (20/20)', () => {
    expect(mejorCandidato(A, B)).toBe(B);
    expect(mejorCandidato(B, A)).toBe(B);   // simétrico
  });

  it('GAP46 · MISMO status: COMPLETENESS gana a reducir issues (18/18 rev2 vence a 9/18 rev1)', () => {
    const A2 = { idx: 0, orden: 'row', eval: { hardOk: true, hard_issues: 0, placed: 18, sem_status: 'REVIEW_REQUIRED', semRank: 1, semFail: 0, semReview: 2, quality: 70 } };
    const B2 = { idx: 1, orden: 'center', eval: { hardOk: true, hard_issues: 0, placed: 9, sem_status: 'REVIEW_REQUIRED', semRank: 1, semFail: 0, semReview: 1, quality: 90 } };
    expect(mejorCandidato(A2, B2)).toBe(A2);   // NO se sacrifica media oficina por bajar 2→1 review
    expect(mejorCandidato(B2, A2)).toBe(A2);
  });

  it('HARD manda sobre SEMANTIC: hard inválido pierde aunque sea semantic PASS', () => {
    const hardBad = { idx: 2, orden: 'reverse', eval: { hardOk: false, hard_issues: 1, placed: 20, sem_status: 'PASS', semRank: 2, semFail: 0, semReview: 0, quality: 99 } };
    expect(mejorCandidato(hardBad, A)).toBe(A);     // A (hardOk, semFail) > hardBad (hard inválido)
  });

  it('COMPLETENESS sobre QUALITY: a igualdad de gates, más piezas gana aunque baje el score', () => {
    const masPiezas = { idx: 0, orden: 'row', eval: { hardOk: true, hard_issues: 0, placed: 20, sem_status: 'PASS', semRank: 2, semFail: 0, semReview: 0, quality: 70 } };
    const menosPiezasMejorScore = { idx: 1, orden: 'center', eval: { hardOk: true, hard_issues: 0, placed: 18, sem_status: 'PASS', semRank: 2, semFail: 0, semReview: 0, quality: 99 } };
    expect(mejorCandidato(masPiezas, menosPiezasMejorScore)).toBe(masPiezas);
  });
});
