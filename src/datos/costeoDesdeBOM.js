// ============================================================================
//  COSTEAR UN MUEBLE DESDE SU BOM — por el MOTOR REAL (no por scripts ad-hoc).
//  Reusa costoFabricacionVH (POLITICA_VH) con la clasificacion de seccion del
//  motor (esCompraVenta).
//
//  FAIL-CLOSED en DOS frentes (auditoria cd972a1, bloqueos 1 y 2):
//   1) PRECIO FALTANTE: una linea sin precio NO se pone en $0; se reporta en
//      `faltantes` y el costeo queda BLOQUEADO (oficial=false).
//   2) TERCERO AMBIGUO: un insumo que PARECE tercero subcontratado (cristal,
//      vidrio, acrilico, termoformado, corte laser, galvanizado) pero que el
//      motor cobraria como FABRICADO x1.80 NO se cobra en silencio: bloquea el
//      costo oficial hasta que Ingenieria/Compras declare su clasificacion
//      (`clasificacion: 'fabricado'|'compra_venta'`). No basta una advertencia.
//      No se INVENTA la clasificacion (eso es verdad economica de Direccion);
//      se exige o se bloquea.
//
//  Cada linea se formaliza con cantidad, costo_unitario y costo_extendido
//  EXPLICITOS (bloqueo 2): sin duplicacion, sin omision y sin aplicacion
//  silenciosa de importes. La suma de costo_extendido reconcilia con `material`.
// ============================================================================
import { costoFabricacionVH, esCompraVenta, CV_SECCIONES, POLITICA_VH } from '../motor/calculo.js';

const n = (x) => { const v = Number(x); return Number.isFinite(v) ? v : null; };

// Secciones/materiales que suelen ser TERCEROS subcontratados (no fabricacion propia).
const TERCERO_RE = /cristal|templad|vidrio|acril|termoform|corte\s*laser|galvaniz/i;
// Clasificaciones que Ingenieria/Compras puede declarar explicitamente por linea.
const CLASIF_VALIDAS = new Set(['fabricado', 'compra_venta']);

const claveLinea = (l, seccion) =>
  `${String(l.nombre || '').toLowerCase().trim()}|${seccion}|${n(l.largoMM) ?? ''}x${n(l.anchoMM) ?? ''}`;

/**
 * Costea un BOM por el motor, fail-closed.
 * @param {Array} lineas  [{ nombre, cantidad, precio?|costo?, seccion, estimado?, clasificacion? }]
 *   - costo = costo YA extendido (cant*unit) de esa linea; si no, precio*cantidad.
 *   - seccion: clasifica fab vs compra-venta (la del motor).
 *   - clasificacion: 'fabricado'|'compra_venta' declarada por Ingenieria/Compras
 *     (resuelve la ambiguedad de terceros). Si falta y la linea parece tercero
 *     cobrado como fabricado, el costeo se BLOQUEA.
 *   - estimado:true marca consumo supuesto (lamina por area, sin despiece).
 * @returns costeo con material/MO/GIF/total + detalle formalizado + faltantes +
 *   bloqueos + oficial(boolean).
 */
export function costearBOM(lineas = [], { politica = POLITICA_VH } = {}) {
  const detalle = []; const faltantes = []; const bloqueos = []; const vistos = new Map();
  const entrada = Array.isArray(lineas) ? lineas : [];

  for (const l of entrada) {
    const nombre = l.nombre || '(sin nombre)';
    const seccion = String(l.seccion || '').toLowerCase().trim();

    // ---- precio / cantidad / extendido EXPLICITOS (bloqueo 2) ----
    const cantidad = n(l.cantidad) != null ? n(l.cantidad) : 1;
    const costoDirecto = n(l.costo);                 // costo YA extendido
    const precioUnit = n(l.precio);                  // precio unitario
    let costo_unitario, costo_extendido;
    if (costoDirecto != null) {                      // viene extendido -> derivar unitario
      costo_extendido = costoDirecto;
      costo_unitario = cantidad > 0 ? costoDirecto / cantidad : null;
    } else if (precioUnit != null) {                 // viene unitario -> extender
      costo_unitario = precioUnit;
      costo_extendido = precioUnit * cantidad;
    } else { costo_unitario = null; costo_extendido = null; }

    // Omision: una linea sin importe usable NO se descarta en silencio.
    if (!(costo_extendido > 0)) { faltantes.push({ nombre, seccion, cantidad, motivo: 'sin precio/costo usable' }); continue; }

    // ---- clasificacion economica (bloqueo 1) ----
    const declarada = String(l.clasificacion || '').toLowerCase().trim();
    let tipo;
    if (CLASIF_VALIDAS.has(declarada)) tipo = declarada;     // Ingenieria/Compras manda
    else tipo = esCompraVenta(seccion) ? 'compra_venta' : 'fabricado';   // regla del motor

    const pareceTercero = TERCERO_RE.test(nombre) || TERCERO_RE.test(seccion);
    const terceroAmbiguo = pareceTercero && tipo === 'fabricado' && !CLASIF_VALIDAS.has(declarada);
    if (terceroAmbiguo) {
      bloqueos.push({ nombre, seccion, costo_extendido: +costo_extendido.toFixed(2),
        motivo: 'parece tercero subcontratado; el motor lo cobraria como FABRICADO (x1.80). '
              + 'Ingenieria/Compras debe declarar clasificacion: "compra_venta" (si se compra terminado, x1.06) '
              + 'o "fabricado" (si se hace en casa). Sin esa decision el costo NO es oficial.' });
    }

    // Duplicacion: misma linea (nombre+seccion+dims) dos veces -> se marca, no se suma dos veces en silencio.
    const k = claveLinea(l, seccion);
    if (vistos.has(k)) {
      bloqueos.push({ nombre, seccion, motivo: `linea duplicada (ya aparece como "${vistos.get(k)}"): revisar doble conteo` });
    } else { vistos.set(k, nombre); }

    detalle.push({ nombre, seccion, cantidad,
      costo_unitario: costo_unitario != null ? +costo_unitario.toFixed(4) : null,
      costo_extendido: +costo_extendido.toFixed(2),
      tipo, estimado: l.estimado === true,
      clasificacion_declarada: CLASIF_VALIDAS.has(declarada) ? declarada : null,
      tercero_ambiguo: terceroAmbiguo });
  }

  // El motor clasifica SOLO por seccion (esCompraVenta). Para que el `tipo` resuelto
  // (incluida la clasificacion declarada por Ingenieria) fluya al motor, se mapea a una
  // seccion-proxy: compra_venta -> una seccion CV real (x1.06); fabricado -> no-CV (x1.80).
  const CV_PROXY = [...CV_SECCIONES][0] || 'graficos';
  const motor = costoFabricacionVH(
    detalle.map((d) => ({ costo: d.costo_extendido,
      seccion: d.tipo === 'compra_venta' ? CV_PROXY : 'metal' })), politica);

  // Reconciliacion (bloqueo 2): la suma de extendidos == material del motor (sin importes fantasma).
  const sumaExtendidos = +detalle.reduce((s, d) => s + d.costo_extendido, 0).toFixed(2);
  const descuadre = Math.abs(sumaExtendidos - +motor.material.toFixed(2)) > 0.02;
  if (descuadre) bloqueos.push({ nombre: '(reconciliacion)', motivo: `suma de lineas ${sumaExtendidos} != material del motor ${motor.material.toFixed(2)}` });

  const hayEstimado = detalle.some((d) => d.estimado);
  const bloqueado = faltantes.length > 0 || bloqueos.length > 0;
  const estado = bloqueado ? 'BLOQUEADO' : (hayEstimado ? 'ESTIMADO' : 'COSTEADO');

  return {
    costo_total: +motor.costoFabricacion.toFixed(2),
    material: +motor.material.toFixed(2),
    material_fabricado: +motor.materialFabricado.toFixed(2),
    material_compra_venta: +motor.materialCompraVenta.toFixed(2),
    mano_obra: +motor.manoObra.toFixed(2),
    gif: +motor.gif.toFixed(2),
    completo: faltantes.length === 0,
    oficial: !bloqueado,                 // el costo es OFICIAL solo si nada quedo bloqueado
    estado,                              // BLOQUEADO / ESTIMADO / COSTEADO
    detalle, faltantes, bloqueos,
    advertencias: advertenciasTerceros(detalle),   // compat: avisos legibles de terceros
    cv_secciones: [...CV_SECCIONES],     // transparencia del modelo vigente
  };
}

/** Avisos legibles de lineas que el motor cobra como FABRICADO pero parecen tercero. */
export function advertenciasTerceros(detalle = []) {
  const avisos = [];
  for (const d of detalle) {
    const tipo = d.tipo || (d.clasificacion_declarada || '');
    if ((d.tercero_ambiguo === true) || (tipo === 'fabricado' && TERCERO_RE.test(d.nombre || ''))) {
      avisos.push({ nombre: d.nombre, costo: d.costo_extendido ?? d.costo,
        aviso: 'parece tercero subcontratado pero el motor lo cobra como FABRICADO (x1.80). '
             + 'Si se compra terminado, deberia ser compra-venta (x1.06). Decision de Ingenieria/Compras.' });
    }
  }
  return avisos;
}
