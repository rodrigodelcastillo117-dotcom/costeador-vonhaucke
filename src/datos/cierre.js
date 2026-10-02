// ============================================================================
//  N18 — CIERRE (won/lost), validación pura.
//  GANADA exige revisión aceptada + total final + fecha + escenario.
//  PERDIDA exige un motivo ESTRUCTURADO (no texto libre, no inventar historia).
//  Sin probabilidades de IA: es un hecho que registra un humano.
// ============================================================================
export const MOTIVOS_PERDIDA = [
  'PRECIO', 'COMPETENCIA', 'PLAZO', 'ESPECIFICACION',
  'PRESUPUESTO_CANCELADO', 'PROYECTO_CANCELADO', 'SIN_RESPUESTA', 'OTRO',
];

/** Valida un cierre. Devuelve { ok, errores: [] }. No muta nada. */
export function validarCierre(cierre) {
  const errores = [];
  const c = cierre || {};
  if (c.resultado !== 'ganada' && c.resultado !== 'perdida') {
    errores.push('resultado debe ser "ganada" o "perdida"');
    return { ok: false, errores };
  }
  if (c.resultado === 'ganada') {
    if (!c.revision_aceptada) errores.push('ganada: falta revision_aceptada');
    if (c.total_final == null || !(Number(c.total_final) > 0)) errores.push('ganada: total_final inválido');
    if (!c.escenario) errores.push('ganada: falta escenario');
    if (!c.fecha) errores.push('ganada: falta fecha');
  } else {
    if (!c.motivo) errores.push('perdida: motivo obligatorio');
    else if (!MOTIVOS_PERDIDA.includes(c.motivo)) errores.push(`perdida: motivo inválido (${c.motivo})`);
    if (c.motivo === 'OTRO' && !String(c.motivo_detalle || '').trim()) errores.push('perdida: motivo OTRO requiere detalle');
  }
  return { ok: errores.length === 0, errores };
}
