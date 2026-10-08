// ============================================================================
//  P0.COSTEO · Commit 2 · TELEMETRÍA (PURA, sólo observabilidad)
//  Arma los campos de telemetría de analizar-mueble SIN secretos ni contenido.
//  - NUNCA incluye prompt, descripción del usuario, BOM, JWT, cookies, API keys.
//  - `telemetriaExtra` es una WHITELIST estricta: cualquier clave fuera del set se
//    descarta, aunque el caller la pase por error. Así un refactor no puede filtrar
//    el prompt/BOM a la DB.
//  Offline: no toca Deno ni red; testeable en Node/vitest.
// ============================================================================

export const MODALIDADES = new Set(["texto", "imagen", "pdf", "revision"]);

// Modalidad de la petición (= columna `modo`). Precedencia preservada de v28
// (soloTexto → texto; revisión → revision), refinada para distinguir pdf de imagen.
export function modalidadDe({ soloTexto = false, esRevision = false, esPdf = false } = {}) {
  if (soloTexto) return "texto";
  if (esRevision) return "revision";
  if (esPdf) return "pdf";
  return "imagen";
}

// Mapea un error del proveedor a { code, modelStatus } — MISMA lógica que los dos
// catch de index.ts (timeout/abort, código del proveedor, o genérico). Extraído para
// poder testear timeout y 4xx/5xx sin levantar Deno. Behavior-preserving.
export function mapProviderError(e) {
  const code = e?.name === "AbortError" ? "PROVIDER_TIMEOUT" : String(e?.code || "CLAUDE_API_ERROR");
  const modelStatus = String(e?.code || e?.name || "provider_error");
  // http REAL del proveedor si existe; null si NO hubo respuesta (abort/timeout). No se
  // confunde con el status que devuelve NUESTRA Edge Function (ese lo decide el wiring).
  const http = Number.isFinite(Number(e?.http)) ? Number(e.http) : null;
  return { code, modelStatus, http };
}

const _int = (x) => {
  const n = Math.round(Number(x));
  return Number.isFinite(n) ? n : null;
};

// WHITELIST de campos nuevos de observabilidad (columnas nuevas pendientes de migración).
// Devuelve SÓLO estas claves, con tipos coercidos; descarta null/undefined y CUALQUIER
// clave ajena. `retry_used` NO va aquí: es derivable de attempts (>1) en consulta.
//   · user_input_chars = longitud del TEXTO del usuario (NO el tamaño total del prompt).
//   · provider_http_status = status HTTP REAL de Anthropic (≠ http_status de NUESTRA fn).
//   · provider_duration_ms / headers_ms / body_ms = tiempos de la llamada al proveedor.
//   · input_tokens / output_tokens = data.usage del proveedor (sólo conteos, sin contenido).
export function telemetriaExtra({
  model_id,
  effort,
  max_tokens,
  user_input_chars,
  catalog_count,
  catalog_chars,
  input_tokens,
  output_tokens,
  provider_http_status,
  provider_duration_ms,
  provider_headers_ms,
  provider_body_ms,
  fallback_used,
} = {}) {
  const out = {};
  if (typeof model_id === "string" && model_id) out.model_id = model_id;
  if (typeof effort === "string" && effort) out.effort = effort;
  // null/undefined se OMITEN (no se escriben → la columna queda NULL). Ojo: Number(null)===0,
  // por eso hay que cortar antes de coercer, o un null terminaría guardado como 0.
  const put = (k, v) => { if (v == null) return; const n = _int(v); if (n != null) out[k] = n; };
  put("max_tokens", max_tokens);
  put("user_input_chars", user_input_chars);
  put("catalog_count", catalog_count);
  put("catalog_chars", catalog_chars);
  put("input_tokens", input_tokens);
  put("output_tokens", output_tokens);
  put("provider_http_status", provider_http_status);
  put("provider_duration_ms", provider_duration_ms);
  put("provider_headers_ms", provider_headers_ms);
  put("provider_body_ms", provider_body_ms);
  if (typeof fallback_used === "boolean") out.fallback_used = fallback_used;
  return out;
}

// Claves que JAMÁS deben persistirse (guard explícito para tests).
export const CLAVES_PROHIBIDAS = new Set([
  "prompt", "system", "descripcion", "desc", "texto", "description",
  "piezas", "propuesta", "bom", "informe",
  "authorization", "jwt", "cookie", "api_key", "apikey", "password", "key",
]);
