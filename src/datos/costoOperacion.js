// ============================================================================
//  COSTO DE OPERACION (MO) — contrato correcto (directiva Direccion 2026-11-09).
//  --------------------------------------------------------------------------
//  NO se acepta "tarifa.mxn" como costo completo de una operacion. El costo real
//  distingue TIEMPO y TARIFA, con preparacion prorrateada por LOTE y adicionales:
//
//     Costo_op = preparacion_imputada + (tiempo_proceso x tarifa) x piezas + adicionales
//     preparacion_imputada = (tiempo_preparacion x tarifa) / lote     [por pieza]
//
//  Unidades EXPLICITAS en cada parametro. Reparto por 'pieza' o 'lote'. Version y
//  fuente del estandar. REGLA DURA: no se inventan tiempos ni tarifas. El registro
//  de estandares arranca VACIO; Ingenieria/Produccion los importan (cargarEstandar).
//  Sin estandar autorizado -> la operacion queda PENDIENTE (sin numero) y se declara
//  exactamente que dato falta. Esto convive con POLITICA_VH (factores autorizados)
//  como modelo vigente; el routing por tiempos es el objetivo cuando existan datos.
// ============================================================================

/**
 * @typedef {Object} EstandarOperacion
 * @property {string} centro            centro de trabajo (metalmecánica, pintura, ...)
 * @property {string} op                clave de operacion (corte_lamina, doblez, ...)
 * @property {number} tiempo_preparacion_min  min de setup por LOTE (base de reparto)
 * @property {number} tiempo_proceso_min      min por PIEZA de proceso
 * @property {number} tarifa_mxn_min    tarifa autorizada en $/min (convierte $/h ÷ 60 al cargar)
 * @property {number} [costos_adicionales_mxn] consumibles/energia por pieza (opcional)
 * @property {number} lote_piezas       tamano de lote para prorratear la preparacion
 * @property {string} version           version del estandar (trazabilidad)
 * @property {string} fuente            quien lo autorizo
 * @property {boolean} autorizado       true solo si Ingenieria/Direccion lo autorizo
 */

// Registro de estandares autorizados: clave "centro|op" -> EstandarOperacion. VACIO por diseno.
const REGISTRO = new Map();
const clave = (centro, op) => `${String(centro || '').toLowerCase()}|${String(op || '').toLowerCase()}`;

/** Convierte $/h a $/min si viene como tarifa_mxn_hora. Normaliza y valida un estandar. */
export function normalizarEstandar(e = {}) {
  const tarifa_mxn_min = Number.isFinite(Number(e.tarifa_mxn_min)) ? Number(e.tarifa_mxn_min)
    : Number.isFinite(Number(e.tarifa_mxn_hora)) ? Number(e.tarifa_mxn_hora) / 60 : null;
  return {
    centro: e.centro, op: e.op,
    tiempo_preparacion_min: Number.isFinite(Number(e.tiempo_preparacion_min)) ? Number(e.tiempo_preparacion_min) : null,
    tiempo_proceso_min: Number.isFinite(Number(e.tiempo_proceso_min)) ? Number(e.tiempo_proceso_min) : null,
    tarifa_mxn_min,
    costos_adicionales_mxn: Number.isFinite(Number(e.costos_adicionales_mxn)) ? Number(e.costos_adicionales_mxn) : 0,
    lote_piezas: Number(e.lote_piezas) > 0 ? Number(e.lote_piezas) : 1,
    version: e.version ? String(e.version) : null,            // sin default: un estandar sin version NO es aprobado
    fuente: e.fuente || '',
    vigente_desde: e.vigente_desde || null,
    vigente_hasta: e.vigente_hasta || null,
    aprobado_por: e.aprobado_por ? String(e.aprobado_por).toLowerCase() : null,
    aprobado_en: e.aprobado_en || null,
    // Estado de aprobacion ESCRITO POR EL SERVIDOR (como insumo_precios.estado='aprobado').
    // Un aprobador NOMBRADO no basta; debe existir el hecho server-side. Acepta `estado` o `estado_aprobacion`.
    estado_aprobacion: e.estado_aprobacion ? String(e.estado_aprobacion).toLowerCase()
      : e.estado ? String(e.estado).toLowerCase() : null,
  };
}

/** Roles cuya aprobacion de un estandar de MO cuenta como humana (como en precios: solo Direccion). */
export const ROLES_APROBADORES_MO = Object.freeze(['direccion']);
/** Construye un verificador de aprobador a partir de las listas autoritativas (permitidos + cuentas_no_humanas). */
export function autoridadDesdeListas({ permitidos = [], noHumanas = [], roles = ROLES_APROBADORES_MO } = {}) {
  const byEmail = new Map((Array.isArray(permitidos) ? permitidos : []).map((p) => [String(p.email || '').toLowerCase(), String(p.rol || '').toLowerCase()]));
  const nh = new Set((Array.isArray(noHumanas) ? noHumanas : []).map((x) => String(x && x.email ? x.email : x || '').toLowerCase()));
  return (email) => {
    const e = String(email || '').toLowerCase();
    const rol = byEmail.get(e) || null;
    return { ok: !!rol && roles.includes(rol) && !nh.has(e), rol };
  };
}
const AUTORIDAD_CERRADA = () => ({ ok: false, rol: null });

/**
 * Importa un estandar de MO al REGISTRO de REFERENCIA. Fail-closed (auditorias p3 y 36432bb).
 *
 * ⚠️ HONESTIDAD (correccion 36432bb): esta funcion es CLIENTE. Verifica requisitos MINIMOS
 * (unidades, version, vigencia, aprobador con rol via `autoridad`, y un campo `estado='aprobado'`),
 * pero NO puede, por si sola, probar que la aprobacion OCURRIO en el servidor: `estado='aprobado'`
 * en un objeto que llega del cliente NO es prueba suficiente (igual que `autorizado:true` no lo era).
 * La aprobacion economica REAL se verifica aparte, contra registros del servidor, con
 * `aprobacionEstandarMO` (autoridadCosteoServidor.js): identidad+permiso+fecha+version+evidencia.
 * Por eso un estandar cargado aqui es REFERENCIA; declarar un costo OFICIAL con el exige, ademas,
 * la verificacion server-side. El objetivo P2 es que estos estandares provengan de una tabla
 * `estandar_mo` escrita por una RPC `aprobar_estandar_mo` (rol Direccion), no de un objeto cliente.
 * @param {object} e
 * @param {{autoridad?:Function}} opts  autoridad(email) -> {ok, rol}. Default: CERRADA (rechaza todo).
 */
export function cargarEstandar(e, { autoridad = AUTORIDAD_CERRADA } = {}) {
  const n = normalizarEstandar(e);
  if (!n.centro || !n.op) throw new Error('estandar sin centro/op');
  if (n.estado_aprobacion !== 'aprobado') throw new Error(`estandar ${n.centro}/${n.op}: sin aprobacion registrada por el servidor (estado != 'aprobado'). Un aprobador nombrado no basta: debe existir el hecho server-side (RPC con rol Direccion).`);
  if (!n.aprobado_por) throw new Error(`estandar ${n.centro}/${n.op}: sin aprobador (aprobado_por). Un 'autorizado:true' del cliente no prueba aprobacion.`);
  const ver = autoridad(n.aprobado_por);
  if (!ver || !ver.ok) throw new Error(`estandar ${n.centro}/${n.op}: aprobador ${n.aprobado_por} NO autorizado (rol ${ver?.rol || 'desconocido'})`);
  if (!(Number.isFinite(n.tiempo_proceso_min) && n.tiempo_proceso_min >= 0) || !(Number.isFinite(n.tarifa_mxn_min) && n.tarifa_mxn_min > 0)) throw new Error(`estandar ${n.centro}/${n.op}: unidades invalidas (tiempo min >= 0 y tarifa $/min > 0)`);
  if (n.tiempo_preparacion_min != null && !(Number.isFinite(n.tiempo_preparacion_min) && n.tiempo_preparacion_min >= 0)) throw new Error(`estandar ${n.centro}/${n.op}: preparacion invalida`);
  if (!n.version) throw new Error(`estandar ${n.centro}/${n.op}: sin version (trazabilidad obligatoria)`);
  if (!n.vigente_desde) throw new Error(`estandar ${n.centro}/${n.op}: sin vigencia (vigente_desde obligatorio)`);
  const guardado = { ...n, rol_aprobador: ver.rol, autorizado: true };   // autorizado DERIVADO de la verificacion, no del input
  REGISTRO.set(clave(n.centro, n.op), guardado);
  return guardado;
}

/** Carga un lote de estandares desde una fuente autoritativa (p.ej. tabla Supabase), con verificacion. */
export function cargarEstandaresDesde(filas = [], opts = {}) {
  const cargados = [], rechazados = [];
  for (const f of (Array.isArray(filas) ? filas : [])) {
    try { cargados.push(cargarEstandar(f, opts)); } catch (err) { rechazados.push({ centro: f?.centro, op: f?.op, motivo: String(err?.message || err) }); }
  }
  return { cargados, rechazados };
}
/** Devuelve el estandar si existe Y esta vigente a la fecha dada (fail-closed si expiro). */
export function estandarDe(centro, op, hoy = new Date()) {
  const n = REGISTRO.get(clave(centro, op));
  if (!n) return null;
  if (n.vigente_hasta) { const h = Date.parse(n.vigente_hasta); if (Number.isFinite(h) && hoy.getTime() > h) return null; }
  return n;
}
export function limpiarEstandares() { REGISTRO.clear(); }
export function estandaresCargados() { return [...REGISTRO.values()]; }

/**
 * Costo de UNA operacion. Sin estandar -> PENDIENTE (no inventa). Con estandar:
 *   preparacion_imputada = tiempo_prep x tarifa / lote
 *   proceso = tiempo_proceso x tarifa x piezas
 *   total = preparacion_imputada x piezas(si base pieza) + proceso + adicionales x piezas
 */
export function costoOperacion({ centro, op, piezas = 1, lote = null, estandar = null } = {}) {
  // Un estandar SUMINISTRADO directamente (objeto cliente) es SIEMPRE referencia, nunca
  // oficial/autorizado: sus campos autorizado:true o estado:'aprobado' NO prueban aprobacion
  // (auditoria 36432bb, p2). Solo un estandar del REGISTRO (vetado por cargarEstandar con
  // autoridad) puede ser AUTORIZADA. La oficialidad economica la decide el servidor, no aqui.
  const directo = !!estandar;
  const std = directo ? normalizarEstandar(estandar) : estandarDe(centro, op);
  const qty = Number(piezas) > 0 ? Number(piezas) : 1;
  if (!std || std.tiempo_proceso_min == null || std.tarifa_mxn_min == null) {
    return {
      estado: 'PENDIENTE_ESTANDAR', centro, op, costo_mxn: null,
      falta: 'tiempo de proceso y/o tarifa autorizada por centro',
      pregunta: `Tiempo estandar (min/pieza), preparacion (min/lote) y tarifa ($/min) autorizados de "${op}" en ${centro}.`,
    };
  }
  const loteEf = Number(lote) > 0 ? Number(lote) : std.lote_piezas;
  const prepPorPieza = (std.tiempo_preparacion_min || 0) * std.tarifa_mxn_min / loteEf;
  const procesoPorPieza = std.tiempo_proceso_min * std.tarifa_mxn_min;
  const adicionalPorPieza = std.costos_adicionales_mxn || 0;
  const costoUnit = prepPorPieza + procesoPorPieza + adicionalPorPieza;
  const costo = +(costoUnit * qty).toFixed(2);
  const autorizada = !directo && std.autorizado === true;   // directo nunca es oficial
  return {
    estado: autorizada ? 'AUTORIZADA' : 'REFERENCIA', oficial: false, origen: directo ? 'suministrado' : 'registro',
    centro, op, costo_mxn: costo,
    desglose: {
      preparacion_imputada_mxn: +(prepPorPieza * qty).toFixed(2),
      proceso_mxn: +(procesoPorPieza * qty).toFixed(2),
      adicionales_mxn: +(adicionalPorPieza * qty).toFixed(2),
      unitario_mxn: +costoUnit.toFixed(4),
    },
    parametros: { tiempo_preparacion_min: std.tiempo_preparacion_min, tiempo_proceso_min: std.tiempo_proceso_min,
      tarifa_mxn_min: std.tarifa_mxn_min, lote_piezas: loteEf, piezas: qty, base_reparto: 'preparacion por lote',
      version: std.version, fuente: std.fuente, autorizado: autorizada },
  };
}

/**
 * MO del routing: aplica costoOperacion a cada operacion propuesta. Devuelve total
 * SOLO si todas tienen estandar; si falta alguna, MO = null y lista los faltantes.
 */
export function costoManoObraRouting(operaciones = [], { piezas = 1, lote = null } = {}) {
  const detalle = []; let total = 0; let completa = true; const faltantes = [];
  for (const o of operaciones) {
    const r = costoOperacion({ centro: o.centro, op: o.op, piezas, lote });
    detalle.push({ op: o.op, centro: o.centro, estado: r.estado, costo_mxn: r.costo_mxn });
    if (r.costo_mxn == null) { completa = false; faltantes.push({ centro: o.centro, op: o.op, pregunta: r.pregunta }); }
    else total += r.costo_mxn;
  }
  return {
    mano_obra_mxn: operaciones.length && completa ? +total.toFixed(2) : null,
    completa: operaciones.length ? completa : null,
    detalle, faltantes,
    nota: operaciones.length && !completa
      ? 'MO por routing incompleta: faltan estandares (tiempo+tarifa) autorizados. Modelo vigente mientras tanto: POLITICA_VH por factores.'
      : null,
  };
}
