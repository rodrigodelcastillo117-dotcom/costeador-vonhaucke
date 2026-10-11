// ============================================================================
//  IMÁGENES → STORAGE, NUNCA BASE64 EN EL ESTADO (VH-045 / VH-046)
//
//  Toda imagen que la app genera o recibe (render de partida, render 3D de la
//  oficina, foto amueblada, escena por cuarto, foto que sube el usuario) se sube
//  al bucket público `renders` y en la cotización vive SÓLO la URL. Producción
//  (2026-10-11): 14 cotizaciones cargan `acomodo.render3d` en base64 (24 MB en
//  total, una de 2.9 MB) y cada guardado las reenviaba enteras.
//
//  Puro: `subir`/`traer` se inyectan para probarse sin red.
// ============================================================================
export const MIMES_BUCKET = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function mimeDe(dataUrl) {
  return (String(dataUrl).match(/^data:([a-z]+\/[a-z0-9.+-]+);/) || [])[1] || 'desconocido';
}
const EXT = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' };
export const extDe = (dataUrl) => EXT[mimeDe(dataUrl)] || 'bin';
const limpiar = (s) => String(s || 'sin-id').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);

/** `<carpeta>/<id>/<nombre>-<ts>.<ext>` — determinista y sin caracteres raros. */
export function rutaImagen(carpeta, id, nombre, dataUrl, ahora = Date.now()) {
  return `${carpeta}/${limpiar(id)}/${nombre ? limpiar(nombre) + '-' : ''}${ahora}.${extDe(dataUrl)}`;
}

export const esURL = (s) => typeof s === 'string' && /^https?:\/\//.test(s);
export const esDataUrl = (s) => typeof s === 'string' && s.startsWith('data:');

/**
 * Sube un dataUrl y devuelve {ok:true,url} o {ok:false,error}. Nunca devuelve el
 * base64 al que llama: si no se pudo conservar, no se finge conservado.
 */
export async function imagenAStorage(dataUrl, path, { subir } = {}) {
  // VH-072: lo que ya es URL pública (la edge generar-render v30 guarda en Storage)
  // no se vuelve a subir: se conserva esa URL.
  if (esURL(dataUrl)) return { ok: true, url: dataUrl };
  if (!esDataUrl(dataUrl)) return { ok: false, error: 'No es una imagen.' };
  if (typeof subir !== 'function') return { ok: false, error: 'Storage no disponible.' };
  const mime = mimeDe(dataUrl);
  if (!MIMES_BUCKET.has(mime)) return { ok: false, error: `Formato de imagen no permitido (${mime}).` };
  let up;
  try { up = await subir(dataUrl, path); } catch (e) { return { ok: false, error: 'No se pudo guardar la imagen.' }; }
  if (!up?.ok || !esURL(up.url)) return { ok: false, error: up?.error || 'No se pudo guardar la imagen; no se conservó.' };
  return { ok: true, url: up.url };
}

/**
 * Para DOCUMENTOS (PDF): las imágenes del acomodo que son URL se traen como
 * dataUrl; las que ya son dataUrl (legado) pasan igual; la que no se pudo traer
 * queda en null y el documento sale sin ella, no roto. `traer(url)` → dataUrl|null.
 */
export async function resolverImagenesAcomodo(acomodo, { traer } = {}) {
  if (!acomodo || typeof acomodo !== 'object') return acomodo ?? null;
  const una = async (s) => {
    if (esDataUrl(s)) return s;
    if (!esURL(s) || typeof traer !== 'function') return null;
    try { return (await traer(s)) || null; } catch (e) { return null; }
  };
  const out = { ...acomodo };
  if (acomodo.render3d) out.render3d = await una(acomodo.render3d);
  if (Array.isArray(acomodo.escenas)) {
    out.escenas = await Promise.all(acomodo.escenas.map(async (e) => (e && e.img ? { ...e, img: await una(e.img) } : e)));
  }
  return out;
}
