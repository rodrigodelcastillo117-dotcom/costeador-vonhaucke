// ============================================================================
//  VH-167 (2026-10-13, librero 5×8 de la Operación 10/10). Al cambiar el material de una pieza, el
//  cliente borraba largo×ancho si el insumo "no era de área" (sin formato de tablero y sin m²). Un
//  tablero ERP vendido por HOJA sin formato (los 21 de 5×8 en producción) caía ahí: la pieza perdía su
//  medida en silencio, el motor la cobraba como "1 hoja" por pieza y el bloqueo P0-02 ("hoja sin formato:
//  no se convierte m²") dejaba de aplicar. La geometría es un dato del plano, no del material.
//
//  Regla: un material por HOJA (o con formato, o por m²) conserva la medida — si no se puede convertir,
//  el motor lo deja PENDIENTE con su motivo. Sólo un material por pieza/juego/metro/kg/tramo deja la
//  medida fuera del consumo, y la medida se GUARDA en `medidaPrevia` para restaurarla si se vuelve a
//  un material de área. Nunca se pierde.
// ============================================================================
import { unidadNormalizada } from '../motor/calculo.js';

const conMedida = (c) => Number(c?.largoMM) > 0 && Number(c?.anchoMM) > 0;

/** ¿El insumo se consume por superficie (tablero, hoja, m²)? */
export function consumePorSuperficie(ins) {
  if (!ins) return false;
  const u = unidadNormalizada(ins.unidad);
  return ins.formato?.tipo === 'tablero' || u === 'm2' || u === 'm²' || u === 'hoja' || !!(ins.formato && Number(ins.formato.medida) > 0);
}

/**
 * Parche de medidas al asignar `ins` a la pieza `prev`. No muta.
 * @returns {{largoMM?:number|undefined, anchoMM?:number|undefined, medidaPrevia?:object|undefined}}
 */
export function patchMedidas(prev = {}, ins = null) {
  if (!ins) return {};
  if (consumePorSuperficie(ins)) {
    if (conMedida(prev)) return {};
    const m = prev.medidaPrevia;
    return m && Number(m.largoMM) > 0 && Number(m.anchoMM) > 0 ? { largoMM: m.largoMM, anchoMM: m.anchoMM, medidaPrevia: undefined } : {};
  }
  if (!conMedida(prev)) return { largoMM: undefined, anchoMM: undefined };
  return { largoMM: undefined, anchoMM: undefined, medidaPrevia: { largoMM: prev.largoMM, anchoMM: prev.anchoMM } };
}
