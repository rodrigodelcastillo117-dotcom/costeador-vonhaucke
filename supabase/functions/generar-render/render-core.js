// ============================================================================
//  VH-121 · RENDER CORE (puro, testeable sin Deno ni Gemini).
//
//  Lo que el modelo y el auditor reciben del proyecto REAL además del dibujo:
//   · `esperados`: piezas DE PISO de ese cuarto con cantidad, medidas y tipo (del acomodo, no inventadas)
//   · `sillas`: cuántas sillas dibuja el plano en ese cuarto
//   · referencias de producto (renders de catálogo) — el auditor las recibe también, para juzgar la
//     geometría del mueble contra la FICHA y no contra una caja del isométrico.
//  Evidencia (render_eventos 12-oct, 9 intentos `escena` en producción): 8 llegaron con UNA sola imagen
//  (el dibujo), ninguna foto de producto; el contador no contaba "mostrador de recepción" (0 de 1); el
//  auditor no sabía qué muebles se esperaban. Nada aquí relaja la auditoría: sólo la informa mejor.
// ============================================================================

const n = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const m = (mm) => (n(mm) > 0 ? (n(mm) / 1000).toFixed(2) : null);

// Normaliza la lista de piezas esperadas que manda el cliente (máximo 12, sin sillas).
/**
 * @param {unknown} lista
 * @returns {Array<{ nombre: string, cantidad: number, tipo: string|null, w: number|null, d: number|null }>}
 */
export function normalizarEsperados(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((p) => p && typeof p === 'object' && String(p.nombre || '').trim())
    .filter((p) => p.tipo !== 'asiento')
    .slice(0, 12)
    .map((p) => ({ nombre: String(p.nombre).slice(0, 90), cantidad: Math.max(1, Math.round(n(p.cantidad, 1))), tipo: p.tipo ? String(p.tipo).slice(0, 24) : null, w: n(p.w) > 0 ? Math.round(n(p.w)) : null, d: n(p.d) > 0 ? Math.round(n(p.d)) : null }));
}

// Texto compacto: "1× Recepción (2.42 × 0.83 m), 2× Gaveta pedestal 3 cajones (0.38 × 0.46 m)".
/** @param {unknown} esperados @returns {string} */
export function textoEsperados(esperados) {
  const e = normalizarEsperados(esperados);
  return e.map((p) => `${p.cantidad}× ${p.nombre}${p.w && p.d ? ` (${m(p.w)} × ${m(p.d)} m)` : ''}`).join(', ');
}

// Pregunta de CONTEO al modelo sobre la imagen que acaba de producir. Antes enumeraba "desks, benches,
// storage units, meeting tables, privacy screens": un mostrador de recepción no estaba en la lista y el
// contador devolvía 0 de 1. Ahora enumera LO QUE SE ESPERA en ese cuarto (de piso), sin sillas.
/**
 * @param {unknown} esperados
 * @param {number|string|null} [total]
 * @returns {string}
 */
export function preguntaConteo(esperados, total) {
  const txt = textoEsperados(esperados);
  const esperado = n(total) > 0 ? n(total) : normalizarEsperados(esperados).reduce((s, p) => s + p.cantidad, 0);
  return (
    'Count ONLY the floor-standing furniture pieces visible in the image you just produced' +
    (txt ? `. The expected floor-standing pieces in this room are: ${txt}. Count every piece of those kinds that stands directly on the floor (a reception counter, a desk, a bench, a storage unit, a credenza, a pedestal, a meeting table or a privacy screen each count as one)` : ': desks, benches, storage units, meeting tables, privacy screens, reception counters — anything that stands directly on the floor') +
    '. Do NOT count chairs, monitors, mugs, notebooks or anything sitting on top of another piece. ' +
    (esperado ? `(For reference, ${esperado} were requested; answer with what you actually see, not with that number.) ` : '') +
    'Answer with ONLY the total number, digits only, no words, no punctuation.'
  );
}

// Bloque de geometría para el prompt de ESCENA: medidas reales por pieza y sillas que dibuja el plano.
/**
 * @param {{ esperados?: Array<Record<string, unknown>>, sillas?: number|string|null }} [o]
 * @returns {string}
 */
export function bloqueGeometriaEscena({ esperados = [], sillas = null } = {}) {
  const txt = textoEsperados(esperados);
  const partes = [];
  if (txt) partes.push(`FLOOR-STANDING PIECES IN THIS ROOM (exact, with footprint width × depth): ${txt}. Reproduce exactly these counts and proportions.`);
  if (n(sillas) > 0) partes.push(`CHAIRS: the diagram shows exactly ${n(sillas)} chairs in this room; render exactly ${n(sillas)} chairs, at the positions the diagram shows.`);
  return partes.length ? partes.join(' ') + ' ' : '';
}

// Prompt del AUDITOR. Recibe lo esperado y cuántas referencias de producto acompañan al dibujo. Las
// reglas de FAIL son las mismas de antes (ninguna se relaja); se agrega que la geometría del mueble se
// juzgue contra las referencias de producto cuando existan, y el conteo de sillas contra el dibujo.
/**
 * @param {{ modo?: string, cuarto?: string, entorno?: string, conteoPiso?: number|string|null, esperados?: Array<Record<string, unknown>>, sillas?: number|string|null, nRefs?: number }} [o]
 * @returns {string}
 */
export function promptAuditoria({ modo = '', cuarto = '', entorno = '', conteoPiso = null, esperados = [], sillas = null, nRefs = 0 } = {}) {
  const txt = textoEsperados(esperados);
  return [
    'You are a strict QA inspector for architectural/product visualization.',
    'REFERENCE IMAGE (the diagram) = source of truth for room, layout, counts and positions.',
    nRefs > 0 ? `PRODUCT REFERENCE IMAGES (${nRefs}) = source of truth for each product's silhouette, legs/frame, drawers, doors and proportions. Judge geometry_match against THEM, not against the simplified boxes of the diagram.` : 'No product reference images were supplied: judge geometry_match only on what the diagram and the expected list make verifiable (counts, footprints, proportions); do not invent product details.',
    'GENERATED IMAGE = candidate output.',
    'Evaluate only what can be visually verified. Do not reward beauty over accuracy.',
    `MODE=${modo}; ROOM=${cuarto || 'n/a'}; ENVIRONMENT=${entorno || 'n/a'}; EXPECTED_FLOOR_COUNT=${conteoPiso ?? 'n/a'}; EXPECTED_CHAIRS=${n(sillas) > 0 ? n(sillas) : 'n/a'}.`,
    txt ? `EXPECTED FLOOR-STANDING FURNITURE: ${txt}.` : '',
    'Return ONLY JSON with keys:',
    '{"pass":boolean,"geometry_match":"PASS|FAIL|UNKNOWN","layout_match":"PASS|FAIL|UNKNOWN","environment_match":"PASS|FAIL|UNKNOWN","extra_objects":"PASS|FAIL|UNKNOWN","natural_camera":"PASS|FAIL|UNKNOWN","reasons":[string],"confidence":0-1}.',
    'FAIL geometry_match if the product silhouette, module count, supports/legs, doors, shelves, drawers or major proportions differ from the product references (or from the expected list when there are no references).',
    'FAIL layout_match for room/placement modes if furniture positions/orientations/room organization materially differ from the diagram, or if the number of floor-standing pieces or chairs differs from EXPECTED_FLOOR_COUNT / EXPECTED_CHAIRS.',
    'FAIL environment_match if the declared room/environment does not read clearly or becomes a generic unrelated office.',
    'FAIL extra_objects if new floor-standing furniture/partitions/rooms are invented.',
    'FAIL natural_camera for dollhouse/aerial/fisheye/physically implausible perspective when a natural view is required.',
    'pass=true only if every relevant critical field is PASS; UNKNOWN may remain only for non-relevant fields.',
  ].filter(Boolean).join('\n');
}
