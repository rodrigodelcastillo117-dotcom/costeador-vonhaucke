// ============================================================================
//  ERRORES DE LAS EDGE (IA) EN PALABRAS DE LA PERSONA — Área J (resiliencia), defecto R-02.
//
//  supabase-js entrega los fallos de `functions.invoke` con mensajes de librería, en inglés:
//    · FunctionsHttpError  → "Edge Function returned a non-2xx status code" (504 del gateway, 502…)
//    · FunctionsFetchError → "Failed to send a request to the Edge Function" (sin red, tiempo agotado)
//    · SyntaxError          → "Unterminated string in JSON at position 55" (respuesta truncada)
//  y nube.js los pasaba tal cual a la pantalla ("let msg = error.message || …"). Medido en
//  e2e/resiliencia.e2e.js (escenarios 2 y 3): un vendedor leía "Edge Function returned a non-2xx
//  status code" cuando la IA tardó demasiado. Aquí se traducen por TIPO y STATUS; si la Edge mandó su
//  propio `error` en JSON (ya en español), quien llama lo sigue prefiriendo.
//  Ningún mensaje promete algo que no pasó: todos dicen que NO se cambió nada y que se puede reintentar.
// ============================================================================

const TIEMPO = new Set([408, 504, 524, 546]);   // 546 = límite de cómputo/recursos de Supabase Edge
const CAIDA = new Set([500, 502, 503]);

export function mensajeErrorEdge(error, porDefecto = 'No se pudo completar la operación. Vuelve a intentar.') {
  if (!error) return porDefecto;
  const nombre = String(error.name || '');
  const status = Number(error.context?.status) || null;
  if (nombre === 'FunctionsFetchError') {
    return 'No se pudo conectar con el servicio de IA (sin red o tiempo agotado). No se cambió nada; revisa tu internet y vuelve a intentar.';
  }
  if (nombre === 'FunctionsRelayError') {
    return 'El servicio de IA no respondió bien en este momento. No se cambió nada; vuelve a intentar en un momento.';
  }
  if (nombre === 'FunctionsHttpError' || status) {
    if (status && TIEMPO.has(status)) return 'La IA tardó demasiado en responder (tiempo agotado). No se cambió nada; vuelve a intentar.';
    if (status === 401 || status === 403) return 'Tu sesión expiró o no tiene permiso para usar la IA. No se cambió nada; vuelve a entrar e inténtalo de nuevo.';
    if (status === 429) return 'La IA está saturada en este momento. No se cambió nada; espera un momento y vuelve a intentar.';
    if (status && CAIDA.has(status)) return 'El servicio de IA falló o no está disponible en este momento. No se cambió nada; vuelve a intentar en un momento.';
    return porDefecto;
  }
  // Cuerpo 200 que no es JSON válido (respuesta truncada / mal formada).
  if (nombre === 'SyntaxError' || /JSON/.test(String(error.message || ''))) {
    return 'La IA respondió algo que no se pudo leer (respuesta incompleta o mal formada). No se agregó nada; vuelve a intentar.';
  }
  return porDefecto;
}
