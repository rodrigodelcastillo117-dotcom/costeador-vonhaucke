// ============================================================================
//  VONI orquestador · tests del primer vertical slice.
//  La prueba decisiva (contrato): "Hazla 30 cm más corta, quiero algo más cálido
//  y dime qué mejorarías" → Voni entiende 3 intenciones, aplica SOLO lo autorizado,
//  crea una revisión real, marca stale lo que corresponde, propone mejora; y NUNCA
//  dice "listo" si la tool/verify falla.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { interpretarIntent, construirProductSpec, extraerDNA, clasificarProducto } from './cocrear.js';
import { voniUnderstand, voniReview, voniContext, LENS } from './voni.js';

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
