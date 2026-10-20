// ============================================================================
//  ERRORES TARDÍOS (después de que React montó) · auditoría externa 2026-10-19.
//
//  La malla de arranque de main.jsx (pintarFallo) sólo pinta cuando #raiz está VACÍO: es para "la app no
//  abrió". Una vez montada, un error en un manejador de evento (onClick que truena, promesa sin catch) no
//  llega a ningún error boundary: quedaba SÓLO en la consola y la persona sentía "le piqué y no hizo nada".
//
//  Aquí: un aviso NO destructivo, encima de la app y fuera de #raiz (React no se entera; su DOM no se toca):
//    "No se pudo completar esta acción. Tu trabajo sigue guardado."  + Ref. <id>  + botón Cerrar.
//  - Sólo después del montaje: #raiz con hijos y sin la pantalla de arranque fallido (data-fallo="1").
//  - NUNCA llama preventDefault: el error sigue en la consola y en la telemetría (main.jsx lo registra con el
//    mismo id que enseña el aviso, para poder cruzarlos).
//  - Ref. = el request_id del error si lo trae (errores de Edge/servidor), si no un id corto propio.
//  - Avisos repetidos se agrupan (debounce): una ráfaga de errores = UN aviso con "(N veces)".
//  - No avisa de lo que ya tiene su propio mensaje: archivo de otra versión (versionNueva.js), pantalla
//    atrapada por la red de seguridad (SinPantallaBlanca: data-red-seguridad), ni ruido conocido del navegador.
// ============================================================================
import { esErrorDeVersion } from './datos/versionNueva.js';

export const TEXTO_AVISO_TARDIO = 'No se pudo completar esta acción. Tu trabajo sigue guardado.';
export const ID_AVISO_TARDIO = 'vh-aviso-error-tardio';
const DEBOUNCE_MS = 5000;
const AUTOCIERRE_MS = 15000;
const ESPERA_MS = 150;   // deja que un error boundary pinte su pantalla antes de decidir si hace falta el aviso

// Ruido del navegador que llega como `error` sin que nada haya fallado para la persona.
const RX_RUIDO = /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/i;

function mensajeDe(error) {
  if (error == null) return '';
  if (typeof error === 'string') return error;
  return String(error.message ?? error.reason ?? '');
}

/** ¿Este error amerita el aviso? (false = ruido, cancelación o algo que ya tiene su propio mensaje). */
export function ameritaAviso(error) {
  const m = mensajeDe(error);
  if (RX_RUIDO.test(m)) return false;
  if (esErrorDeVersion(error)) return false;   // versionNueva.js recarga o SinPantallaBlanca dice "Hay una versión nueva"
  if (error && typeof error === 'object' && error.name === 'AbortError') return false;   // cancelación pedida por la app
  return true;
}

const RX_REQUEST_ID = /\b(req[-_][A-Za-z0-9_-]{3,64})\b/;
/** El request id que trae el error (respuesta de una Edge o del servidor), si lo trae. */
export function requestIdDe(error) {
  if (!error || typeof error !== 'object') {
    const m = RX_REQUEST_ID.exec(mensajeDe(error));
    return m ? m[1] : null;
  }
  const candidatos = [error.request_id, error.requestId, error.context?.request_id, error.context?.requestId,
    error.details?.request_id, error.cause?.request_id, error.cause?.requestId];
  for (const c of candidatos) if (typeof c === 'string' && c.trim()) return c.trim().slice(0, 80);
  const m = RX_REQUEST_ID.exec(mensajeDe(error));
  return m ? m[1] : null;
}

/** Id corto para cruzar el aviso con la consola/telemetría: E-<base36 tiempo><azar>. */
export function idCortoError({ ahora = Date.now(), azar = Math.random } = {}) {
  const t = (ahora % 1679616).toString(36).padStart(4, '0');            // 36^4: últimos ~28 min, suficiente para cruzar
  const r = Math.floor(azar() * 1296).toString(36).padStart(2, '0');    // 36^2
  return `E-${(t + r).toUpperCase()}`;
}

/** React ya montó: #raiz tiene hijos y no es la pantalla de "La app no pudo abrir" (pintarFallo). */
export function appMontada(doc) {
  const raiz = doc?.getElementById?.('raiz');
  return !!raiz && raiz.childElementCount > 0 && raiz.dataset?.fallo !== '1';
}

/**
 * Crea el manejador. `notificar(error)` decide y, si toca, pinta el aviso; devuelve el id (o null si no avisó).
 * Dependencias inyectables para probarlo sin navegador.
 */
export function crearAvisoErrorTardio({
  doc = typeof document !== 'undefined' ? document : null,
  ahora = () => Date.now(),
  programar = (fn, ms) => setTimeout(fn, ms),
  cancelar = (t) => clearTimeout(t),
  azar = Math.random,
  debounceMs = DEBOUNCE_MS,
  autocierreMs = AUTOCIERRE_MS,
  esperaMs = ESPERA_MS,
} = {}) {
  let ultimo = -Infinity;     // cuándo se enseñó (o se agrupó) el último aviso
  let veces = 0;
  let refActual = null;
  let pendiente = false;      // decidido pero aún no pintado (espera del error boundary)
  let timerCierre = null;

  const cerrar = () => {
    cancelar(timerCierre); timerCierre = null;
    try { doc?.getElementById?.(ID_AVISO_TARDIO)?.remove?.(); } catch { /* el aviso nunca tumba nada */ }
  };

  function pintar(textoDeRef) {
    const caja = doc.createElement('div');
    caja.id = ID_AVISO_TARDIO;
    caja.setAttribute('role', 'alert');
    caja.setAttribute('aria-live', 'assertive');
    caja.setAttribute('data-testid', 'aviso-error-tardio');
    caja.style.cssText = [
      'position:fixed', 'top:16px', 'left:50%', 'transform:translateX(-50%)', 'z-index:2147483646',
      'max-width:min(560px,calc(100vw - 32px))', 'display:flex', 'gap:12px', 'align-items:flex-start',
      'padding:12px 14px', 'border-radius:10px', 'background:#FFF8E6', 'color:#1E1B1A', 'border:1px solid #B8912F',
      'box-shadow:0 10px 30px rgba(0,0,0,.18)', 'font:14px/1.45 system-ui,sans-serif',
    ].join(';');
    const cuerpo = doc.createElement('div');
    const texto = doc.createElement('div');
    texto.setAttribute('data-testid', 'aviso-error-tardio-texto');
    texto.style.cssText = 'font-weight:600';
    texto.textContent = TEXTO_AVISO_TARDIO;
    const detalle = doc.createElement('div');
    detalle.setAttribute('data-testid', 'aviso-error-tardio-ref');
    detalle.style.cssText = 'font-size:12px;color:#6b645c;margin-top:2px';
    detalle.textContent = textoDeRef;
    cuerpo.appendChild(texto);
    cuerpo.appendChild(detalle);
    const boton = doc.createElement('button');
    boton.setAttribute('type', 'button');
    boton.setAttribute('aria-label', 'Cerrar aviso');
    boton.textContent = 'Cerrar';
    boton.style.cssText = 'flex:none;padding:4px 10px;border:1px solid #B8912F;background:#fff;color:#1E1B1A;border-radius:6px;cursor:pointer;font:600 13px system-ui,sans-serif';
    boton.addEventListener('click', cerrar);
    caja.appendChild(cuerpo);
    caja.appendChild(boton);
    doc.body.appendChild(caja);
    return detalle;
  }

  const textoRef = () => (veces > 1 ? `Ref. ${refActual} (${veces} veces)` : `Ref. ${refActual}`);

  function notificar(error, { id } = {}) {
    try {
      if (!doc || !ameritaAviso(error) || !appMontada(doc)) return null;
      const t = ahora();
      const visible = doc.getElementById(ID_AVISO_TARDIO);
      // Ráfaga: el mismo aviso cuenta las veces (no se apilan cajas ni se re-anima nada).
      if ((visible || pendiente) && t - ultimo < debounceMs) {
        veces += 1; ultimo = t;
        const r = visible?.querySelector?.('[data-testid="aviso-error-tardio-ref"]');
        if (r) r.textContent = textoRef();
        return refActual;
      }
      if (!visible && t - ultimo < debounceMs) return null;   // la persona lo cerró hace un momento: no se reabre en la misma ráfaga
      refActual = requestIdDe(error) || id || idCortoError({ ahora: t, azar });
      ultimo = t; veces = 1; pendiente = true;
      // Se decide un instante después: si un error boundary atrapó el error, su pantalla ya lo dice.
      programar(() => {
        pendiente = false;
        try {
          if (doc.querySelector?.('[data-red-seguridad]')) return;
          cerrar();
          pintar(textoRef());
          timerCierre = programar(cerrar, autocierreMs);
        } catch { /* el aviso nunca tumba nada */ }
      }, esperaMs);
      return refActual;
    } catch {
      return null;
    }
  }

  return { notificar, cerrar };
}
