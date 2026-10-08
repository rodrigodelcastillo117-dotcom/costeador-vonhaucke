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

// FIX outage imagen/plano: la 1ª pasada VISUAL (extraer BOM de un render/plano, que el usuario
// CONFIRMA; NO fija costo — el motor costea con precios canónicos) usa un modelo RÁPIDO para no
// exceder el wall-clock de la función (Opus tardaba >75 s en el TTFT de visión → PROVIDER_TIMEOUT).
// Opus se conserva para texto/revisión/pasadas de costeo. Default allowlisted; override por env;
// fail-closed igual que resolverModelo.
export const MODELO_VISUAL_DEFAULT = Object.freeze({
  "analizar-mueble": "claude-sonnet-5-5",
});
export function resolverModeloVisual(fn, env = {}) {
  const k = "ANTHROPIC_MODEL_VISUAL_" + String(fn || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const ov = env[k];
  if (ov != null && String(ov).trim() !== "") {
    const v = String(ov).trim();
    if (!MODELOS_PERMITIDOS.has(v)) {
      const err = new Error(`CONFIG de modelo visual inválida para '${fn}': '${v}' no está en la allowlist.`);
      err.code = "MODEL_CONFIG_INVALID";
      throw err;
    }
    return v;
  }
  const def = MODELO_VISUAL_DEFAULT[fn];
  if (!def) {
    const err = new Error(`CONFIG de modelo visual ausente: no hay default para '${fn}'.`);
    err.code = "MODEL_CONFIG_MISSING";
    throw err;
  }
  return def;
}

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
