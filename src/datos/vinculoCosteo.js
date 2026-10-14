// ============================================================================
//  SEG-01c · qué costeos del servidor falta vincular a su partida (lógica pura). El vínculo lo escribe el servidor
//  (RPC adjuntar_costeo_a_partida, un solo uso); aquí sólo se decide a quién pedirlo, sin repetir lo ya vinculado en
//  esta sesión. La RPC es idempotente para la misma partida, así que repetir tras recargar es inofensivo.
// ============================================================================
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const vinculados = new Set();
const clave = (cot, p) => `${cot}:${p.partidaId}:${p.costeoId}`;

// Canónico = lo que el gate de producción y SEG-01c tratan como canónico: producto_id Y producto_version_id NUMÉRICOS.
// `productoId` de texto es la CLAVE DE LÍNEA (partida.js), no Producto Maestro: ese renglón sí necesita su vínculo.
const NUM = /^[0-9]+$/;
const pid = (p) => String(p.producto_id ?? p.productoId ?? p.product_id ?? '');
const pvid = (p) => String(p.producto_version_id ?? p.productoVersionId ?? p.product_version_id ?? '');
export const esCanonica = (p) => NUM.test(pid(p)) && NUM.test(pvid(p));

export function costeosPorVincular(cotizacionId, partidas = [], hechos = vinculados) {
  if (!cotizacionId) return [];
  return (Array.isArray(partidas) ? partidas : [])
    .filter((p) => p && !esCanonica(p) && typeof p.costeoId === 'string' && UUID.test(p.costeoId) && p.id)
    .map((p) => ({ partidaId: String(p.id), costeoId: p.costeoId }))
    .filter((p) => !hechos.has(clave(cotizacionId, p)));
}
export function marcarVinculado(cotizacionId, p, hechos = vinculados) { hechos.add(clave(cotizacionId, p)); }

/**
 * P1-03 (reauditoría v2): un vínculo que no se pudo hacer NO puede quedar en silencio. El guardado sí ocurrió, pero ese
 * renglón no se podrá emitir hasta vincularse; se reintenta solo en el siguiente guardado. Devuelve el aviso o null.
 */
export function avisoVinculosFallidos(fallidos = []) {
  if (!Array.isArray(fallidos) || !fallidos.length) return null;
  const n = fallidos.length;
  const conflicto = fallidos.some((f) => f && f.conflicto);
  const cambio = fallidos.some((f) => /la partida cambió|otra cantidad|recostea/i.test(String(f?.error || '')));
  const que = n === 1 ? '1 renglón especial' : `${n} renglones especiales`;
  if (cambio) return `Guardado, pero ${que} ya no corresponde${n === 1 ? '' : 'n'} a su costeo (cambió el mueble o la cantidad): vuelve a costear${n === 1 ? 'lo' : 'los'} antes de emitir.`;
  if (conflicto) return `Guardado, pero alguien más cambió la cotización antes de vincular el costo de ${que}. Revisa y guarda de nuevo para vincular${n === 1 ? 'lo' : 'los'}.`;
  return `Guardado, pero el costo de ${que} no quedó vinculado en el servidor; se reintenta en el siguiente guardado. Sin vínculo no se puede emitir.`;
}
