// ============================================================================
//  IntelisisPriceProvider (REALITY CUTOVER, v1 · DISEÑO, NO INTEGRADO)
//
//  Intelisis es una FUTURA fuente automática de verdad de precios, NO un
//  requisito para terminar v1. Hoy la app costea con la EVIDENCIA REAL ya
//  cargada de Von Haucke (compras/TDC). Este adapter existe para que, cuando se
//  conecte Intelisis, SÓLO cambie el ORIGEN: Intelisis produce exactamente el
//  mismo contrato de observación de precio que consume el CanonicalPriceResolver,
//  así el motor y el resolver NO se tocan.
//
//  REGLAS:
//   · READ-ONLY. Este módulo NO llama al ERP, NO escribe producción, NO integra.
//   · Normaliza filas autorizadas (vía intelisisAdapter) al contrato canónico de
//     precioProvenance, SIN inventar huecos.
//   · `fetch()` lanza ERP_NO_INTEGRADO hasta que exista una integración real
//     explícitamente autorizada: nadie debe creer que ya hay precios de Intelisis.
// ============================================================================
import { normalizarMaterialIntelisis } from './intelisisAdapter.js';
import { normalizarObservacionPrecio, FUENTE_PRECIO } from './precioProvenance.js';

/**
 * Mapea UNA fila cruda de Intelisis a una observación de precio canónica.
 * Reutiliza el normalizador de material de Intelisis (evidence_status/issues) y
 * la traduce al contrato de precioProvenance. `canonical_insumo_id` debe venir
 * ya resuelto por el mapeo de identidad (clave_erp → canonical_id); este adapter
 * NO hace matching difuso.
 * @param {object} rowIntelisis  fila cruda del ERP
 * @param {(claveErp:string)=>string|null} resolverIdentidad  mapea clave ERP → canonical_id
 */
export function observacionDesdeIntelisis(rowIntelisis = {}, resolverIdentidad = () => null) {
  const mat = normalizarMaterialIntelisis(rowIntelisis);
  const canonical = resolverIdentidad(mat.clave_erp) || null;
  return normalizarObservacionPrecio({
    canonical_insumo_id: canonical,
    precio: mat.precio,
    moneda: mat.moneda,
    unidad_compra: mat.unidad_compra,
    unidad_costeo: mat.unidad_consumo,
    conversion: mat.conversion,
    fuente: FUENTE_PRECIO.INTELISIS,
    source_document: mat.evidencia || `intelisis:${mat.clave_erp}`,
    source_date: mat.vigencia,
    supplier: mat.proveedor,
    evidence: mat.evidencia,
    // Intelisis es autoritativo: si trae vigencia, se trata como vigencia explícita.
    validity: mat.vigencia,
  });
}

/**
 * Provider con la MISMA interfaz que tendrá cualquier origen de precios
 * (p.ej. uno respaldado por las observaciones reales de VH). Diseño del seam:
 *   provider.id                      → identificador del origen
 *   provider.estaIntegrado()         → false hasta integración autorizada
 *   provider.observaciones(filas, id)→ observaciones canónicas (sin red)
 *   provider.fetch()                 → LANZA hasta integrar (no finge datos)
 */
export const IntelisisPriceProvider = Object.freeze({
  id: 'INTELISIS',
  fuente: FUENTE_PRECIO.INTELISIS,
  integrado: false,
  estaIntegrado() { return false; },
  observaciones(filas = [], resolverIdentidad = () => null) {
    return (Array.isArray(filas) ? filas : []).map((r) => observacionDesdeIntelisis(r, resolverIdentidad));
  },
  async fetch() {
    throw new Error('ERP_NO_INTEGRADO: Intelisis es un adapter de diseño; no hay integración autorizada. La app costea con la evidencia real ya cargada de Von Haucke.');
  },
});
