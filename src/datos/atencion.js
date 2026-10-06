// ============================================================================
//  N17 / N19 / N20 — DETECTORES DE ATENCIÓN Y HECHOS (puros, sin IA de probabilidad).
//  Operan sobre arreglos planos (proyectos, cotizaciones, aprobaciones) y producen:
//   - N17: proyectos activos SIN próxima acción.
//   - N19 "HOY NECESITA TU ATENCIÓN": tarjetas accionables (hechos, no adornos).
//   - N20 Dirección: conteos/montos SÓLO con hechos reales (sin inventar).
//  No deciden dinero; sólo leen estados ya calculados por el servidor.
// ============================================================================
const ETAPAS_CERRADAS = ['GANADA', 'PERDIDA', 'CANCELADA', 'SUSPENDIDA'];
export const esProyectoActivo = (p) => !ETAPAS_CERRADAS.includes(String(p?.etapa || '').toUpperCase());

/** N17 — proyectos activos sin próxima acción definida. */
export function proyectosSinProximaAccion(proyectos) {
  return (proyectos || []).filter((p) => esProyectoActivo(p) && !String(p?.proxima_accion || '').trim());
}

/**
 * N19 — tarjetas "HOY NECESITA TU ATENCIÓN".
 * entrada: { proyectos, cotizaciones, aprobaciones, hoy:'YYYY-MM-DD' }
 * cada tarjeta: { tipo, ref, texto, severidad }
 */
export function hoyNecesitaAtencion({ proyectos = [], cotizaciones = [], aprobaciones = [], hoy } = {}) {
  const cards = [];
  const hoyStr = hoy || new Date().toISOString().slice(0, 10);

  for (const a of aprobaciones) {
    if (a.estado === 'PENDIENTE') cards.push({ tipo: 'APROBACION_PENDIENTE', ref: a.cotizacion_id, texto: `Aprobación pendiente de la cotización ${a.cotizacion_id}`, severidad: 'alta' });
  }
  for (const c of cotizaciones) {
    if (c.estado_autorizacion === 'bloqueada' || c.cotizacion_emitible === false) cards.push({ tipo: 'COTIZACION_BLOQUEADA', ref: c.id, texto: `Cotización ${c.folio || c.id} bloqueada (datos faltantes)`, severidad: 'alta' });
    const partidas = c.partidas || [];
    if (partidas.some((p) => p.sinPrecioAutorizado)) cards.push({ tipo: 'PRODUCTO_SIN_PRECIO', ref: c.id, texto: `Cotización ${c.folio || c.id} tiene productos sin precio autorizado`, severidad: 'media' });
  }
  for (const p of proyectos) {
    if (!esProyectoActivo(p)) continue;
    if (!String(p.proxima_accion || '').trim()) cards.push({ tipo: 'SIN_PROXIMA_ACCION', ref: p.id, texto: `Proyecto "${p.nombre}" sin próxima acción`, severidad: 'media' });
    else if (p.fecha_proxima_accion && p.fecha_proxima_accion <= hoyStr) cards.push({ tipo: 'ACCION_VENCE_HOY', ref: p.id, texto: `"${p.nombre}": ${p.proxima_accion} (vence ${p.fecha_proxima_accion})`, severidad: 'alta' });
    if (p.scopeDiscrepancia) cards.push({ tipo: 'INCONSISTENCIA_ALCANCE', ref: p.id, texto: `"${p.nombre}" tiene discrepancia de alcance (requerido≠cotizado/acomodado)`, severidad: 'media' });
  }
  const ordenSev = { alta: 0, media: 1, baja: 2 };
  return cards.sort((a, b) => (ordenSev[a.severidad] ?? 9) - (ordenSev[b.severidad] ?? 9));
}

/** N20 — hechos de Dirección (sin probabilidades; márgenes sólo si costo confiable). */
export function hechosDireccion({ proyectos = [], cotizaciones = [] } = {}) {
  const porEtapa = {};
  for (const p of proyectos) { const e = String(p.etapa || '?').toUpperCase(); porEtapa[e] = (porEtapa[e] || 0) + 1; }
  const ganadas = proyectos.filter((p) => String(p.etapa).toUpperCase() === 'GANADA');
  const perdidas = proyectos.filter((p) => String(p.etapa).toUpperCase() === 'PERDIDA');
  const motivosPerdida = {};
  for (const p of perdidas) { const m = p.motivo_perdida || 'OTRO'; motivosPerdida[m] = (motivosPerdida[m] || 0) + 1; }
  const ganadasConTotal = ganadas.filter((p) => p?.total_final != null && Number.isFinite(Number(p.total_final)));
  const ganadasSinTotal = ganadas.length - ganadasConTotal.length;
  const montoGanadoConocido = ganadasConTotal.reduce((s, p) => s + Number(p.total_final), 0);
  return {
    proyectosActivos: proyectos.filter(esProyectoActivo).length,
    porEtapa,
    ganadas: ganadas.length,
    perdidas: perdidas.length,
    montoGanado: ganadasSinTotal ? null : montoGanadoConocido,
    montoGanadoConocido,
    ganadasSinTotal,
    motivosPerdida,
    // 33 borradores NO cuentan como ventas: sólo se cuentan cotizaciones con folio_oficial.
    cotizacionesOficiales: cotizaciones.filter((c) => c.folio_oficial).length,
  };
}
