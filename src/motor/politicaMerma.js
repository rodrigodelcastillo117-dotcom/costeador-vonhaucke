// ============================================================================
//  POLÍTICA DE MERMA DE PRODUCCIÓN (A14 · VH-077) — reglas de taller de Rogelio
//  (doc "comentarios Rogelio y Alba", Drive), adoptadas como FÓRMULA OFICIAL el
//  2026-10-12 con aprobación de Dirección ("hazlo todo").
//
//  Lo que Producción dijo, literal:
//   · Tablero: pieza > 1.50 × 0.60 m = ½ hoja; si excede 0.60 de ancho × 1.50 = 1 hoja.
//   · Pintura en polvo: 8 m²/kg en superficie plana (el tubular rinde MENOS; no dieron cifra).
//   · Cubrecanto: excedente por lado (no dieron cuánto).
//   · Perfiles tubulares: tramos de 6 m.           → ya era política (formato TRAMO6, tramo entero).
//   · Lámina: anchos 0.91 y 1.22 m.                 → ya era política (formatos 3x10 y 4x8).
//
//  Qué codifica este módulo y qué NO:
//   · SÍ: el piso de ½ / 1 hoja por pieza grande (sustituye a la rejilla SÓLO cuando la
//     regla aplica; piezas ≤ 1.50 × 0.60 siguen con la fracción real de la rejilla, que es lo
//     que reproduce los T.D.C. de Alba al centavo).
//   · SÍ: kg de pintura a partir del área plana (8 m²/kg).
//   · SÍ (desde 2026-10-12, Dirección: "es 8"): rendimiento de pintura en TUBULAR = 8 m²/kg,
//     igual que en plano. Antes era null (pendiente) por falta de cifra.
//   · NO: excedente de canto por lado (sin cifra → sigue mermaCorte del insumo).
// ============================================================================

export const REGLAS_MERMA_PRODUCCION = Object.freeze({
  version: 'produccion-rogelio-2026-10',
  tablero: Object.freeze({ largoMM: 1500, anchoMM: 600 }),
  pinturaPlanaM2PorKg: 8,
  // Producción dijo "rinde menos" sin cifra; Dirección fijó el número el 12-oct-2026 ("es 8").
  pinturaTubularM2PorKg: 8,
  tramoM: 6,
  laminaAnchosMM: Object.freeze([914, 1220]),
});

/**
 * Hojas de tablero que Producción cobra por UNA pieza grande, o null si la regla no
 * aplica (pieza chica → rejilla / fracción real).
 *  · lado mayor > 1.50 m y lado menor ≤ 0.60 m  → 0.5 hoja
 *  · lado mayor > 1.50 m y lado menor > 0.60 m  → 1 hoja
 *  · lado mayor ≤ 1.50 m                        → null (sin regla)
 * La orientación no importa (la pieza se gira en el tablero).
 */
export function hojasPorPiezaProduccion(largoMM, anchoMM, reglas = REGLAS_MERMA_PRODUCCION.tablero) {
  const a = Number(largoMM), b = Number(anchoMM);
  if (!(a > 0) || !(b > 0)) return null;
  const mayor = Math.max(a, b), menor = Math.min(a, b);
  if (mayor <= reglas.largoMM) return null;
  return menor <= reglas.anchoMM ? 0.5 : 1;
}

/** ¿El insumo es pintura en polvo (se compra por kg)? */
export function esPinturaPolvo(insumo) {
  if (!insumo) return false;
  const id = String(insumo.id || '');
  return insumo.unidad === 'kg' && (id === 'pintura-polvo' || id.startsWith('pintura-polvo-') || id === 'pintura-electrostatica-kg');
}

/**
 * kg de pintura en polvo para un área (m²). Plana: área / 8. Tubular: área / 8 (Dirección,
 * 12-oct-2026). Si alguna vez vuelve a null, el motor deja el componente PENDIENTE, no inventa.
 */
export function kgPinturaPorArea(areaM2, { tubular = false } = {}) {
  const a = Number(areaM2);
  if (!(a > 0)) return null;
  const rend = tubular ? REGLAS_MERMA_PRODUCCION.pinturaTubularM2PorKg : REGLAS_MERMA_PRODUCCION.pinturaPlanaM2PorKg;
  if (!(rend > 0)) return null;
  return a / rend;
}
