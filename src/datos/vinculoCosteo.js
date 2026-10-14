// ============================================================================
//  SEG-01c · qué costeos del servidor falta vincular a su partida (lógica pura). El vínculo lo escribe el servidor
//  (RPC adjuntar_costeo_a_partida, un solo uso); aquí sólo se decide a quién pedirlo, sin repetir lo ya vinculado en
//  esta sesión. La RPC es idempotente para la misma partida, así que repetir tras recargar es inofensivo.
// ============================================================================
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const vinculados = new Set();
const clave = (cot, p) => `${cot}:${p.partidaId}:${p.costeoId}`;

export function costeosPorVincular(cotizacionId, partidas = [], hechos = vinculados) {
  if (!cotizacionId) return [];
  return (Array.isArray(partidas) ? partidas : [])
    .filter((p) => p && !p.producto_id && !p.productoId && typeof p.costeoId === 'string' && UUID.test(p.costeoId) && p.id)
    .map((p) => ({ partidaId: String(p.id), costeoId: p.costeoId }))
    .filter((p) => !hechos.has(clave(cotizacionId, p)));
}
export function marcarVinculado(cotizacionId, p, hechos = vinculados) { hechos.add(clave(cotizacionId, p)); }
