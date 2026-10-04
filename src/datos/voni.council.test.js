// ============================================================================
//  VONI COUNCIL conectado al orquestador.  Contrato:
//  Council = PROPUESTA/CRÍTICA (execution PROPOSAL_ONLY). NUNCA ejecuta; el
//  validador determinista + ToolRegistry son los únicos que aplican. El desacuerdo
//  entre modelos jamás se oculta. Si el council cae, el orquestador sigue determinista.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { interpretarIntent } from './cocrear.js';
import {
  voniTurno, voniUnderstand, construirPeticionCouncil, resumenConsejo, voniContext,
} from './voni.js';

const intentRecepcion = () => { const i = interpretarIntent('recepción 2.40 m nogal iluminación'); i.dimensiones = { ancho_mm: 2400 }; return i; };
const estudio = (intent) => ({ spec: { familia: intent.familia, hash: 'h1' }, rev: 1, historiaLen: 0, renderState: 'ok', costState: { cost_status: 'KNOWN' } });

// Mock de la edge `voni-council` con la forma real.
const councilMock = (over = {}) => async () => ({
  ok: true,
  execution: 'PROPOSAL_ONLY',
  council: { status: 'CONSENSUS', decision: 'APPLY_EXPLICIT_CHANGE', requires_confirmation: false, provider_decisions: [{ provider: 'anthropic', decision: 'APPLY_EXPLICIT_CHANGE' }, { provider: 'gemini', decision: 'APPLY_EXPLICIT_CHANGE' }], ...(over.council || {}) },
  opinions: over.opinions || [{ ok: true, provider: 'anthropic', output: { decision: 'APPLY_EXPLICIT_CHANGE', recommendations: [{ category: 'ENGINEERING', what: 'Refuerza la ménsula', why: 'voladizo', requires_validation: true }], questions: [{ what: '¿uso intensivo?' }], blockers: [] } }],
});

const toolsBase = (extra = {}) => ({
  CREATE_REVISION: async (intent) => ({ ok: true, rev: 2, hash: 'h2-' + (intent?.dimensiones?.ancho_mm || 0) }),
  ...extra,
});

describe('construirPeticionCouncil', () => {
  it('task=interpret_change cuando hay cambios; request = mensaje; incluye lentes', () => {
    const u = voniUnderstand('Hazla 30 cm más corta', intentRecepcion());
    const ctx = voniContext(estudio(intentRecepcion()), 'direccion');
    const p = construirPeticionCouncil('Hazla 30 cm más corta', u, ctx);
    expect(p.task).toBe('interpret_change');
    expect(p.request).toMatch(/30 cm/);
    expect(Array.isArray(p.lenses)).toBe(true);
    expect(p.context.requested_changes.length).toBeGreaterThan(0);
  });
  it('task=review_product cuando sólo pide revisión', () => {
    const u = voniUnderstand('¿qué mejorarías?', intentRecepcion());
    const p = construirPeticionCouncil('¿qué mejorarías?', u, voniContext(estudio(intentRecepcion()), 'direccion'));
    expect(p.task).toBe('review_product');
  });
});

describe('resumenConsejo', () => {
  it('consolida recomendaciones/preguntas y marca desacuerdo', () => {
    const r = resumenConsejo({ execution: 'PROPOSAL_ONLY', council: { status: 'DISAGREEMENT', decision: 'REQUIRES_VALIDATION', provider_decisions: [{ provider: 'a', decision: 'APPLY_EXPLICIT_CHANGE' }, { provider: 'b', decision: 'BLOCK' }] }, opinions: [{ ok: true, output: { recommendations: [{ what: 'x' }], questions: [{ what: 'y' }], blockers: ['z'] } }] });
    expect(r.disagreement).toBe(true);
    expect(r.recommendations.length).toBe(1);
    expect(r.questions.length).toBe(1);
    expect(r.advertencias).toContain('z');
  });
  it('sin council ⇒ null', () => { expect(resumenConsejo(null)).toBeNull(); });
});

describe('voniTurno + COUNCIL', () => {
  it('consulta al council y lo expone como propuesta/crítica (no como acción ejecutada)', async () => {
    const intent = intentRecepcion();
    const r = await voniTurno('Hazla 30 cm más corta y dime qué mejorarías', { intentActual: intent, role: 'direccion', tools: toolsBase({ COUNCIL: councilMock() }), estudio: estudio(intent) });
    expect(r.council).toBeTruthy();
    expect(r.council.execution).toBe('PROPOSAL_ONLY');
    expect(r.response.council).toBeTruthy();
    // El cambio explícito SÍ se aplicó, pero por el camino determinista (CREATE_REVISION).
    expect(r.applied.length).toBeGreaterThan(0);
    expect(r.newRev).toBeTruthy();
    expect(r.trace.some((t) => t.step === 'validate' && t.ok)).toBe(true);
  });

  it('DISAGREEMENT se expone, nunca se oculta', async () => {
    const intent = intentRecepcion();
    const council = councilMock({ council: { status: 'DISAGREEMENT', decision: 'REQUIRES_VALIDATION', provider_decisions: [{ provider: 'a', decision: 'APPLY_EXPLICIT_CHANGE' }, { provider: 'b', decision: 'BLOCK' }] } });
    const r = await voniTurno('Hazla 30 cm más corta', { intentActual: intent, role: 'direccion', tools: toolsBase({ COUNCIL: council }), estudio: estudio(intent) });
    expect(r.council.disagreement).toBe(true);
    expect(r.trace.some((t) => t.step === 'council_disagreement')).toBe(true);
  });

  it('NUNCA ejecuta por "acuerdo" del council: sin cambio explícito válido, no crea revisión', async () => {
    const intent = interpretarIntent('mesa 1.20 m laminado'); intent.dimensiones = { ancho_mm: 1200 };
    let creada = false;
    const tools = { CREATE_REVISION: async () => { creada = true; return { ok: true, rev: 2, hash: 'hX' }; }, COUNCIL: councilMock() };
    // Mensaje sin cambio concreto (sólo opinión): aunque el council "apruebe", no hay qué ejecutar.
    const r = await voniTurno('¿qué opinas de este diseño?', { intentActual: intent, role: 'direccion', tools, estudio: estudio(intent) });
    expect(creada).toBe(false);
    expect(r.applied.length).toBe(0);
    expect(r.newRev).toBeFalsy();
  });

  it('council caído ⇒ el orquestador sigue determinista (aplica el cambio igual)', async () => {
    const intent = intentRecepcion();
    const councilRoto = async () => ({ ok: false, error: 'edge 503' });
    const r = await voniTurno('Hazla 30 cm más corta', { intentActual: intent, role: 'direccion', tools: toolsBase({ COUNCIL: councilRoto }), estudio: estudio(intent) });
    expect(r.council).toBeNull();
    expect(r.applied.length).toBeGreaterThan(0); // el determinismo no depende del council
    expect(r.trace.some((t) => t.step === 'council' && !t.ok)).toBe(true);
  });

  it('cambio fuera de rango: el VALIDADOR determinista bloquea aunque el council apruebe', async () => {
    const intent = intentRecepcion();
    const r = await voniTurno('hazla 5 m más larga', { intentActual: intent, role: 'direccion', tools: toolsBase({ COUNCIL: councilMock() }), estudio: estudio(intent) });
    expect(r.applied.length).toBe(0);         // el validador manda, no el council
    expect(r.blockers.length).toBeGreaterThan(0);
  });
});
