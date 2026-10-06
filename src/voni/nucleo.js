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
    materialesTecnicos: Array.isArray(p.materialesTecnicos) ? p.materialesTecnicos : [],
    // Trabajo VIVO del flujo principal (seller-safe + geometría del acomodo), para
    // que Voni analice lo que está EN PANTALLA, no sólo lo guardado en la BD
    // comercial. Si no se pasan aquí, el proveedor nunca los ve.
    partidasLocales: p.partidasLocales ?? null,
    acomodoLocal: p.acomodoLocal ?? null,
  };
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Evidencia mínima para NO confundir "no pude comprobar" con "todo bien".
// Se exige sólo lo imprescindible para la intención. Las tools económicas se
// agregan cuando el rol realmente puede verlas; un vendedor no queda bloqueado
// por no tener permisos de costo interno.
function requisitosEvidencia(intent, ctx = {}) {
  const base = {
    READINESS: ['get_project_context', 'get_reconciliation', 'get_quote', 'get_approvals', 'get_render_status'],
    DIFF: ['compare_revisions'],
    GAPS: ['get_reconciliation', 'get_quote'],
    BUDGET: ['get_project_context', 'get_quote'],
    ATTENTION: ['get_today_attention'],
    COSTING_ANALYSIS: [],
    INDUSTRIAL_IMPROVEMENT: ['get_industrial_analysis'],
    MATERIAL_TECHNICAL: ['get_material_technical'],
    RISK: [],
    LAYOUT: ['get_reconciliation', 'get_layout'],
  }[intent] || [];
  if (['READINESS', 'COSTING_ANALYSIS', 'RISK'].includes(intent)
      && rolVeEconomia(ctx.role) && !ctx.clientSafe) {
    return [...new Set([...base, 'get_costing', ...(intent === 'COSTING_ANALYSIS' || intent === 'READINESS' ? ['get_bom'] : [])])];
  }
  return base;
}

function respuestaSinPermisoEconomico(intent, denegadas = [], resultadosLente = []) {
  const lentes = resultadosLente.map((r) => r.lente);
  const detalle = denegadas.join(', ');
  return respuestaEstructurada({
    que_paso: 'No puedo confirmar el análisis económico con este rol.',
    por_que: `La consulta requiere información económica interna no autorizada: ${detalle}.`,
    impacto: 'No se interpreta la ausencia de permiso como costo/margen correcto.',
    confianza: 0,
    accion: 'Abrir la consulta con un rol autorizado o revisar una vista seller-safe sin economía.',
    evidencia: [],
    urgencia: URGENCIA.BAJA,
    estado: ESTADO.DESCONOCIDO,
    lentes,
    bloqueos: [{
      titulo: 'Información económica restringida',
      detalle: `Sin permiso para: ${detalle}.`,
      urgencia: URGENCIA.BAJA,
    }],
  });
}

function respuestaSinEvidencia(intent, faltantes, resultadosLente = []) {
  const evidencia = [];
  const lentes = resultadosLente.map((r) => r.lente);
  const detalle = faltantes.join(', ');
  return respuestaEstructurada({
    que_paso: intent === 'READINESS'
      ? 'No puedo confirmar que esté lista para enviarse.'
      : 'No puedo confirmar el resultado todavía.',
    por_que: `Falta evidencia de fuente: ${detalle}.`,
    impacto: 'La ausencia de datos no se interpreta como PASS.',
    confianza: 0,
    accion: 'Recuperar esas fuentes y volver a revisar.',
    evidencia,
    urgencia: URGENCIA.ALTA,
    estado: ESTADO.DESCONOCIDO,
    lentes,
    bloqueos: [{ titulo: 'Evidencia insuficiente', detalle: `No respondieron: ${detalle}.`, urgencia: URGENCIA.ALTA }],
  });
}

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
  // CONOCIMIENTO TÉCNICO DE MATERIAL: formato físico/unidad/veta, SIN economía.
  if (/\b(mide|medida|medidas|formato|hoja|tablero|veta|espesor|ptr|perfil)\b/.test(q)
      && /\b(material|mdf|melamina|laminado|tablero|hoja|ptr|perfil|acero|aluminio|cristal|madera)\b/.test(q)) {
    return {
      intent: 'MATERIAL_TECHNICAL', modo: MODOS.CONSULTAR,
      lentes: ['conocimiento'], tools: ['get_material_technical'],
    };
  }

  // CONOCIMIENTO DE PRODUCTO (qué línea sirve, materiales, a la medida). Va ANTES
  // que COSTING para que "¿qué mueble me sirve?" no se confunda con "costéame".
  if (/(que linea|recomiend|sugier|me sirve|sirve para|de que est|a la medida|que producto|catalogo|que mueble|codigo|modelo|variante|mampara|cancel|biombo)/.test(q)) {
    return { intent: 'KNOWLEDGE', modo, lentes: ['conocimiento'], tools: ['get_catalog_knowledge','search_products'] };
  }
  if (/\b(mejor\w*|optimiz\w*|desarroll\w* producto|despiece|despiez\w*|merma\w*|desperdici\w*|eficien\w*|nesting|corte\w*|aprovech\w*|fabricab\w*)\b/.test(q)) {
    return {
      intent: 'INDUSTRIAL_IMPROVEMENT',
      modo: MODOS.PROPONER,
      lentes: ['industrial', 'costeador'],
      tools: ['get_industrial_analysis', 'get_costing', 'get_bom', 'get_render_status'],
    };
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

function respuestaMaterialTecnico(k) {
  const items = Array.isArray(k?.items) ? k.items : [];
  if (!k || k.disponible === false || !items.length) {
    return respuestaEstructurada({
      que_paso: 'No encontré una ficha técnica verificable para ese material.',
      por_que: k?.nota || 'El catálogo técnico cargado no tiene coincidencia suficiente.',
      impacto: 'No invento medidas de hoja/formato.',
      confianza: 0,
      accion: 'Confirma la clave/nombre del material o carga su ficha técnica.',
      evidencia: [], urgencia: URGENCIA.MEDIA, estado: ESTADO.DESCONOCIDO,
      lentes:['conocimiento'], bloqueos:[],
    });
  }
  const evidencia = items.slice(0,5).map((m)=>afirmacion(
    `${m.nombre}: ${m.formato_texto || 'formato no documentado'} · unidad ${m.unidad || 'N/D'}.`,
    TIPO_AFIRMACION.HECHO,
    { source_type:'catalogo_tecnico_materiales', source_id:m.id, confidence:1 },
  ));
  const top=items[0];
  return respuestaEstructurada({
    que_paso: `${top.nombre}: ${top.formato_texto || 'formato físico no documentado'}.`,
    por_que: `Ficha técnica cargada · unidad ${top.unidad || 'N/D'}${top.veta?' · material con veta':''}.`,
    impacto: 'Este formato puede alimentar validación de corte/nesting; no contiene precio ni costo.',
    confianza: 1,
    accion: items.length>1 ? 'Si buscabas otra variante, dime la clave o nombre más exacto.' : 'Usar este formato para validar piezas y aprovechamiento.',
    evidencia, urgencia:URGENCIA.BAJA, estado:ESTADO.OK,
    lentes:['conocimiento'], bloqueos:[],
  });
}

function respuestaIndustrial(a, resultadosLente = []) {
  if (!a || a.disponible === false) {
    return respuestaSinEvidencia('INDUSTRIAL_IMPROVEMENT', ['get_industrial_analysis'], resultadosLente);
  }
  const recomendaciones = Array.isArray(a.recomendaciones) ? a.recomendaciones : [];
  const bloqueos = Array.isArray(a.bloqueos) ? a.bloqueos.map((b) => ({
    titulo: b.titulo || b.code || 'Bloqueo industrial',
    detalle: b.detalle || '',
    urgencia: URGENCIA.ALTA,
  })) : [];
  const evidencia = [];
  for (const h of a.hallazgos || []) {
    if (h.tipo === 'CORTE_2D') {
      evidencia.push(afirmacion(
        `${h.material}: eficiencia de corte advisory ${h.eficiencia_pct ?? 'N/D'}%.`,
        TIPO_AFIRMACION.HECHO,
        { source_type:'motor_corte', confidence:h.completo ? 0.9 : 0.6 },
      ));
    }
  }
  for (const r of recomendaciones) {
    evidencia.push(afirmacion(
      `${r.accion}${r.ahorro_certificado === false ? ' · ahorro potencial, NO certificado' : ''}`,
      TIPO_AFIRMACION.RECOMENDACION,
      { source_type:'analisis_industrial', confidence:r.confianza ?? 0.7 },
    ));
  }

  const principal = recomendaciones[0] || null;
  const hayBloqueos = bloqueos.length > 0;
  const nMejoras = recomendaciones.length;
  return respuestaEstructurada({
    que_paso: hayBloqueos
      ? `${bloqueos.length} bloqueo(s) industrial(es) y ${nMejoras} mejora(s) detectada(s).`
      : nMejoras
        ? `${nMejoras} mejora(s) concreta(s) detectada(s).`
        : 'No detecté una mejora industrial demostrable con la evidencia disponible.',
    por_que: principal?.accion || bloqueos[0]?.detalle || 'No hay señal determinista suficiente para recomendar un cambio.',
    impacto: nMejoras
      ? 'Puede mejorar fabricabilidad, uso de material o eficiencia. El ahorro sigue siendo potencial hasta validarlo con Producción.'
      : 'No se atribuye ahorro sin evidencia.',
    confianza: confianzaDe(evidencia),
    accion: hayBloqueos
      ? `Resolver primero: ${bloqueos[0].titulo}.`
      : principal?.accion || 'Mantener la revisión actual y seguir midiendo datos reales.',
    evidencia,
    urgencia: hayBloqueos ? URGENCIA.ALTA : (nMejoras ? URGENCIA.MEDIA : URGENCIA.BAJA),
    estado: hayBloqueos ? ESTADO.ATENCION : (nMejoras ? ESTADO.ATENCION : ESTADO.OK),
    lentes: resultadosLente.map((r) => r.lente),
    bloqueos,
  });
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
    const nombreLinea=(r)=>r.linea||r.nombre||r.ruta||'Línea Von Haucke';
    que_paso = `Te sirve revisar: ${k.recomendaciones.map(nombreLinea).join(', ')}.`;
    por_que = k.recomendaciones.map((r) => {
      const piezas=(r.productos||[]).slice(0,4).map((p)=>p.nombre||p.id).filter(Boolean);
      return `${nombreLinea(r)}${r.que?` — ${r.que}`:''}${piezas.length?` · variantes: ${piezas.join(', ')}`:''}`;
    }).join(' · ');
    for (const r of k.recomendaciones) evidencia.push(afirmacion(
      `${nombreLinea(r)}: ${r.que || `${(r.productos||[]).length} producto(s)/variante(s) en el registro canónico`}.`,
      TIPO_AFIRMACION.HECHO,
      { source_type: 'catalogo', confidence: 1 },
    ));
  } else if (k.linea) {
    const nom=k.linea.linea||k.linea.nombre||k.linea.ruta||'Línea Von Haucke';
    que_paso = `${nom}${k.linea.que?`: ${k.linea.que}`:'.'}`;
    por_que = `Registro canónico: ${(k.linea.productos || []).slice(0,8).map((p)=>p.nombre||p.id).join(', ') || 'sin variantes detalladas'}.`;
  } else {
    que_paso = 'Von Haucke fabrica casi todo a la medida. Dime el mueble o la zona (sala de juntas, privado, recepción, lounge…) y te recomiendo la línea.';
  }
  const productosReales = Array.isArray(k.productos_reales) ? k.productos_reales : [];
  if (productosReales.length) {
    const top = productosReales.slice(0, 6);
    const txt = top.map((p) => [p.codigo, p.nombre, p.familia ? `[${p.familia}]` : null].filter(Boolean).join(' · ')).join(' | ');
    por_que = `${por_que ? por_que + ' · ' : ''}Producto Maestro encontró coincidencias reales: ${txt}.`;
    for (const p of top) evidencia.push(afirmacion(
      `Producto Maestro #${p.id}: ${p.nombre}${p.codigo ? ` (${p.codigo})` : ''}.`,
      TIPO_AFIRMACION.HECHO,
      { source_type:'producto_maestro', source_id:p.id, confidence:1 },
    ));
  }
  if (k.esAMedida || k.a_la_medida_disponible) por_que = `${por_que ? por_que + ' · ' : ''}Si ningún producto real resuelve el brief, Von Haucke puede desarrollarlo a la medida; si existe un padre real, VONI debe conservar ese linaje.`;
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
  try {
  const contexto = construirContexto(ctx || {});
  const plan = intentForzado
    ? { intent: intentForzado, modo: MODOS.ANALIZAR, lentes: [lenteEfectiva(contexto.role).lente], tools: ['get_project_context', 'get_reconciliation'] }
    : inferirIntencion(query, contexto);

  // CONOCIMIENTO DE PRODUCTO: responde directo desde el catálogo (sin lentes de
  // readiness). Mantiene el MISMO contrato de respuesta, así la UI no cambia.
  if (plan.intent === 'KNOWLEDGE') {
    const [rk,rp] = await Promise.all([
      ejecutarTool('get_catalog_knowledge', contexto, { ...contexto, query }, prov),
      ejecutarTool('search_products', contexto, { ...contexto, query }, prov),
    ]);
    const knowledge = rk.ok ? { ...(rk.data || {}), productos_reales: rp.ok ? (rp.data || []) : [] } : null;
    const respuesta = respuestaConocimiento(knowledge);
    const obs = registrar({ ctx: contexto, intent: plan.intent, lentes: plan.lentes, tools: ['get_catalog_knowledge','search_products'], resultStatus: respuesta.estado, duration: Date.now() - t0 });
    return { respuesta, intent: plan.intent, modo: plan.modo, observabilidad: obs };
  }

  // Llamar tools (cada una con auth+permiso+sanitización). Las económicas que el
  // rol no puede ver simplemente fallan con sin_permiso y NO entran en `datos`.
  // La consulta viaja en args (`query`) para las tools que la usan (conocimiento).
  const datos = {};
  const toolsLlamadas = [];
  const fallosTool = {};
  for (const nombre of plan.tools) {
    const res = await ejecutarTool(nombre, contexto, { ...contexto, query }, prov);
    toolsLlamadas.push(nombre);
    if (res.ok) datos[nombre] = res.data;
    else fallosTool[nombre] = res;
  }

  // Correr lentes (ángulo); los datos económicos faltantes no se pueden exponer.
  const resultadosLente = plan.lentes.map((l) => correrLente(l, datos, contexto));

  // FAIL-CLOSED DE EVIDENCIA: antes, si una consulta crítica fallaba, las lentes
  // veían {} y podían producir cero bloqueos => "Lista para enviarse". Ahora la
  // falta de una fuente requerida produce DESCONOCIDO, nunca OK.
  const requeridas = requisitosEvidencia(plan.intent, contexto);
  const faltantes = requeridas.filter((nombre) => datos[nombre] == null);
  const denegadasEconomia = Object.entries(fallosTool)
    .filter(([nombre, r]) => ['get_costing', 'get_bom', 'get_industrial_analysis'].includes(nombre) && r?.error === 'sin_permiso')
    .map(([nombre]) => nombre);
  const consultaEconomicaDirecta = ['COSTING_ANALYSIS', 'RISK', 'INDUSTRIAL_IMPROVEMENT'].includes(plan.intent);

  const respuesta = (consultaEconomicaDirecta && denegadasEconomia.length)
    ? respuestaSinPermisoEconomico(plan.intent, denegadasEconomia, resultadosLente)
    : faltantes.length
      ? respuestaSinEvidencia(plan.intent, faltantes, resultadosLente)
      : plan.intent === 'MATERIAL_TECHNICAL'
        ? respuestaMaterialTecnico(datos.get_material_technical)
        : plan.intent === 'INDUSTRIAL_IMPROVEMENT'
          ? respuestaIndustrial(datos.get_industrial_analysis, resultadosLente)
          : sintetizar(plan.intent, resultadosLente);

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
  } catch (e) {
    // "Nunca lanza": ante cualquier fallo inesperado responde DESCONOCIDO en vez de
    // romper la UI, y NO afirma que algo esté "listo".
    const respuesta = respuestaEstructurada({
      que_paso: 'No pude revisar ahora.', por_que: String(e && e.message ? e.message : e).slice(0, 140),
      estado: ESTADO.DESCONOCIDO, urgencia: URGENCIA.BAJA, evidencia: [], bloqueos: [], lentes: [],
    });
    return { respuesta, intent: 'ERROR', modo: MODOS.CONSULTAR, observabilidad: null };
  }
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
  if (r === 'costeador' || r === 'diseno') base.push('Analiza este mueble', '¿Cómo lo mejorarías para fabricar mejor y desperdiciar menos?');
  if (!base.length) base.push('¿Qué necesita mi atención?', '¿Qué falta?');
  base.push('¿Qué línea me sirve?');   // conocimiento de producto, útil para cualquiera
  return base.slice(0, 5);
}
