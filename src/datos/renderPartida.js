// ============================================================================
//  RENDER DE UNA PARTIDA → SIEMPRE URL (mandato §11 #2 · VH-045)
//
//  `generar-render` devuelve la imagen en base64 (dataUrl). Cotizacion.jsx la
//  guardaba TAL CUAL en `partida.render`: cientos de KB por renglón dentro del
//  estado, del respaldo local y del payload a la nube; y el contrato de partida
//  (crearPartida) la descartaba al reconstruir, con lo que el render "se perdía"
//  al reabrir. Desde hoy el render se sube al bucket público `renders` y en la
//  partida sólo vive la URL. Si Storage falla, NO se guarda nada y se avisa:
//  una imagen que no se puede conservar no se finge conservada.
//
//  Puro: recibe `generar` y `subir` inyectados para poder probarse sin red.
// ============================================================================
import { leerRespuestaRender } from './renderRespuesta.js';
import { imagenAStorage, rutaImagen } from './imagenStorage.js';

/** Ruta determinista por partida y momento: partidas/<id>/<ts>.<ext>. */
export function rutaRenderPartida(pt, dataUrl, ahora = Date.now()) {
  return rutaImagen('partidas', pt?.id, '', dataUrl, ahora);
}

/**
 * Genera el render y lo deja en Storage. Devuelve {ok:true, url} o {ok:false, error}.
 * Nunca devuelve base64 al que llama.
 */
export async function renderParaPartida(pt, { generar, subir, ahora = Date.now() } = {}) {
  if (!pt) return { ok: false, error: 'Sin partida.' };
  if (typeof generar !== 'function' || typeof subir !== 'function') return { ok: false, error: 'Render no disponible.' };
  let r;
  try { r = await generar(pt.nombre || 'mueble de oficina', { tipo: pt.ruta || '' }); } catch (e) { return { ok: false, error: 'No se pudo conectar.' }; }
  // VH-072: la edge v30 ya guarda el render en Storage y devuelve `url`; se usa tal
  // cual (sin copiarlo). Si llegó `dataUrl` (respaldo), se sube como antes.
  const lr = leerRespuestaRender(r);
  if (!lr.ok) return { ok: false, error: lr.error || 'No se pudo generar el render.' };
  if (lr.enStorage) return { ok: true, url: lr.imagen };
  return imagenAStorage(lr.imagen, rutaRenderPartida(pt, lr.imagen, ahora), { subir });
}
