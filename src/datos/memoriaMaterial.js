// ============================================================================
//  MEMORIA DE MATERIAL (Parte B · "confirma una vez → se reusa").
//  Cuando Dirección confirmó antes que un material pedido = un insumo, ese puente queda APROBADO en
//  insumo_mapeos_externos (source_system='voni_material'). Aquí se reusa esa decisión firmada: para cada
//  pieza que sigue sin material útil, si su clave normalizada tiene un puente aprobado, se trae el insumo
//  recordado (con su precio real, por la MISMA búsqueda que inyecta el amarre) y se preselecciona.
//
//  Invariantes de integridad (iguales al amarre; nunca se relajan):
//   · NUNCA $0: sólo aplica si el insumo recordado tiene precio usable; si no, la pieza queda pendiente.
//   · NO auto-emite: entra PROVISIONAL (SAME_FAMILY_COMPATIBLE_PROPOSED, por confirmar). La compuerta del
//     costo (estadoCosto.js) la sigue tratando como "material propuesto" → PRELIMINAR, no VALIDADO.
//   · NO pisa lo confirmado por un humano ni una pieza que ya cuesta.
//   · Respeta el conflicto por dimensiones/unidad (VH-155): una memoria genérica no se cuela como compatible
//     sobre una pieza con medida/calibre/unidad distinta → entra como CRÍTICO (no autocosteable).
//  Corre ANTES del amarre ERP: la identidad firmada por Dirección pesa más que una búsqueda a ciegas.
//  Puro salvo por `buscar`/`agregarInsumo` (inyectados), para probarlo sin red.
// ============================================================================
import { familiaDeMaterial, severidadConflicto_, textoCambio_, MATCH } from './materialMatch.js';
import { conTramoPorPieza, precioUsable } from '../motor/calculo.js';
import { normalizarClaveMaterial } from './claveMaterial.js';

const PENDIENTES = new Set([MATCH.NOT_AVAILABLE, 'PENDING_MATERIAL', 'PENDING_PRICE', 'PENDING_PURCHASING', '']);

// Pieza elegible para memoria/amarre: sin material confirmado por humano y (sin insumo con clase pendiente) o
// (con insumo pero en un bucket genérico sin precio usable, p. ej. "tornillería"/"cerradura").
function elegible(c, insumos) {
  if (!c || c.excluida) return false;
  if (c.material_confirmado === true || (c._match && c._match.confirmado_por_usuario)) return false;
  const resuelto = c.insumoId ? insumos[c.insumoId] : null;
  const clase = c.material_match || (c._match && c._match.clase) || '';
  const sinPrecioUtil = !!c.insumoId && !precioUsable(resuelto);
  return (!c.insumoId && PENDIENTES.has(clase)) || sinPrecioUtil;
}

/** Claves normalizadas de las piezas elegibles → para pedir los puentes aprobados a resolverMapeosMaterial. */
export function clavesParaMemoria(comps = [], insumos = {}) {
  const out = new Set();
  for (const c of (Array.isArray(comps) ? comps : [])) {
    if (!elegible(c, insumos)) continue;
    const clave = normalizarClaveMaterial(c.material_solicitado || c.nombre || '');
    if (clave) out.add(clave);
  }
  return [...out];
}

/**
 * @param {Array} comps  componentes del BOM (no se muta)
 * @param {{memoria:Object, buscar:(q:string,n:number)=>Promise<Array>, agregarInsumo:(ins:object)=>void, insumos:object}} deps
 *   memoria: { claveNormalizada: {insumoId, mapeoId, aprobadoPor} } de resolverMapeosMaterial
 * @returns {Promise<{comps:Array, aplicados:Array}>}
 */
export async function aplicarMemoriaMaterial(comps = [], { memoria = {}, buscar, agregarInsumo, insumos = {} } = {}) {
  const out = Array.isArray(comps) ? comps.map((c) => ({ ...c })) : [];
  const aplicados = [];
  if (!memoria || typeof memoria !== 'object' || typeof buscar !== 'function') return { comps: out, aplicados };
  for (const c of out) {
    if (!elegible(c, insumos)) continue;
    const solicitado = String(c.material_solicitado || c.nombre || '').trim();
    const clave = normalizarClaveMaterial(solicitado);
    const hit = clave ? memoria[clave] : null;
    if (!hit || !hit.insumoId) continue;
    // No re-proponer el mismo insumo sin precio que ya traía la pieza.
    const resuelto = c.insumoId ? insumos[c.insumoId] : null;
    if (String(c.insumoId || '') === String(hit.insumoId) && !precioUsable(resuelto)) continue;
    // Se trae el insumo recordado (con precio real) por la misma búsqueda que el amarre: su id va como término.
    let filas = [];
    try { filas = await buscar(String(hit.insumoId), 5); } catch (_e) { filas = []; }
    const fila = (filas || []).find((f) => f && String(f.id) === String(hit.insumoId));
    if (!fila || fila.precio == null) continue;          // NUNCA $0: sin precio usable, se deja pendiente
    // UNIDAD compatible con cómo se consume la pieza (igual que el amarre: evita metros × $/pieza).
    const esArea = Number(c.largoMM) > 0 && Number(c.anchoMM) > 0;
    const esLineal = !esArea && (c.forma === 'lineal' || /\bm\b|metros?/i.test(String(c.unidad || '')));
    const f = conTramoPorPieza(fila);
    const unidadOk = esArea ? !!f.formato : esLineal ? (String(f.unidad || '').toLowerCase() === 'm' || (f.formato && /tramo/i.test(String(f.formato.tipo || '')))) : true;
    const fam = familiaDeMaterial(solicitado) || familiaDeMaterial(fila.nombre || '');
    const solicitadoConDims = [solicitado, String(c.nombre || '')].filter(Boolean).join(' · ');
    const sev = fam ? severidadConflicto_(fam, solicitadoConDims, fila.nombre || '') : { critico: false };
    const prov = `Memoria: Dirección ya confirmó este material antes${hit.aprobadoPor ? ` (${hit.aprobadoPor})` : ''}${hit.mapeoId ? ` · puente #${hit.mapeoId}` : ''}.`;
    const cambio = !unidadOk ? `unidad de Compras (${fila.unidad || '?'}) distinta a como se consume la pieza` : textoCambio_(solicitadoConDims, fila.nombre || '');
    if (typeof agregarInsumo === 'function') agregarInsumo(fila);
    if (sev.critico || !unidadOk) {
      c.material_match = MATCH.SAME_FAMILY_CRITICAL_CONFLICT; c.candidate_insumo_id = fila.id;
      c._match = { ...(c._match || {}), clase: MATCH.SAME_FAMILY_CRITICAL_CONFLICT, candidate_insumo_id: fila.id, resuelto: fila.nombre, cambio, autollenado: true, memoria: true, mapeo_id: hit.mapeoId || null, autocosteable: false,
        motivo: `${prov} Pero esta pieza tiene un atributo distinto (${cambio || 'medida/calibre'}). Confírmalo antes de costear.` };
    } else {
      c.insumoId = fila.id; c.material_match = MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED; c.candidate_insumo_id = fila.id;
      c._match = { ...(c._match || {}), clase: MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED, candidate_insumo_id: fila.id, resuelto: fila.nombre, cambio, autollenado: true, memoria: true, mapeo_id: hit.mapeoId || null, aprobado_por: hit.aprobadoPor || null, erp: true, autocosteable: true,
        motivo: `${prov} Provisional: confírmalo para oficializar.` };
    }
    aplicados.push({ nombre: c.nombre, id: fila.id, insumoNombre: fila.nombre, mapeoId: hit.mapeoId || null, critico: !!(sev.critico || !unidadOk) });
  }
  return { comps: out, aplicados };
}
