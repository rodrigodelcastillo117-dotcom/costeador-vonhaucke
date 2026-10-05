// ============================================================================
//  TELEMETRÍA  ·  observabilidad honesta y auto-contenida (sin dependencia externa)
//  La app vive en campo, a veces sin internet y en un solo HTML. Esto NO manda a
//  un servicio pago por default: captura en memoria (anillo) los últimos errores y
//  eventos para que Dirección los vea/exporte, y SI se configura un endpoint los
//  envía best-effort. Las redes globales (window.onerror/unhandledrejection) ya
//  existen en main.jsx: desde ahí se llama a registrarError (no se duplican listeners).
//  Nunca lanza: la observabilidad jamás debe tumbar la app.
// ============================================================================

const MAX = 50;                       // anillo: últimos N eventos
const buffer = [];                    // [{t, tipo, msg, ctx, stack}]
let endpoint = null;                  // POST opcional (lo configura la app si hay)

function push(entry) {
  try {
    buffer.push({ t: new Date().toISOString(), ...entry });
    if (buffer.length > MAX) buffer.shift();
    if (endpoint) enviar(entry);      // best-effort, no bloquea
  } catch { /* la telemetría nunca tumba la app */ }
}

async function enviar(entry) {
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...entry, t: new Date().toISOString(), ua: typeof navigator !== 'undefined' ? navigator.userAgent : null }),
      keepalive: true,
    });
  } catch { /* offline o sin endpoint: queda en el anillo local */ }
}

// Configura un endpoint de envío (opcional). Sin esto, la telemetría es sólo local.
export function configurarTelemetria({ endpoint: ep } = {}) {
  if (typeof ep === 'string' && /^https?:\/\//.test(ep)) endpoint = ep;
}

// Registra un ERROR con contexto (pantalla, acción…). Seguro ante cualquier input.
export function registrarError(error, ctx = {}) {
  const msg = error?.message || String(error || 'error');
  push({ tipo: 'error', msg: String(msg).slice(0, 500), ctx, stack: String(error?.stack || '').slice(0, 2000) });
}

// Registra un EVENTO de uso (navegación, acción clave) — sin datos sensibles.
export function registrarEvento(nombre, datos = {}) {
  push({ tipo: 'evento', msg: String(nombre || '').slice(0, 120), ctx: datos });
}

// Los últimos eventos capturados (para un panel de "ver errores" / exportar).
export function erroresRecientes() {
  return buffer.slice().reverse();
}

// Texto plano para copiar/mandar (debug de campo).
export function exportarTelemetria() {
  return erroresRecientes()
    .map((e) => `[${e.t}] ${e.tipo.toUpperCase()} ${e.msg}${e.ctx && Object.keys(e.ctx).length ? ' · ' + JSON.stringify(e.ctx) : ''}`)
    .join('\n');
}

// Sólo para pruebas: vacía el anillo.
export function _reset() { buffer.length = 0; endpoint = null; }
