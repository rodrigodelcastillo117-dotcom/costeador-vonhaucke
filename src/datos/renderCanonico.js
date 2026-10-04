// ============================================================================
//  RENDER CANÓNICO POR PRODUCT-REVISION  ·  una sola verdad de la imagen.
//  Resuelve la imagen de una partida SÓLO por (producto_id, producto_version_id)
//  — NUNCA por nombre ni por "render parecido". Devuelve un estado explícito:
//    VIGENTE            → render válido y NO stale de esa revisión exacta.
//    STALE              → sólo existe render marcado stale (histórico, no vigente).
//    SIN_RENDER_VALIDO  → la revisión existe pero no tiene render usable.
//    SIN_VERSION        → la partida no está anclada a una ProductVersion.
//  Reglas (mandato tanda render-partida): jamás usar una revisión vieja en silencio;
//  jamás fabricar; una cotización emitida queda congelada a su producto_version_id
//  (resolver por ese id es, por sí mismo, el congelado — el id es inmutable).
// ============================================================================

export const ESTADO_RENDER = Object.freeze({
  VIGENTE: 'VIGENTE',
  STALE: 'STALE',
  SIN_RENDER_VALIDO: 'SIN_RENDER_VALIDO',
  SIN_VERSION: 'SIN_VERSION',
});

// Estados de la fila `renders.estado` que cuentan como "render realmente generado".
const ESTADOS_GENERADO = new Set(['GENERATED', 'VIGENTE', 'OK']);

const masReciente = (filas) =>
  filas.slice().sort((a, b) => new Date(b?.creado || 0) - new Date(a?.creado || 0))[0];

// Contrato puro: a partir de las filas de `renders` (ya traídas por el resolver de
// nube), elige el render canónico para UNA revisión exacta. No hace red ni I/O.
export function resolverRenderDeFilas(filas = [], { productoId = null, productoVersionId = null } = {}) {
  if (productoVersionId == null) return { estado: ESTADO_RENDER.SIN_VERSION, url: null, productoVersionId: null };
  // SÓLO filas de ESA revisión exacta y con imagen. El producto_id, si viene, es
  // un guardia extra; nunca se cae a buscar por nombre u otra revisión.
  const deEstaRev = (filas || []).filter((f) =>
    f && String(f.producto_version_id) === String(productoVersionId)
    && (productoId == null || f.producto_id == null || String(f.producto_id) === String(productoId))
    && f.storage_url);

  const vigentes = deEstaRev.filter((f) => ESTADOS_GENERADO.has(String(f.estado || '').toUpperCase()) && !f.stale);
  if (vigentes.length) {
    const r = masReciente(vigentes);
    return { estado: ESTADO_RENDER.VIGENTE, url: r.storage_url, productoVersionId, render: r };
  }
  // Sólo histórico stale: se puede mostrar MARCADO como histórico, nunca como vigente.
  const historicos = deEstaRev.filter((f) => ESTADOS_GENERADO.has(String(f.estado || '').toUpperCase()) && f.stale);
  if (historicos.length) {
    const r = masReciente(historicos);
    return { estado: ESTADO_RENDER.STALE, url: r.storage_url, productoVersionId, render: r };
  }
  return { estado: ESTADO_RENDER.SIN_RENDER_VALIDO, url: null, productoVersionId };
}

// La referencia canónica de una partida (si está anclada a un producto/versión).
export function claveRenderPartida(partida) {
  const vid = partida?.producto_version_id ?? partida?.productVersionId ?? null;
  const pid = partida?.productoId ?? partida?.producto_id ?? null;
  return vid == null ? null : { productoId: pid, productoVersionId: vid };
}

// ¿La partida está anclada a una ProductVersion? (línea canónica vs catálogo/banco legacy)
export const partidaEsCanonica = (partida) => claveRenderPartida(partida) != null;

// Dado el mapa { [versionId]: filas[] } (de resolverRendersCanonicos en nube.js),
// resuelve el estado de render de una partida. Si no es canónica → SIN_VERSION.
export function estadoRenderPartida(partida, mapaPorVersion = {}) {
  const clave = claveRenderPartida(partida);
  if (!clave) return { estado: ESTADO_RENDER.SIN_VERSION, url: null, productoVersionId: null };
  const filas = mapaPorVersion[clave.productoVersionId] || mapaPorVersion[String(clave.productoVersionId)] || [];
  return resolverRenderDeFilas(filas, clave);
}
