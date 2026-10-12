// ============================================================================
//  AMARRE AL CATÁLOGO DE COMPRAS (ERP) · regla de casa 2026-10-12, autorizada por Dirección
//  ("que se usen todos los precios de las materias primas de compras, son los reales").
//  El amarre local sólo ve el catálogo curado (≈259). Lo que queda PENDIENTE se busca en todo el
//  catálogo activo (curado + ERP Intelisis, ~11k) con la misma política determinista: misma
//  familia, mejor coincidencia de color/espesor, genérico de casa ante empate. Entra PROVISIONAL
//  (POR CONFIRMAR): la emisión sigue bloqueada hasta confirmación humana. Nunca inventa precio:
//  un insumo sin precio vigente queda pendiente en el motor igual que antes.
//  Puro salvo por `buscar` y `agregarInsumo` (inyectados) para poder probarlo sin red.
// ============================================================================
import { candidatosDeFamilia, familiaDeMaterial, severidadConflicto_, textoCambio_, MATCH, FAMILIAS_HERRAJE } from './materialMatch.js';

const PENDIENTES = new Set([MATCH.NOT_AVAILABLE, 'PENDING_MATERIAL', 'PENDING_PRICE', 'PENDING_PURCHASING', '']);

/**
 * @param {Array} comps  componentes del BOM (no se muta)
 * @param {{buscar:(q:string,n:number)=>Promise<Array>, agregarInsumo:(ins:object)=>void, insumos:object}} deps
 * @returns {Promise<{comps:Array, amarrados:Array<{nombre:string,id:string,insumoNombre:string,precio:(number|null)}>, sinCandidato:Array<string>}>}
 */
export async function amarrarPendientesERP(comps = [], { buscar, agregarInsumo, insumos = {} } = {}) {
  const out = Array.isArray(comps) ? comps.map((c) => ({ ...c })) : [];
  const amarrados = [], sinCandidato = [];
  if (typeof buscar !== 'function') return { comps: out, amarrados, sinCandidato };
  for (const c of out) {
    if (!c || c.insumoId || c.excluida) continue;
    const clase = c.material_match || (c._match && c._match.clase) || '';
    if (!PENDIENTES.has(clase)) continue;
    const solicitado = String(c.material_solicitado || c.nombre || '').trim();
    const fam = familiaDeMaterial(solicitado);
    if (!solicitado || !fam || fam === 'equipo_externo') { sinCandidato.push(c.nombre || solicitado); continue; }   // sin familia reconocible o equipo del cliente: lo decide la persona
    let filas = [];
    try { filas = await buscar(solicitado, 30); } catch (_e) { filas = []; }
    const conPrecio = (filas || []).filter((f) => f && f.id && f.precio != null && !(insumos[f.id] && f.id === c.insumoId));
    const { ambiguo, mejor } = candidatosDeFamilia(solicitado, conPrecio.length ? conPrecio : (filas || []));
    if (ambiguo || !mejor) { sinCandidato.push(c.nombre || solicitado); continue; }
    const fila = (filas || []).find((f) => f.id === mejor.id) || mejor;
    const sev = severidadConflicto_(fam, solicitado, fila.nombre || '');
    const cambio = textoCambio_(solicitado, fila.nombre || '');
    if (typeof agregarInsumo === 'function') agregarInsumo(fila);
    if (sev.critico) {
      c.material_match = MATCH.SAME_FAMILY_CRITICAL_CONFLICT; c.candidate_insumo_id = fila.id;
      c._match = { ...(c._match || {}), clase: MATCH.SAME_FAMILY_CRITICAL_CONFLICT, candidate_insumo_id: fila.id, resuelto: fila.nombre, cambio, autollenado: true, erp: true, autocosteable: false,
        motivo: `Catálogo de Compras: candidato «${fila.nombre}» con atributo crítico distinto (${cambio || 'calibre/perfil'}). Confirma antes de costear.` };
    } else {
      c.insumoId = fila.id; c.material_match = MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED; c.candidate_insumo_id = fila.id;
      c._match = { ...(c._match || {}), clase: MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED, candidate_insumo_id: fila.id, resuelto: fila.nombre, cambio: cambio || (mejor.generico ? 'estándar de casa' : ''), autollenado: true, erp: true, autocosteable: true,
        motivo: `Catálogo de Compras (ERP${fila.precio != null ? ', precio real de la última compra' : ', sin precio vigente'}): ${fila.nombre}. Provisional: confírmalo.` };
    }
    amarrados.push({ nombre: c.nombre, id: fila.id, insumoNombre: fila.nombre, precio: fila.precio == null ? null : Number(fila.precio), familia: fam, critico: !!sev.critico });
  }
  return { comps: out, amarrados, sinCandidato };
}
