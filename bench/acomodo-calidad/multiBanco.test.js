import { describe, it, expect } from 'vitest';
import { construirCasos } from '../acomodo/casos.js';
import { resolverKits, resolverKitsMulti } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';

// ============================================================================
//  P0.2c · BLOCK 5 · BANCO MULTI COMPLETO. Corre resolverKitsMulti sobre TODOS los
//  casos del banco (congelado, sólo lectura) y verifica: (a) NO regresión vs el
//  determinista (nunca coloca menos piezas), (b) presupuesto TOTAL respetado, y
//  mide p50/p95/max + candidatos + estrategia ganadora.
// ============================================================================
const idsFaltantes = (sol) => {
  const s = new Set();
  for (const u of (sol.unplaced || [])) for (const id of (u.piezas || [])) s.add(String(id));
  for (const id of (sol.unassigned || [])) s.add(String(id));
  return s;
};
const pctl = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p / 100 * a.length))]; };

describe('P0.2c · BLOCK 5 · banco multi completo (perf + no regresión)', () => {
  const casos = construirCasos();

  it('multi NUNCA coloca menos piezas que el determinista en NINGÚN caso del banco', () => {
    for (const c of casos) {
      const base = resolverKits(c.areas, c.piezas);
      const multi = resolverKitsMulti(c.areas, c.piezas);
      const basePlaced = c.piezas.length - idsFaltantes(base).size;
      const multiPlaced = c.piezas.length - idsFaltantes(multi).size;
      expect(multiPlaced, `caso ${c.nombre}: multi<base`).toBeGreaterThanOrEqual(basePlaced);
    }
  });

  it('presupuesto TOTAL respetado (ningún caso excede) + métricas p50/p95/max', () => {
    const tiempos = [];
    let maxCands = 0;
    const ganadores = {};
    for (const c of casos) {
      const m = resolverKitsMulti(c.areas, c.piezas);
      const met = m.seleccion.metrics;
      tiempos.push(met.elapsed_ms);
      maxCands = Math.max(maxCands, met.candidates_evaluated);
      ganadores[met.winner_strategy] = (ganadores[met.winner_strategy] || 0) + 1;
      expect(met.elapsed_ms, `caso ${c.nombre} excede presupuesto`).toBeLessThanOrEqual(met.budget_ms + 50);
    }
    const p50 = pctl(tiempos, 50), p95 = pctl(tiempos, 95), max = Math.max(...tiempos);
    // Útil en el log de CI; el umbral es holgado (no debe tardar segundos por caso).
    console.log(`[BANCO MULTI] casos=${casos.length} p50=${p50}ms p95=${p95}ms max=${max}ms maxCands=${maxCands} ganadores=${JSON.stringify(ganadores)}`);
    expect(max).toBeLessThan(4000);
  });

  it('el presupuesto no produce falso PASS: quality_review_required es boolean coherente', () => {
    for (const c of casos) {
      const m = resolverKitsMulti(c.areas, c.piezas);
      const sel = m.seleccion;
      expect(typeof sel.quality_review_required).toBe('boolean');
      // si se agotó el presupuesto y el ganador no es completo+semántico-OK → review.
      if (sel.metrics.budget_exhausted && !(sel.ganador_eval.hardOk && sel.ganador_eval.semOk && sel.ganador_eval.placed === c.piezas.length)) {
        expect(sel.quality_review_required).toBe(true);
      }
    }
  });
});
