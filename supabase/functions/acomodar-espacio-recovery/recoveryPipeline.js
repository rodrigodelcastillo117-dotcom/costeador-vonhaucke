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
import { auditarPuertas, areaSinCuadrosDuplicados } from './spatial-core.js';
import { CONTRATO, evaluarRecovery } from './recovery-core.js';
import { resolverKitsMulti } from './kit-solver.js';
import { mensajeVendedor } from './opciones.js';

// El mensaje al vendedor viaja sin los closures `aplicar` (no serializables).
// GAP28: las opciones se verifican con el MISMO contrato del pipeline final
// (resolverKitsMulti → hard → semantic → quality). El verifier NO llama a
// mensajeVendedor, así que no hay recursión.
// Laboratorio de recorridos 19-oct (546 en producción): cuando algo no cabe, cada opción sugerida re-corría el multi
// COMPLETO (6 estrategias); con dos mesas de más eran ~0.4 s locales sólo en opciones y la edge pasaba de 2 s de CPU.
// Las simulaciones usan la estrategia GANADORA del acomodo principal (y la base): misma verificación (HARD ∧ SEMANTIC ∧
// QUALITY del pipeline), menos órdenes de búsqueda. Puede encontrar menos opciones; nunca anuncia una no verificada.
function mensajeSerializable(areas, piezas, sol, cacheEstatico) {
  const g = sol?.seleccion?.ganador_orden;
  const ganadora = g == null || g === 'row' ? undefined : g;
  const estrategias = ganadora === undefined ? [undefined] : [ganadora, undefined];
  const m = mensajeVendedor(areas, piezas, sol, { resolver: (as, ps) => resolverKitsMulti(as, ps, { cacheEstatico, estrategias }) });
  return { pendientes: m.pendientes, motivos: m.motivos, opciones: m.opciones.map((o) => ({ id: o.id, texto: o.texto })), sin_opcion: m.sin_opcion, hay_pendientes: m.hay_pendientes };
}

export function construirRespuestaAcomodo(areasIn = [], piezas = []) {
  // 2026-10-17: una puerta con barrido verificado se evalúa con su forma real; su cuadro conservador
  // duplicado (obstáculo tipo 'puerta' del cliente) se ignora en TODO el pipeline (solver, duro, juez).
  const areas = (Array.isArray(areasIn) ? areasIn : []).map(areaSinCuadrosDuplicados);
  // GANADOR del pipeline multi-candidato (jueces en capas HARD→SEMANTIC→COMPLETENESS→QUALITY).
  // 2026-10-19: veredicto estático por posición compartido entre el multi y las simulaciones de opciones
  // (mismas áreas, misma petición). C2 curvo pasaba de 2 s de CPU y la edge respondía 546.
  const cacheEstatico = new WeakMap();
  const sol = resolverKitsMulti(areas, piezas, { cacheEstatico });
  const colocacion = sol.colocacion;
  const piezasAsign = sol.piezas;
  const sel = sol.seleccion || {};
  const semEval = sel.ganador_eval || {};

  const evalFinal = evaluarRecovery(areas, piezasAsign, colocacion, { requested: piezas.length });
  const val = validarColocacion(areas, piezasAsign, colocacion, 1);
  const doors = auditarPuertas(areas);
  const mensaje = mensajeSerializable(areas, piezasAsign, sol, cacheEstatico);

  // GATE de publicación sobre el GANADOR (contrato FINAL, FAIL-CLOSED · GAP34):
  //   render_ready ⇔ HARD PASS (evaluarRecovery) ∧ SEMANTIC PASS (GAP18: sólo 'PASS')
  //   ∧ QUALITY PASS (GAP26). AUSENCIA DE EVIDENCIA ≠ PASS. Precedencia de estado:
  //   metadata ausente → SEMANTIC (FAIL/REVIEW) → QUALITY. El quality se omite por
  //   diseño cuando la semántica no pasa (lazy), así que SEMANTIC manda sobre QUALITY.
  const semanticPass = semEval.sem_status === 'PASS' && semEval.semantic_pass === true;
  const qualityPass = semEval.quality_status === 'PASS';       // fail-closed: faltante → false
  const render_ready = !!evalFinal.render_ready && semanticPass && qualityPass && !sel.quality_review_required;
  const qualityReview = !!sel.quality_review_required || !qualityPass;
  // Una falla GEOMÉTRICA dura (encimados, fuera del cuarto, puerta tapada) nunca se publica como
  // "revisión de calidad": es FAIL. Cotización 4048: 8 encimados salían como QUALITY_REVIEW_REQUIRED
  // ("geometría y semántica válidas") con el acomodo encimado completo.
  const geoFail = (evalFinal.issues || []).some((i) => i.severity === 'fail' && i.geo);
  const status = geoFail ? 'FAIL'
    : !semEval.sem_status ? 'NEEDS_REVIEW_METADATA'
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
      // VH-120: capacidad por ancla con su fuente (CATALOGO/USUARIO/INFERIDA/DECLARADA/GEOMETRICA), tope geométrico y
      // conflicto. Informativo: no cambia status ni ranking; la estimación geométrica es PRELIMINAR y se dice.
      capacidad: piezasAsign.filter((p) => p.capacidad && /^ANCHOR_/.test(String(p.relation_role || ''))).map((p) => ({ id: String(p.id), nombre: p.nombre ?? null, rol: p.relation_role, ...p.capacidad })),
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
