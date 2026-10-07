// ============================================================================
//  P0.2c · BLOCK 5 · PIPELINE DEL EDGE (puro, testeable SIN deploy).
//
//  El handler HTTP (index.ts) sólo parsea y serializa; TODA la lógica de acomodo
//  vive aquí para poder certificarla a nivel edge sin desplegar. Pipeline:
//    resolverKitsMulti (multi-candidato) → GANADOR
//      → HARD (evaluarRecovery + validarColocacion)
//      → SEMANTIC gate (del ganador) → QUALITY review (presupuesto)
//    → layoutSpec / render_ready / status / mensaje_vendedor SOBRE EL GANADOR.
// ============================================================================
import { validarColocacion } from './acomodo-core.js';
import { auditarPuertas } from './spatial-core.js';
import { CONTRATO, evaluarRecovery } from './recovery-core.js';
import { resolverKits, resolverKitsMulti } from './kit-solver.js';
import { mensajeVendedor } from './opciones.js';

// El mensaje al vendedor viaja sin los closures `aplicar` (no serializables).
function mensajeSerializable(areas, piezas, sol) {
  const m = mensajeVendedor(areas, piezas, sol, { resolver: resolverKits });
  return { pendientes: m.pendientes, motivos: m.motivos, opciones: m.opciones.map((o) => ({ id: o.id, texto: o.texto })), sin_opcion: m.sin_opcion, hay_pendientes: m.hay_pendientes };
}

export function construirRespuestaAcomodo(areas = [], piezas = []) {
  // GANADOR del pipeline multi-candidato (jueces en capas HARD→SEMANTIC→COMPLETENESS→QUALITY).
  const sol = resolverKitsMulti(areas, piezas);
  const colocacion = sol.colocacion;
  const piezasAsign = sol.piezas;
  const sel = sol.seleccion || {};
  const semEval = sel.ganador_eval || {};

  const evalFinal = evaluarRecovery(areas, piezasAsign, colocacion, { requested: piezas.length });
  const val = validarColocacion(areas, piezasAsign, colocacion, 1);
  const doors = auditarPuertas(areas);
  const mensaje = mensajeSerializable(areas, piezasAsign, sol);

  // GATE SEMÁNTICO + CALIDAD sobre el GANADOR.
  const semOk = semEval.semOk !== false;
  const qualityReview = !!sel.quality_review_required;
  const render_ready = !!evalFinal.render_ready && semOk && !qualityReview;
  const status = (!semOk) ? 'NEEDS_SEMANTIC_REVIEW' : (qualityReview ? 'QUALITY_REVIEW_REQUIRED' : evalFinal.status);

  const layoutSpec = {
    version: CONTRATO.output_version,
    status,
    requested: evalFinal.requested,
    placed: evalFinal.placed,
    unplaced: evalFinal.unplaced,
    no_cupieron: sol.unplaced,
    unassigned: sol.unassigned,
    placements: colocacion,
    validation: {
      issues: evalFinal.issues,
      render_ready,
      invariant_ok: evalFinal.invariant_ok,
      doors,
      semantic: val,
      semantic_gate: { sem_status: semEval.sem_status ?? null, semFail: semEval.semFail ?? null, quality: semEval.quality ?? null },
      min_pasillo_mm: CONTRATO.min_pasillo_mm,
    },
    seleccion: sel,
    mensaje_vendedor: mensaje,
  };

  return {
    ok: true,
    plan: { colocacion, piezas: piezasAsign },
    layoutSpec,
    render_ready,
    status,
    no_cupieron: sol.unplaced,
    unassigned: sol.unassigned,
    mensaje_vendedor: mensaje,
    metodo: sol.metodo,
    seleccion: sel,
    attempts_used: sol.attempts_used,
    input_version: CONTRATO.input_version,
  };
}
