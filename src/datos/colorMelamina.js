// ============================================================================
//  APLICAR COLOR — reescribe el insumoId de un componente al color elegido,
//  DESPUES de que cada línea arma su despiece. Es el único punto de contacto
//  entre las 9 líneas y el catálogo de acabados (src/datos/acabados.js): la
//  línea sigue resolviendo su material a un id BASE ('melamina-28', etc.)
//  exactamente como hoy, y esta función lo reescribe si hay color elegido.
//
//  Sin config.color, o si el color no existe para ese id base, el id se queda
//  IGUAL — cero regresión posible en las 9 líneas.
// ============================================================================
import { MAPA_COLOR_POR_BASE } from './acabados.js';

/**
 * @param {{componentes: Array<{insumoId: string}>}} resultado  lo que arma generarX()
 * @param {{color?: string}} config
 * @returns el mismo `resultado`, con los insumoId de melamina/pintura reescritos
 */
export function aplicarColor(resultado, config) {
  const color = config?.color;
  if (!color || !resultado?.componentes) return resultado;
  resultado.componentes = resultado.componentes.map((c) => {
    const porColor = MAPA_COLOR_POR_BASE[c.insumoId];
    const idConColor = porColor && porColor[color];
    return idConColor ? { ...c, insumoId: idConColor } : c;
  });
  // El color REALMENTE aplicado al despiece (el que se está cotizando). La UI lo
  // usa para resaltar el chip correcto: antes resaltaba `colores[0]` aunque el
  // generador cotizara otro color o el material base → mentira visual.
  resultado.colorEfectivo = color;
  return resultado;
}
