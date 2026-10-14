// ============================================================================
//  VH-148b · GUARDADO VERSIONADO DE UN EXPEDIENTE (biblioteca de Costear / AsistenteEspecial).
//  Lógica pura con dependencias inyectadas (las funciones de nube.js): la pantalla sólo pinta el resultado.
//
//  Antes (producción c3.4 y este cliente hasta hoy): UPDATE directo con `revision: revActual + 1` y luego
//  INSERT del snapshot en expediente_revisiones con el error TRAGADO. Dos editores en la misma revisión:
//  el segundo pisaba al primero y el historial quedaba con el snapshot del primero, sin aviso.
//
//  Ahora:
//   · bandera de control optimista PRENDIDA → actualizar_expediente_seguro(id, patch, revActual): el servidor
//     compara, actualiza y guarda el snapshot en UNA transacción; no hay segundo paso.
//   · bandera APAGADA (ruta de producción) → UPDATE directo (el servidor con VH-148b hace compare-and-swap de
//     `revision`) y el snapshot, cuyo error YA NO se traga.
//   · Cualquier conflicto (40001 / 23505 / VERSION_REQUIRED) → { ok:false, code:'VERSION_CONFLICT', status:409 }
//     y `mensaje` = EXACTAMENTE "Existe una versión más reciente. Recarga o compara antes de guardar."
//     Sin reintento ni fusión.
// ============================================================================
import { mensajeEscritura, CODIGO_VERSION_CONFLICT } from './conflictoGuardado.js';

const fallo = (r, prefijo) => ({ ok: false, ...(r?.code ? { code: r.code, status: r.status } : {}), mensaje: mensajeEscritura(r, prefijo) });

/**
 * Guarda la edición de un expediente que ya existe.
 * @param {object} p
 * @param {number|string} p.id            expediente
 * @param {object} p.exp                  columnas de contenido (nombre, bom, costo, …)
 * @param {number} p.revActual            revisión desde la que se editó (la que se cargó o se guardó la última vez)
 * @param {string|null} p.quien           correo de quien guarda (sólo ruta directa; la RPC lo toma del JWT)
 * @param {(id:any, rev:number)=>object} p.snap  snapshot para expediente_revisiones (sólo ruta directa)
 * @param {boolean} p.controlOptimista
 * @param {object} p.deps                 { actualizarExpediente, actualizarExpedienteSeguro, guardarRevisionExpediente }
 * @returns {Promise<{ok:true, revision:number} | {ok:false, code?:string, status?:number, mensaje:string}>}
 */
export async function guardarExpedienteEditado({ id, exp, revActual, quien = null, snap, controlOptimista, deps }) {
  if (controlOptimista) {
    const r = await deps.actualizarExpedienteSeguro(id, exp, revActual);
    if (!r?.ok) return fallo(r, 'No se pudo actualizar');
    return { ok: true, revision: r.revision };
  }
  const nuevaRev = revActual + 1;
  const r = await deps.actualizarExpediente(id, { ...exp, revision: nuevaRev, actualizado_por: quien });
  if (!r?.ok) return fallo(r, 'No se pudo actualizar');
  const rv = await deps.guardarRevisionExpediente(snap(id, nuevaRev));
  if (!rv?.ok) return fallo(rv, 'Se actualizó el expediente pero no su historial de revisiones');
  return { ok: true, revision: nuevaRev };
}

/** Crea el expediente y su revisión 1. Un fallo del snapshot ya no se reporta como "✓ Guardado". */
export async function guardarExpedienteNuevo({ exp, snap, deps }) {
  const r = await deps.guardarExpediente(exp);
  if (!r?.ok) return fallo(r, 'No se pudo guardar');
  const rv = await deps.guardarRevisionExpediente(snap(r.id, 1));
  if (!rv?.ok) return { ...fallo(rv, 'Se guardó el expediente pero no su revisión 1'), id: r.id };
  return { ok: true, id: r.id, revision: 1 };
}

export const esConflictoDeExpediente = (r) => r?.code === CODIGO_VERSION_CONFLICT;
