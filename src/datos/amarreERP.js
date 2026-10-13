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
const STOP_Q = new Set(['para', 'con', 'del', 'los', 'las', 'una', 'uno', 'por', 'sin', 'cal', 'calibre', 'mm', 'negro', 'negra', 'blanco', 'blanca', 'gris', 'estructura', 'puerta', 'puertas', 'cajon', 'cajones', 'kit', 'juego', 'pza']);
const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Consultas que SÍ encuentra la búsqueda por término: frase limpia y palabras significativas (máx. 3). */
export function consultasPara(solicitado = '') {
  const limpio = sinAcentos(solicitado).replace(/cal\.?\s*\d+/gi, ' ').replace(/[^a-zA-Z0-9\s"/.-]/g, ' ').replace(/\s+/g, ' ').trim();
  const out = [];
  if (limpio.length >= 3) out.push(limpio);
  const palabras = (limpio.toLowerCase().match(/[a-z]{3,}/g) || []).filter((w) => !STOP_Q.has(w));
  for (const w of palabras.slice(0, 3)) if (!out.includes(w)) out.push(w);
  return out;
}

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
    // La búsqueda del servidor es por término (ILIKE): "PTR cal.14 negro" no encuentra nada, "ptr" sí.
    // Se consulta la frase sin acentos y cada palabra significativa, y se unen los resultados.
    const filas = [];
    const vistos = new Set();
    for (const q of consultasPara(solicitado)) {
      let r = [];
      try { r = await buscar(q, 30); } catch (_e) { r = []; }
      for (const f of (r || [])) if (f && f.id && !vistos.has(f.id)) { vistos.add(f.id); filas.push(f); }
    }
    const esArea = Number(c.largoMM) > 0 && Number(c.anchoMM) > 0;
    const esLineal = !esArea && (c.forma === 'lineal' || /\bm\b|metros?/i.test(String(c.unidad || '')));
    // UNIDAD COMPATIBLE con cómo se consume la pieza (si no, el motor multiplicaría metros × $/pieza):
    //  · área → fila con formato (sin formato no hay m² → hojas: P0-02);
    //  · lineal (metros) → unidad m o formato de tramo;
    //  · pieza → pza/juego/kit/par. Si nada es compatible, se preselecciona como CRÍTICO (no costea).
    const unidadOk = (f) => esArea ? !!f.formato : esLineal ? (String(f.unidad || '').toLowerCase() === 'm' || (f.formato && /tramo/i.test(String(f.formato.tipo || '')))) : true;
    const compatibles = filas.filter(unidadOk);
    const unidadForzada = compatibles.length === 0 && filas.length > 0;
    const utiles = compatibles.length ? compatibles : filas;
    const conPrecio = utiles.filter((f) => f.precio != null);
    const { ambiguo, mejor } = candidatosDeFamilia(solicitado, conPrecio.length ? conPrecio : utiles);
    if (ambiguo || !mejor) { sinCandidato.push(c.nombre || solicitado); continue; }
    const fila = (filas || []).find((f) => f.id === mejor.id) || mejor;
    // VH-155: las medidas explícitas del NOMBRE de la pieza ("Jaladeras rectas 300 mm") cuentan para el conflicto
    // aunque `material_solicitado` sólo diga "jaladera": antes un candidato de 128 mm entraba como propuesta
    // compatible y la confirmación en bloque lo daba por bueno.
    const solicitadoConDims = [solicitado, String(c.nombre || '')].filter(Boolean).join(' · ');
    const sev = severidadConflicto_(fam, solicitadoConDims, fila.nombre || '');
    const cambio = unidadForzada ? `unidad de Compras (${fila.unidad || '?'}) distinta a como se consume la pieza` : textoCambio_(solicitadoConDims, fila.nombre || '');
    if (typeof agregarInsumo === 'function') agregarInsumo(fila);
    if (sev.critico || unidadForzada) {
      c.material_match = MATCH.SAME_FAMILY_CRITICAL_CONFLICT; c.candidate_insumo_id = fila.id;
      c._match = { ...(c._match || {}), clase: MATCH.SAME_FAMILY_CRITICAL_CONFLICT, candidate_insumo_id: fila.id, resuelto: fila.nombre, cambio, autollenado: true, erp: true, autocosteable: false,
        motivo: `Catálogo de Compras: candidato «${fila.nombre}» con atributo crítico distinto (${cambio || 'calibre/perfil'}). Confirma antes de costear.` };
    } else {
      c.insumoId = fila.id; c.material_match = MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED; c.candidate_insumo_id = fila.id;
      c._match = { ...(c._match || {}), clase: MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED, candidate_insumo_id: fila.id, resuelto: fila.nombre, cambio: cambio || (mejor.perfilSupuesto ? 'perfil supuesto 1"×1" (regla de casa)' : mejor.generico ? 'estándar de casa' : ''), autollenado: true, erp: true, autocosteable: true,
        motivo: `Catálogo de Compras (ERP${fila.precio != null ? ', precio real de la última compra' : ', sin precio vigente'}): ${fila.nombre}. Provisional: confírmalo.` };
    }
    amarrados.push({ nombre: c.nombre, id: fila.id, insumoNombre: fila.nombre, precio: fila.precio == null ? null : Number(fila.precio), familia: fam, critico: !!sev.critico });
  }
  return { comps: out, amarrados, sinCandidato };
}

// VH-149 · Fusión del amarre ASÍNCRONO sobre el BOM vigente. El amarre llega tarde (búsquedas en el ERP)
// y la persona pudo haber editado la pieza mientras tanto (cantidad, largo, nombre, excluir…). Antes se
// hacía `{ ...c, ...amarrado }` y el objeto amarrado —calculado sobre el BOM VIEJO— pisaba esas ediciones.
// Ahora sólo viajan los campos de MATERIAL del amarre, y sólo a piezas que siguen sin material.
const CAMPOS_AMARRE = ['insumoId', 'material_match', 'candidate_insumo_id', '_match'];
export function fusionarAmarreEnBom(actuales = [], amarrados = []) {
  const act = Array.isArray(actuales) ? actuales : [];
  if (!Array.isArray(amarrados) || act.length !== amarrados.length) return act;
  return act.map((c, i) => {
    const a = amarrados[i];
    if (!c || !a || c.nombre !== a.nombre || c.insumoId || c.excluida) return c;
    if (!a.insumoId && !a.candidate_insumo_id) return c;
    const parche = {};
    for (const k of CAMPOS_AMARRE) if (a[k] !== undefined) parche[k] = a[k];
    return { ...c, ...parche };
  });
}
