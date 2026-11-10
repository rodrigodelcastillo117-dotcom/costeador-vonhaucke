// ============================================================================
//  COSTEAR UN MUEBLE DESDE SU BOM — por el MOTOR REAL (no por scripts ad-hoc).
//  Reusa costoFabricacionVH (POLITICA_VH) con la clasificacion de seccion del
//  motor (esCompraVenta). Fail-closed: una linea sin precio NO se pone en $0;
//  se reporta en `faltantes` y el costeo queda 'bloqueado'.
//
//  TRANSPARENCIA + hueco de terceros: el motor hoy trata como COMPRA-VENTA solo
//  {graficos, iluminacion}; TODO lo demas (incluido cristal templado, vidrio,
//  acrilico termoformado) lo cobra como FABRICADO x1.80. Para muchos muebles eso
//  SOBREcostea los terceros subcontratados. Este modulo NO cambia esa regla (es
//  verdad economica, decision de Direccion): la EXPONE con `advertenciasTerceros`
//  para que el costeador la vea y decida, en vez de que el numero mienta en silencio.
// ============================================================================
import { costoFabricacionVH, esCompraVenta, CV_SECCIONES, POLITICA_VH } from '../motor/calculo.js';

const n = (x) => { const v = Number(x); return Number.isFinite(v) ? v : null; };

/**
 * Costea un BOM por el motor.
 * @param {Array} lineas  [{ nombre, cantidad, precio?|costo?, seccion, estimado? }]
 *   - costo = costo ya calculado; si no, precio*cantidad.
 *   - seccion: clasifica fab vs compra-venta (la del motor).
 *   - estimado:true marca consumo supuesto (lamina por area, sin despiece).
 * @param {{politica?:object}} opts
 * @returns costeo con material/MO/GIF/total + detalle + faltantes + advertencias.
 */
export function costearBOM(lineas = [], { politica = POLITICA_VH } = {}) {
  const detalle = []; const faltantes = [];
  for (const l of (Array.isArray(lineas) ? lineas : [])) {
    const costoDirecto = n(l.costo);
    const precio = n(l.precio); const cant = n(l.cantidad);
    const costo = costoDirecto != null ? costoDirecto
      : (precio != null && cant != null ? precio * cant : null);
    if (!(costo > 0)) { faltantes.push({ nombre: l.nombre || '(sin nombre)', motivo: 'sin precio/costo usable' }); continue; }
    const seccion = String(l.seccion || '').toLowerCase().trim();
    detalle.push({ nombre: l.nombre || '', seccion, costo: +costo.toFixed(2),
      tipo: esCompraVenta(seccion) ? 'compra_venta' : 'fabricado', estimado: l.estimado === true });
  }
  const motor = costoFabricacionVH(detalle.map((d) => ({ costo: d.costo, seccion: d.seccion })), politica);
  const advertencias = advertenciasTerceros(detalle);
  const hayEstimado = detalle.some((d) => d.estimado);
  return {
    costo_total: +motor.costoFabricacion.toFixed(2),
    material: +motor.material.toFixed(2),
    material_fabricado: +motor.materialFabricado.toFixed(2),
    material_compra_venta: +motor.materialCompraVenta.toFixed(2),
    mano_obra: +motor.manoObra.toFixed(2),
    gif: +motor.gif.toFixed(2),
    completo: faltantes.length === 0,
    estado: faltantes.length > 0 ? 'BLOQUEADO' : (hayEstimado ? 'ESTIMADO' : 'COSTEADO'),
    detalle, faltantes, advertencias,
    cv_secciones: [...CV_SECCIONES],   // transparencia del modelo vigente
  };
}

// Secciones/materiales que suelen ser TERCEROS subcontratados (no fabricacion propia).
const TERCERO_RE = /cristal|templad|vidrio|acril|termoform|corte\s*laser|galvaniz/i;

/** Marca lineas que el motor cobra como FABRICADO (x1.80) pero parecen tercero subcontratado. */
export function advertenciasTerceros(detalle = []) {
  const avisos = [];
  for (const d of detalle) {
    if (d.tipo === 'fabricado' && TERCERO_RE.test(d.nombre || '')) {
      avisos.push({ nombre: d.nombre, costo: d.costo,
        aviso: 'parece tercero subcontratado pero el motor lo cobra como FABRICADO (x1.80). '
             + 'Si se compra terminado, deberia ser compra-venta (x1.06). Decision de Direccion.' });
    }
  }
  return avisos;
}
