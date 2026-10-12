// ============================================================================
//  RESPUESTA DE `generar-render` → UNA imagen utilizable
//
//  VH-072 (2026-10-11). La edge v30 (desplegada 2026-10-04) ya NO devuelve el
//  render en base64: lo guarda en Storage y responde `{ ok, url, storagePath,
//  audit, request_id }`; `dataUrl` sólo viaja si Storage falló
//  (`storageFallback: true`). TODOS los consumidores del cliente leían
//  `r.dataUrl`: con la edge nueva, Costeador guardaba `imagen: undefined`, la
//  partida respondía "No se pudo generar el render", Acomodo y Cotización
//  intentaban subir `undefined` a Storage. Producción (leído 2026-10-11): 41
//  intentos de render en 30 días y 6 archivos en `renders/generated/` desde el
//  despliegue — renders pagados y guardados que el cliente tiró.
//
//  Aquí se lee la respuesta UNA vez. Puro.
// ============================================================================

export const esURLImagen = (s) => typeof s === 'string' && /^https?:\/\/\S+/i.test(s);
export const esDataUrlImagen = (s) => typeof s === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(s);

/**
 * @param {object} r respuesta cruda de la edge (o del wrapper nube.generarRender)
 * @returns {{ok:boolean, imagen?:string, enStorage?:boolean, url?:string|null, dataUrl?:string|null,
 *            audit?:object|null, requestId?:string|null, error?:string}}
 */
export function leerRespuestaRender(r) {
  if (!r || typeof r !== 'object') return { ok: false, error: 'No se pudo generar el render.' };
  if (!r.ok) return { ok: false, error: r.error || 'No se pudo generar el render.', code: r.code || null, requestId: r.request_id || null, audit: r.audit || null };
  const url = esURLImagen(r.url) ? r.url : null;
  const dataUrl = esDataUrlImagen(r.dataUrl) ? r.dataUrl : null;
  const imagen = url || dataUrl;
  if (!imagen) return { ok: false, error: 'El servidor no devolvió ninguna imagen.', requestId: r.request_id || null };
  return {
    ...r,
    ok: true,
    imagen,                 // lo que se enseña y se guarda: URL de Storage, o dataUrl de respaldo
    enStorage: !!url,       // true ⇒ ya vive en el bucket `renders`; no hay que volver a subirlo
    url, dataUrl,
    audit: r.audit || null,
    requestId: r.request_id || null,
  };
}

/**
 * Para quien necesita los BYTES (referencia visual para otra generación, PDF):
 * una URL se trae con `traer(url) → dataUrl|null`; un dataUrl pasa igual.
 */
export async function comoDataUrl(imagen, traer) {
  if (esDataUrlImagen(imagen)) return imagen;
  if (esURLImagen(imagen) && typeof traer === 'function') {
    try { const d = await traer(imagen); return esDataUrlImagen(d) ? d : null; } catch { return null; }
  }
  return null;
}
