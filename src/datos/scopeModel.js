// ============================================================================
//  SCOPE MODEL — N5 (alcance de un plano de edificio). Capa PURA.
//  Toma las zonas detectadas (plano real, dibujado o por m²/programa) y arma un
//  modelo de ALCANCE: qué se necesita por zona, con qué evidencia y qué tan
//  confiable es. Se enlaza con la reconciliación REQUERIDO vs COTIZADO vs
//  ACOMODADO (reconciliacion.js). No inventa cantidades: lo desconocido queda null.
// ============================================================================
import { reconciliar, resumenReconciliacion } from './reconciliacion.js';

export const ESTADOS_ZONA = Object.freeze({
  CONFIRMADO: 'CONFIRMADO', // evidencia fuerte (plano real / usuario)
  INFERIDO: 'INFERIDO',     // deducido con base razonable
  REVISAR: 'REVISAR',       // dato flojo o faltante
});

export function estadoPorConfianza(confidence) {
  if (confidence >= 0.9) return ESTADOS_ZONA.CONFIRMADO;
  if (confidence >= 0.5) return ESTADOS_ZONA.INFERIDO;
  return ESTADOS_ZONA.REVISAR;
}

function zidDe(z, i) {
  return z.zone_id || z.id || `z${i}_${String(z.nombre || z.name || 'zona').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`;
}

/** Suma de cantidades de los required_items (lo requerido total de la zona). */
export function requeridoDeZona(zona) {
  const items = zona.required_items || zona.requeridos || [];
  if (!items.length && zona.requerido != null) return Number(zona.requerido) || 0;
  return items.reduce((s, it) => s + (Number(it.cantidad) || 0), 0);
}

/**
 * Normaliza una zona cruda a una zona de ScopeModel.
 * Entrada flexible: { nombre|name, tipo|type, required_items|requeridos, evidence,
 *                     confidence|confianza, status }
 */
export function zonaScope(z, i = 0) {
  const confidence = z.confidence != null ? z.confidence : (z.confianza != null ? z.confianza : 0.6);
  const required_items = z.required_items || z.requeridos || [];
  return {
    zone_id: zidDe(z, i),
    name: z.name || z.nombre || `Zona ${i + 1}`,
    type: z.type || z.tipo || 'general',
    required_items,
    requerido: requeridoDeZona({ required_items, requerido: z.requerido }),
    evidence: z.evidence || z.evidencia || [],
    confidence,
    status: z.status || estadoPorConfianza(confidence),
    m2: z.m2 ?? null,
  };
}

/** Construye el ScopeModel a partir de una lista de zonas crudas. */
export function construirScope(zonas) {
  const zs = (zonas || []).map((z, i) => zonaScope(z, i));
  const porEstado = {
    CONFIRMADO: zs.filter((z) => z.status === ESTADOS_ZONA.CONFIRMADO).length,
    INFERIDO: zs.filter((z) => z.status === ESTADOS_ZONA.INFERIDO).length,
    REVISAR: zs.filter((z) => z.status === ESTADOS_ZONA.REVISAR).length,
  };
  return {
    zonas: zs,
    totalZonas: zs.length,
    totalRequerido: zs.reduce((s, z) => s + (z.requerido || 0), 0),
    porEstado,
    requiereRevision: porEstado.REVISAR > 0,
  };
}

/**
 * Enlaza el ScopeModel con lo COTIZADO y lo ACOMODADO para la reconciliación.
 * @param {object} scope  resultado de construirScope
 * @param {object} [datos] { cotizadoPorZona:{zone_id|name:n}, acomodadoPorZona:{...} }
 * @returns resumenReconciliacion (zonas con estado ok/falta/sobra/revisar)
 */
export function reconciliarScope(scope, datos = {}) {
  const cot = datos.cotizadoPorZona || {};
  const aco = datos.acomodadoPorZona || {};
  const zonas = (scope?.zonas || []).map((z) => ({
    nombre: z.name,
    requerido: z.requerido,
    cotizado: cot[z.zone_id] ?? cot[z.name] ?? null,
    acomodado: aco[z.zone_id] ?? aco[z.name] ?? null,
  }));
  return resumenReconciliacion(zonas);
}

// Re-export por conveniencia para la UI.
export { reconciliar, resumenReconciliacion };
