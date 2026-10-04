// ============================================================================
//  VONI orquestador · tests del primer vertical slice.
//  La prueba decisiva (contrato): "Hazla 30 cm más corta, quiero algo más cálido
//  y dime qué mejorarías" → Voni entiende 3 intenciones, aplica SOLO lo autorizado,
//  crea una revisión real, marca stale lo que corresponde, propone mejora; y NUNCA
//  dice "listo" si la tool/verify falla.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { interpretarIntent, construirProductSpec, extraerDNA, clasificarProducto } from './cocrear.js';
import { voniUnderstand, voniTurno, voniReview, voniContext, LENS } from './voni.js';

const intentRecepcion = () => { const i = interpretarIntent('recepción 2.40 m nogal iluminación'); i.dimensiones = { ancho_mm: 2400 }; return i; };
const specDe = (intent) => construirProductSpec(intent, extraerDNA(intent), clasificarProducto(intent, {}), { rev: 1 });

function toolsFake({ falla = false } = {}) {
  let rev = 1;
  return {
    CREATE_REVISION: async (intent) => {
      if (falla) return { ok: false, error: 'fallo simulado al guardar' };
      rev += 1;
      return { ok: true, rev, hash: specDe(intent).hash };
    },
  };
}

describe('VONI understand · 3 intenciones distintas en una frase', () => {
  const u = voniUnderstand('Hazla 30 cm más corta, quiero algo más cálido y dime qué mejorarías', intentRecepcion());
  it('detecta cambio dimensional (-300 mm)', () => {
    expect(u.requested_changes.some((c) => c.tipo === 'dimensional')).toBe(true);
    expect(u.intent.dimensiones.ancho_mm).toBe(2100);
  });
  it('detecta "más cálido" como cambio de material (nogal + ADN cálido)', () => {
    expect(u.requested_changes.some((c) => c.tipo === 'material')).toBe(true);
    expect(u.intent.materiales[0].material).toBe('nogal');
  });
  it('detecta la intención de REVIEW (no es un cambio)', () => {
    expect(u.wants_review).toBe(true);
    expect(u.proposed_actions.map((a) => a.tool)).toContain('REVIEW_PRODUCT');
    expect(u.proposed_actions.map((a) => a.tool)).toContain('CREATE_REVISION');
  });
  it('activa lentes DESIGN/ENGINEERING/MATERIALS', () => {
    expect(u.lenses).toEqual(expect.arrayContaining([LENS.DESIGN, LENS.ENGINEERING, LENS.MATERIALS]));
  });
  it('salida estructurada, no texto libre', () => { expect(Array.isArray(u.requested_changes)).toBe(true); expect(u.source).toBe('deterministic'); });
});

describe('VONI turno · ejecuta solo lo autorizado, crea revisión, invalida dependencias', () => {
  it('golden decisivo: aplica corta+cálida, crea Rev, review NO cambia, stale correcto', async () => {
    const intent = intentRecepcion();
    const estudio = { spec: specDe(intent), rev: 1, historiaLen: 1 };
    const r = await voniTurno('Hazla 30 cm más corta, quiero algo más cálido y dime qué mejorarías', { intentActual: intent, role: 'direccion', tools: toolsFake(), estudio });
    expect(r.ok).toBe(true);
    expect(r.newRev).toBeTruthy();
    expect(r.trace.some((t) => t.step === 'verify' && t.ok)).toBe(true);
    expect(r.applied.length).toBe(2);
    expect(r.stale).toEqual(expect.arrayContaining(['render', 'costo', 'placement', 'cotizacion']));
    expect(r.review).toBeTruthy();
  });

  it('tool failure ⇒ NUNCA dice "listo": reporta que no pudo', async () => {
    const intent = intentRecepcion();
    const r = await voniTurno('hazla 20 cm más corta', { intentActual: intent, tools: toolsFake({ falla: true }), estudio: { spec: specDe(intent), rev: 1 } });
    expect(r.ok).toBe(false);
    expect(r.newRev).toBeFalsy();
    expect(r.blockers.length).toBeGreaterThan(0);
    expect(r.response.humano).toMatch(/no pude/i);
    expect(r.stale).not.toContain('render');
  });

  it('cambio fuera de rango fabricable ⇒ bloqueado (validador determinista)', async () => {
    const intent = intentRecepcion();
    // 2.40 m + 5 m = 7.40 m, por encima del máximo fabricable (6.00 m).
    const r = await voniTurno('hazla 5 m más larga', { intentActual: intent, tools: toolsFake(), estudio: { spec: specDe(intent), rev: 1 } });
    expect(r.ok).toBe(false);
    expect(r.blockers.join(' ')).toMatch(/rango fabricable/i);
    expect(r.newRev).toBeFalsy();
  });

  it('petición de solo review ⇒ no crea revisión; "no cambiaría nada" en diseño simple', async () => {
    const intent = interpretarIntent('mesa 1.20 m laminado'); intent.dimensiones = { ancho_mm: 1200 };
    const r = await voniTurno('¿qué mejorarías?', { intentActual: intent, tools: toolsFake(), estudio: { spec: specDe(intent), rev: 1 } });
    expect(r.newRev).toBeFalsy();
    expect(r.review).toBeTruthy();
    expect(r.review.no_change).toBe(true);
  });
});

describe('VONI context · seller-safe', () => {
  it('un vendedor NO recibe estado de costo en el contexto', () => {
    const ctx = voniContext({ spec: { hash: 'h1' }, costState: { costo: 1234 } }, 'vendedor');
    expect(ctx.veCostos).toBe(false);
    expect(ctx.costState).toBeUndefined();
  });
  it('Dirección sí ve el estado de costo (interno)', () => {
    const ctx = voniContext({ spec: { hash: 'h1' }, costState: { estado: 'KNOWN' } }, 'direccion');
    expect(ctx.veCostos).toBe(true);
    expect(ctx.costState).toBeTruthy();
  });
});
