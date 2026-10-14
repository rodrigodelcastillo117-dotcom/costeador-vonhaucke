// ============================================================================
//  TOPES DE ESTADO POR POLÍTICAS SIN RATIFICAR (auditoría 14-oct, posible P1 de D2).
//  El servidor podía devolver `certificado` con tubular cobrado por FRACCIÓN de tramo (D2), y ese estado viajaba tal
//  cual al renglón de Cotizar (`costoEstado`) y al expediente (`estado_costo`); la emisión sólo frena preliminar /
//  incompleto / bloqueado. D2 la firmó Dirección pero Producción no ha ratificado la merma de corte: mientras tanto,
//  ningún costo que use D2 puede salir `certificado` del servidor. Una sola bandera, la misma para pantalla y servidor.
// ============================================================================
import { esTubularD2 } from '../motor/calculo.js';

/**
 * RATIFICADA el 14-oct-2026 por Rodrigo del Castillo (Dirección), por escrito en la sesión de trabajo: "mi autorización de
 * la merma sustituye la ratificación de producción". Merma D2 = 6.94 % (calculo.js · MERMA_TUBULAR_D2). Registro en
 * docs/auditoria/DECISIONES_DIRECCION_COSTEAR_20261013.md. Volver a false reactiva el tope (el mecanismo sigue probado).
 */
export const D2_RATIFICADA_POR_PRODUCCION = true;

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
