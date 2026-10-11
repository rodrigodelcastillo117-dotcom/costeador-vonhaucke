// ============================================================================
//  VONI · orquestador de la capa de inteligencia (vertical slice 1).
//
//  FÓRMULA (contrato): VONI PROPONE → SISTEMA ESTRUCTURA → VALIDADORES
//  DETERMINISTAS COMPRUEBAN → ACTION TOOL → VERIFY → INVALIDAR DEPENDENCIAS →
//  RESPUESTA. Nunca "IA dijo = verdad"; nunca "Listo" si la tool/verify falló.
//
//  La capa que INTERPRETA/PROPONE hoy usa el baseline DETERMINISTA (safety net,
//  sin quemar créditos): `aplicarCambioTexto` + `sugerenciasVoni`. Es una costura:
//  el proveedor `understand`/`review` se puede sustituir por un modelo de IA sin
//  tocar el orquestador ni los validadores. NO es "IA inteligente" todavía — está
//  etiquetado honestamente con source:'deterministic'.
//
//  Arquitectura mínima (crece después): VoniContext (seller-safe) · LensRegistry ·
//  understand (structured output) · StructuredOutputValidator · validadores
//  deterministas · ToolRegistry/ActionExecutor · dependency invalidation ·
//  RecommendationEngine (REVIEW_PRODUCT) · Observability (trace).
// ============================================================================
import { aplicarCambioTexto, sugerenciasVoni, construirProductSpec, extraerDNA, clasificarProducto } from './cocrear.js';
import { veCostosCosteo } from './roles.js';

const sinAc = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const LENS = Object.freeze({ DESIGN: 'DESIGN', MATERIALS: 'MATERIALS', ENGINEERING: 'ENGINEERING', COST: 'COST', MANUFACTURING: 'MANUFACTURING', SPACE: 'SPACE', COMMERCIAL: 'COMMERCIAL' });
export const EVID = Object.freeze({ FACT: 'FACT', RULE: 'RULE', INFERENCE: 'INFERENCE', SUGGESTION: 'SUGGESTION', REQUIRES_VALIDATION: 'REQUIRES_VALIDATION' });

const REVIEW_RE = /mejorar|revisa|revisar|recomiend|sugier|que cambiarias|que opinas|ves algo|mejorarias/;

const specDe = (intent) => construirProductSpec(intent, extraerDNA(intent), clasificarProducto(intent, {}), { rev: 1 });

// --- CONTEXT · seller-safe ANTES del modelo/respuesta (nunca costo/margen a ventas).
export function voniContext(estudio = {}, role = 'direccion') {
  const veCostos = veCostosCosteo(role);   // VH-054: espejo del servidor; 'admin' ya no cuela
  const ctx = {
    role, veCostos,
    familia: estudio?.spec?.familia || null,
    revActual: estudio?.rev || 1,
    historiaLen: estudio?.historiaLen || 0,
    renderState: estudio?.renderState || 'none',
    specHash: estudio?.spec?.hash || null,
  };
  if (veCostos) ctx.costState = estudio?.costState || null;   // SÓLO interno
  return ctx;
}

// --- VONI COUNCIL · capa de razonamiento multi-modelo (edge). SÓLO propone/critica.
//     Construye la petición { task, request, context, constraints, lenses } y resume
//     la respuesta del council para la UI. NUNCA ejecuta: el validador determinista y
//     el ToolRegistry son los únicos que aplican cambios.
export function construirPeticionCouncil(message, u, ctx, constraints = []) {
  const task = u.requested_changes.length ? 'interpret_change' : (u.wants_review ? 'review_product' : 'general');
  return {
    task,
    request: message,
    context: {
      familia: ctx.familia, rev_actual: ctx.revActual, render_state: ctx.renderState,
      spec_hash: ctx.specHash, historia_len: ctx.historiaLen,
      requested_changes: u.requested_changes,
      // cost_state SÓLO si el rol ve costos (ctx ya lo gatea); el server re-sanitiza.
      cost_state: ctx.costState || null,
    },
    constraints,
    lenses: u.lenses,
  };
}

// Consolida la respuesta del council para la UI: estado, decisión, desacuerdo
// explícito (jamás se oculta), recomendaciones/preguntas/bloqueos (ya seller-safe
// server-side). Degrada a null si no hay council.
export function resumenConsejo(council) {
  if (!council || !council.council) return null;
  const okOps = (council.opinions || []).filter((o) => o && o.ok && o.output);
  const recs = okOps.flatMap((o) => o.output.recommendations || []);
  const questions = okOps.flatMap((o) => o.output.questions || []);
  const blockers = okOps.flatMap((o) => o.output.blockers || []);
  return {
    status: council.council.status,
    decision: council.council.decision,
    requires_confirmation: !!council.council.requires_confirmation,
    disagreement: council.council.status === 'DISAGREEMENT',
    modelos: okOps.length,   // modelos que respondieron OK (SINGLE_PROVIDER no trae provider_decisions)
    provider_decisions: council.council.provider_decisions || [],
    recommendations: recs.slice(0, 5),
    questions: questions.slice(0, 5),
    advertencias: blockers.slice(0, 5),   // advisory (no bloquean emisión; eso es determinista)
    execution: council.execution || 'PROPOSAL_ONLY',
  };
}

// --- LENS REGISTRY · qué lentes activar según la petición.
export function seleccionarLentes(requested_changes = [], wants_review = false) {
  const L = new Set();
  for (const c of requested_changes) {
    if (c.tipo === 'dimensional' || c.tipo === 'forma') { L.add(LENS.DESIGN); L.add(LENS.ENGINEERING); }
    if (c.tipo === 'material' || c.tipo === 'acabado') { L.add(LENS.MATERIALS); L.add(LENS.DESIGN); }
    if (c.tipo === 'feature') { L.add(LENS.DESIGN); L.add(LENS.MANUFACTURING); }
  }
  if (wants_review) { L.add(LENS.ENGINEERING); L.add(LENS.MATERIALS); L.add(LENS.COST); L.add(LENS.MANUFACTURING); }
  if (!L.size) L.add(LENS.DESIGN);
  return [...L];
}

// --- UNDERSTAND · salida ESTRUCTURADA (no texto libre).
export function voniUnderstand(message, intentActual) {
  const res = aplicarCambioTexto(intentActual, message);
  const wants_review = REVIEW_RE.test(sinAc(message));
  let requested_changes = [], nextIntent = intentActual, questions = [], proposals = null;
  if (res.tipo === 'aplicado') { requested_changes = res.cambios; nextIntent = res.intent; }
  else if (res.tipo === 'propuestas') { proposals = res.propuestas; questions = ['¿Cuál de estos caminos prefieres?']; }
  else if (res.tipo === 'nada' && !wants_review) { questions = [res.mensaje || 'No entendí un cambio concreto.']; }

  const proposed_actions = [];
  if (requested_changes.length) proposed_actions.push({ tool: 'CREATE_REVISION', changes: requested_changes });
  if (wants_review) proposed_actions.push({ tool: 'REVIEW_PRODUCT' });

  return {
    source: 'deterministic',
    message,
    intent: nextIntent,
    requested_changes, questions, proposals, wants_review,
    lenses: seleccionarLentes(requested_changes, wants_review),
    confidence: (requested_changes.length || wants_review) ? 'media' : 'baja',
    evidence: EVID.RULE,
    required_validation: [],
    proposed_actions,
  };
}

// StructuredOutputValidator: el entendimiento debe cumplir el esquema mínimo.
export function validarSalidaUnderstand(u) {
  if (!u || typeof u !== 'object') return { ok: false, error: 'salida vacía' };
  if (!Array.isArray(u.requested_changes)) return { ok: false, error: 'requested_changes inválido' };
  if (!Array.isArray(u.proposed_actions)) return { ok: false, error: 'proposed_actions inválido' };
  return { ok: true };
}

// Validadores DETERMINISTAS de los cambios (geometría/reglas) antes de ejecutar.
export function validarCambios(requested_changes, nextIntent) {
  const ancho = nextIntent?.dimensiones?.ancho_mm;
  if (requested_changes.some((c) => c.tipo === 'dimensional')) {
    if (!(ancho >= 300 && ancho <= 6000)) return { ok: false, error: `Ancho fuera de rango fabricable (${ancho} mm). Debe estar entre 0.30 y 6.00 m.` };
  }
  return { ok: true };
}

// --- RECOMMENDATION ENGINE · REVIEW_PRODUCT (reusa sugerenciasVoni, clasificado).
export function voniReview(spec) {
  const base = sugerenciasVoni(spec);
  const rec = (s, evid) => ({
    type: s.tipo, title: s.que, what: s.que, why: s.porque,
    impact: s.impacto, economic_impact: null,
    technical_impact: s.impacto === 'estructural' ? s.porque : null,
    visual_impact: null, confidence: s.confianza || 'media', evidence: evid,
    required_validation: s.tipo === 'validacion' ? ['ingeniería'] : [],
    proposed_action: s.accion || null,
  });
  const out = { risks: [], opportunities: [], value_engineering: [], durability: [], manufacturability: [], maintenance: [], missing_decisions: [], no_change: false };
  for (const s of base) {
    if (s.tipo === 'riesgo') out.risks.push(rec(s, EVID.INFERENCE));
    else if (s.tipo === 'validacion') out.manufacturability.push(rec(s, EVID.REQUIRES_VALIDATION));
    else if (s.tipo === 'decision') out.missing_decisions.push(rec(s, EVID.RULE));
    else if (s.tipo === 'mantenimiento') out.maintenance.push(rec(s, EVID.RULE));
  }
  out.no_change = base.length > 0 && base.every((s) => s.tipo === 'ok');
  return out;
}

const etiquetaDe = (changes) => changes.map((c) => `${c.campo}: ${c.a}`).join(' · ');

// Etiqueta HUMANA de un cambio (para la respuesta al cliente).
const humanCambio = (c) => {
  if (c.tipo === 'dimensional') return `ancho ${(Number(c.a) / 1000).toFixed(2)} m`;
  if (c.tipo === 'material') return `material ${c.a}`;
  if (c.tipo === 'acabado') return `tono ${c.a}`;
  if (c.tipo === 'forma') return `forma ${c.a}`;
  if (c.tipo === 'feature') return String(c.a).replace(/_/g, ' ');
  return String(c.a);
};

// B7 (2026-10-11): el orquestador `voniTurno` (propone→valida→ejecuta) se retiró: prod 0, sólo lo
// probaban 3 archivos de tests. La capa viva es CocrearV3 + edge voni-council (propuesta, nunca ejecución).
