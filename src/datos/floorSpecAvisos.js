// ============================================================================
//  AVISOS DE LA VALIDACIÓN DETERMINISTA DEL SERVIDOR (leer-plano · FloorSpec)
//
//  VH-064 (2026-10-11). La edge `leer-plano` v11 revalida TODA la salida de la
//  IA y devuelve `floorSpec.validation = { state, issues, warnings }` con
//  `state ∈ PASS | REVIEW_REQUIRED | FAIL`. La app lo ignoraba por completo:
//  medía sólo traslapes locales (`planoLeido.resumenLectura`) y una lectura con
//  la envolvente SUPUESTA por el modelo salía como "✓ Lectura confiable". Y en
//  un FAIL (422) el cliente sólo veía la frase genérica, sin los `issues` que
//  dicen exactamente qué no cuadró (p. ej. suma de cotas ≠ envolvente).
//
//  Aquí vive la traducción a español y la regla de combinación. Puro: sin red,
//  sin React. Un código que no conocemos NO se traga: se muestra tal cual.
// ============================================================================

const mm = (x) => (Number.isFinite(Number(x)) ? `${Math.round(Number(x))} mm` : '?');
const zona = (w) => (w?.zone ? ` (${w.zone})` : '');
const campo = (w) => (w?.field ? ` [${w.field}]` : '');

// Avisos (REVIEW_REQUIRED): la lectura se puede usar, pero la persona debe saberlo.
const TEXTO_AVISO = {
  NO_DIMENSION_AUTHORITY: () => 'El plano no trae cotas: las medidas son estimadas y requieren una referencia real antes de liberar.',
  MULTI_LEVEL_DOCUMENT: (i) => `El documento trae ${(i?.niveles || []).length || 'varios'} niveles (${(i?.niveles || []).join(' · ')}): se acomoda un nivel a la vez (el que elegiste al confirmar la lectura); los demás se cotizan como otro proyecto.`,
  ASSUMED_CRITICAL_GEOMETRY: () => 'La envolvente (ancho × largo total) la SUPUSO el modelo, no la midió: confírmala antes de usar la lectura.',
  UNKNOWN_GEOMETRY_PROVENANCE: () => 'No quedó claro si la envolvente se midió o se supuso.',
  ASSUMED_ZONE_GEOMETRY: (w) => `La forma del cuarto${zona(w)} se basa en un supuesto del modelo, no en el plano.`,
  LOW_CONFIDENCE_ZONE: (w) => `El modelo tiene poca confianza en el cuarto${zona(w)}.`,
  COTAS_WITHOUT_COMPLETE_GRID: () => 'Hay cotas pero no se pudo reconstruir la retícula completa: las medidas internas pueden variar.',
  NO_DOORS_DETECTED: () => 'No se detectaron puertas: el acomodo no respetará accesos.',
  DOOR_SWING_UNVERIFIED: (w) => `Una puerta${campo(w)} se detectó sin bisagra ni sentido de abatimiento verificable.`,
  ASSUMED_DOOR_GEOMETRY: (w) => `Una puerta${campo(w)} se ubicó por supuesto, no por el plano.`,
};

// Problemas (FAIL): el servidor rechazó la lectura; se explica qué no cuadró.
const TEXTO_PROBLEMA = {
  INVALID_ENVELOPE: () => 'La envolvente leída no es una medida válida.',
  INVALID_GRID_SEGMENT: () => 'Algún tramo de la retícula de cotas no es una medida válida.',
  GRID_ENVELOPE_MISMATCH: (i) => `Las cotas no suman la envolvente${campo(i)}: suman ${mm(i?.sum_mm)} y la envolvente mide ${mm(i?.envelope_mm)} (tolerancia ${mm(i?.tolerance_mm)}).`,
  NO_AREAS: () => 'No se reconoció ningún cuarto.',
  DUPLICATE_ZONE_NAME: () => 'Dos cuartos salieron con el mismo nombre.',
  MISSING_ZONE_NAME: (i) => `Un cuarto${campo(i)} quedó sin nombre.`,
  INVALID_SHAPE: (i) => `Un cuarto${campo(i)} tiene una forma que no se reconoce.`,
  UNKNOWN_PARENT_ZONE: (i) => `Un cuarto${campo(i)} dice estar dentro de "${i?.value ?? '?'}", que no existe.`,
  SELF_PARENT_ZONE: (i) => `Un cuarto${campo(i)} dice estar dentro de sí mismo.`,
  INVALID_WORKSTATION_COUNT: (i) => `El conteo de puestos${campo(i)} no es un entero válido.`,
  POLYGON_NEEDS_3_POINTS: (i) => `Un cuarto${campo(i)} tiene menos de 3 vértices.`,
  NON_FINITE_POINT: (i) => `Un vértice${campo(i)} no es una coordenada válida.`,
  POINT_OUTSIDE_ENVELOPE: (i) => `Un vértice${campo(i)} cae fuera de la envolvente (${mm(i?.x)}, ${mm(i?.y)}).`,
  ZERO_AREA_POLYGON: (i) => `Un cuarto${campo(i)} tiene área cero.`,
  INVALID_CIRCLE: (i) => `Un cuarto circular${campo(i)} no tiene centro/radio válidos.`,
  CIRCLE_OUTSIDE_ENVELOPE: (i) => `Un cuarto circular${campo(i)} se sale de la envolvente.`,
  TOP_LEVEL_AREA_EXCEEDS_ENVELOPE: (i) => `Los cuartos suman ${i?.top_level_m2 ?? '?'} m² y la envolvente mide ${i?.envelope_m2 ?? '?'} m²: hay cuartos encimados o mal medidos.`,
  INVALID_DOOR: (i) => `Una puerta${campo(i)} no tiene posición/ancho válidos.`,
  DOOR_OUTSIDE_ENVELOPE: (i) => `Una puerta${campo(i)} cae fuera de la envolvente.`,
  INVALID_DOOR_SWING_EVIDENCE: (i) => `El abatimiento de una puerta${campo(i)} viene incompleto.`,
  DOOR_HINGE_OUTSIDE_ENVELOPE: (i) => `La bisagra de una puerta${campo(i)} cae fuera de la envolvente.`,
};

// VH-094: avisos REPETIDOS por elemento (5 puertas sin barrido → 5 renglones con
// `[puertas[i]]`) se resumen en UNO con conteo. Los problemas (FAIL) no se resumen:
// cada uno nombra algo distinto que hay que corregir.
const RESUMEN_AVISO = {
  DOOR_SWING_UNVERIFIED: (n) => `${n} puerta${n === 1 ? '' : 's'} sin bisagra ni sentido de abatimiento verificable: el acomodo no bloquea su barrido hasta que lo confirmes.`,
  ASSUMED_DOOR_GEOMETRY: (n) => `${n} puerta${n === 1 ? '' : 's'} ubicada${n === 1 ? '' : 's'} por supuesto, no por el plano.`,
  ASSUMED_ZONE_GEOMETRY: (n) => `${n} cuarto${n === 1 ? '' : 's'} con forma supuesta por el modelo, no leída del plano.`,
  LOW_CONFIDENCE_ZONE: (n) => `El modelo tiene poca confianza en ${n} cuarto${n === 1 ? '' : 's'}.`,
};

function traducir(lista, tabla, prefijo, { resumir = false } = {}) {
  if (!Array.isArray(lista)) return [];
  const out = [];
  const conteo = new Map();
  for (const x of lista) {
    const code = String(x?.code || '').trim();
    if (resumir && RESUMEN_AVISO[code]) {
      conteo.set(code, { n: (conteo.get(code)?.n || 0) + 1, zonas: [...(conteo.get(code)?.zonas || []), x?.zone].filter(Boolean) });
      continue;
    }
    const fn = tabla[code];
    if (fn) { out.push(fn(x)); continue; }
    // Código desconocido: se enseña, no se esconde (un aviso perdido es peor que uno feo).
    out.push(`${prefijo} del servidor: ${code || 'SIN_CÓDIGO'}${campo(x)}${x?.message ? ` · ${x.message}` : ''}`);
  }
  for (const [code, { n, zonas }] of conteo) {
    if (n === 1) { const x = lista.find((y) => String(y?.code || '').trim() === code); out.push(tabla[code](x)); continue; }
    out.push(RESUMEN_AVISO[code](n) + (zonas.length ? ` (${[...new Set(zonas)].join(', ')})` : ''));
  }
  return out;
}

/** Avisos (warnings) de `floorSpec.validation`, en español. */
export const avisosDeValidacion = (validation) => traducir(validation?.warnings, TEXTO_AVISO, 'Aviso', { resumir: true });
/** Problemas (issues) de `floorSpec.validation`, en español. */
export const problemasDeValidacion = (validation) => traducir(validation?.issues, TEXTO_PROBLEMA, 'Problema');

export const ESTADOS_SERVIDOR = ['PASS', 'REVIEW_REQUIRED', 'FAIL'];

/**
 * Estado que reporta el servidor, normalizado. Si la respuesta no trae
 * validación (edge vieja, respuesta recortada) se dice: SIN_VALIDACION.
 */
export function estadoServidor(floorSpec) {
  const s = String(floorSpec?.validation?.state || '').toUpperCase();
  return ESTADOS_SERVIDOR.includes(s) ? s : 'SIN_VALIDACION';
}

/**
 * Combina el nivel local (traslapes medidos aquí) con el veredicto del servidor.
 * El servidor es la autoridad de procedencia (MEASURED/ASSUMED) que el cliente no
 * puede medir: por eso puede BAJAR el nivel, nunca subirlo.
 *   FAIL            → 'baja'  (si había cuartos)
 *   REVIEW_REQUIRED → a lo más 'media'
 *   SIN_VALIDACION  → a lo más 'media' (no sabemos; no se declara confiable)
 *   PASS            → se respeta el nivel local
 */
export function nivelCombinado(nivelLocal, estado) {
  if (nivelLocal === 'nula') return 'nula';
  if (estado === 'FAIL') return 'baja';
  if (estado === 'PASS') return nivelLocal;
  return nivelLocal === 'alta' ? 'media' : nivelLocal;
}

export const TEXTO_ESTADO_SERVIDOR = {
  PASS: 'validación geométrica del servidor: aprobada',
  REVIEW_REQUIRED: 'validación geométrica del servidor: requiere revisión',
  FAIL: 'validación geométrica del servidor: rechazada',
  SIN_VALIDACION: 'el servidor no devolvió validación geométrica',
};
