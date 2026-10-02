// ============================================================================
//  VONI 2.0 — OBSERVABILIDAD. Registra METADATOS de cada interacción, nunca el
//  razonamiento interno (chain-of-thought) ni secretos ni el contenido económico.
//  Sink pluggable: por default un buffer en memoria.
// ============================================================================

const MODEL_VERSION = 'voni-2.0-deterministic-2026-10-02';
const _buffer = [];
const MAX = 200;

function idNuevo() {
  return 'vi_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// Resumen seguro del contexto: SÓLO ids y rol, nunca datos ni economía.
function contextoSeguro(ctx = {}) {
  return {
    role: ctx.role || null,
    clientSafe: !!ctx.clientSafe,
    route: ctx.route || null,
    project_id: ctx.project_id ?? null,
    quote_id: ctx.quote_id ?? null,
    revision_id: ctx.revision_id ?? null,
    scenario_id: ctx.scenario_id ?? null,
    product_id: ctx.product_id ?? null,
  };
}

/**
 * Construye un registro de observabilidad. NO incluye query crudo (puede traer
 * datos), ni resultados, ni CoT: sólo metadatos.
 */
export function construirRegistro({ ctx = {}, intent, lentes = [], tools = [], resultStatus, duration, error } = {}) {
  return {
    interaction_id: idNuevo(),
    user_id: ctx.user?.id || ctx.user?.email || null,
    role: ctx.role || null,
    context: contextoSeguro(ctx),
    intent: intent || null,
    lenses_used: Array.isArray(lentes) ? lentes : [],
    tools_called: Array.isArray(tools) ? tools : [],
    result_status: resultStatus || null,     // OK | ATENCION | BLOQUEADO | ERROR
    model_version: MODEL_VERSION,
    duration_ms: duration ?? null,
    error: error ? String(error).slice(0, 160) : null,
    created_at: new Date().toISOString(),
  };
}

/** Registra en el buffer de sesión. Devuelve el registro. Nunca lanza. */
export function registrar(partes) {
  const reg = construirRegistro(partes);
  try {
    _buffer.push(reg);
    if (_buffer.length > MAX) _buffer.shift();
  } catch { /* noop */ }
  return reg;
}

export function eventos() { return _buffer.slice(); }
export function limpiarEventos() { _buffer.length = 0; }
export { MODEL_VERSION };
