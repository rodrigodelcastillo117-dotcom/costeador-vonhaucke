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
const limpiarId = (s) => String(s || 'sin-id').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
const extDe = (dataUrl) => {
  const mime = (String(dataUrl).match(/^data:([a-z]+\/[a-z0-9.+-]+);/) || [])[1] || 'desconocido';
  return { mime, ext: mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png' };
};
const MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);   // lo que acepta el bucket

/** Ruta determinista por partida y momento: partidas/<id>/<ts>.<ext>. */
export function rutaRenderPartida(pt, dataUrl, ahora = Date.now()) {
  return `partidas/${limpiarId(pt?.id)}/${ahora}.${extDe(dataUrl).ext}`;
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
  if (!r?.ok || typeof r.dataUrl !== 'string' || !r.dataUrl.startsWith('data:')) return { ok: false, error: r?.error || 'No se pudo generar el render.' };
  const { mime } = extDe(r.dataUrl);
  if (!MIMES.has(mime)) return { ok: false, error: `Formato de imagen no permitido (${mime}).` };
  let up;
  try { up = await subir(r.dataUrl, rutaRenderPartida(pt, r.dataUrl, ahora)); } catch (e) { return { ok: false, error: 'No se pudo guardar la imagen.' }; }
  if (!up?.ok || typeof up.url !== 'string' || !/^https?:\/\//.test(up.url)) return { ok: false, error: up?.error || 'No se pudo guardar la imagen; el render no se conservó.' };
  return { ok: true, url: up.url };
}
