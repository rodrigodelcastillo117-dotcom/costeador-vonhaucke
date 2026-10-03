// ============================================================================
//  VONI 2.0 — NÚCLEO (un solo cerebro). Entiende intención + contexto, elige
//  tools y lentes (con permisos), consulta fuentes, separa hechos de inferencias,
//  detecta bloqueos y sintetiza UNA respuesta (contrato estable). No hay
//  VoniVendedor/VoniCFO como bots separados: hay un núcleo con lentes.
//
//  Determinista y testeable: `responder` recibe un PROVEEDOR de tools inyectable,
//  así que no toca red en tests. El dinero real ya viene filtrado por el servidor;
//  aquí además las tools re-filtran por rol/modo.
// ============================================================================
import { ejecutarTool } from './tools.js';
import { correrLente } from './lentes.js';
import { lenteEfectiva, rolVeEconomia } from './permisos.js';
import { respuestaEstructurada, ESTADO, URGENCIA, confianzaDe, afirmacion, TIPO_AFIRMACION } from './respuesta.js';
import { registrar } from './observabilidad.js';

export const MODOS = Object.freeze({ CONSULTAR: 'CONSULTAR', ANALIZAR: 'ANALIZAR', PROPONER: 'PROPONER' });

/** Normaliza el contexto (ids + rol + ruta + modo cliente). */
export function construirContexto(p = {}) {
  return {
    user: p.user || null,
    role: p.role || 'ventas',
    clientSafe: !!p.clientSafe,
    route: p.route || null,
    project_id: p.project_id ?? null,
    quote_id: p.quote_id ?? null,
    revision_id: p.revision_id ?? null,
    scenario_id: p.scenario_id ?? null,
    product_id: p.product_id ?? null,
    expediente_id: p.expediente_id ?? null,
    layout_id: p.layout_id ?? null,
    // Fuentes económicas autorizadas inyectadas por el host SÓLO para veCostos
    // (p.ej. el BOM del costeo actual). La capa tools.js igual bloquea estas
    // tools para vendedor/cliente, así que esto nunca filtra economía.
    bom: p.bom ?? null,
    costing: p.costing ?? null,
    // Trabajo VIVO del flujo principal (seller-safe + geometría del acomodo), para
    // que Voni analice lo que está EN PANTALLA, no sólo lo guardado en la BD
    // comercial. Si no se pasan aquí, el proveedor nunca los ve.
    partidasLocales: p.partidasLocales ?? null,
    acomodoLocal: p.acomodoLocal ?? null,
  };
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Intenciones → { intent, modo, lentes, tools }.
export function inferirIntencion(query, ctx = {}) {
  const q = norm(query);
  const modo = /\b(propon|sugiere|arma|prepara|optimiza)/.test(q) ? MODOS.PROPONER
    : /\b(analiza|revisa|audita|checa|compara)/.test(q) ? MODOS.ANALIZAR
      : MODOS.CONSULTAR;

  // READINESS (multilente)
  if (/\b(lista|listo|enviar|mandar|podemos enviar|se puede enviar)\b/.test(q)) {
    return { intent: 'READINESS', modo, lentes: ['ventas', 'diseno', 'costeador', 'proyectos'],
      tools: ['get_project_context', 'get_reconciliation', 'get_quote', 'get_approvals', 'get_render_status', 'get_costing', 'get_bom'] };
  }
  if (/\b(cambio|cambios|cambi[oó]|comparar|comparacion|diff|revision|revisiones)\b/.test(q)) {
    return { intent: 'DIFF', modo, lentes: ['ventas'], tools: ['compare_revisions', 'get_project_context'] };
  }
  if (/\b(falta|faltante|faltan|que falta|pendiente)\b/.test(q)) {
    return { intent: 'GAPS', modo, lentes: ['ventas', 'diseno'], tools: ['get_reconciliation', 'get_quote', 'get_project_context'] };
  }
  if (/\b(budget|presupuesto|en budget)\b/.test(q)) {
    return { intent: 'BUDGET', modo, lentes: ['ventas'], tools: ['get_project_context', 'get_quote'] };
  }
  if (/\b(atencion|atenci[oó]n|hoy|que necesito|prioridad)\b/.test(q)) {
    return { intent: 'ATTENTION', modo, lentes: ['direccion'], tools: ['get_today_attention', 'get_direction_facts', 'get_approvals'] };
  }
  // CONOCIMIENTO DE PRODUCTO (qué línea sirve, materiales, a la medida). Va ANTES
  // que COSTING para que "¿qué mueble me sirve?" no se confunda con "costéame".
  if (/\b(que linea|recomien|me sirve|sugier|de que esta|a la medida|material|acabado|que producto|catalogo|que mueble|sirve para|para (una|un) )\b/.test(q)) {
    return { intent: 'KNOWLEDGE', modo, lentes: ['conocimiento'], tools: ['get_catalog_knowledge'] };
  }
  if (/\b(analiza este mueble|producto|mueble|costear|costo|fabricar|bom)\b/.test(q)) {
    return { intent: 'COSTING_ANALYSIS', modo: MODOS.ANALIZAR, lentes: ['costeador'], tools: ['get_costing', 'get_bom', 'get_render_status'] };
  }
  if (/\b(riesgo|margen|rentab|utilidad)\b/.test(q)) {
    return { intent: 'RISK', modo, lentes: ['cfo'], tools: ['get_costing', 'get_approvals', 'get_direction_facts'] };
  }
  if (/\b(cabe|circulacion|acomod|layout|distribucion)\b/.test(q)) {
    return { intent: 'LAYOUT', modo, lentes: ['diseno'], tools: ['get_reconciliation', 'get_layout', 'get_render_status'] };
  }
  // Default: la lente de su rol (pedir otra lente no da permisos).
  const ef = lenteEfectiva(ctx.role);
  return { intent: 'CONSULTA', modo, lentes: [ef.lente], tools: ['get_project_context', 'get_reconciliation', 'get_quote'] };
}

// Sintetiza los resultados de lente en UNA respuesta.
function sintetizar(intent, resultadosLente) {
  const bloqueos = [];
  const evidencia = [];
  const lentesUsadas = [];
  for (const r of resultadosLente) {
    lentesUsadas.push(r.lente);
    for (const b of r.bloqueos) bloqueos.push(b);
    for (const f of r.findings) evidencia.push(f);
  }
  // Dedup bloqueos por título.
  const vistos = new Set();
  const bloqueosUnicos = bloqueos.filter((b) => (vistos.has(b.titulo) ? false : (vistos.add(b.titulo), true)));

  const hayBloqueante = bloqueosUnicos.some((b) => b.urgencia === URGENCIA.BLOQUEANTE);
  const estado = hayBloqueante ? ESTADO.BLOQUEADO : (bloqueosUnicos.length ? ESTADO.ATENCION : ESTADO.OK);

  let que_paso;
  if (intent === 'READINESS') {
    que_paso = bloqueosUnicos.length ? 'NO LISTA para enviarse.' : 'Lista para enviarse.';
  } else {
    que_paso = bloqueosUnicos.length ? `${bloqueosUnicos.length} punto(s) por resolver.` : 'Todo en orden en lo que puedo revisar.';
  }
  const principal = bloqueosUnicos[0] || null;
  return respuestaEstructurada({
    que_paso,
    por_que: principal ? `${principal.titulo}: ${principal.detalle}` : null,
    impacto: principal && principal.urgencia === URGENCIA.BLOQUEANTE ? 'Impide emitir/enviar.' : (bloqueosUnicos.length ? 'Requiere atención antes de avanzar.' : null),
    confianza: confianzaDe(evidencia),
    accion: principal ? `Resolver: ${principal.titulo}.` : 'Sin acción pendiente de mi parte.',
    evidencia,
    urgencia: hayBloqueante ? URGENCIA.BLOQUEANTE : (bloqueosUnicos.length ? URGENCIA.ALTA : URGENCIA.BAJA),
    estado,
    lentes: lentesUsadas,
    bloqueos: bloqueosUnicos,
  });
}

// Respuesta de CONOCIMIENTO de producto (catálogo Von Haucke). Mismo contrato.
function respuestaConocimiento(k) {
  if (!k) {
    return respuestaEstructurada({ que_paso: 'No pude consultar el catálogo ahora.', estado: ESTADO.DESCONOCIDO, urgencia: URGENCIA.BAJA, lentes: ['conocimiento'], bloqueos: [], evidencia: [] });
  }
  const evidencia = (k.principios || []).map((p) => afirmacion(p, TIPO_AFIRMACION.HECHO, { source_type: 'catalogo' }));
  let que_paso; let por_que = null;
  if (k.recomendaciones && k.recomendaciones.length) {
    que_paso = `Te sirve: ${k.recomendaciones.map((r) => r.nombre).join(', ')}.`;
    por_que = k.recomendaciones.map((r) => `${r.nombre} — ${r.que} (${r.razones.join('; ')})`).join(' · ');
    for (const r of k.recomendaciones) evidencia.push(afirmacion(`${r.nombre}: ${r.que}.`, TIPO_AFIRMACION.HECHO, { source_type: 'catalogo', confidence: 0.8 }));
  } else if (k.linea) {
    que_paso = `${k.linea.nombre}: ${k.linea.que}.`;
    por_que = `Fabrica: ${(k.linea.fabrica || []).join(', ')}.`;
  } else {
    que_paso = 'Von Haucke fabrica casi todo a la medida. Dime el mueble o la zona (sala de juntas, privado, recepción, lounge…) y te recomiendo la línea.';
  }
  if (k.esAMedida) por_que = `${por_que ? `${por_que} · ` : ''}Sí: casi todo se hace a la medida (medidas y acabados); por eso cada pieza se costea por su despiece.`;
  return respuestaEstructurada({
    que_paso, por_que, confianza: confianzaDe(evidencia),
    accion: 'Dime la zona o el mueble y lo aterrizo en tu cotización.',
    evidencia, urgencia: URGENCIA.BAJA, estado: ESTADO.OK, lentes: ['conocimiento'], bloqueos: [],
  });
}

/**
 * EL CEREBRO. Infiere intención, llama tools (con permisos/sanitización), corre
 * lentes y sintetiza UNA respuesta. Nunca lanza.
 * @param {{query:string, ctx:object, prov:object, intentForzado?:string}}
 */
export async function responder({ query, ctx = {}, prov = {}, intentForzado = null } = {}) {
  const t0 = Date.now();
  const contexto = construirContexto(ctx);
  const plan = intentForzado
    ? { intent: intentForzado, modo: MODOS.ANALIZAR, lentes: [lenteEfectiva(contexto.role).lente], tools: ['get_project_context', 'get_reconciliation'] }
    : inferirIntencion(query, contexto);

  // CONOCIMIENTO DE PRODUCTO: responde directo desde el catálogo (sin lentes de
  // readiness). Mantiene el MISMO contrato de respuesta, así la UI no cambia.
  if (plan.intent === 'KNOWLEDGE') {
    const res = await ejecutarTool('get_catalog_knowledge', contexto, { ...contexto, query }, prov);
    const respuesta = respuestaConocimiento(res.ok ? res.data : null);
    const obs = registrar({ ctx: contexto, intent: plan.intent, lentes: plan.lentes, tools: ['get_catalog_knowledge'], resultStatus: respuesta.estado, duration: Date.now() - t0 });
    return { respuesta, intent: plan.intent, modo: plan.modo, observabilidad: obs };
  }

  // Llamar tools (cada una con auth+permiso+sanitización). Las económicas que el
  // rol no puede ver simplemente fallan con sin_permiso y NO entran en `datos`.
  // La consulta viaja en args (`query`) para las tools que la usan (conocimiento).
  const datos = {};
  const toolsLlamadas = [];
  for (const nombre of plan.tools) {
    const res = await ejecutarTool(nombre, contexto, { ...contexto, query }, prov);
    toolsLlamadas.push(nombre);
    if (res.ok) datos[nombre] = res.data;
  }

  // Correr lentes (ángulo); los datos económicos faltantes no se pueden exponer.
  const resultadosLente = plan.lentes.map((l) => correrLente(l, datos, contexto));
  const respuesta = sintetizar(plan.intent, resultadosLente);

  // Nota de permiso si se pidió una lente económica sin permiso real.
  const lenteEco = plan.lentes.find((l) => ['cfo', 'costeador'].includes(l));
  if (lenteEco && !rolVeEconomia(contexto.role)) {
    respuesta.nota_permiso = lenteEfectiva(contexto.role, lenteEco).nota;
  }

  const obs = registrar({
    ctx: contexto, intent: plan.intent, lentes: plan.lentes, tools: toolsLlamadas,
    resultStatus: respuesta.estado, duration: Date.now() - t0,
  });

  return { respuesta, intent: plan.intent, modo: plan.modo, observabilidad: obs };
}

// Sugerencias contextuales (3–5) por ruta/rol.
export function sugerencias(ctx = {}) {
  const base = [];
  const r = ctx.role || 'ventas';
  const hayTrabajo = ctx.project_id || ctx.quote_id || (ctx.partidasLocales && ctx.partidasLocales.length);
  if (hayTrabajo) {
    base.push('¿Está lista para enviarse?', '¿Qué falta?');
    if (ctx.project_id || ctx.quote_id) base.push('¿Estamos en budget?');
    if (ctx.revision_id) base.push('¿Qué cambió entre revisiones?');
  }
  if (r === 'direccion' || r === 'cfo') base.push('¿Qué necesita mi atención?');
  if (r === 'costeador' || r === 'diseno') base.push('Analiza este mueble');
  base.push('¿Qué línea me sirve?');   // conocimiento de producto, útil para cualquiera
  if (!base.length) base.push('¿Qué necesita mi atención?', '¿Qué falta?');
  return base.slice(0, 5);
}
