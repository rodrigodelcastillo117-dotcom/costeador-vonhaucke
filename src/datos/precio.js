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
