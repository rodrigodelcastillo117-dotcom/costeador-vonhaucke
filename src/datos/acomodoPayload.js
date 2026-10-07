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
export function construirPayloadAcomodo({ partidas = [], areasM = [] } = {}) {
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

  const piezas = expandirPiezas(reales);
  // Blindaje final: ninguna pieza expandida puede provenir de un sug-*.
  const piezasLimpias = piezas.filter((pz) => !esSugerida(pz) && !String(pz.id || '').startsWith('sug-'));

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
  };
}
