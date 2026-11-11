// ============================================================================
//  SONDEO del análisis ASÍNCRONO de mueble (opus en segundo plano).
//
//  La edge `analizar-mueble`, en la pasada de TEXTO, corre opus con EdgeRuntime.waitUntil
//  (hasta el wall-clock de ~400 s del plan de pago) y RESPONDE AL INSTANTE con
//  { procesando:true, job_id }. Aquí se consulta `estado_analisis(request_id)` hasta que la
//  función escribe `resultado` — la ÚNICA señal de completitud: se escribe tanto en éxito
//  ({ ok:true, propuesta, ... }) como en fallo ({ ok:false, code, error }). Se devuelve TAL CUAL,
//  así el llamador recibe el MISMO shape que en modo síncrono (los componentes no cambian).
//
//  PURO Y TESTEABLE: `rpc(requestId) -> { data, error }` se INYECTA; no depende de red ni de
//  Supabase. Un error transitorio del rpc NO rompe el sondeo (reintenta). Nunca cuelga para
//  siempre: al agotar `maxMs` devuelve POLL_TIMEOUT.
// ============================================================================

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export async function sondearAnalisis(requestId, { intervaloMs = 3000, maxMs = 380000, rpc } = {}) {
  if (typeof rpc !== 'function') {
    return { ok: false, code: 'SIN_RPC', error: 'No se pudo consultar el análisis. Vuelve a intentar.' };
  }
  const t0 = Date.now();
  let visto = false; // ¿apareció la fila alguna vez? (distingue "aún no visible" de "sin red")
  while (Date.now() - t0 < maxMs) {
    await espera(intervaloMs);
    let row;
    try {
      const { data, error } = await rpc(requestId);
      if (error) continue;                       // error transitorio de red/RPC: reintentar
      row = Array.isArray(data) ? data[0] : data;
    } catch (_e) { continue; }
    if (!row) continue;                          // fila aún no visible (o no es del usuario)
    visto = true;
    if (row.resultado != null) return row.resultado;   // completó: resultado = la respuesta
    // Caso raro: estado final con error pero SIN resultado (el worker murió antes de escribirlo).
    if (row.status && row.status !== 'started' && row.error_code) {
      return { ok: false, code: row.error_code, error: 'El análisis terminó con un error. Vuelve a intentar.' };
    }
  }
  return {
    ok: false,
    code: 'POLL_TIMEOUT',
    error: visto
      ? 'El análisis está tardando más de lo normal. Vuelve a intentar en un momento.'
      : 'No se pudo consultar el análisis. Revisa tu internet y vuelve a intentar.',
  };
}
