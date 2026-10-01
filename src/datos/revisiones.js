// ============================================================================
//  REVISIONES DE COTIZACIÓN — la evidencia de lo que se le ofreció al cliente
//
//  Audit 2026-10-01 (pendiente #2): "Una cotización emitida debe conservarse.
//  Cambiar cantidades, materiales, precios o descuentos debe generar una revisión
//  vinculada, con fecha y responsable. Sobrescribirla elimina la evidencia."
//
//  CÓMO. La cotización VIVA (tabla `cotizaciones`) se sigue editando como hoy. Lo
//  que se congela es cada EMISIÓN: al descargar el PDF o imprimir, se guarda un
//  snapshot INMUTABLE en `cotizaciones_revisiones` (append-only, sin UPDATE ni
//  DELETE por RLS). Así, si mañana se cambia una cantidad y se re-emite, queda una
//  revisión nueva y la anterior se conserva tal cual se ofreció.
//
//  NO DUPLICA. Si se re-emite SIN cambios (el vendedor baja el PDF dos veces), el
//  contenido es idéntico (mismo `hash`) y no se crea una revisión nueva. Solo un
//  cambio real de partidas/precios/descuentos/totales genera otra revisión.
//
//  REGLA DE ORO (igual que aprendizaje.js): guardar la revisión NUNCA puede
//  romper la emisión. Si la nube falla, el PDF se entrega igual; la evidencia se
//  reintenta a la siguiente. El responsable lo asigna el SERVIDOR desde el JWT
//  (trigger en la DB), no el cliente: no se puede suplantar.
// ============================================================================
import { nube } from '../nube.js';
import { paraGuardar } from './cotizaciones.js';

// Lo que se emitió, con la MISMA escalera de dinero que ve y firma el cliente
// (paraGuardar → totales.js). El `usuario` de dentro del snapshot da igual: el
// responsable de la revisión es la columna `usuario` de la fila, puesta por el
// servidor.
export function snapshotEmitido(estado) {
  return paraGuardar(estado);
}

// Firma estable del CONTENIDO ofrecido. Si cambia cualquier renglón, cantidad,
// precio, descuento o total, cambia el hash → es una emisión distinta. djb2.
export function hashContenido(snap) {
  const base = {
    partidas: (snap?.partidas || []).map((p) => ({
      n: p.nombre || '', c: p.cantidad || 0,
      pu: Math.round(p.precioUnitario || 0), cu: Math.round(p.costoUnitario || 0),
      pid: p.piezaId || null, cfg: p.config || null,
    })),
    total: snap?.total || 0,
    totales: snap?.totales || null,
    folio: snap?.folio || null,
    cliente: snap?.cliente || null,
  };
  const txt = JSON.stringify(base);
  let h = 5381;
  for (let k = 0; k < txt.length; k++) h = ((h << 5) + h + txt.charCodeAt(k)) >>> 0;
  return `rev${h.toString(36)}`;
}

// Conserva una revisión de lo emitido, de forma ATÓMICA y con AUTORIZACIÓN, vía la
// RPC `emitir_revision` (audit backend 2026-10-01). La RPC: exige cotizacion_id
// (vínculo estable; el folio no basta por duplicados históricos), verifica que el
// usuario tenga acceso a ESA cotización (no solo ser autor), serializa emisiones
// simultáneas (advisory lock) y dedup contra la última (re-emitir idéntico no
// crea revisión). Autor/folio/cliente los pone el servidor, no el cliente.
// Devuelve { ok, revision, nueva } o { ok:false, motivo } — SIN lanzar: quien
// llama decide si el documento es definitivo (ok) o solo un borrador no registrado.
export async function guardarRevision(estado, cotizacionId) {
  try {
    if (!cotizacionId) return { ok: false, motivo: 'sin-cotizacion' }; // sin vínculo no hay emisión definitiva
    const snap = snapshotEmitido(estado);
    if (!snap || !(snap.partidas || []).length) return { ok: false, motivo: 'vacia' };
    const hash = hashContenido(snap);
    const { data, error } = await nube.rpc('emitir_revision', {
      p_cotizacion_id: cotizacionId,
      p_total: snap.total || 0,
      p_hash: hash,
      p_snapshot: snap,
    });
    if (error) return { ok: false, motivo: error.message || 'rpc' };
    return { ok: true, revision: data?.revision, nueva: !!data?.nueva };
  } catch (e) {
    return { ok: false, motivo: String(e?.message || e) };
  }
}

// El historial de una cotización (más reciente primero), para mostrar qué se
// ofreció y cuándo. Trae el responsable y el total; el snapshot completo va
// embebido por si se quiere reimprimir una revisión vieja.
export async function listarRevisiones(cotizacionId, folio) {
  try {
    let q = nube.from('cotizaciones_revisiones')
      .select('id, revision, emitida_en, usuario, total, folio, cliente')
      .order('revision', { ascending: false });
    q = cotizacionId ? q.eq('cotizacion_id', cotizacionId) : q.eq('folio', folio || '');
    const { data, error } = await q;
    if (error || !data) return [];
    return data;
  } catch (e) {
    return [];
  }
}
