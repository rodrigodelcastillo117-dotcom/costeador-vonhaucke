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
import { resolverKitsMulti } from './kit-solver.js';
import { mensajeVendedor } from './opciones.js';

// El mensaje al vendedor viaja sin los closures `aplicar` (no serializables).
// GAP28: las opciones se verifican con el MISMO contrato del pipeline final
// (resolverKitsMulti → hard → semantic → quality). El verifier NO llama a
// mensajeVendedor, así que no hay recursión.
function mensajeSerializable(areas, piezas, sol) {
  const m = mensajeVendedor(areas, piezas, sol, { resolver: resolverKitsMulti });
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

  // GATE de publicación sobre el GANADOR (contrato FINAL, FAIL-CLOSED · GAP34):
  //   render_ready ⇔ HARD PASS (evaluarRecovery) ∧ SEMANTIC PASS (GAP18: sólo 'PASS')
  //   ∧ QUALITY PASS (GAP26). AUSENCIA DE EVIDENCIA ≠ PASS. Precedencia de estado:
  //   metadata ausente → SEMANTIC (FAIL/REVIEW) → QUALITY. El quality se omite por
  //   diseño cuando la semántica no pasa (lazy), así que SEMANTIC manda sobre QUALITY.
  const semanticPass = semEval.sem_status === 'PASS' && semEval.semantic_pass === true;
  const qualityPass = semEval.quality_status === 'PASS';       // fail-closed: faltante → false
  const render_ready = !!evalFinal.render_ready && semanticPass && qualityPass && !sel.quality_review_required;
  const qualityReview = !!sel.quality_review_required || !qualityPass;
  const status = !semEval.sem_status ? 'NEEDS_REVIEW_METADATA'
    : (!semanticPass ? 'NEEDS_SEMANTIC_REVIEW'
      : (qualityReview ? 'QUALITY_REVIEW_REQUIRED' : evalFinal.status));

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
      semantic_gate: { sem_status: semEval.sem_status ?? null, semantic_pass: semanticPass, semFail: semEval.semFail ?? null, quality: semEval.quality ?? null, quality_status: semEval.quality_status ?? null },
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
