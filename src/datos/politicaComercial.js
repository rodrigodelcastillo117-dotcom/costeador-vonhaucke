// ============================================================================
//  POLÍTICA COMERCIAL PÚBLICA (VH-063) · lo único que el vendedor puede saber
//  ANTES de verificar: el descuento máximo sin aprobación y la versión vigente.
//  Viene de la RPC `politica_comercial_publica` (security definer; sólo esos dos
//  datos; el margen mínimo NO viaja). Aquí se normaliza y se arma el aviso. Puro.
//  La autoridad sigue siendo el servidor al verificar/emitir: este aviso sólo
//  evita que el vendedor descubra al final que su descuento requería aprobación.
// ============================================================================

/** Normaliza la respuesta de la RPC. Sin dato ⇒ { vigente:false } (no se inventa umbral). */
export function leerPolitica(data) {
  if (!data || typeof data !== 'object' || data.vigente !== true) return { vigente: false, version: null, descuentoMax: null };
  const d = Number(data.descuento_max_sin_aprobacion);
  if (!Number.isFinite(d) || d < 0 || d > 100) return { vigente: false, version: null, descuentoMax: null };
  const v = Number(data.version);
  return { vigente: true, version: Number.isFinite(v) ? v : null, descuentoMax: d };
}

/**
 * Aviso para el campo de descuento. null si no hay nada que avisar o no se conoce la política.
 * @returns {{nivel:'ambar', texto:string}|null}
 */
export function avisoDescuento(descuentoPct, politica) {
  const p = politica || {};
  const pct = Number(descuentoPct);
  if (!p.vigente || !Number.isFinite(pct) || pct <= 0) return null;
  if (pct <= p.descuentoMax) return null;
  const ver = p.version != null ? ` (política v${p.version})` : '';
  return {
    nivel: 'ambar',
    texto: `Un descuento de ${pct}% supera el máximo sin aprobación (${p.descuentoMax}%)${ver}: la cotización requerirá aprobación de Dirección antes de emitirse en definitiva.`,
  };
}
