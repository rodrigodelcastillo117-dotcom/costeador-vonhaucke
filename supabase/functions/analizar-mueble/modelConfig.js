// ============================================================================
//  P0.COSTEO · Commit 2 · CONFIG DE MODELO (centralizada, PURA, fail-closed)
//  Resuelve el model_id por Edge Function con un DEFAULT EXPLÍCITO.
//  - NO cambia el modelo activo: el default de analizar-mueble sigue 'claude-opus-5'
//    (idéntico a v28). Esto sólo centraliza y hace observable/testeable la elección.
//  - FAIL-CLOSED: si hay un override pero es inválido (o no hay default para la fn),
//    LANZA. Nunca inventa un modelo en silencio.
//  - NO implementa fallback de modelo (fuera de alcance de este commit).
//  Offline: no toca Deno ni red; recibe un `env` plano para ser testeable en Node/vitest.
// ============================================================================

// Allowlist de ids de modelo VÁLIDOS para pasar validación de override. Incluir un id
// aquí NO lo selecciona: la selección la hace el DEFAULT o un override explícito en env.
export const MODELOS_PERMITIDOS = new Set([
  "claude-opus-5",        // activo-legacy (DEFAULT actual, idéntico a v28)
  "claude-opus-5-5",
  "claude-sonnet-5-5",
  "claude-haiku-5-5",
  "claude-fable-5-1",
]);

// DEFAULT EXPLÍCITO por Edge Function. Si una fn no está aquí, resolverModelo LANZA
// (no hay "modelo por si acaso": fail-closed).
export const MODELO_DEFAULT = Object.freeze({
  "analizar-mueble": "claude-opus-5",
});

// Nombre de la variable de entorno de override por función: ANTHROPIC_MODEL_<FN>
// (mayúsculas, guiones→guiones_bajos). Ej: 'analizar-mueble' → ANTHROPIC_MODEL_ANALIZAR_MUEBLE.
export function envKeyPorFn(fn) {
  return "ANTHROPIC_MODEL_" + String(fn || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

// Resuelve el model_id para una fn. Precedencia: override por-fn → (global SI se permite) → default.
// Un override presente pero inválido (no en la allowlist) LANZA (fail-closed).
// `env` es un objeto plano (en Deno: sólo las claves ANTHROPIC_MODEL* — nunca todo el entorno).
//
// AISLAMIENTO (P0.COSTEO · 2b): `permitirGlobal` es FALSE por defecto. Así, aunque exista
// un secret ANTHROPIC_MODEL global (que usan Council u otras funciones), NO afecta a esta
// función: sólo su override por-fn o el default. Un caller debe OPTAR explícitamente por el
// global para usarlo. Esto evita cambiar el Costeador sin tocar una línea.
export function resolverModelo(fn, env = {}, { permitirGlobal = false } = {}) {
  const porFn = env[envKeyPorFn(fn)];
  const global = permitirGlobal ? env.ANTHROPIC_MODEL : undefined;
  const override = (porFn != null && String(porFn).trim() !== "")
    ? String(porFn).trim()
    : (global != null && String(global).trim() !== "") ? String(global).trim() : null;

  if (override != null) {
    if (!MODELOS_PERMITIDOS.has(override)) {
      const err = new Error(`CONFIG de modelo inválida para '${fn}': '${override}' no está en la allowlist.`);
      err.code = "MODEL_CONFIG_INVALID";
      throw err;
    }
    return override;
  }

  const def = MODELO_DEFAULT[fn];
  if (!def) {
    const err = new Error(`CONFIG de modelo ausente: no hay default para '${fn}'.`);
    err.code = "MODEL_CONFIG_MISSING";
    throw err;
  }
  return def;
}

/**
 * Revisión de planos: Sonnet tiene evidencia real de respuestas visuales ~27 s,
 * mientras Opus agotó repetidamente la ventana de 45 s en modo revisión.
 * Sólo cambia la selección de MODELO para revisiones, no la certificación:
 * el BOM sigue sujeto a validación y confirmación humanas.
 * Overrides inválidos fallan cerrados.
 */
export function resolverModeloPorPasada(fn, env = {}, { esRevision = false, esVisual = false } = {}) {
  if (!esRevision && !esVisual) return resolverModelo(fn, env);
  const revision = String(env.ANTHROPIC_MODEL_ANALIZAR_MUEBLE_REVISION || '').trim();
  if (!revision) return 'claude-sonnet-5-5';
  if (!MODELOS_PERMITIDOS.has(revision)) {
    const err = new Error('MODEL_CONFIG_INVALID para revisión');
    err.code = 'MODEL_CONFIG_INVALID';
    throw err;
  }
  return revision;
}
