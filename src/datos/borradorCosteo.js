// ============================================================================
//  BORRADOR DEL COSTEO MANUAL EN ESTA COMPUTADORA — Área J (resiliencia), defecto R-05.
//
//  El despiece del Costeo manual (Dirección/Diseño) vivía SÓLO en memoria (App.jsx · `useState(costeoEnBlanco)`):
//  una recarga, un cierre de pestaña o un "la página dejó de responder" a media captura lo borraba sin una
//  palabra (medido en e2e/resiliencia.e2e.js · escenario 4d: 2 piezas antes, 0 después, ningún aviso). Aquí se
//  conserva el borrador en localStorage (misma computadora, misma persona) y se recupera al volver.
//  · Sólo se guarda un costeo CON contenido (piezas, nombre o descripción); el costeo en blanco borra la clave.
//  · No se guardan imágenes embebidas gigantes (data:… base64): el borrador es el despiece, no los binarios.
//  · Al salir de la sesión se borra (App.jsx · hacerLogout), igual que lo sensible de Dirección.
// ============================================================================
export const CLAVE_BORRADOR_COSTEO = 'costeador-vonhaucke-costeo-borrador-v1';

export function costeoConContenido(c) {
  if (!c || typeof c !== 'object') return false;
  const comps = Array.isArray(c.componentes) ? c.componentes : [];
  return comps.some((x) => x && (x.insumoId || String(x.nombre || '').trim()))
    || !!String(c.nombre || '').trim()
    || !!String(c.descripcionCliente || '').trim();
}

const sinBinarios = (c) => {
  const out = { ...c };
  if (typeof out.imagen === 'string' && out.imagen.startsWith('data:') && out.imagen.length > 100000) out.imagen = null;
  return out;
};

/** Guarda (o retira, si está en blanco) el borrador. Nunca lanza; devuelve si quedó en esta computadora. */
export function guardarBorradorCosteo(storage, costeo, ahora = new Date()) {
  try {
    if (!storage) return false;
    if (!costeoConContenido(costeo)) { storage.removeItem(CLAVE_BORRADOR_COSTEO); return true; }
    storage.setItem(CLAVE_BORRADOR_COSTEO, JSON.stringify({ version: 1, guardado: ahora.toISOString(), costeo: sinBinarios(costeo) }));
    return true;
  } catch {
    return false;
  }
}

/** El borrador guardado ({ version, guardado, costeo }) o null si no hay / está dañado / está en blanco. */
export function leerBorradorCosteo(storage) {
  try {
    const j = JSON.parse(storage?.getItem(CLAVE_BORRADOR_COSTEO) || 'null');
    if (j && j.version === 1 && costeoConContenido(j.costeo)) return j;
  } catch { /* dañado: se ignora, no se inventa nada */ }
  return null;
}

export function borrarBorradorCosteo(storage) {
  try { storage?.removeItem(CLAVE_BORRADOR_COSTEO); } catch { /* nada que hacer */ }
}
