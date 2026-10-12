// ============================================================================
//  VONI COUNCIL conectado al orquestador.  Contrato:
//  Council = PROPUESTA/CRÍTICA (execution PROPOSAL_ONLY). NUNCA ejecuta; el
//  validador determinista + ToolRegistry son los únicos que aplican. El desacuerdo
//  entre modelos jamás se oculta. Si el council cae, el orquestador sigue determinista.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { interpretarIntent } from './cocrear.js';
import {
  voniUnderstand, construirPeticionCouncil, resumenConsejo, voniContext,
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

