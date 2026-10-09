// ============================================================================
//  SHADOW MOTOR CUTOVER (REALITY CUTOVER · paso de seguridad, autorizado)
//
//  Objetivo (ChatGPT §8): ANTES de que el motor tome el precio del
//  CanonicalPriceResolver para productos NUEVOS, demostrar en SHADOW que NO se
//  rompe nada: para cada insumo se compara el precio LEGACY que el motor usa hoy
//  (`insumo.precio`) contra el precio CANÓNICO resuelto (capturado-aware), y se
//  clasifica cualquier diferencia por causa. Cero diferencias inexplicables.
//
//  PURO, determinista, READ-ONLY. NO cambia el motor, NO toca las 33 legacy, NO
//  escribe nada. Es el reporte que habilita conectar productos nuevos al resolver.
//
//  Nota honesta: con el catálogo ACTUAL (una observación por insumo, que viene de
//  `insumo.precio`), el número resuelto es IDÉNTICO al legacy — el "cutover"
//  numérico es no-op hoy. Lo que SÍ aporta ya es el GATE de procedencia: qué
//  insumos quedarían como costo NO oficial (provisional/sin-fecha/pendiente). El
//  gobierno real del número cobra sentido al ingerir la serie histórica (xlsx).
// ============================================================================
import { resolverPrecioInsumoVivo, precioCapturadoAMano } from './precioInsumoBridge.js';
import { ESTADO_PRECIO } from './precioProvenance.js';

const num = (v) => { if (typeof v !== 'number' && typeof v !== 'string') return null; if (typeof v === 'string' && v.trim() === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

// Causas de diferencia entre legacy y canónico (determinista).
export const CAUSA_SHADOW = Object.freeze({
  SIN_DIFERENCIA: 'SIN_DIFERENCIA',           // mismo número
  LEGACY_SIN_PRECIO: 'LEGACY_SIN_PRECIO',     // el legacy no tenía precio
  CANONICO_PENDIENTE: 'CANONICO_PENDIENTE',   // el resolver no pudo resolver (PENDING)
  CAPTURADO_A_MANO: 'CAPTURADO_A_MANO',       // precio editado a mano → provisional (num igual, estado distinto)
  DIFERENCIA_NUMERICA: 'DIFERENCIA_NUMERICA', // ⚠️ los números difieren (no debería con catálogo actual)
});

/**
 * Shadow-resuelve UN insumo: legacy vs canónico.
 * @returns {{id, legacy:number|null, canonico:number|null, estado:string,
 *   bloqueaCostoOficial:boolean, igual:boolean, causa:string}}
 */
export function shadowResolverInsumo(id, insumo = {}, opts = {}) {
  const legacy = num(insumo.precio);
  const r = resolverPrecioInsumoVivo(id, insumo, opts);
  const canonico = num(r.precio);
  const igual = legacy != null && canonico != null && Math.abs(legacy - canonico) < 1e-6;

  let causa;
  if (legacy == null) causa = CAUSA_SHADOW.LEGACY_SIN_PRECIO;
  else if (r.estado === ESTADO_PRECIO.PENDING || canonico == null) causa = CAUSA_SHADOW.CANONICO_PENDIENTE;
  else if (igual) causa = precioCapturadoAMano(insumo) ? CAUSA_SHADOW.CAPTURADO_A_MANO : CAUSA_SHADOW.SIN_DIFERENCIA;
  else causa = CAUSA_SHADOW.DIFERENCIA_NUMERICA;

  return {
    id,
    legacy,
    canonico,
    estado: r.estado,
    bloqueaCostoOficial: r.bloqueaCostoOficial,
    igual,
    causa,
  };
}

/**
 * Reporte SHADOW de un catálogo completo (mapa id→insumo).
 * @returns {{total, iguales, diferenciasNumericas, bloqueanOficial, porCausa, filas, sinDiferenciaNumericaActual}}
 */
export function reporteShadowCatalogo(insumos = {}, opts = {}) {
  const filas = [];
  const porCausa = {};
  let iguales = 0;
  let diferenciasNumericas = 0;
  let bloqueanOficial = 0;

  for (const [id, insumo] of Object.entries(insumos || {})) {
    if (!insumo || typeof insumo !== 'object') continue;
    const f = shadowResolverInsumo(id, insumo, opts);
    filas.push(f);
    porCausa[f.causa] = (porCausa[f.causa] || 0) + 1;
    if (f.igual) iguales += 1;
    if (f.causa === CAUSA_SHADOW.DIFERENCIA_NUMERICA) diferenciasNumericas += 1;
    if (f.bloqueaCostoOficial) bloqueanOficial += 1;
  }

  return {
    total: filas.length,
    iguales,
    diferenciasNumericas,       // DEBE ser 0 para que el cutover no cambie números HOY
    bloqueanOficial,            // cuántos quedarían como costo NO oficial (gate de procedencia)
    porCausa,
    filas,
    // WORDING EXACTO (ChatGPT P1): esto SÓLO demuestra que el bridge actual no
    // cambia `insumo.precio` hoy. NO prueba el cutover con la serie histórica real
    // (que aún no se ingiere), y 93/259 bloquearían costo oficial por procedencia.
    sinDiferenciaNumericaActual: diferenciasNumericas === 0,
  };
}
