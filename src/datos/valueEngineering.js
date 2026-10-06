// ============================================================================
//  N13 — VALUE ENGINEERING (selección/priorización pura).
//  La IA NO hace aritmética de dinero: cada opción trae su `delta` YA calculado
//  por el servidor (cotizar-servidor recalcula el cambio real). Este motor sólo
//  PRIORIZA (sustitución > configuración > acabado > opcional > descuento) y
//  selecciona el conjunto mínimo que mete la propuesta en presupuesto. El
//  descuento va SIEMPRE al final (primero ingeniería de valor, luego descuento).
// ============================================================================
import { aCentavosEnteros, deCentavosEnteros } from '../motor/dinero.js';

export const PRIORIDAD_VE = ['sustitucion', 'configuracion', 'acabado', 'opcional', 'descuento'];
const prioIdx = (o) => { const i = PRIORIDAD_VE.indexOf(o.tipo); return i === -1 ? PRIORIDAD_VE.length : i; };

/**
 * planValueEngineering(presupuesto, totalActual, opciones)
 *   opciones: [{ id, tipo, descripcion, delta }]  (delta < 0 = ahorro; viene del servidor)
 * Devuelve el plan: cuánto falta bajar, qué opciones seleccionar (en orden) y si alcanza.
 */
export function planValueEngineering(presupuesto, totalActual, opciones) {
  const presupuestoC = presupuesto == null ? null : aCentavosEnteros(presupuesto);
  const totalC = totalActual == null ? null : aCentavosEnteros(totalActual);

  // UNKNOWN nunca se convierte en ZERO. Sin ambos importes no existe comparación
  // económica legítima y por lo tanto tampoco existe "falta por bajar".
  if (presupuestoC == null || totalC == null) {
    return {
      estado: 'NO_EVALUABLE',
      faltaBajar: null,
      yaEnPresupuesto: null,
      seleccionadas: [],
      ahorroTotal: null,
      nuevoTotal: totalC == null ? null : deCentavosEnteros(totalC),
      alcanza: null,
      usaDescuento: false,
      motivo: presupuestoC == null ? 'PRESUPUESTO_DESCONOCIDO' : 'TOTAL_DESCONOCIDO',
    };
  }

  const faltaBajarC = totalC - presupuestoC; // >0 si está arriba
  const candidatas = (opciones || [])
    .map((o) => ({ ...o, _deltaC: aCentavosEnteros(o?.delta) }))
    .filter((o) => o._deltaC != null && o._deltaC < 0)
    .sort((a, b) => prioIdx(a) - prioIdx(b) || (a._deltaC - b._deltaC));

  const seleccionadas = [];
  let ahorroC = 0;
  if (faltaBajarC > 0) {
    for (const o of candidatas) {
      if (ahorroC >= faltaBajarC) break;
      const { _deltaC, ...publica } = o;
      seleccionadas.push(publica);
      ahorroC += -_deltaC;
    }
  }

  const nuevoTotalC = totalC - ahorroC;
  return {
    estado: 'EVALUADO',
    faltaBajar: deCentavosEnteros(Math.max(0, faltaBajarC)),
    yaEnPresupuesto: faltaBajarC <= 0,
    seleccionadas,
    ahorroTotal: deCentavosEnteros(ahorroC),
    nuevoTotal: deCentavosEnteros(nuevoTotalC),
    alcanza: nuevoTotalC <= presupuestoC,
    usaDescuento: seleccionadas.some((o) => o.tipo === 'descuento'),
  };
}
