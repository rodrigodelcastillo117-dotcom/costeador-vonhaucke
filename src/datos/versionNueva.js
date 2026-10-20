// ============================================================================
//  VERSIÓN NUEVA PUBLICADA CON LA APP ABIERTA (2026-10-18).
//
//  Cada pantalla es un archivo aparte con un nombre que cambia en cada versión
//  (`assets/Precios-<hash>.js`). Vercel sólo sirve los archivos de la versión
//  publicada: una pestaña abierta desde ANTES de un deploy (o de un rollback) pide
//  los de la suya, recibe 404 y TODAS las pantallas caían en "Esta pantalla se
//  atoró". "Reintentar" no servía: React guarda la carga fallida y la repite.
//  Sólo una recarga completa trae el index.html nuevo (Vercel lo sirve con
//  `max-age=0, must-revalidate`) y con él los nombres buenos.
//
//  Aquí: se reconoce ese error y se recarga UNA vez. Un candado en sessionStorage
//  impide el bucle: si en 60 s vuelve a fallar, ya no se recarga sola y la red de
//  seguridad muestra el botón para hacerlo a mano. Sin sessionStorage no se
//  recarga sola (no habría con qué evitar el bucle).
// ============================================================================

export const CLAVE_RECARGA_VERSION = 'vh:recargaPorVersion';
export const VENTANA_RECARGA_MS = 60_000;

// Mensajes de los navegadores cuando un import() dinámico no carga (Chrome/Edge, Firefox, Safari) y los de Vite.
const RX_VERSION = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError|Loading chunk \S+ failed/i;

export function esErrorDeVersion(error) {
  const m = error && typeof error === 'object' ? (error.message ?? '') : (error ?? '');
  return RX_VERSION.test(String(m));
}

function storagePorOmision() {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch { return null; }
}

// SIN INTERNET (2026-10-19, e2e/versionNueva.e2e.js): el MISMO error ("Failed to fetch dynamically imported module")
// sale al abrir sin red una pantalla que aún no se había descargado. Recargar ahí cambia la app por la página de
// error del navegador ("Sin conexión a Internet") justo cuando la cabecera promete "sigue en esta computadora".
// Sin red NO se recarga (ni se gasta el candado): la red de seguridad lo dice y se recarga sola al volver la red.
export function sinRed(nav = typeof navigator !== 'undefined' ? navigator : null) {
  return nav?.onLine === false;
}

/** Recarga la página si no se recargó por esta causa en la ventana (y hay red). Devuelve true si recargó. */
export function recargarUnaVez({ storage = storagePorOmision(), recargar = () => window.location.reload(), ahora = Date.now(), offline = sinRed() } = {}) {
  if (offline) return false;
  if (!storage) return false;
  try {
    const previa = Number(storage.getItem(CLAVE_RECARGA_VERSION)) || 0;
    if (ahora - previa < VENTANA_RECARGA_MS) return false;
    storage.setItem(CLAVE_RECARGA_VERSION, String(ahora));
  } catch {
    return false;
  }
  recargar();
  return true;
}

/**
 * Vite (≥5) avisa con `vite:preloadError` cuando falla CUALQUIER import() dinámico (la pantalla o sus dependencias).
 * Si se recarga, se cancela el error (preventDefault) para que no se pinte la pantalla de fallo en el instante
 * antes de recargar; si no se recarga (candado), el error sigue su camino hasta la red de seguridad.
 */
export function instalarRecargaPorVersion(win = window, deps = {}) {
  win.addEventListener('vite:preloadError', (ev) => {
    if (recargarUnaVez(deps)) ev.preventDefault();
  });
}
