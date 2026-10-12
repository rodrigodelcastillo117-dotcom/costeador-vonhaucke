// ============================================================================
//  INTERPRETAR LA RESPUESTA DE `acomodar-espacio` (acomodo con IA del servidor)
//
//  VH-067 (2026-10-11). La edge v9 corre primero un planificador determinista y
//  usa la IA sólo para reparar; valida cada posición (dentro del cuarto, sin
//  encimar, sin tapar puertas, zona que lo admite) y devuelve el veredicto en
//  `layoutSpec.status` ∈ PASS | REVIEW_REQUIRED | PARTIAL | FAIL, con
//  `layoutSpec.validation.issues/reviews`, `noColocadas` y `puertas`. PERO
//  responde SIEMPRE `ok: true` (HTTP 200), aunque el estado sea FAIL con cero
//  piezas colocadas. El cliente hacía `setPlan(r.plan)` y ya: un FAIL se veía
//  como "acomodado" sin muebles y sin explicación; un PARTIAL no decía qué faltó.
//
//  Aquí vive la lectura. Puro: sin red ni React. Nunca inventa colocaciones.
// ============================================================================

import { ESTADOS_SERVIDOR, TEXTO_ESTADO_SERVIDOR, describirValidacionServidor } from './acomodoVeredicto.js';

// VH-111: el edge también responde NEEDS_SEMANTIC_REVIEW / QUALITY_REVIEW_REQUIRED /
// NEEDS_REVIEW_METADATA. Antes no estaban aquí y se leían como "sin validación".
export const ESTADOS = ESTADOS_SERVIDOR;

export function estadoAcomodo(r) {
  const s = String(r?.layoutSpec?.status || '').toUpperCase();
  return ESTADOS.includes(s) ? s : 'SIN_VALIDACION';
}

const id = (x) => (x?.id != null ? ` «${x.id}»` : '');
const TEXTO = {
  OUTSIDE_ZONE: (i) => `Pieza${id(i)} fuera de su cuarto.`,
  OVERLAP: (i) => `Encimado entre «${i?.a ?? '?'}» y «${i?.b ?? '?'}».`,
  BLOCKS_DOOR: (i) => `Pieza${id(i)} tapa una puerta.`,
  FUNCTIONAL_CLEARANCE: (i) => `Pieza${id(i)} sin espacio de uso (choca con ${i?.with_id ? `«${i.with_id}»` : i?.collision || 'otro elemento'}).`,
  WRONG_EXPLICIT_ZONE: (i) => `Pieza${id(i)} quedó en «${i?.zone ?? '?'}» y se pidió «${i?.expected_zone ?? '?'}».`,
  INVALID_AREA_INDEX: (i) => `Pieza${id(i)} apunta a un cuarto que no existe.`,
  INVALID_COORDINATES: (i) => `Pieza${id(i)} con coordenadas inválidas.`,
  MISSING_PLACEMENT: (i) => `Pieza${id(i)} no fue colocada ni declarada como no colocada.`,
  PLACEMENT_INVARIANT_BROKEN: () => 'El servidor reportó una inconsistencia interna en la colocación.',
  CLAIMED_ALL_FIT_BUT_UNPLACED: () => 'El servidor dijo que todo cabía pero dejó piezas sin colocar.',
  FURNITURE_IN_RESTROOM: (i) => `Pieza${id(i)} dentro de un baño.`,
  NON_TECH_FURNITURE_IN_TECHNICAL: (i) => `Pieza${id(i)} dentro de un site/IT.`,
  WORKSTATION_IN_WRONG_ZONE: (i) => `Estación${id(i)} en una zona que no es operativa ni privada.`,
  VISITOR_SEAT_ZONE_REVIEW: (i) => `Silla de visita${id(i)} en una zona poco usual: revisar.`,
  TECHNICAL_STORAGE_ZONE_REVIEW: (i) => `Guarda técnica${id(i)} fuera de site/servicio: revisar.`,
  SEMANTIC_ROLE_REVIEW: (i) => `Pieza${id(i)}: el servidor no pudo confirmar que la zona la admite.`,
};
const traducir = (lista) => (Array.isArray(lista) ? lista : []).map((x) => {
  const code = String(x?.code || '').trim();
  if (TEXTO[code]) return TEXTO[code](x);
  const m = /^([A-Z_]+)_WRONG_ZONE$/.exec(code);
  if (m) return `Pieza${id(x)} (${m[1].toLowerCase().replace(/_/g, ' ')}) en una zona que no le corresponde.`;
  return `Aviso del servidor: ${code || 'SIN_CÓDIGO'}${id(x)}`;
});

export const TEXTO_ESTADO = TEXTO_ESTADO_SERVIDOR;

/**
 * @param {object} r      respuesta cruda de la edge
 * @param {Array}  piezas piezas enviadas (para nombrar las no colocadas)
 * @returns {{ok:boolean, error?:string, plan?:object, estado:string, avisos:string[]}}
 */
export function interpretarAcomodoServidor(r, piezas = []) {
  if (!r || !r.ok) return { ok: false, error: r?.error || 'No se pudo acomodar. Vuelve a intentar.', estado: 'ERROR', avisos: [] };
  const estado = estadoAcomodo(r);
  const val = r.layoutSpec?.validation || {};
  const problemas = traducir(val.issues);
  const revisiones = traducir(val.reviews);
  const colocacion = Array.isArray(r.plan?.colocacion) ? r.plan.colocacion : [];
  const nombre = (pid) => piezas.find((p) => p.id === pid)?.nombre || pid;
  const noColocadas = (Array.isArray(r.noColocadas) ? r.noColocadas : []).map((n) => ({
    id: n?.id, nombre: nombre(n?.id), motivo: n?.motivo || (Array.isArray(n?.codigos) ? n.codigos.join(', ') : ''),
  }));
  const total = Number.isFinite(r.total) ? r.total : piezas.length;

  if (estado === 'FAIL' || (estado !== 'SIN_VALIDACION' && !colocacion.length)) {
    const det = [...problemas, ...noColocadas.map((n) => `${n.nombre}: ${n.motivo}`)].filter(Boolean);
    return { ok: false, estado, avisos: det, error: `${TEXTO_ESTADO.FAIL[0].toUpperCase()}${TEXTO_ESTADO.FAIL.slice(1)}.${det.length ? ' ' + det.slice(0, 6).join(' · ') : ''}` };
  }
  if (estado === 'SIN_VALIDACION' && !colocacion.length) {
    return { ok: false, estado, avisos: [], error: 'El servidor no devolvió ninguna colocación ni su validación.' };
  }

  const puertas = r.puertas || val.doors || null;
  // Sin puertas en el plano el servidor dice VERIFIED (no había nada que verificar): aquí NO cuenta como verificado.
  const puertasOk = puertas ? puertas.total > 0 && (puertas.status === 'VERIFIED' || puertas.verificadas === true) : null;
  const avisos = [];
  if (estado === 'SIN_VALIDACION') avisos.push('El servidor no devolvió validación del acomodo: revisa el plano antes de usarlo.');
  if (noColocadas.length) avisos.push(`${noColocadas.length} mueble(s) sin colocar: ${noColocadas.map((n) => n.nombre).join(', ')}.`);
  avisos.push(...revisiones);
  if (puertas && puertas.total === 0) avisos.push('El servidor acomodó sin puertas: nadie verificó accesos ni barridos.');
  else if (puertasOk === false) avisos.push('Hay puertas cuyo barrido el servidor no pudo verificar.');

  const auditoria = [
    // VH-111: el detalle sale del estado real del edge (incluidas las revisiones semánticas y sus observaciones).
    { check: 'Validación del servidor', ok: estado === 'PASS', detalle: describirValidacionServidor(r.layoutSpec, r.metodo || null).detalle },
    { check: 'Todas las piezas colocadas', ok: noColocadas.length === 0 && colocacion.length >= total, detalle: `${colocacion.length} de ${total}` },
    { check: 'Sin problemas geométricos', ok: problemas.length === 0, detalle: problemas.length ? problemas.join(' · ') : 'ninguno reportado' },
    { check: 'Puertas verificadas', ok: puertasOk === true, detalle: !puertas ? 'sin dato' : puertas.total === 0 ? 'ninguna puerta en el plano' : `${puertas.verificadasCount ?? '?'} de ${puertas.total}` },
  ];
  const plan = {
    ...(r.plan || {}),
    colocacion,
    caben: noColocadas.length === 0 && colocacion.length >= total,
    sinColocar: noColocadas.map((n) => n.id),
    notas: [...(Array.isArray(r.plan?.notas) ? r.plan.notas : []), ...avisos],
    auditoria,
    servidor: { estado, metodo: r.metodo || null, requestId: r.request_id || null, calidad: r.calidad ?? null },
  };
  return { ok: true, plan, estado, avisos };
}
