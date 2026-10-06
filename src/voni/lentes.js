// ============================================================================
//  VONI 2.0 — LENTES POR ROL. Cada lente es un analizador DETERMINISTA que mira
//  los datos (ya traídos y ya saneados por las tools) desde la pregunta de un rol
//  y devuelve hallazgos (afirmaciones) + bloqueos. No pide datos ni red: recibe un
//  mapa `datos = { [tool]: data }`. El orquestador decide qué tools llamar.
//
//  IMPORTANTE: una lente es un ÁNGULO, no un permiso. Si el rol real no ve
//  economía, los datos económicos simplemente no están en `datos` (la tool los
//  bloqueó), así que la lente no puede exponerlos aunque "actúe como CFO".
// ============================================================================
import { afirmacion, TIPO_AFIRMACION, URGENCIA, ESTADO } from './respuesta.js';

const num = (x) => (x == null ? null : (Number.isFinite(Number(x)) ? Number(x) : null));

// Bloqueo normalizado.
function bloqueo(titulo, detalle, urgencia = URGENCIA.ALTA) {
  return { titulo, detalle, urgencia };
}

// ---- LENTE VENTAS: ¿qué necesita el cliente y qué hago para avanzar? --------
export function lenteVentas(datos = {}, ctx = {}) {
  const findings = []; const bloqueos = [];
  const proy = datos.get_project_context;
  const recon = datos.get_reconciliation;
  const quote = datos.get_quote;

  if (recon && recon.hayDiscrepancia) {
    const faltan = (recon.zonas || []).filter((z) => z.estado === 'falta');
    if (faltan.length) {
      bloqueos.push(bloqueo('Alcance incompleto', `${faltan.length} zona(s) con faltantes por cotizar/acomodar.`, URGENCIA.ALTA));
      findings.push(afirmacion(`Faltan piezas en: ${faltan.map((z) => z.nombre).join(', ')}.`, TIPO_AFIRMACION.HECHO, { source_type: 'reconciliacion', confidence: 0.9 }));
    }
  }
  // Cotización vacía: NO está lista. Antes, sin partidas no había bloqueo y Voni
  // respondía "Lista para enviarse." sobre una cotización sin un solo mueble.
  if (quote && Array.isArray(quote.partidas) && quote.partidas.length === 0) {
    bloqueos.push(bloqueo('Cotización vacía', 'Aún no hay muebles: agrega al menos uno antes de enviar.', URGENCIA.BLOQUEANTE));
  }
  if (quote && Array.isArray(quote.sinPrecio) && quote.sinPrecio.length) {
    bloqueos.push(bloqueo('Renglones sin precio autorizado', `${quote.sinPrecio.length} partida(s) sin precio; no se puede cotizar completo.`, URGENCIA.BLOQUEANTE));
  }
  if (proy) {
    if (proy.presupuesto != null && proy.total_actual != null) {
      const delta = num(proy.total_actual) - num(proy.presupuesto);
      if (delta > 0) findings.push(afirmacion(`La propuesta está $${Math.round(delta).toLocaleString('es-MX')} arriba del presupuesto.`, TIPO_AFIRMACION.HECHO, { source_type: 'proyecto', confidence: 0.95 }));
    }
    if (!proy.proxima_accion) bloqueos.push(bloqueo('Sin próxima acción', 'Este proyecto no tiene un siguiente paso agendado.', URGENCIA.MEDIA));
  }
  return { lente: 'ventas', pregunta: '¿Qué necesita el cliente y qué hago para avanzar?', findings, bloqueos, estado: bloqueos.length ? ESTADO.ATENCION : ESTADO.OK };
}

// ---- LENTE COSTEADOR: ¿qué necesitamos para fabricar bien? ------------------
export function lenteCosteador(datos = {}, ctx = {}) {
  const findings = []; const bloqueos = [];
  const costing = datos.get_costing;      // sólo llega si el rol ve economía
  const bom = datos.get_bom;
  const render = datos.get_render_status;

  if (!costing) {
    findings.push(afirmacion('No se analizó costo: tu rol/modo no incluye economía.', TIPO_AFIRMACION.SUPUESTO, { source_type: 'permiso' }));
  } else if (Array.isArray(costing.sinCosto) && costing.sinCosto.length) {
    bloqueos.push(bloqueo('Componentes sin costo', `${costing.sinCosto.length} componente(s) sin precio de insumo.`, URGENCIA.ALTA));
  }
  if (bom && Array.isArray(bom.contradicciones) && bom.contradicciones.length) {
    bloqueos.push(bloqueo('Contradicciones en el plano', `${bom.contradicciones.length} medida(s) en conflicto; requieren confirmación.`, URGENCIA.ALTA));
  }
  if (render && Array.isArray(render) && render.some((r) => r.estado === 'DESACTUALIZADO')) {
    findings.push(afirmacion('Hay un render desactualizado respecto al diseño actual.', TIPO_AFIRMACION.HECHO, { source_type: 'render', confidence: 0.8 }));
  }
  return { lente: 'costeador', pregunta: '¿Qué necesitamos para fabricar bien?', findings, bloqueos, estado: bloqueos.length ? ESTADO.ATENCION : ESTADO.OK };
}

// ---- LENTE DISEÑO: ¿cabe, funciona y cumple? --------------------------------
export function lenteDiseno(datos = {}, ctx = {}) {
  const findings = []; const bloqueos = [];
  const recon = datos.get_reconciliation;
  const layout = datos.get_layout;

  if (recon && recon.hayDiscrepancia) {
    const sinAcomodar = (recon.zonas || []).filter((z) => z.faltaAcomodar > 0);
    if (sinAcomodar.length) bloqueos.push(bloqueo('Piezas sin acomodar', sinAcomodar.map((z) => `${z.nombre}: ${z.faltaAcomodar}`).join(' · '), URGENCIA.ALTA));
  }
  if (layout && layout.warnings && layout.warnings.length) {
    bloqueos.push(bloqueo('Avisos de layout', `${layout.warnings.length} aviso(s) de circulación/choque.`, URGENCIA.MEDIA));
  }
  return { lente: 'diseno', pregunta: '¿Cabe, funciona y cumple?', findings, bloqueos, estado: bloqueos.length ? ESTADO.ATENCION : ESTADO.OK };
}

// ---- LENTE INDUSTRIAL: ¿cómo lo fabrico mejor, con menos riesgo y desperdicio? ----
export function lenteIndustrial(datos = {}, ctx = {}) {
  const findings = []; const bloqueos = [];
  const a = datos.get_industrial_analysis;
  if (!a || a.disponible === false) {
    bloqueos.push(bloqueo('Análisis industrial no disponible', a?.nota || 'Falta BOM/costeo del producto.', URGENCIA.ALTA));
    return { lente:'industrial', pregunta:'¿Cómo lo fabrico mejor?', findings, bloqueos, estado:ESTADO.ATENCION };
  }
  for (const b of a.bloqueos || []) {
    bloqueos.push(bloqueo(b.titulo || b.code || 'Bloqueo industrial', b.detalle || '', URGENCIA.ALTA));
  }
  for (const h of a.hallazgos || []) {
    if (h.tipo === 'CORTE_2D') {
      findings.push(afirmacion(
        `${h.material}: eficiencia de corte advisory ${h.eficiencia_pct ?? 'N/D'}%.`,
        TIPO_AFIRMACION.HECHO,
        { source_type:'motor_corte', confidence: h.completo ? 0.9 : 0.6 },
      ));
    }
  }
  for (const r of a.recomendaciones || []) {
    findings.push(afirmacion(
      `${r.accion} ${r.ahorro_certificado === false ? '(ahorro potencial, no certificado)' : ''}`.trim(),
      TIPO_AFIRMACION.INFERENCIA,
      { source_type:'analisis_industrial', confidence:r.confianza ?? 0.7 },
    ));
  }
  if (a.eficiencia?.corte_2d_global_pct != null) {
    findings.push(afirmacion(
      `Eficiencia global de corte 2D: ${a.eficiencia.corte_2d_global_pct}%.`,
      TIPO_AFIRMACION.HECHO,
      { source_type:'motor_corte', confidence:0.9 },
    ));
  }
  return { lente:'industrial', pregunta:'¿Cómo lo fabrico mejor?', findings, bloqueos, estado: bloqueos.length ? ESTADO.ATENCION : ESTADO.OK };
}

// ---- LENTE PROYECTOS: ¿lo vendido está listo para ejecutarse? --------------
export function lenteProyectos(datos = {}, ctx = {}) {
  const findings = []; const bloqueos = [];
  const recon = datos.get_reconciliation;
  const aprob = datos.get_approvals;
  const render = datos.get_render_status;
  if (recon && recon.hayDiscrepancia) bloqueos.push(bloqueo('Alcance no cerrado', 'Hay zonas sin reconciliar antes de ejecutar.', URGENCIA.ALTA));
  if (Array.isArray(aprob) && aprob.some((a) => a.estado === 'PENDIENTE')) bloqueos.push(bloqueo('Aprobaciones pendientes', 'Falta resolver aprobaciones.', URGENCIA.ALTA));
  if (Array.isArray(render) && !render.some((r) => r.estado === 'LISTO')) findings.push(afirmacion('No hay render LISTO para presentar/ejecutar.', TIPO_AFIRMACION.INFERENCIA, { source_type: 'render', confidence: 0.6 }));
  return { lente: 'proyectos', pregunta: '¿Lo vendido está listo para ejecutarse?', findings, bloqueos, estado: bloqueos.length ? ESTADO.ATENCION : ESTADO.OK };
}

// ---- LENTE DIRECCIÓN: ¿qué necesita mi atención? ---------------------------
export function lenteDireccion(datos = {}, ctx = {}) {
  const findings = []; const bloqueos = [];
  const hoy = datos.get_today_attention;
  const hechos = datos.get_direction_facts;
  if (Array.isArray(hoy)) {
    for (const t of hoy.filter((x) => x && (x.severidad === 'alta' || x.urgencia === 'ALTA')).slice(0, 5)) {
      bloqueos.push(bloqueo(t.titulo || t.tipo || 'Atención', t.detalle || '', URGENCIA.ALTA));
    }
  }
  if (hechos) {
    if (hechos.aprobacionesPendientes) findings.push(afirmacion(`${hechos.aprobacionesPendientes} aprobación(es) pendiente(s).`, TIPO_AFIRMACION.HECHO, { source_type: 'direccion', confidence: 0.95 }));
  }
  return { lente: 'direccion', pregunta: '¿Qué necesita mi atención?', findings, bloqueos, estado: bloqueos.length ? ESTADO.ATENCION : ESTADO.OK };
}

// ---- LENTE CFO: ¿dónde está el riesgo económico? ---------------------------
export function lenteCfo(datos = {}, ctx = {}) {
  const findings = []; const bloqueos = [];
  const costing = datos.get_costing;      // sólo si el rol ve economía (cfo sí)
  const aprob = datos.get_approvals;
  if (!costing) {
    findings.push(afirmacion('Sin datos económicos en este contexto (permiso/modo).', TIPO_AFIRMACION.SUPUESTO, { source_type: 'permiso' }));
  } else if (costing.margen != null && num(costing.margen) < (costing.margenMinimo != null ? num(costing.margenMinimo) : 25)) {
    bloqueos.push(bloqueo('Margen bajo', `Margen ${costing.margen}% por debajo del mínimo.`, URGENCIA.ALTA));
  }
  if (Array.isArray(aprob) && aprob.some((a) => a.estado === 'PENDIENTE')) findings.push(afirmacion('Hay descuentos esperando aprobación.', TIPO_AFIRMACION.HECHO, { source_type: 'aprobaciones', confidence: 0.9 }));
  return { lente: 'cfo', pregunta: '¿Dónde está el riesgo económico?', findings, bloqueos, estado: bloqueos.length ? ESTADO.ATENCION : ESTADO.OK };
}

export const LENTES = Object.freeze({
  ventas: lenteVentas, costeador: lenteCosteador, diseno: lenteDiseno,
  industrial: lenteIndustrial,
  proyectos: lenteProyectos, direccion: lenteDireccion, cfo: lenteCfo,
});

export function correrLente(nombre, datos, ctx) {
  const fn = LENTES[nombre] || LENTES.ventas;
  return fn(datos, ctx);
}
