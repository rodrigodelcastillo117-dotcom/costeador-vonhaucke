// ============================================================================
//  observed-core · VALIDADOR DETERMINISTA del programa observado (edge-side)
//
//  Capa PURA (sin Deno/red). El wrapper leer-plano llama a esto para revalidar
//  el `observed_program` que devuelve la visión (leer-plano-core) con las MISMAS
//  invariantes que src/datos/observedProgram.js, pero del lado servidor: la IA
//  propone, el servidor NO confía ciegamente.  (ChatGPT P0-R8-2)
//
//  REGLAS DURAS:
//   · quantity > 0, capacity_total > 0 (si viene), dimensiones > 0 (si vienen).
//   · position finita y DENTRO de la envolvente (si la envolvente es conocida).
//   · zone debe existir entre las zonas del FloorSpec (si se declara).
//   · page válida (entero > 0, ≤ max si se conoce).
//   · confidence ∈ [0,1].
//   · origin ∈ {observed,inferred,suggested}; kind ∈ {room,furniture,amenity,unknown}.
//   · OBSERVED EXIGE evidencia y NO puede derivarse de un cuarto (room_derived).
//   · sin duplicados (misma identidad type+zone+posición).
//  Un item inválido NO cuenta como real: queda review_required y baja el estado.
// ============================================================================

export const ORIGEN = Object.freeze({ OBSERVED: 'observed', INFERRED: 'inferred', SUGGESTED: 'suggested' });
export const KIND = Object.freeze({ ROOM: 'room', FURNITURE: 'furniture', AMENITY: 'amenity', UNKNOWN: 'unknown' });

const txt = (v) => String(v ?? '').trim();
// null/undefined/'' → null (NO 0; Number(null)===0 inventaría un dato).
const num = (v) => { if (typeof v !== 'number' && typeof v !== 'string') return null; if (typeof v === 'string' && v.trim() === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
// Mapa EXPLÍCITO del enum textual de confianza del lector (schema core:
// alta/media/baja) a número ANTES de validar (ChatGPT P0-R9-2). Nunca se intenta
// Number("alta") (que daría null silencioso y dejaría confidence sin issue).
const CONF_TEXTO = Object.freeze({ alta: 0.9, media: 0.6, baja: 0.4 });

/**
 * Normaliza + valida UN item observado del lado servidor. FAIL-CLOSED:
 * cualquier dato SUMINISTRADO pero inválido es un ISSUE, no un silencio
 * (ChatGPT P0-R9-3). Lo AUSENTE queda null; lo PRESENTE-pero-malo marca review.
 * @param {object} raw item crudo de la visión
 * @param {object} ctx {envelopeW, envelopeH, zoneNames:Set<string>, maxPage}
 */
export function validarItemObservado(raw = {}, ctx = {}) {
  const { envelopeW, envelopeH, zoneNames, maxPage } = ctx;
  const issues = [];

  const originRaw = txt(raw.origin || raw.origen).toLowerCase();
  const origin = Object.values(ORIGEN).includes(originRaw) ? originRaw : null;
  if (!origin) issues.push('ORIGEN_INVALIDO');

  // kind: ausente → furniture por defecto; PRESENTE pero fuera del enum → ISSUE
  // (nunca se degrada en silencio a furniture — P0-R9-3).
  const kindRaw = txt(raw.kind).toLowerCase();
  let kind = KIND.FURNITURE;
  if (kindRaw) { if (Object.values(KIND).includes(kindRaw)) kind = kindRaw; else issues.push('KIND_INVALIDO'); }

  const type = txt(raw.type || raw.tipo) || null;
  const role = txt(raw.role || raw.semantic_role || raw.rol) || null;
  if (!type && !role) issues.push('FALTA_TYPE');

  // quantity: entero > 0 (son MUEBLES; 2.5 benches no existe — P0-R9-3).
  const quantity = num(raw.quantity ?? raw.cantidad);
  if (quantity == null || quantity <= 0 || !Number.isInteger(quantity)) issues.push('CANTIDAD_INVALIDA');

  const capacityPer = num(raw.capacity_per_unit);
  if (raw.capacity_per_unit != null && capacityPer == null) issues.push('CAPACIDAD_UNIDAD_INVALIDA');
  else if (capacityPer != null && capacityPer <= 0) issues.push('CAPACIDAD_UNIDAD_INVALIDA');
  const capacityTotal = num(raw.capacity_total)
    ?? ((quantity != null && capacityPer != null) ? quantity * capacityPer : null);
  if (raw.capacity_total != null && num(raw.capacity_total) == null) issues.push('CAPACIDAD_TOTAL_INVALIDA');
  else if (capacityTotal != null && capacityTotal <= 0) issues.push('CAPACIDAD_TOTAL_INVALIDA');

  // Dimensiones: SUMINISTRADAS pero no numéricas → ISSUE; 0/negativo → ISSUE.
  let dimensions = null;
  const rawDims = raw.dimensions || ((raw.w != null || raw.d != null || raw.h != null) ? { w: raw.w, d: raw.d, h: raw.h } : null);
  if (rawDims) {
    dimensions = { w: num(rawDims.w), d: num(rawDims.d), h: num(rawDims.h) };
    for (const k of ['w', 'd', 'h']) {
      if (rawDims[k] != null && dimensions[k] == null) { issues.push('DIMENSION_INVALIDA'); break; }  // dada pero no numérica
      if (dimensions[k] != null && dimensions[k] <= 0) { issues.push('DIMENSION_INVALIDA'); break; }
    }
  }

  // Posición (si viene) debe ser finita y dentro de la envolvente conocida.
  let position = null;
  const rawPos = raw.position || (raw.x != null || raw.y != null ? { x: raw.x, y: raw.y } : null);
  if (rawPos) {
    position = { x: num(rawPos.x), y: num(rawPos.y) };
    if (position.x == null || position.y == null) issues.push('POSICION_NO_FINITA');
    else if (Number.isFinite(envelopeW) && Number.isFinite(envelopeH) &&
      (position.x < 0 || position.y < 0 || position.x > envelopeW || position.y > envelopeH)) {
      issues.push('POSICION_FUERA_DE_ENVOLVENTE');
    }
  }

  // orientation: SUMINISTRADA pero no numérica → ISSUE (P0-R9-3).
  let orientation = null;
  if (raw.orientation != null || raw.rot != null || raw.orientacion != null) {
    orientation = num(raw.orientation ?? raw.rot ?? raw.orientacion);
    if (orientation == null) issues.push('ORIENTACION_INVALIDA');
  }

  // Zona declarada debe existir entre las zonas del FloorSpec.
  const zone = txt(raw.zone || raw.zona) || null;
  if (zone && zoneNames instanceof Set && zoneNames.size > 0 && !zoneNames.has(zone)) {
    issues.push('ZONA_DESCONOCIDA');
  }

  // Página: entero > 0, y ≤ max si se conoce.
  let page = null;
  if (raw.page != null) {
    const p = num(raw.page);
    if (p == null || !Number.isInteger(p) || p <= 0) issues.push('PAGINA_INVALIDA');
    else if (Number.isFinite(maxPage) && maxPage > 0 && p > maxPage) issues.push('PAGINA_FUERA_DE_RANGO');
    else page = p;
  }

  // confidence: enum textual del lector → número por mapa EXPLÍCITO; numérico
  // fuera de [0,1] → ISSUE (no clamp silencioso); ausente → FALTA; basura → ISSUE.
  let confidence = null;
  const confRaw = raw.confidence ?? raw.confianza;
  if (confRaw == null) issues.push('FALTA_CONFIANZA');
  else if (typeof confRaw === 'string' && CONF_TEXTO[confRaw.trim().toLowerCase()] != null) {
    confidence = CONF_TEXTO[confRaw.trim().toLowerCase()];
  } else {
    const c = num(confRaw);
    if (c == null) issues.push('CONFIANZA_INVALIDA');
    else if (c < 0 || c > 1) issues.push('CONFIANZA_FUERA_DE_RANGO');
    else confidence = c;
  }

  const evidence = txt(raw.evidence || raw.evidencia) || null;
  const roomDerived = raw.room_derived === true || raw.derived_from_room === true || raw.derivadoDeCuarto === true;

  // OBSERVED EXIGE evidencia real y NO puede ser un mueble derivado de un cuarto.
  if (origin === ORIGEN.OBSERVED) {
    if (!evidence) issues.push('OBSERVED_SIN_EVIDENCIA');
    if (kind !== KIND.ROOM && roomDerived) issues.push('OBSERVED_DERIVADO_DE_CUARTO');
  }

  const out = {
    kind, type, role,
    quantity: quantity ?? null,
    capacity_per_unit: capacityPer,
    capacity_total: capacityTotal,
    zone,
    grouping: txt(raw.grouping || raw.functional_group_id || raw.grupo) || null,
    position,
    orientation,
    dimensions,
    page,
    evidence,
    confidence,
    origin: origin || originRaw || null,
    source_ref: txt(raw.source_ref || raw.plan_tag) || null,
    plan_tag: txt(raw.plan_tag) || null,
    room_derived: roomDerived,
    issues,
    review_required: issues.length > 0,
  };
  return out;
}

/** Identidad para detectar duplicados de forma determinista. */
function identidad(it) {
  const px = it.position?.x ?? '∅';
  const py = it.position?.y ?? '∅';
  return `${it.type || it.role || '∅'}|${it.zone || '∅'}|${px}|${py}|${it.page ?? '∅'}`;
}

/**
 * Valida el programa observado COMPLETO del lado servidor.
 * @param {Array} items
 * @param {object} ctx {envelopeW, envelopeH, zoneNames, maxPage}
 * @returns {{state, items, issues, warnings, metrics}}
 */
export function validarProgramaObservado(items, ctx = {}) {
  if (!Array.isArray(items)) {
    return { state: 'ABSENT', items: [], issues: [], warnings: [], metrics: { total: 0, invalidos: 0, observados: 0 } };
  }
  const norm = items.map((it) => validarItemObservado(it, ctx));
  const issues = [];
  const warnings = [];

  norm.forEach((it, i) => it.issues.forEach((c) => issues.push({ index: i, code: c })));

  // Duplicados: misma identidad (type+zone+posición+página) ⇒ algo se contó doble.
  const seen = new Map();
  norm.forEach((it, i) => {
    const key = identidad(it);
    if (seen.has(key)) {
      issues.push({ index: i, code: 'ITEM_DUPLICADO', of: seen.get(key) });
      it.review_required = true;
      if (!it.issues.includes('ITEM_DUPLICADO')) it.issues.push('ITEM_DUPLICADO');
    } else seen.set(key, i);
  });

  // Lo que NO es observed-válido no cuenta como real todavía: es material de revisión.
  norm.forEach((it, i) => {
    if (!it.review_required && it.origin !== ORIGEN.OBSERVED) {
      warnings.push({ index: i, code: 'REQUIERE_CONFIRMACION', origin: it.origin });
    }
  });

  const invalidos = norm.filter((it) => it.review_required).length;
  const observados = norm.filter((it) => !it.review_required && it.origin === ORIGEN.OBSERVED).length;

  // FAIL nunca por mobiliario (la geometría es la que puede FALLAR duro). Un item
  // inválido o pendiente baja a REVIEW_REQUIRED: se lee, pero NO se libera solo.
  const state = norm.length === 0 ? 'ABSENT'
    : (invalidos > 0 || warnings.length > 0) ? 'REVIEW_REQUIRED'
    : 'PASS';

  return {
    state,
    items: norm,
    issues,
    warnings,
    metrics: { total: norm.length, invalidos, observados },
  };
}
