// ============================================================================
//  RUTA DE FABRICACIÓN / HORAS-HOMBRE (PRODUCT INTELLIGENCE, §10)
//
//  Capa PURA. Un ProductSpec/BOM se conecta a OPERACIONES reales (corte, doblado,
//  punzonado, láser, soldadura, pulido, pintura, enchapado, ensamble, empaque…).
//  Por operación: setup, tiempo unitario, cantidad, tiempo total, tarifa/hora,
//  fuente, confianza. REGLA DURA: si NO conocemos la ruta/tiempo → PENDING. NUNCA
//  se inventan minutos para "cerrar" el costo. La MO sólo es oficial con evidencia.
//
//  No lee red ni archivos. El ingestor (ruta de ingeniería / T.D.C. humana) alimenta.
// ============================================================================

export const PROCESO = Object.freeze({
  CORTE: 'corte', DOBLADO: 'doblado', PUNZONADO: 'punzonado', LASER: 'laser',
  SOLDADURA: 'soldadura', PULIDO: 'pulido', PINTURA: 'pintura', ENCHAPADO: 'enchapado',
  ENSAMBLE: 'ensamble', EMPAQUE: 'empaque', OTRO: 'otro',
});

export const ESTADO_OP = Object.freeze({
  OK: 'OK',           // tiempo + tarifa con evidencia → MO calculable
  PENDING: 'PENDING', // falta tiempo o tarifa → NO se inventa; MO no oficial
});

const txt = (v) => String(v ?? '').trim();
const num = (v) => { if (typeof v !== 'number' && typeof v !== 'string') return null; if (typeof v === 'string' && v.trim() === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

/**
 * Normaliza UNA operación. tiempo_total_min = setup + unitario×cantidad (sólo si
 * hay datos). costo_mo = tiempo_total_h × tarifa_hora (sólo con tarifa real).
 * Sin tiempo o sin tarifa → PENDING (no inventa minutos ni tarifa).
 */
export function operacion(raw = {}) {
  const proceso = PROCESO[txt(raw.proceso).toUpperCase()] || (Object.values(PROCESO).includes(txt(raw.proceso)) ? txt(raw.proceso) : null);
  const setup_min = num(raw.setup_min ?? raw.setup);
  const tiempo_unitario_min = num(raw.tiempo_unitario_min ?? raw.tiempo_unitario);
  // CANTIDAD: si viene explícita y es ≤0 (o inválida) es un dato malo → NO se
  // coacciona a 1 (eso fabricaría tiempo/costo). Default 1 sólo cuando NO viene.
  const cantidadRaw = num(raw.cantidad);
  const cantidad = cantidadRaw ?? 1;
  const tarifa_hora = num(raw.tarifa_hora ?? raw.tarifa);

  const issues = [];
  if (!proceso) issues.push('PROCESO_DESCONOCIDO');
  if (tiempo_unitario_min == null && setup_min == null) issues.push('SIN_TIEMPO');       // ni setup ni unitario
  if (tiempo_unitario_min != null && tiempo_unitario_min < 0) issues.push('TIEMPO_INVALIDO');
  if (setup_min != null && setup_min < 0) issues.push('TIEMPO_INVALIDO');
  if (cantidadRaw != null && cantidadRaw <= 0) issues.push('CANTIDAD_INVALIDA');          // 0/negativa (red-team C2)
  if (tarifa_hora == null) issues.push('SIN_TARIFA');
  else if (tarifa_hora < 0) issues.push('TARIFA_INVALIDA');

  // Tiempo total sólo con tiempo válido Y cantidad válida (no se inventa nada).
  let tiempo_total_min = null;
  if (!issues.includes('SIN_TIEMPO') && !issues.includes('TIEMPO_INVALIDO') && !issues.includes('CANTIDAD_INVALIDA')) {
    tiempo_total_min = +((setup_min || 0) + (tiempo_unitario_min || 0) * cantidad).toFixed(4);
  }
  // Costo MO sólo con tiempo Y tarifa reales.
  let costo_mo = null;
  if (tiempo_total_min != null && tarifa_hora != null && tarifa_hora >= 0) {
    costo_mo = +((tiempo_total_min / 60) * tarifa_hora).toFixed(4);
  }

  const estado = issues.length ? ESTADO_OP.PENDING : ESTADO_OP.OK;
  return {
    proceso, setup_min, tiempo_unitario_min, cantidad, tiempo_total_min,
    tarifa_hora, costo_mo,
    fuente: txt(raw.fuente) || null,
    confianza: num(raw.confianza ?? raw.confidence),
    evidencia: txt(raw.evidencia || raw.evidence) || null,
    issues, estado,
  };
}

/**
 * Ruta completa (lista de operaciones). Agrega tiempo y MO SÓLO si TODAS las
 * operaciones son OK; si alguna es PENDING, la ruta es PRELIMINAR y NO entrega
 * un costo de MO oficial (no se inventa el faltante).
 * @param {Array} operaciones
 * @returns {{operaciones, estado, tiempo_total_min, costo_mo_total, pendientes}}
 */
export function rutaFabricacion(operaciones = []) {
  const ops = (Array.isArray(operaciones) ? operaciones : []).map(operacion);
  const pendientes = ops.filter((o) => o.estado !== ESTADO_OP.OK).length;
  const completa = pendientes === 0 && ops.length > 0;

  const tiempo_total_min = completa ? +ops.reduce((s, o) => s + (o.tiempo_total_min || 0), 0).toFixed(4) : null;
  const costo_mo_total = completa ? +ops.reduce((s, o) => s + (o.costo_mo || 0), 0).toFixed(4) : null;

  return {
    operaciones: ops,
    estado: completa ? 'OK' : 'PRELIMINAR',
    tiempo_total_min,     // null si la ruta no está completa (no se inventa)
    costo_mo_total,       // null si la ruta no está completa
    pendientes,
  };
}
