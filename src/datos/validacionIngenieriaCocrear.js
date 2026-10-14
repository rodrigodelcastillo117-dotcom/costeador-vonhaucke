// ============================================================================
//  VALIDACIÓN DE INGENIERÍA EN COCREAR (lógica pura extraída de CocrearV3.jsx, 2026-10-14). Refactor puro.
//
//  COCREAR 10 (D-03/D-05): la aprobación NO es un sello en el JSON del cliente. "VALIDADA" sólo si el SERVIDOR la
//  validó para ESTA revisión (spec hash del servidor = el actual) y para la MISMA revisión visual (visual hash).
//  Sólo Diseño/Dirección pueden pedirla, con BOM y sin piezas pendientes. Cualquier commit canónico la invalida.
//  Probado por comportamiento en cocrearEngineeringValidation.test.js.
// ============================================================================

/**
 * @param {object} p
 * @param {object|null} p.servidor        respuesta de costear-servidor para la revisión guardada
 * @param {object|null} p.specBase        spec que reconstruye el servidor (sin validación)
 * @param {()=>string|null} p.visualHashActual perezoso: visualRevisionHash del spec actual (sólo se calcula si el
 *        servidor validó; el componente no construye el spec sin necesidad)
 */
export function estadoValidacionIngenieria({ servidor, specBase, visualHashActual }) {
  const servidorVigente = !!(servidor?.ok && specBase && servidor.spec_hash === specBase.hash);
  const engineeringValidation = servidorVigente && servidor.ingenieria_validada ? {
    fuente: 'costear-servidor', validador: servidor.validada_por || null, fecha: servidor.validada_en || null,
    visual_hash: servidor.visual_hash || null, motivo: 'Validada en el servidor: costo emitible, sin bloqueos estructurales y misma revisión.',
  } : null;
  const engineeringValidated = !!(
    engineeringValidation
    && engineeringValidation.visual_hash
    && engineeringValidation.visual_hash === visualHashActual()
  );
  return { servidorVigente, engineeringValidation, engineeringValidated };
}

export const puedeAprobarIngenieria = (rol) => rol === 'direccion' || rol === 'diseno';

/** Piezas que impiden validar: sin material o funciones sin despiece (las excluidas no cuentan). */
export const piezasPendientesIngenieria = (componentes) =>
  (componentes || []).filter((c) => c && !c.excluida && (!c.insumoId || c._funcion));

export const ingenieriaListaParaRevision = (componentes) =>
  !!(componentes?.length && !piezasPendientesIngenieria(componentes).length);

/** Motivo por el que NO se puede pedir la validación (null = se puede pedir al servidor). */
export function bloqueoValidacionIngenieria({ rol, componentes }) {
  if (!puedeAprobarIngenieria(rol)) return 'Sólo Diseño o Dirección pueden validar ingeniería.';
  if (!ingenieriaListaParaRevision(componentes)) {
    return 'Ingeniería todavía no puede validarse: falta el BOM o hay piezas pendientes (sin material o funciones sin despiece).';
  }
  return null;
}

/** Cualquier cambio técnico/visual invalida la aprobación de ingeniería previa. */
export const sinValidacionIngenieria = (intent) => ({ ...intent, _engineering_validated: false, _engineering_validation: null });
