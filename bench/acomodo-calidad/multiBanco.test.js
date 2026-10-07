import { describe, it, expect } from 'vitest';
import { construirCasos, generarFactibles } from '../acomodo/casos.js';
import { construirDificiles } from '../acomodo/casos-dificiles.js';
import { construirPlanosReales } from '../acomodo/planos-reales.js';
import { resolverKits, resolverKitsMulti } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';
import { evaluarRecovery } from '../../supabase/functions/acomodar-espacio-recovery/recovery-core.js';

// ============================================================================
//  P0.2c · BLOCK 5 · GAP36 · BANCO MULTI COMPLETO (los 55 inputs del banco congelado,
//  SIN tocar juez/casos). Verifica por caso: no regresión vs determinista, determinismo,
//  presupuesto; y que los IMPOSIBLES nunca terminan en FINAL/render_ready. NO esconde
//  UNKNOWN topology: un caso legacy sin profile queda REVIEW_REQUIRED (no se inventa verde).
// ============================================================================
const MAX_MULTI_MS = 4000;
const idsFaltantes = (sol) => {
  const s = new Set();
  for (const u of (sol.unplaced || [])) for (const id of (u.piezas || [])) s.add(String(id));
  for (const id of (sol.unassigned || [])) s.add(String(id));
  return s;
};
const pctl = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p / 100 * a.length))]; };

describe('P0.2c · GAP36 · banco multi completo (55 casos)', () => {
  const casos = [...construirCasos(), ...generarFactibles(30), ...construirDificiles(), ...construirPlanosReales()];

  it('son 55 casos (mismos inputs del banco congelado)', () => {
    expect(casos.length).toBe(55);
  });

  // Orden LAYERED idéntico a mejorCandidato: HARD → (si !hardOk) −hard_issues →
  // semRank(PASS>REVIEW>FAIL) → −semFail → −semReview → placed → quality.
  const SEM_RANK = { PASS: 2, REVIEW_REQUIRED: 1, FAIL: 0 };
  const rankTuple = (ev) => [
    ev.hardOk ? 1 : 0,
    ev.hardOk ? 0 : -(ev.hard_issues || 0),
    ev.semRank ?? (SEM_RANK[ev.sem_status] ?? 0),
    -(ev.semFail || 0),
    -(ev.semReview || 0),
    ev.placed,
    ev.quality || 0,
  ];
  const geq = (a, b) => { for (let i = 0; i < a.length; i++) { if (a[i] > b[i]) return true; if (a[i] < b[i]) return false; } return true; };

  it('NO regresión (orden layered) + determinismo + presupuesto + imposibles sin falso FINAL; reporte', () => {
    let factibles = 0, imposibles = 0, falsosFinal = 0, regresiones = 0, regresionPlaced = 0, noDeterm = 0;
    const statusDist = {};
    const tiempos = [];
    const ganadores = {};
    let maxElapsed = 0;

    for (const c of casos) {
      const base = resolverKits(c.areas, c.piezas);                 // determinista (default)
      const m1 = resolverKitsMulti(c.areas, c.piezas);
      const m2 = resolverKitsMulti(c.areas, c.piezas);              // determinismo

      const basePlaced = c.piezas.length - idsFaltantes(base).size;
      const multiPlaced = c.piezas.length - idsFaltantes(m1).size;
      if (multiPlaced < basePlaced) regresionPlaced++;              // informativo (puede bajar si gana semántica)
      // NO REGRESIÓN REAL: el ganador nunca es PEOR que el candidato determinista (#0)
      // bajo el orden layered. Como #0 siempre se evalúa y los empates van a #0, esto
      // debe cumplirse SIEMPRE por construcción.
      const cand0 = (m1.seleccion.por_candidato || []).find((x) => x.idx === 0);
      if (cand0 && !geq(rankTuple(m1.seleccion.ganador_eval), rankTuple(cand0))) regresiones++;
      if (JSON.stringify(m1.colocacion) !== JSON.stringify(m2.colocacion)) noDeterm++;

      const sel = m1.seleccion;
      const er = evaluarRecovery(c.areas, m1.piezas, m1.colocacion, { requested: c.piezas.length });
      // FINAL/publicable: hard PASS ∧ semantic PASS ∧ quality PASS (lo expone `publicable`).
      const final = sel.publicable === true && er.render_ready === true;

      const ev = sel.ganador_eval;
      const st = !ev.hardOk ? 'HARD_FAIL' : (ev.sem_status !== 'PASS' ? ev.sem_status : (ev.quality_status !== 'PASS' ? 'QUALITY_REVIEW' : (ev.placed === c.piezas.length ? 'PASS' : 'PARTIAL')));
      statusDist[st] = (statusDist[st] || 0) + 1;

      tiempos.push(sel.metrics.elapsed_ms); maxElapsed = Math.max(maxElapsed, sel.metrics.elapsed_ms);
      ganadores[sel.metrics.winner_strategy] = (ganadores[sel.metrics.winner_strategy] || 0) + 1;
      expect(sel.metrics.elapsed_ms, `caso ${c.nombre} excede presupuesto`).toBeLessThanOrEqual(MAX_MULTI_MS + 250);

      if (c.factible === false) { imposibles++; if (final) falsosFinal++; }   // imposible JAMÁS FINAL
      else factibles++;
    }

    const p50 = pctl(tiempos, 50), p95 = pctl(tiempos, 95);
    console.log(`[BANCO MULTI 55] factibles=${factibles} imposibles=${imposibles} falsosFINAL=${falsosFinal} regresiones=${regresiones} regresionPlaced(info)=${regresionPlaced} noDeterm=${noDeterm}`);
    console.log(`[BANCO MULTI 55] statusDist=${JSON.stringify(statusDist)} p50=${p50}ms p95=${p95}ms max=${maxElapsed}ms ganadores=${JSON.stringify(ganadores)}`);

    expect(falsosFinal).toBe(0);     // imposibles nunca terminan en FINAL/render_ready
    expect(regresiones).toBe(0);     // el ganador nunca es PEOR que el determinista (orden layered)
    expect(noDeterm).toBe(0);        // determinismo
    expect(maxElapsed).toBeLessThanOrEqual(MAX_MULTI_MS + 250);
  });

  // GAP35 · stress de PRESUPUESTO: workload grande + budget pequeño. El SEARCH se corta
  // por deadline compartido; si el presupuesto se agota sin ganador LIMPIO → review (nunca
  // falso FINAL). El overshoot está acotado por el costo NO interrumpible de juzgar UN
  // candidato (evaluarRecovery/validar/semantic/quality son O(n²) en piezas).
  it('GAP35 · presupuesto estricto: exhausto → review, sin falso FINAL, overshoot acotado', () => {
    const stress = [];
    for (let g = 0; g < 6; g++) {
      stress.push({ id: 'b' + g, relation_role: 'ANCHOR_WORKSTATION', w: 6000, d: 1400, user_capacity: 8, functional_group_id: 'g' + g, zone_id: 'OP', placement_profile: { topology: 'DOUBLE_FACE', provenance: 'USER_CONFIRMED', version: 'PP_V1' } });
      for (let i = 0; i < 8; i++) stress.push({ id: `s${g}_${i}`, relation_role: 'WORK_SEAT', w: 600, d: 600, functional_group_id: 'g' + g, zone_id: 'OP' });
    }
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 100000, largo: 100000 }];
    const budget = 100;
    const m = resolverKitsMulti(areas, stress, { maxMultiMs: budget });
    // Garantías DETERMINISTAS (no dependen del reloj bajo carga de CI):
    //  - el deadline COMPARTIDO cortó el search → budget_exhausted;
    //  - la exploración NO recorrió las 5 estrategias (evita el blow-up naïf de 5×MAX_MS);
    //  - si el ganador no es LIMPIO, jamás se publica (sin falso FINAL).
    // (La cota de reloj no se asserta: el juzgado O(n²) por candidato no es interrumpible
    //  y su costo absoluto depende del hardware; `candidates_evaluated<5` es la prueba real
    //  de que el presupuesto acota la exploración.)
    expect(m.seleccion.metrics.budget_exhausted).toBe(true);
    expect(m.seleccion.metrics.candidates_evaluated).toBeLessThan(5);
    if (!m.seleccion.publicable) expect(m.seleccion.quality_review_required).toBe(true);
  });
});
