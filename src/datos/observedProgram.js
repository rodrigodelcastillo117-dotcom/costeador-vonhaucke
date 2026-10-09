// ============================================================================
//  observed_program (PLAN INTELLIGENCE, v1 · contrato compartido cross-flow)
//
//  Capa PURA. Define el OBJETO canónico de "lo que el plano/brief realmente
//  dice" para que Costear, Cotizar, Cocrear y Acomodo compartan LA MISMA verdad
//  observada. Un FloorPlanReader (edge leer-plano, o análisis de render)
//  alimenta estos items ya extraídos; aquí se normalizan, validan y clasifican
//  por ORIGEN. No lee archivos ni red.
//
//  REGLA DURA: nada SUGERIDO o INFERIDO se confirma solo. Confirmar es un acto
//  explícito del usuario (promueve a OBSERVED con procedencia USER_CONFIRMED).
//  Reutiliza PROCEDENCIA/esConfirmado de floorSpec.js → UNA sola verdad.
// ============================================================================
import { PROCEDENCIA, esConfirmado } from './floorSpec.js';

// Origen del item observado (Rodrigo: observed/inferred/suggested).
export const ORIGEN = Object.freeze({
  OBSERVED: 'observed',   // visible/dibujado en el plano, o confirmado por el usuario
  INFERRED: 'inferred',   // deducido por geometría/estructura (no visible explícito)
  SUGGESTED: 'suggested', // propuesto por regla/IA; NUNCA cuenta como real hasta confirmar
});

// NATURALEZA del item (ChatGPT #3: un CUARTO observado ≠ un MUEBLE observado).
// Detectar una sala NO es detectar su mobiliario; nunca se cuentan juntos.
export const KIND = Object.freeze({
  ROOM: 'room',           // área/cuarto/zona (geometría del espacio)
  FURNITURE: 'furniture', // mueble (bench, silla, mesa, escritorio…)
  AMENITY: 'amenity',     // coffee point, lockers, etc.
  UNKNOWN: 'unknown',
});

// Mapea la PROCEDENCIA (floorSpec) al ORIGEN del observed_program.
export function origenDeProcedencia(procedencia) {
  switch (procedencia) {
    case PROCEDENCIA.DETECTED_FROM_PLAN:
    case PROCEDENCIA.USER_CONFIRMED:
      return ORIGEN.OBSERVED;
    case PROCEDENCIA.CATALOG_MATCH:
      return ORIGEN.INFERRED;
    case PROCEDENCIA.RULE_SUGGESTION:
    case PROCEDENCIA.AI_SUGGESTION:
    default:
      return ORIGEN.SUGGESTED;
  }
}

const txt = (v) => String(v ?? '').trim();
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const clamp01 = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null; };

/**
 * Normaliza UN item del programa observado al contrato canónico, tolerando los
 * alias que ya usan floorSpec/programaDelPlano (semantic_role, quantity_group…).
 * NO inventa: lo ausente queda null; `issues` marca lo que falta.
 *
 * Contrato: {
 *   type, role, quantity, zone, grouping, position{x,y}, orientation,
 *   dimensions{w,d,h}, page, evidence, confidence, origin, procedencia, source_ref
 * }
 */
export function observedItem(raw = {}) {
  const procedencia = raw.procedencia || raw.source || null;
  const origin = raw.origin && Object.values(ORIGEN).includes(raw.origin)
    ? raw.origin
    : origenDeProcedencia(procedencia);

  const pos = raw.position || (raw.x != null || raw.y != null ? { x: raw.x, y: raw.y } : null);
  const dims = raw.dimensions || ((raw.w != null || raw.d != null || raw.h != null)
    ? { w: raw.w, d: raw.d, h: raw.h } : null);

  // CANTIDAD DE MUEBLES ≠ CAPACIDAD (puestos). ChatGPT #4: 4 benches × 2 usuarios
  // = 8 puestos, no "8 benches". quantity = unidades de mueble; capacity_per_unit
  // = personas por mueble; capacity_total = puestos. Si no se da capacidad, es 1:1.
  const quantity = num(raw.quantity ?? raw.quantity_group ?? raw.cantidad) ?? null;
  const capacityPer = num(raw.capacity_per_unit ?? raw.capacidad_por_unidad);
  const capacityTotal = num(raw.capacity_total ?? raw.capacidad_total)
    ?? ((quantity != null && capacityPer != null) ? quantity * capacityPer : null);

  const out = {
    kind: Object.values(KIND).includes(raw.kind) ? raw.kind : KIND.FURNITURE,  // por defecto MUEBLE (#3)
    type: txt(raw.type || raw.tipo) || null,
    role: txt(raw.role || raw.semantic_role || raw.rol) || null,
    quantity,
    capacity_per_unit: capacityPer,
    capacity_total: capacityTotal,
    zone: txt(raw.zone || raw.zona) || null,
    grouping: txt(raw.grouping || raw.functional_group_id || raw.grupo) || null,
    position: pos ? { x: num(pos.x), y: num(pos.y) } : null,
    orientation: num(raw.orientation ?? raw.rot ?? raw.orientacion),
    dimensions: dims ? { w: num(dims.w), d: num(dims.d), h: num(dims.h) } : null,
    page: raw.page != null ? (num(raw.page) ?? txt(raw.page)) : null,
    evidence: txt(raw.evidence || raw.evidencia) || null,
    confidence: clamp01(raw.confidence ?? raw.confianza),
    origin,
    procedencia: procedencia || null,
    source_ref: txt(raw.source_ref) || null,
  };

  const issues = [];
  if (!out.type && !out.role) issues.push('FALTA_TYPE');
  if (out.quantity == null || out.quantity <= 0) issues.push('CANTIDAD_INVALIDA');
  if (!out.evidence && out.origin === ORIGEN.OBSERVED) issues.push('OBSERVED_SIN_EVIDENCIA');
  if (out.confidence == null) issues.push('FALTA_CONFIANZA');
  return { ...out, issues };
}

/** Normaliza y valida un programa observado completo. */
export function validarObservedProgram(items = []) {
  const norm = (Array.isArray(items) ? items : []).map(observedItem);
  const issues = [];
  norm.forEach((it, i) => it.issues.forEach((code) => issues.push(`[${i}] ${code}`)));
  // Invariante dura: ningún item SUGERIDO/INFERIDO puede venir marcado confirmado.
  norm.forEach((it, i) => {
    if (it.origin !== ORIGEN.OBSERVED && esConfirmado({ procedencia: it.procedencia })) {
      issues.push(`[${i}] SUGERIDO_MARCADO_CONFIRMADO`);
    }
  });
  return { ok: issues.length === 0, items: norm, issues };
}

/** ¿Este item puede confirmarse? (todos pueden; SUGGESTED/INFERRED REQUIEREN acto explícito) */
export function esConfirmable(item) {
  return !!(item && (item.type || item.role) && (item.quantity > 0));
}

/** ¿Este item ya cuenta como real? Sólo OBSERVED. */
export function esObservadoReal(item) {
  return item?.origin === ORIGEN.OBSERVED;
}

/**
 * Confirma EXPLÍCITAMENTE un item (acto del usuario). Promueve a OBSERVED con
 * procedencia USER_CONFIRMED. NO hay auto-confirmación: esta función debe
 * llamarse SÓLO desde una acción explícita del usuario.
 * @param {object} item
 * @param {{por?:string, nota?:string}} meta
 */
export function confirmarObservado(item, meta = {}) {
  if (!esConfirmable(item)) return item;
  return {
    ...item,
    origin: ORIGEN.OBSERVED,
    procedencia: PROCEDENCIA.USER_CONFIRMED,
    confidence: 1,
    confirmado_por: txt(meta.por) || null,
    confirmado_nota: txt(meta.nota) || null,
  };
}

/**
 * Resumen por ORIGEN y por tipo. Deja ver de un golpe qué es REAL (observed) vs
 * lo que todavía es sugerido/inferido y por tanto NO debe costearse como hecho.
 */
export function resumenObservado(items = []) {
  const { items: norm } = validarObservedProgram(items);
  // ChatGPT #3/#4: nunca se mezclan MUEBLES con CUARTOS, ni cantidad con capacidad.
  //  · porOrigen/porTipo/capacidad cuentan sólo MUEBLES (kind=furniture/amenity).
  //  · cuartosPorOrigen cuenta sólo CUARTOS (kind=room).
  const esMueble = (it) => it.kind !== KIND.ROOM;
  const porOrigen = { [ORIGEN.OBSERVED]: 0, [ORIGEN.INFERRED]: 0, [ORIGEN.SUGGESTED]: 0 };
  const capacidadPorOrigen = { [ORIGEN.OBSERVED]: 0, [ORIGEN.INFERRED]: 0, [ORIGEN.SUGGESTED]: 0 };
  const cuartosPorOrigen = { [ORIGEN.OBSERVED]: 0, [ORIGEN.INFERRED]: 0, [ORIGEN.SUGGESTED]: 0 };
  const porTipo = {};
  let cantidadObservada = 0;       // MUEBLES observados
  let capacidadObservada = 0;      // PUESTOS observados
  let cuartosObservados = 0;       // CUARTOS observados
  for (const it of norm) {
    const q = it.quantity > 0 ? it.quantity : 0;
    if (it.kind === KIND.ROOM) {
      cuartosPorOrigen[it.origin] = (cuartosPorOrigen[it.origin] || 0) + q;
      if (it.origin === ORIGEN.OBSERVED) cuartosObservados += q;
      continue;                    // un cuarto NUNCA cuenta como mueble
    }
    const cap = it.capacity_total > 0 ? it.capacity_total : 0;
    porOrigen[it.origin] = (porOrigen[it.origin] || 0) + q;
    capacidadPorOrigen[it.origin] = (capacidadPorOrigen[it.origin] || 0) + cap;
    const clave = it.type || it.role || 'desconocido';
    porTipo[clave] = (porTipo[clave] || 0) + q;
    if (it.origin === ORIGEN.OBSERVED) { cantidadObservada += q; capacidadObservada += cap; }
  }
  return {
    total: norm.length,
    muebles: norm.filter(esMueble).length,
    cuartos: norm.filter((it) => it.kind === KIND.ROOM).length,
    cantidadObservada,          // MUEBLES observados
    capacidadObservada,         // PUESTOS observados (capacity)
    cuartosObservados,          // CUARTOS observados
    porOrigen,                  // muebles por origen
    capacidadPorOrigen,         // puestos por origen
    cuartosPorOrigen,           // cuartos por origen
    porTipo,
    // Sólo lo OBSERVED alimenta costeo/acomodo como real; el resto requiere confirmar.
    hayPendientesDeConfirmar: porOrigen[ORIGEN.SUGGESTED] > 0 || porOrigen[ORIGEN.INFERRED] > 0
      || cuartosPorOrigen[ORIGEN.SUGGESTED] > 0 || cuartosPorOrigen[ORIGEN.INFERRED] > 0,
  };
}
