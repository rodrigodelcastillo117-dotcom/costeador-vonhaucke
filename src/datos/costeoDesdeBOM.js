// ============================================================================
//  COSTEAR UN MUEBLE DESDE SU BOM — por el MOTOR REAL (costoFabricacionVH).
//  Define el CONTRATO de "costo OFICIAL". Un costo es oficial SOLO si es trazable
//  de extremo a extremo Y aprobado por el servidor; cualquier duda => NO oficial.
//
//  CONTRATO (auditorias cd972a1 y 01c456c):
//   · P1-A  ESTIMADO ≠ OFICIAL. Una sola linea estimada vuelve el costeo ESTIMADO
//           y oficial=false, aunque nada este bloqueado.
//   · P1-B  BOM VACIO ≠ OFICIAL. Sin lineas costeables no hay costo oficial (bloquea).
//   · P1-C  TRAZABILIDAD. Un importe suelto del cliente, o una clasificacion escrita
//           como texto, NO bastan. Oficial exige por linea: insumoId, precio UNITARIO
//           exacto, unidad, cantidad real, procedencia; y a nivel costeo: politica VH
//           y aprobacionServidor===true. Faltando cualquiera -> ESTIMADO, no oficial.
//   · P2-D  IDENTIDAD Y CANTIDAD. Duplicado se juzga por IDENTIDAD ESTABLE (id/instanceId),
//           nunca por nombre+dimensiones (dos piezas legitimas pueden compartirlos).
//           Una cantidad AUSENTE nunca se vuelve 1 para certificar.
//   · TERCEROS fail-closed (bloqueo 1): un subcontratado (cristal/vidrio/acrilico/
//           termoformado/corte laser/galvanizado) que quedaria FABRICADO x1.80 sin
//           clasificar BLOQUEA; Ingenieria/Compras declara compra_venta|fabricado.
// ============================================================================
import { costoFabricacionVH, esCompraVenta, CV_SECCIONES, POLITICA_VH } from '../motor/calculo.js';

const n = (x) => { const v = Number(x); return Number.isFinite(v) ? v : null; };
const txt = (x) => String(x == null ? '' : x).trim();
const TERCERO_RE = /cristal|templad|vidrio|acril|termoform|corte\s*laser|galvaniz/i;
const CLASIF_VALIDAS = new Set(['fabricado', 'compra_venta']);

// Identidad ESTABLE de una linea (P2-D): id o instanceId explicitos. NUNCA nombre+dims.
const identidadEstable = (l) => (l.id != null ? `id:${l.id}` : (l.instanceId != null ? `inst:${l.instanceId}` : null));

// Trazabilidad end-to-end de UNA linea para costo oficial (P1-C). Devuelve lo que FALTA.
function faltaTrazabilidad(l) {
  const faltan = [];
  if (!txt(l.insumoId)) faltan.push('insumoId');
  if (!(n(l.precio) > 0)) faltan.push('precio_unitario');   // precio exacto, no un importe agregado
  if (!(n(l.cantidad) > 0)) faltan.push('cantidad');        // ausente NO se vuelve 1 (P2-D)
  if (!txt(l.unidad)) faltan.push('unidad');
  if (!txt(l.procedencia)) faltan.push('procedencia');
  return faltan;
}

// HUELLA (ligadura) del candidato: ata un veredicto del servidor a ESTE BOM + precios + politica
// EXACTOS. No es la firma criptografica (esa la emite el servidor); es el contrato de ligadura.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
function huellaCandidato(detalle, politica) {
  const canon = detalle.map((d) => `${d.insumoId || d.nombre}|${d.cantidad}|${d.costo_extendido}|${d.tipo}`).sort().join(';');
  return fnv1a(canon + '|' + JSON.stringify(politica || {}));
}

/**
 * Costea un BOM por el motor, fail-closed. El costeo CLIENTE nunca es oficial por si mismo:
 * la certificacion es SERVER-ONLY (autoridadCosteoServidor en la Edge costear-servidor).
 * @param {Array} lineas  [{ id?|instanceId?, insumoId?, nombre?, cantidad?, precio?, costo?,
 *   unidad?, procedencia?, seccion, clasificacion?, estimado? }]
 * @param {{politica?:object, veredictoServidor?:object}} opts
 *   veredictoServidor: el RESULTADO verificable del servidor (estadoBaseServidor +
 *   aprobacionPrecioExacto): { estado:'certificado', aprobacionHumana:true }. Un booleano
 *   enviado desde JS NO es autorizacion valida (P2 auditoria 16307614): se ignora.
 */
export function costearBOM(lineas = [], { politica = POLITICA_VH, veredictoServidor = null } = {}) {
  const detalle = []; const faltantes = []; const bloqueos = []; const vistos = new Map();
  const entrada = Array.isArray(lineas) ? lineas : [];

  for (const l0 of entrada) {
    const l = l0 || {};
    const nombre = txt(l.nombre) || txt(l.insumoId) || '(sin nombre)';
    const seccion = txt(l.seccion).toLowerCase();
    const cantidad = n(l.cantidad);                     // NO se defaultea a 1 (P2-D)
    const precioUnit = n(l.precio);
    const costoDirecto = n(l.costo);

    // costo_extendido: precio*cantidad verificable; un costo suelto sirve pero marca ESTIMADO (P1-C).
    let costo_unitario = null, costo_extendido = null, soloImporte = false;
    if (precioUnit != null && cantidad != null && cantidad > 0) {
      costo_unitario = precioUnit; costo_extendido = precioUnit * cantidad;
    } else if (costoDirecto != null && costoDirecto > 0) {
      costo_extendido = costoDirecto; costo_unitario = (cantidad > 0) ? costoDirecto / cantidad : null; soloImporte = true;
    }
    if (!(costo_extendido > 0)) { faltantes.push({ nombre, seccion, motivo: 'sin precio/costo usable' }); continue; }

    // Clasificacion economica (regla del motor o declaracion de Ingenieria/Compras).
    const declarada = txt(l.clasificacion).toLowerCase();
    const tipo = CLASIF_VALIDAS.has(declarada) ? declarada : (esCompraVenta(seccion) ? 'compra_venta' : 'fabricado');
    const pareceTercero = TERCERO_RE.test(nombre) || TERCERO_RE.test(seccion);
    const terceroAmbiguo = pareceTercero && tipo === 'fabricado' && !CLASIF_VALIDAS.has(declarada);
    if (terceroAmbiguo) bloqueos.push({ nombre, seccion, motivo: 'tercero sin clasificar: Ingenieria/Compras declara compra_venta (x1.06) o fabricado (x1.80). Sin eso el costo no es oficial.' });

    // Duplicado por IDENTIDAD ESTABLE (P2-D), nunca por nombre+dims.
    const idE = identidadEstable(l);
    if (idE) { if (vistos.has(idE)) bloqueos.push({ nombre, motivo: `linea duplicada (misma identidad ${idE})` }); else vistos.set(idE, nombre); }

    const faltan = faltaTrazabilidad(l);
    detalle.push({
      nombre, seccion, insumoId: txt(l.insumoId) || null, cantidad: cantidad != null ? cantidad : null,
      costo_unitario: costo_unitario != null ? +costo_unitario.toFixed(4) : null,
      costo_extendido: +costo_extendido.toFixed(2), unidad: txt(l.unidad) || null, procedencia: txt(l.procedencia) || null,
      tipo, estimado: l.estimado === true || soloImporte, trazable: faltan.length === 0, falta_trazabilidad: faltan,
      clasificacion_declarada: CLASIF_VALIDAS.has(declarada) ? declarada : null, tercero_ambiguo: terceroAmbiguo,
    });
  }

  // P1-B: BOM vacio o sin lineas costeables NUNCA es oficial.
  if (detalle.length === 0) bloqueos.push({ nombre: '(bom)', motivo: 'BOM vacío o sin líneas costeables: no hay costo que certificar' });

  const CV_PROXY = [...CV_SECCIONES][0] || 'graficos';
  const motor = costoFabricacionVH(detalle.map((d) => ({ costo: d.costo_extendido, seccion: d.tipo === 'compra_venta' ? CV_PROXY : 'metal' })), politica);

  const sumaExt = +detalle.reduce((s, d) => s + d.costo_extendido, 0).toFixed(2);
  if (detalle.length && Math.abs(sumaExt - +motor.material.toFixed(2)) > 0.02)
    bloqueos.push({ nombre: '(reconciliacion)', motivo: `suma de lineas ${sumaExt} != material del motor ${motor.material.toFixed(2)}` });

  const hayEstimado = detalle.some((d) => d.estimado);
  const todasTrazables = detalle.length > 0 && detalle.every((d) => d.trazable);
  const bloqueado = faltantes.length > 0 || bloqueos.length > 0;
  const estado = bloqueado ? 'BLOQUEADO' : (hayEstimado ? 'ESTIMADO' : 'COSTEADO');
  // HUELLA de ESTE costeo (BOM + precios + politica). El servidor liga su veredicto a ella.
  const huella = huellaCandidato(detalle, politica);
  // VEREDICTO del servidor (P1-A auditoria e48c0c2): certifica SOLO si viene LIGADO a este costeo
  // exacto (misma huella) Y trae PRUEBA DE ORIGEN del servidor (firma no vacia, emitida por la Edge
  // atada a expediente/version/BOM/precios/politica) Y marca certificado + aprobacion humana.
  // Un objeto fabricado por el cliente ({estado,aprobacionHumana}) NO trae huella ni firma -> no cuenta.
  const vs = (veredictoServidor && typeof veredictoServidor === 'object') ? veredictoServidor : null;
  const ligado = !!(vs && vs.huella === huella);
  const firmado = !!(vs && typeof vs.firma === 'string' && vs.firma.length > 0);
  const servidorCertifico = ligado && firmado && vs.estado === 'certificado' && vs.aprobacionHumana === true;
  // El cliente SIEMPRE emite un CANDIDATO. `oficial` solo es true con veredicto ligado+firmado del servidor.
  const oficial = !bloqueado && !hayEstimado && todasTrazables && servidorCertifico;

  return {
    costo_total: +motor.costoFabricacion.toFixed(2), material: +motor.material.toFixed(2),
    material_fabricado: +motor.materialFabricado.toFixed(2), material_compra_venta: +motor.materialCompraVenta.toFixed(2),
    mano_obra: +motor.manoObra.toFixed(2), gif: +motor.gif.toFixed(2),
    completo: faltantes.length === 0 && detalle.length > 0,
    candidato: true,                 // el cliente nunca se auto-certifica: esto es un calculo candidato
    huella,                          // ligadura: el servidor ata su veredicto firmado a esta huella
    oficial, estado, todasTrazables,
    servidorCertifico, veredicto_ligado: ligado, veredicto_firmado: firmado, politica,
    detalle, faltantes, bloqueos, advertencias: advertenciasTerceros(detalle), cv_secciones: [...CV_SECCIONES],
  };
}

/** Avisos legibles de lineas que el motor cobra como FABRICADO pero parecen tercero. */
export function advertenciasTerceros(detalle = []) {
  const avisos = [];
  for (const d of detalle) {
    const tipo = d.tipo || d.clasificacion_declarada || '';
    if (d.tercero_ambiguo === true || (tipo === 'fabricado' && TERCERO_RE.test(d.nombre || ''))) {
      avisos.push({ nombre: d.nombre, costo: d.costo_extendido ?? d.costo,
        aviso: 'parece tercero subcontratado pero el motor lo cobra como FABRICADO (x1.80). '
             + 'Si se compra terminado, deberia ser compra-venta (x1.06). Decision de Ingenieria/Compras.' });
    }
  }
  return avisos;
}
