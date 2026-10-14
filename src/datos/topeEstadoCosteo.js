// ============================================================================
//  TOPES DE ESTADO POR POLÍTICAS SIN RATIFICAR (auditoría 14-oct, posible P1 de D2).
//  El servidor podía devolver `certificado` con tubular cobrado por FRACCIÓN de tramo (D2), y ese estado viajaba tal
//  cual al renglón de Cotizar (`costoEstado`) y al expediente (`estado_costo`); la emisión sólo frena preliminar /
//  incompleto / bloqueado. D2 la firmó Dirección pero Producción no ha ratificado la merma de corte: mientras tanto,
//  ningún costo que use D2 puede salir `certificado` del servidor. Una sola bandera, la misma para pantalla y servidor.
// ============================================================================
import { esTubularD2 } from '../motor/calculo.js';

/** Cambia a true SÓLO con la ratificación escrita de Producción (y su registro en DECISIONES_DIRECCION_COSTEAR). */
export const D2_RATIFICADA_POR_PRODUCCION = false;

export function piezasConD2(componentes = [], insumos = {}) {
  return (Array.isArray(componentes) ? componentes : [])
    .filter((c) => c && !c.excluida && c.insumoId && esTubularD2(insumos?.[c.insumoId]));
}

/**
 * @param {'certificado'|'preliminar'|'incompleto'|'bloqueado'} estado  estado calculado por el servidor
 * @returns {{ estado: string, warnings: string[] }}  nunca SUBE el estado; sólo lo topa en 'preliminar'
 */
export function topeEstadoPorPoliticas(estado, { componentes = [], insumos = {}, d2Ratificada = D2_RATIFICADA_POR_PRODUCCION } = {}) {
  const warnings = [];
  const d2 = d2Ratificada ? [] : piezasConD2(componentes, insumos);
  if (d2.length && estado === 'certificado') {
    warnings.push(`Tubular por fracción de tramo (D2) sin ratificación de Producción: estado tope 'preliminar' (${d2.slice(0, 3).map((c) => c.nombre).join(', ')}).`);
    return { estado: 'preliminar', warnings };
  }
  return { estado, warnings };
}
