// ============================================================================
//  P0.2 · BUILDER ÚNICO DEL PAYLOAD AL SOLVER (contrato de entrada).
//
//  Hoy el payload {areas,piezas} se arma en 4 sitios dispersos de AcomodoBase,
//  con flags inconsistentes y SIN garantía server-independiente de que:
//    (obj 1) el solver reciba SÓLO partidas CONFIRMADas,
//    (obj 2) CERO sug-* lleguen al input real,
//    (obj 3) NO se acomode sin un FloorSpec VÁLIDO.
//
//  Este módulo es la ÚNICA puerta de entrada. Es puro y testeable sin deploy
//  (CERTIFICADO AHORA). Devuelve el payload canónico (áreas en mm + piezas +
//  program_hash + floor_hash) o un rechazo explícito con motivo — nunca un
//  payload "a medias" que el solver pudiera malinterpretar.
// ============================================================================
import { areasCanonicas, aMM } from './floorPlan.js';
import { expandirPiezas } from './espacio.js';
import { inferirRolFuncional } from './rolFuncional.js';
import { marcarDestinoPartida } from './destinoAcomodo.js';
import { programHashCanonico, floorHash } from './acomodoHash.js';

// Pasillo mínimo de circulación (mm) — parte del input geométrico para el hash.
const MIN_PASILLO_MM = 1000;

// Predicado sug-* local (no importa el componente Acomodo.jsx). Debe coincidir
// con Acomodo.jsx:esSugerida — misma regla ABSOLUTA #6/#97.
export const esSugerida = (p) => !!p?.sugeridoPlano || String(p?.id || '').startsWith('sug-');

/**
 * Validación GEOMÉTRICA del FloorSpec (áreas en metros). Determinista, sin IA.
 * No sustituye a floorSpec.js (que valida el FloorSpec rico leído del plano);
 * aquí sólo exigimos que el espacio sea acomodable: existe y cada área tiene
 * dimensiones positivas y finitas.
 * @returns {{ok:boolean, issues:string[]}}
 */
export function validarFloorSpecGeom(areasM) {
  const issues = [];
  const areas = Array.isArray(areasM) ? areasM : [];
  if (areas.length === 0) { issues.push('SIN_AREAS'); return { ok: false, issues }; }
  areas.forEach((a, i) => {
    const w = Number(a?.ancho), d = Number(a?.largo);
    const etiqueta = a?.nombre || `área ${i + 1}`;
    if (!Number.isFinite(w) || w <= 0) issues.push(`AREA_ANCHO_INVALIDO:${etiqueta}`);
    if (!Number.isFinite(d) || d <= 0) issues.push(`AREA_LARGO_INVALIDO:${etiqueta}`);
    if (Array.isArray(a?.poly) && a.poly.length > 0 && a.poly.length < 3) issues.push(`AREA_POLY_DEGENERADO:${etiqueta}`);
  });
  return { ok: issues.length === 0, issues };
}

/**
 * Construye el payload canónico para el solver, o lo rechaza con motivo.
 *
 * @param {{partidas?:Array, areasM?:Array}} entrada
 * @returns {
 *   {ok:true, areas:Array, piezas:Array, program_hash:string, floor_hash:string,
 *    requested:number, descartadosSugeridos:number, areasCanon:Array} |
 *   {ok:false, motivo:'SIN_PARTIDAS_CONFIRMADAS'|'SIN_FLOORSPEC'|'FLOORSPEC_INVALIDO',
 *    detalles?:string[]}
 * }
 */
// Estados de FloorSpec (de floorSpec.js / lectura de plano) que SÍ permiten
// colocar y PUBLICAR. Para un plano leído por IA, cualquier otro estado bloquea
// la PUBLICACIÓN; sólo los de FALLO bloquean además el solver.
const FLOORSPEC_ESTADOS_OK = new Set(['PASS', 'VALID', 'OK', 'VALIDO']);
// COT-P0-022 (RESCATE, E2E Torre Sur 2026-10-10): el validador del servidor
// distingue `issues → FAIL` (geometría insuficiente) de `warnings → REVIEW_REQUIRED`
// (p.ej. puertas sin barrido legible, observado por revisar). Antes el cliente
// trataba TODO lo que no era PASS como rechazo y apagaba el solver: "No voy a
// acomodar… (estado REVIEW_REQUIRED)" sin camino para seguir. Ahora REVIEW_REQUIRED
// produce un payload de BORRADOR (marcado) — se acomoda, se puede revisar y
// corregir, pero `layoutPublicable` sigue en false hasta revalidar. FAIL sigue
// bloqueando el solver.
const FLOORSPEC_ESTADOS_BORRADOR = new Set(['REVIEW_REQUIRED']);

export function construirPayloadAcomodo({ partidas = [], areasM = [], piezasExtra = [], floorSpecEstado = null } = {}) {
  // (obj 1/2) CONFIRMADas-only: se filtra sug-* SIEMPRE, aquí, aunque el caller
  // ya lo haya hecho. Es la garantía server-independiente contra el bypass de
  // montar AcomodoBase sin el wrapper. `descartadosSugeridos` deja rastro.
  const entrada = Array.isArray(partidas) ? partidas : [];
  const reales = entrada.filter((p) => !esSugerida(p)).map(marcarDestinoPartida);
  const descartadosSugeridos = entrada.length - reales.length;

  if (reales.length === 0) {
    return { ok: false, motivo: 'SIN_PARTIDAS_CONFIRMADAS', detalles: [], descartadosSugeridos };
  }

  // (obj 3) FloorSpec válido es PRE-CONDICIÓN del placement. Primero se valida el
  // espacio; sólo entonces se acomoda. No se mezcla detección con placement.
  const areasCanon = areasCanonicas({ areasM });
  if (areasCanon.length === 0) {
    return { ok: false, motivo: 'SIN_FLOORSPEC', detalles: ['areasCanonicas vacío'], descartadosSugeridos };
  }
  const val = validarFloorSpecGeom(areasCanon);
  if (!val.ok) {
    return { ok: false, motivo: 'FLOORSPEC_INVALIDO', detalles: val.issues, descartadosSugeridos };
  }
  // GAP3 · FloorSpec de PLANO/IA: aunque la GEOMETRÍA sea válida, si el estado
  // determinista del FloorSpec no permite placement, NO se llama al solver. El
  // espacio manual/simple (sin floorSpecEstado) pasa; un plano rechazado NO.
  const estadoFS = floorSpecEstado != null ? String(floorSpecEstado).toUpperCase() : null;
  const borrador = estadoFS != null && FLOORSPEC_ESTADOS_BORRADOR.has(estadoFS);
  if (estadoFS != null && !FLOORSPEC_ESTADOS_OK.has(estadoFS) && !borrador) {
    return { ok: false, motivo: 'FLOORSPEC_RECHAZADO', detalles: [String(floorSpecEstado)], descartadosSugeridos };
  }

  // COT-P0-025: las partidas de Voni/IA llegan SIN rol funcional y el kit-solver no
  // arma kits sin anclas (0 colocadas en el E2E real). Se infiere rol/grupo/capacidad
  // y se MARCA como inferido; un rol confirmado del programa nunca se pisa.
  const piezas = inferirRolFuncional(expandirPiezas(reales), { areas: areasCanon });
  // Piezas EXTRA (p.ej. copias manuales `dup-*` del proyectista): ya vienen
  // expandidas (nivel pieza). Entran al solver pero NUNCA un sug-*.
  const extra = (Array.isArray(piezasExtra) ? piezasExtra : [])
    .filter((pz) => !esSugerida(pz) && !String(pz.id || '').startsWith('sug-'));
  // Blindaje final: ninguna pieza expandida puede provenir de un sug-*.
  const piezasLimpias = [...piezas, ...extra].filter((pz) => !esSugerida(pz) && !String(pz.id || '').startsWith('sug-'));

  return {
    ok: true,
    areas: aMM(areasCanon),                // mm, orden preservado (índice = identidad)
    areasCanon,                            // metros canónicos (para persistir/hash)
    piezas: piezasLimpias,
    // program_hash CANÓNICO: sobre las piezas EXPANDIDAS que recibe el solver
    // (captura cambios de dimensión canónica aunque id/cantidad comercial no cambien).
    program_hash: programHashCanonico(piezasLimpias),
    floor_hash: floorHash(areasCanon, { minPasillo: MIN_PASILLO_MM }),
    requested: piezasLimpias.length,
    descartadosSugeridos,
    // BORRADOR: el plano está en revisión (REVIEW_REQUIRED). Se acomoda para que el
    // usuario vea/corrija, pero NO es publicable ni emitible hasta revalidar.
    borrador,
    floorSpecEstado: estadoFS,
    ...(borrador ? { motivoBorrador: `plano en revisión (${estadoFS}): acomodo de borrador, no publicable hasta revalidar el plano` } : {}),
  };
}
