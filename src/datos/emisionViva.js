// ============================================================================
//  EMISIÓN SOBRE EL ESTADO VIVO (lógica pura extraída de App.jsx, 2026-10-14). Refactor puro.
//
//  Invariante: nunca se gatea ni se congela una revisión contra una versión VIEJA de la cotización.
//  Si el guardado vivo no se confirmó (`guardado:false`, sin id, o excepción), el gate responde
//  DESCONOCIDO y el registro de emisión falla — el documento sale como BORRADOR (ver modoDocumento.js).
//  Se prueba por comportamiento en liveQuoteEmissionGate.test.js (antes: texto de App.jsx).
// ============================================================================

/**
 * Gate de emisión AUTORITATIVO: guarda la cotización viva y consulta al servidor sobre el MISMO snapshot
 * que se emitirá (VH-055: el hash de la aprobación debe cuadrar).
 * @param {object} p
 * @param {boolean} p.haySesion
 * @param {()=>Promise<{id:any,guardado:boolean,motivo?:string}>} p.guardarEnNube
 * @param {(id:any, snapshot:object)=>Promise<object>} p.evaluarEmision
 * @param {()=>object} p.snapshot   perezoso: snapshotEmitido(estado)
 */
export async function verificarEmisionViva({ haySesion, guardarEnNube, evaluarEmision, snapshot }) {
  if (!haySesion) return { ok: false, estado: 'DESCONOCIDO', motivos: [] };
  try {
    const r = await guardarEnNube();
    // Sólo se gatea lo que SÍ quedó guardado (o sin cambios): nunca una versión vieja.
    if (!r.id || !r.guardado) return { ok: false, estado: 'DESCONOCIDO', motivos: [], error: r.motivo || 'sin-id' };
    // VH-055: el MISMO snapshot que se emitirá, para que el hash de la aprobación cuadre.
    return await evaluarEmision(r.id, snapshot());
  } catch (e) { return { ok: false, estado: 'DESCONOCIDO', motivos: [], error: String(e?.message || e) }; }
}

/**
 * Al emitir: congela una REVISIÓN inmutable contra el id del guardado VIVO recién confirmado.
 * @param {object} p
 * @param {boolean} p.haySesion
 * @param {()=>Promise<{id:any,guardado:boolean,motivo?:string}>} p.guardarEnNube
 * @param {(estado:object, id:any)=>Promise<object>} p.guardarRevision
 * @param {object} p.estado
 * @param {(r:object)=>void} [p.alNuevaRevision]   aviso cuando el servidor creó una revisión nueva
 */
export async function registrarEmisionViva({ haySesion, guardarEnNube, guardarRevision, estado, alNuevaRevision }) {
  if (!haySesion) return { ok: false, motivo: 'sin-sesion' };
  try {
    const g = await guardarEnNube();
    if (!g.id || !g.guardado) return { ok: false, motivo: g.motivo || 'no-se-guardo-estado-vivo' };
    const r = await guardarRevision(estado, g.id);
    if (r?.ok && r.nueva && alNuevaRevision) alNuevaRevision(r);
    return r || { ok: false, motivo: 'desconocido' };
  } catch (e) {
    return { ok: false, motivo: String(e?.message || e) };
  }
}
