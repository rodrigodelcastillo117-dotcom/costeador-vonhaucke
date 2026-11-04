// ============================================================================
//  DESGLOSE "REAL vs SUPUESTO" DEL MATERIAL (lever A).
//  Para que el costo deje de "sentirse irreal": parte el costo de MATERIAL del mueble en
//  lo que tiene precio real certificado vs lo que es supuesto, y dice QUÉ piezas lo arrastran.
//  Hoy una sola pieza vieja o por confirmar pinta todo el mueble de "preliminar"; aquí se ve
//  que el 95% es real y sólo 1-2 piezas lo bajan.
//
//  Clasificación por pieza (sólo MATERIAL; mano de obra e indirectos son aparte):
//   · 'real'         → material confirmado por humano (o exacto) Y precio certificado (evidencia.certificable).
//   · 'por_confirmar'→ material propuesto por la IA/ERP/memoria sin que un humano lo confirme, o pieza que la IA
//                       infirió sin verla y nadie confirmó que exista.
//   · 'precio_viejo' → el material está bien, pero su precio no está certificado (viejo / por actualizar).
//   · 'pendiente'    → la pieza no tiene material con precio usable → aporta $0 (hay que elegirle material).
//
//  Determinista, sin red. `montoDe(c, ins)` lo inyecta cada pantalla (calculan el costo por pieza distinto).
// ============================================================================
import { precioUsable } from '../motor/calculo.js';
import { MATCH } from './materialMatch.js';

const SUPUESTO = new Set(['por_confirmar', 'precio_viejo']);

/** @returns {{clase:'real'|'por_confirmar'|'precio_viejo'|'pendiente', motivo:string}} */
export function realidadPieza(c = {}, insumos = {}) {
  const ins = c.insumoId ? insumos[c.insumoId] : null;
  if (!ins || !precioUsable(ins)) return { clase: 'pendiente', motivo: 'sin material con precio' };
  const mt = c._match || {};
  const confirmado = c.material_confirmado === true || mt.confirmado_por_usuario === true;
  const propuesto = !confirmado && (mt.autollenado === true || mt.clase === MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
  if (propuesto) return { clase: 'por_confirmar', motivo: 'material propuesto sin confirmar' };
  const inferidaSinConfirmar = (c.procedencia === 'INFERIDO' || c.procedencia === 'SUPUESTO') && c.pieza_confirmada !== true;
  if (inferidaSinConfirmar) return { clase: 'por_confirmar', motivo: 'pieza inferida por la IA sin confirmar que existe' };
  const ev = ins.evidencia || null;
  const certificable = ev && typeof ev.certificable === 'boolean' ? ev.certificable : null;
  if (certificable === false) return { clase: 'precio_viejo', motivo: 'precio sin certificar (por actualizar)' };
  // certificable true, o sin dato de certificación (rol sin evidencia): con material confirmado se cuenta como real.
  return { clase: 'real', motivo: '' };
}

/**
 * @param {Array} componentes  BOM del mueble
 * @param {Object} insumos     mapa de insumos (con .evidencia.certificable cuando el rol lo recibe)
 * @param {(c:object, ins:object)=>number} montoDe  costo de material de la pieza
 * @returns {{realMonto:number, supuestoMonto:number, totalConocido:number, pendientes:number,
 *   piezasReales:number, piezasSupuesto:number, items:Array<{nombre:string, monto:number, clase:string, motivo:string}>,
 *   haySupuesto:boolean, hayPendiente:boolean, pctReal:(number|null)}}
 */
export function desgloseRealidad(componentes = [], insumos = {}, montoDe = () => 0) {
  let realMonto = 0, supuestoMonto = 0, pendientes = 0, piezasReales = 0, piezasSupuesto = 0;
  const items = [];
  for (const c of (Array.isArray(componentes) ? componentes : [])) {
    if (!c || c.excluida) continue;
    const { clase, motivo } = realidadPieza(c, insumos);
    const nombre = c.nombre || c.material_solicitado || '(pieza)';
    const materialTexto = c.material_solicitado || c.nombre || '';
    // `solicitable`: precio viejo o pieza sin precio → se le puede pedir precio a Compras (lever B).
    if (clase === 'pendiente') {
      pendientes += 1;
      items.push({ nombre, monto: 0, clase, motivo, insumoId: c.insumoId || null, materialTexto, solicitable: true });
      continue;
    }
    const ins = insumos[c.insumoId];
    let monto = Number(montoDe(c, ins));
    if (!Number.isFinite(monto) || monto < 0) monto = 0;
    if (clase === 'real') { realMonto += monto; piezasReales += 1; }
    else { supuestoMonto += monto; piezasSupuesto += 1; items.push({ nombre, monto, clase, motivo, insumoId: c.insumoId || null, materialTexto, solicitable: clase === 'precio_viejo' }); }
  }
  const totalConocido = realMonto + supuestoMonto;
  const pctReal = totalConocido > 0 ? Math.round((realMonto / totalConocido) * 100) : null;
  return {
    realMonto, supuestoMonto, totalConocido, pendientes, piezasReales, piezasSupuesto,
    items, haySupuesto: supuestoMonto > 0 || piezasSupuesto > 0, hayPendiente: pendientes > 0, pctReal,
  };
}

export const esSupuesto = (clase) => SUPUESTO.has(clase);
