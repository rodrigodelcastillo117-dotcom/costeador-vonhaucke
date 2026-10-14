// ============================================================================
//  CONTEXTO ECONÓMICO QUE APP LE PASA A VONI (lógica pura extraída de App.jsx, 2026-10-14). Refactor puro.
//
//  · Voni mira EXACTAMENTE el mismo resultado vivo que el Costeador (calcularCosteoVivo): no existe un
//    "costeo para IA" paralelo.
//  · Sólo quien ve costos (Dirección/Diseño) recibe BOM y costeo; para el vendedor ambos son null y sus
//    partidas viajan recortadas a nombre/cantidad/precio (sin costo ni margen).
//  Probado por comportamiento en voniLiveCosting.test.js.
// ============================================================================
import { calcularCosteoVivo } from '../motor/costeoVivo.js';

/** Costeo vivo para Voni; null si el rol no ve economía, si no hay BOM o si el motor falla. */
export function costeoVivoParaVoni({ veCostos, estado, costeo }, calcularVivo = calcularCosteoVivo) {
  if (!veCostos || !(costeo?.componentes || []).length) return null;
  try {
    return calcularVivo(estado, costeo).resultado;
  } catch (_e) {
    return null;
  }
}

/** Partidas en pantalla, YA recortadas a seller-safe (nunca costo ni margen). */
export function partidasLocalesVoni(partidas) {
  return (partidas || []).map((p) => ({
    nombre: p.nombre,
    cantidad: p.cantidad,
    precioUnitario: p.precioUnitario,
    sinPrecioAutorizado: !(Number(p.precioUnitario) > 0),
  }));
}

/** Fuente económica autorizada: SÓLO veCostos, y sólo el BOM del costeo actual. */
export function economiaVoni({ veCostos, costeo, voniCosting }) {
  return {
    bom: veCostos ? (costeo?.componentes || null) : null,
    costing: veCostos ? voniCosting : null,
  };
}
