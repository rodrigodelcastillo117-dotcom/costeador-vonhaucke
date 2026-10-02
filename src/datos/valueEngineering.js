// ============================================================================
//  N13 — VALUE ENGINEERING (selección/priorización pura).
//  La IA NO hace aritmética de dinero: cada opción trae su `delta` YA calculado
//  por el servidor (cotizar-servidor recalcula el cambio real). Este motor sólo
//  PRIORIZA (sustitución > configuración > acabado > opcional > descuento) y
//  selecciona el conjunto mínimo que mete la propuesta en presupuesto. El
//  descuento va SIEMPRE al final (primero ingeniería de valor, luego descuento).
// ============================================================================
export const PRIORIDAD_VE = ['sustitucion', 'configuracion', 'acabado', 'opcional', 'descuento'];
const prioIdx = (o) => { const i = PRIORIDAD_VE.indexOf(o.tipo); return i === -1 ? PRIORIDAD_VE.length : i; };

/**
 * planValueEngineering(presupuesto, totalActual, opciones)
 *   opciones: [{ id, tipo, descripcion, delta }]  (delta < 0 = ahorro; viene del servidor)
 * Devuelve el plan: cuánto falta bajar, qué opciones seleccionar (en orden) y si alcanza.
 */
export function planValueEngineering(presupuesto, totalActual, opciones) {
  const faltaBajar = Math.round((Number(totalActual) || 0) - (Number(presupuesto) || 0)); // >0 si está arriba
  const candidatas = (opciones || [])
    .filter((o) => Number(o.delta) < 0)                    // sólo las que ahorran
    .sort((a, b) => prioIdx(a) - prioIdx(b) || (a.delta - b.delta)); // prioridad, luego mayor ahorro

  const seleccionadas = [];
  let ahorro = 0;
  if (faltaBajar > 0) {
    for (const o of candidatas) {
      if (ahorro >= faltaBajar) break;
      seleccionadas.push(o);
      ahorro += -Math.round(Number(o.delta));
    }
  }
  const nuevoTotal = Math.round((Number(totalActual) || 0) - ahorro);
  return {
    faltaBajar,
    yaEnPresupuesto: faltaBajar <= 0,
    seleccionadas,
    ahorroTotal: ahorro,
    nuevoTotal,
    alcanza: nuevoTotal <= (Number(presupuesto) || 0),
    usaDescuento: seleccionadas.some((o) => o.tipo === 'descuento'),
  };
}
