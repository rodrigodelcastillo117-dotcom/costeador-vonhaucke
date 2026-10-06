// ============================================================================
//  RENDER CANÓNICO POR PRODUCT-REVISION · una sola verdad de la imagen.
//  Un render GENERADO no equivale a un render VALIDADO. La app puede mostrar
//  una propuesta pendiente, pero sólo un render validado puede ser VIGENTE.
// ============================================================================

export const ESTADO_RENDER = Object.freeze({
  VIGENTE: 'VIGENTE',
  PENDIENTE_VALIDACION: 'PENDIENTE_VALIDACION',
  STALE: 'STALE',
  SIN_RENDER_VALIDO: 'SIN_RENDER_VALIDO',
  SIN_VERSION: 'SIN_VERSION',
});

const ESTADOS_GENERADO = new Set(['GENERATED', 'VALIDATED', 'VIGENTE', 'OK']);
const PASS = 'PASS';

const masReciente = (filas) =>
  filas.slice().sort((a, b) => new Date(b?.creado || 0) - new Date(a?.creado || 0))[0];

/**
 * Un render sólo está validado si las tres lentes pasan y no está stale.
 * `estado=VALIDATED` es la intención persistida en DB; las tres columnas son
 * la evidencia. Exigir ambas cosas hace el contrato fail-closed.
 */
export function renderEstaValidado(f, hashesActuales = null) {
  if (!f || f.stale) return false;
  if (!f.geometry_hash) return false; // fail-closed: validado sin identidad geométrica no es canónico
  if (hashesActuales && typeof hashesActuales === 'object') {
    for (const k of ['geometry_hash', 'bom_hash', 'material_hash', 'layout_hash']) {
      if (hashesActuales[k] == null) continue;
      if (f[k] == null || String(f[k]) !== String(hashesActuales[k])) return false;
    }
  }
  return String(f.estado || '').toUpperCase() === 'VALIDATED'
    && String(f.geometry_validation || '').toUpperCase() === PASS
    && String(f.feature_validation || '').toUpperCase() === PASS
    && String(f.finish_validation || '').toUpperCase() === PASS;
}

export function resolverRenderDeFilas(filas = [], { productoId = null, productoVersionId = null, hashesActuales = null } = {}) {
  if (productoVersionId == null) return { estado: ESTADO_RENDER.SIN_VERSION, url: null, productoVersionId: null };

  const deEstaRev = (filas || []).filter((f) =>
    f && String(f.producto_version_id) === String(productoVersionId)
    && (productoId == null || f.producto_id == null || String(f.producto_id) === String(productoId))
    && f.storage_url);

  // 1) Sólo VALIDATED + PASS/PASS/PASS puede ser vigente.
  const validados = deEstaRev.filter((f) => renderEstaValidado(f, hashesActuales));
  if (validados.length) {
    const r = masReciente(validados);
    return { estado: ESTADO_RENDER.VIGENTE, url: r.storage_url, productoVersionId, render: r, validado: true };
  }

  // 2) Render generado de la revisión exacta, pero aún sin evidencia completa:
  // se puede previsualizar como PROPUESTA, jamás vender como fidelidad validada.
  const pendientes = deEstaRev.filter((f) => ESTADOS_GENERADO.has(String(f.estado || '').toUpperCase()) && !f.stale);
  if (pendientes.length) {
    const r = masReciente(pendientes);
    return {
      estado: ESTADO_RENDER.PENDIENTE_VALIDACION,
      url: r.storage_url,
      productoVersionId,
      render: r,
      validado: false,
      motivo: 'Render generado; pendiente validación de geometría, elementos y acabado.',
    };
  }

  // 3) Histórico stale: disponible sólo como histórico marcado.
  const historicos = deEstaRev.filter((f) => ESTADOS_GENERADO.has(String(f.estado || '').toUpperCase()) && f.stale);
  if (historicos.length) {
    const r = masReciente(historicos);
    return { estado: ESTADO_RENDER.STALE, url: r.storage_url, productoVersionId, render: r, validado: false };
  }

  return { estado: ESTADO_RENDER.SIN_RENDER_VALIDO, url: null, productoVersionId, validado: false };
}

export function claveRenderPartida(partida) {
  const vid = partida?.producto_version_id ?? partida?.productVersionId ?? null;
  const pid = partida?.productoId ?? partida?.producto_id ?? null;
  return vid == null ? null : { productoId: pid, productoVersionId: vid };
}

export const partidaEsCanonica = (partida) => claveRenderPartida(partida) != null;

export function estadoRenderPartida(partida, mapaPorVersion = {}) {
  const clave = claveRenderPartida(partida);
  if (!clave) return { estado: ESTADO_RENDER.SIN_VERSION, url: null, productoVersionId: null, validado: false };
  const filas = mapaPorVersion[clave.productoVersionId] || mapaPorVersion[String(clave.productoVersionId)] || [];
  return resolverRenderDeFilas(filas, clave);
}
