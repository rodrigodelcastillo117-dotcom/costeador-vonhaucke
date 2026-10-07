// ============================================================================
//  P0.2 · ORQUESTADOR DE ACOMODO (repair-loop + precedencia manual).
//
//  Orquesta el flujo correcto, separado del edge (que se inyecta como `solve`):
//    1) Construye el payload canónico (contrato de entrada, bloque A). Si lo
//       rechaza (sug-*/sin FloorSpec/inválido) → NO llama al solver.
//    2) PRECEDENCIA MANUAL (obj 9): si hay un plan guardado con piezas movidas a
//       mano y NI program_hash NI floor_hash cambiaron, NO se re-resuelve: se
//       conserva ese plan (se re-evalúa, no se cree a ciegas).
//    3) REPAIR LOOP ≤3 (obj 8): cada intento llama a `solve`, RE-IMPONE las
//       posiciones manuales vigentes (el edge nunca pisa lo que el humano movió),
//       evalúa invariantes y deja RASTRO (qué invariante falló, qué piezas se
//       movieron, por qué, resultado). Si tras el 3º sigue inválido → NEEDS_REVIEW
//       (jamás render_ready).
//
//  `solve(payload, ctx)` es async y devuelve el plan del edge:
//     { colocacion:[{id,area,x,y,rot}], layoutSpec?, render_ready?, ... }
//  Puro respecto al edge (inyectado) → testeable sin deploy (CERTIFICADO AHORA).
// ============================================================================
import { construirPayloadAcomodo } from './acomodoPayload.js';
import { evaluarInvariantesAcomodo } from './acomodoInvariantes.js';
import { planEstaStale } from './acomodoHash.js';

const claveColoc = (c) => `${c.id}@${c.area}:${Math.round(c.x)},${Math.round(c.y)},${Number(c.rot) || 0}`;

// Colocaciones marcadas a mano por el usuario (obj 9) que SIGUEN existiendo.
function fijasVigentes(planGuardado, idsVivos) {
  const coloc = Array.isArray(planGuardado?.colocacion) ? planGuardado.colocacion : [];
  return coloc.filter((c) => c?.manual && idsVivos.has(String(c.id)));
}

// Re-impone las fijas sobre un plan del solver: el edge NO puede mover lo manual.
function reimponerFijas(plan, fijas) {
  if (!fijas.length) return plan;
  const porId = new Map(fijas.map((f) => [String(f.id), f]));
  const resto = (plan.colocacion || []).filter((c) => !porId.has(String(c.id)));
  const manuales = fijas.map((f) => ({ ...f, manual: true }));
  return { ...plan, colocacion: [...resto, ...manuales] };
}

// Diff de posiciones entre dos planes (para el rastro: qué se movió).
function piezasMovidas(prev, next) {
  const a = new Map((prev?.colocacion || []).map((c) => [String(c.id), claveColoc(c)]));
  const movidas = [];
  for (const c of (next?.colocacion || [])) {
    const k = claveColoc(c);
    if (!a.has(String(c.id)) || a.get(String(c.id)) !== k) movidas.push(String(c.id));
  }
  return movidas;
}

/**
 * @param {{
 *   partidas:Array, areasM:Array,
 *   solve:(payload:object, ctx:object)=>Promise<object>,
 *   planGuardado?:object, maxIntentos?:number
 * }} _
 */
export async function resolverAcomodo({ partidas = [], areasM = [], piezasExtra = [], solve, planGuardado = null, maxIntentos = 3 }) {
  const trace = [];
  const payload = construirPayloadAcomodo({ partidas, areasM, piezasExtra });
  if (!payload.ok) {
    return { ok: false, status: 'SIN_LAYOUT', render_ready: false, motivo: payload.motivo, detalles: payload.detalles || [], payload, plan: null, evaluacion: null, trace };
  }

  const idsVivos = new Set(payload.piezas.map((p) => String(p.id)));
  const fijas = fijasVigentes(planGuardado, idsVivos);

  // (obj 9) Precedencia manual: program/floor sin cambios → conservar el plan
  // guardado (re-evaluado). planEstaStale compara contra los hashes guardados.
  const stale = planEstaStale(planGuardado, payload.program_hash, payload.floor_hash);
  if (planGuardado && fijas.length && !stale) {
    const evaluacion = evaluarInvariantesAcomodo({ payload, plan: planGuardado });
    trace.push({ intento: 0, accion: 'CONSERVA_MANUAL', status: evaluacion.status,
      porque: 'program_hash y floor_hash sin cambios; se respeta lo movido a mano',
      invariantesFallados: evaluacion.issues.filter((i) => i.severity === 'fail').map((i) => i.code),
      piezasMovidas: [] });
    return {
      ok: evaluacion.render_ready, status: evaluacion.status, render_ready: evaluacion.render_ready,
      conservadoManual: true, payload,
      plan: { ...planGuardado, program_hash: payload.program_hash, floor_hash: payload.floor_hash },
      evaluacion, trace,
    };
  }

  // (obj 8) Repair loop ≤ max. Cada intento re-impone fijas y evalúa.
  let planPrev = planGuardado;
  let mejor = null;
  for (let intento = 1; intento <= maxIntentos; intento++) {
    const esUltimo = intento === maxIntentos;
    let planBruto;
    try {
      planBruto = await solve(payload, { intento, fijas, planPrev });
    } catch (e) {
      trace.push({ intento, accion: 'SOLVE_ERROR', status: 'FAIL', porque: String(e?.message || e), invariantesFallados: ['SOLVE_ERROR'], piezasMovidas: [] });
      continue;
    }
    const plan = reimponerFijas(planBruto || { colocacion: [] }, fijas);
    const evaluacion = evaluarInvariantesAcomodo({ payload, plan, opts: { repairAgotado: esUltimo } });
    const movidas = piezasMovidas(planPrev, plan);
    trace.push({
      intento, accion: 'SOLVE', status: evaluacion.status,
      invariantesFallados: evaluacion.issues.filter((i) => i.severity === 'fail').map((i) => i.code),
      piezasMovidas: movidas,
      porque: intento === 1 ? 'primer intento' : (movidas.length ? 'reparación movió piezas' : 'sin cambios respecto al intento previo'),
    });

    const planSellado = { ...plan, program_hash: payload.program_hash, floor_hash: payload.floor_hash };
    mejor = { plan: planSellado, evaluacion };

    if (evaluacion.render_ready) {
      return { ok: true, status: 'PASS', render_ready: true, conservadoManual: false, payload, plan: planSellado, evaluacion, trace };
    }
    planPrev = plan;
  }

  // Tras el loop: inválido. NEEDS_REVIEW (no render_ready) — nunca se presenta como PASS.
  const evalFinal = mejor ? mejor.evaluacion : null;
  const status = evalFinal && evalFinal.status === 'PARTIAL' ? 'PARTIAL' : 'NEEDS_REVIEW';
  return {
    ok: false, status, render_ready: false, conservadoManual: false, payload,
    plan: mejor ? mejor.plan : null, evaluacion: evalFinal, trace,
  };
}
