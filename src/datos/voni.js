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

const sinAc = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const LENS = Object.freeze({ DESIGN: 'DESIGN', MATERIALS: 'MATERIALS', ENGINEERING: 'ENGINEERING', COST: 'COST', MANUFACTURING: 'MANUFACTURING', SPACE: 'SPACE', COMMERCIAL: 'COMMERCIAL' });
export const EVID = Object.freeze({ FACT: 'FACT', RULE: 'RULE', INFERENCE: 'INFERENCE', SUGGESTION: 'SUGGESTION', REQUIRES_VALIDATION: 'REQUIRES_VALIDATION' });

const REVIEW_RE = /mejorar|revisa|revisar|recomiend|sugier|que cambiarias|que opinas|ves algo|mejorarias/;

const specDe = (intent) => construirProductSpec(intent, extraerDNA(intent), clasificarProducto(intent, {}), { rev: 1 });

// --- CONTEXT · seller-safe ANTES del modelo/respuesta (nunca costo/margen a ventas).
export function voniContext(estudio = {}, role = 'direccion') {
  const veCostos = /direccion|direcci|diseno|diseño|admin/.test(sinAc(role));
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

// Frase humana + contrato interno (WHAT/WHY/IMPACT/CONFIDENCE/EVIDENCE/BLOCKERS/NEXT).
function construirRespuesta({ u, applied, newRev, stale, blockers, review }) {
  const partes = [];
  if (applied.length) partes.push(`Apliqué: ${applied.map(humanCambio).join(', ')} (Rev ${newRev.rev}).`);
  if (u.wants_review && review) {
    const total = review.risks.length + review.missing_decisions.length + review.maintenance.length + review.manufacturability.length;
    partes.push(review.no_change ? 'No veo una mejora técnica justificable: lo dejaría así.' : `Revisé el diseño y veo ${total} punto(s) que vale la pena considerar.`);
  }
  if (u.proposals) partes.push('Veo varios caminos — dime cuál prefieres.');
  if (!applied.length && !u.wants_review && !u.proposals) partes.push(u.questions[0] || 'No entendí un cambio concreto.');
  if (blockers.length) partes.push(`No pude aplicar todo: ${blockers.join('; ')}.`);

  const next_actions = [];
  if (stale.includes('render')) next_actions.push('regenerar render');
  if (stale.includes('cotizacion')) next_actions.push('actualizar cotización (nueva revisión disponible)');

  return {
    humano: partes.join(' '),
    what: applied.length ? etiquetaDe(applied) : (u.wants_review ? 'revisión de diseño' : 'sin cambio'),
    why: u.message,
    impact: stale,
    confidence: u.confidence,
    evidence: u.evidence,
    blockers,
    next_actions,
  };
}

// --- ORQUESTADOR · el loop completo. `tools` = ActionExecutor (CREATE_REVISION,
//     REVIEW_PRODUCT). `estudio` = estado actual (spec, rev, ...). role = rol.
export async function voniTurno(message, { intentActual, role = 'direccion', tools = {}, estudio = {} } = {}) {
  const trace = [];
  const u = voniUnderstand(message, intentActual);
  trace.push({ step: 'understand', ok: true, lenses: u.lenses, changes: u.requested_changes.length, review: u.wants_review });

  const sv = validarSalidaUnderstand(u);
  if (!sv.ok) return { ok: false, understand: u, trace: [...trace, { step: 'schema', ok: false, error: sv.error }], response: { humano: 'No pude estructurar la petición.', blockers: [sv.error], next_actions: [] }, applied: [], stale: [], blockers: [sv.error] };

  const ctx = voniContext(estudio, role);
  trace.push({ step: 'context', ok: true, veCostos: ctx.veCostos });

  const applied = []; const stale = []; const blockers = []; let newRev = null;

  // EXECUTE · sólo lo autorizado (los cambios concretos). La review NO cambia nada.
  if (u.requested_changes.length) {
    const vc = validarCambios(u.requested_changes, u.intent);
    if (!vc.ok) { blockers.push(vc.error); trace.push({ step: 'validate', ok: false, error: vc.error }); }
    else {
      trace.push({ step: 'validate', ok: true });
      try {
        const r = await tools.CREATE_REVISION?.(u.intent, etiquetaDe(u.requested_changes));
        if (r?.ok && r.hash && r.hash !== ctx.specHash) {
          newRev = r; applied.push(...u.requested_changes);
          trace.push({ step: 'execute', ok: true, rev: r.rev });
          trace.push({ step: 'verify', ok: true, hash: r.hash });
        } else if (r?.ok && r.hash === ctx.specHash) {
          blockers.push('El cambio no produjo una revisión distinta.');
          trace.push({ step: 'verify', ok: false });
        } else {
          blockers.push(r?.error || 'No pude aplicar el cambio.');
          trace.push({ step: 'execute', ok: false, error: r?.error });
        }
      } catch (e) {
        blockers.push('No pude aplicar el cambio: ' + String(e?.message || e));
        trace.push({ step: 'execute', ok: false, error: String(e?.message || e) });
      }
    }
  }

  // DEPENDENCY INVALIDATION · sólo si de verdad hubo nueva revisión.
  if (newRev) {
    const tipos = new Set(u.requested_changes.map((c) => c.tipo));
    stale.push('render');
    if (tipos.has('dimensional') || tipos.has('material') || tipos.has('feature') || tipos.has('acabado')) stale.push('costo');
    if (tipos.has('dimensional')) stale.push('placement');
    stale.push('cotizacion');
    trace.push({ step: 'invalidate', ok: true, stale });
  }

  // REVIEW · sólo propone, no aplica.
  let review = null;
  if (u.wants_review) {
    try { review = tools.REVIEW_PRODUCT ? await tools.REVIEW_PRODUCT(u.intent) : voniReview(specDe(u.intent)); trace.push({ step: 'review', ok: true }); }
    catch (e) { trace.push({ step: 'review', ok: false, error: String(e?.message || e) }); }
  }

  const response = construirRespuesta({ u, applied, newRev, stale, blockers, review });
  return { ok: blockers.length === 0, understand: u, applied, newRev, stale, blockers, review, trace, response };
}
