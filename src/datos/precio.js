// ============================================================================
//  UNA SOLA FUNCIÓN COSTO → PRECIO (COSTEAR §3, 2026-10-11 · VH-019 / VH-041)
//
//  Antes había siete formas de pasar de costo a precio repartidas por pantalla
//  (precioDe ×2.0, precioVenta·precioDeLista ×2.16, politicaVH ×2.21, HojaCosto
//  ×1.45, Catálogo, costear-servidor con 40 %, Cocrear) y tres márgenes por omisión
//  (50 / 40 / 30). La misma pieza daba precios distintos según dónde se mirara.
//
//  Regla única:
//   - costo null/NaN/∞ (costeo incompleto)      → precio null (nunca $0, nunca inventado)
//   - modelo Intelisis (líneas App LT)           → precio 2 × (1 − 40 %) = precio de lista
//   - modelo clásico (Alba / legacy)             → costo ÷ (1 − margen), margen SOBRE PRECIO
//   - margen por omisión                         → parametros.margenObjetivo, y si no, 50
//  Los NIVELES por volumen de Alba (politicaVH.preciosVH) son otra cosa: política de
//  piso/lista/precio 2 por volumen; no son "el precio de la partida".
// ============================================================================
import { precioDe, precioVenta, PARAMETROS_DEFAULT } from '../motor/calculo.js';
import { precioDeLista } from './preciosVenta.js';

export const MARGEN_OBJETIVO_DEFAULT = 50;

export function margenObjetivoDe(par) {
  const m = Number(par?.margenObjetivo);
  return Number.isFinite(m) ? m : MARGEN_OBJETIVO_DEFAULT;
}

/**
 * @param costo  costo OFICIAL unitario (usa `resultado.costoOficial`, no `costoUnitario`)
 * @returns número > 0, o null cuando no hay precio válido
 */
export function precioDesdeCosto(costo, { par = PARAMETROS_DEFAULT, esIntelisis = false, margen } = {}) {
  if (costo == null || !Number.isFinite(costo) || costo < 0) return null;
  let p;
  if (esIntelisis) p = precioDeLista(precioVenta(costo, par).lista);
  else p = precioDe(costo, margen ?? margenObjetivoDe(par));
  return Number.isFinite(p) && p >= 0 ? p : null;
}

// ============================================================================
//  PRECIO SUGERIDO DE UN MUEBLE CO-CREADO (COCREAR 10, Dirección 2026-10-13)
//  "Co-creación puede ser un mueble nuevo o cambiar medidas de uno de línea; ahí sí sería costear
//   y nosotros poner un precio."
//   - El precio de catálogo de los muebles de LÍNEA no se toca: esto sólo aplica a lo co-creado.
//   - precio = costo ÷ (1 − margen), con el margen de POLÍTICA (margenObjetivo) y nunca por debajo
//     del PISO de margen (margenMinimo, 25 % por omisión): si la política bajara del piso, manda el piso.
//   - costo incompleto (null/NaN/∞/≤0) → precio null = "Por confirmar". Jamás $0 ni inventado.
//  Una sola función: la usan la UI de Cocrear y el servidor (costear-servidor, modo cocrear).
// ============================================================================
export const PISO_MARGEN_DEFAULT = 25;

export function pisoMargenDe(par) {
  const m = Number(par?.margenMinimo);
  return Number.isFinite(m) && m >= 0 && m < 100 ? m : PISO_MARGEN_DEFAULT;
}

/**
 * Costo unitario OFICIAL de una respuesta de costear-servidor, o null si no hay uno usable.
 * Certificación 19-oct (Cocrear paso 9): `Number(null)` es 0 y el panel decía "Costo del servidor: $0.00" con el
 * despiece incompleto. Un costo ausente, no numérico o ≤ 0 NO es un costo: es "incompleto".
 */
export function costoOficialServidor(servidor) {
  const cu = servidor?.costo?.costoUnitario;
  if (cu == null || cu === '') return null;
  const n = Number(cu);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * @param costo  costo OFICIAL unitario (el del servidor cuando se registra o se emite)
 * @returns {{precio:number|null, margen:number|null, piso:number, motivo:string|null}}
 */
export function precioSugeridoCocreado(costo, { par = PARAMETROS_DEFAULT } = {}) {
  const piso = pisoMargenDe(par);
  const c = Number(costo);
  if (costo == null || !Number.isFinite(c) || c <= 0) {
    return { precio: null, margen: null, piso, motivo: 'Por confirmar: el costo está incompleto (no se inventa precio).' };
  }
  const objetivo = margenObjetivoDe(par);
  const margen = Math.max(objetivo, piso);
  const precio = precioDesdeCosto(c, { par, margen });
  if (precio == null || !(precio > 0)) return { precio: null, margen: null, piso, motivo: 'Por confirmar: el margen de política no es válido.' };
  return { precio, margen, piso, motivo: margen > objetivo ? `El margen de política (${objetivo} %) está bajo el piso: se aplicó el piso de ${piso} %.` : null };
}
