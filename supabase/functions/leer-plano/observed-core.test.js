import { describe, it, expect } from 'vitest';
import { validarItemObservado, validarProgramaObservado, ORIGEN, KIND } from './observed-core.js';

const ctx = { envelopeW: 10000, envelopeH: 8000, zoneNames: new Set(['Open', 'Juntas']), maxPage: 3 };
const ok = (over = {}) => ({
  kind: 'furniture', type: 'bench', quantity: 4, capacity_per_unit: 2,
  zone: 'Open', position: { x: 1000, y: 2000 }, page: 1, confidence: 0.8,
  evidence: 'dibujado en planta', origin: 'observed', ...over,
});

describe('observed-core · validador determinista del edge (ChatGPT P0-R8-2)', () => {
  it('item observed válido → sin issues, cuenta como real', () => {
    const it = validarItemObservado(ok(), ctx);
    expect(it.issues).toEqual([]);
    expect(it.review_required).toBe(false);
    expect(it.capacity_total).toBe(8);   // 4 × 2 puestos, no "8 benches"
    expect(it.source_ref).toBeNull();
  });

  it('quantity ≤ 0 → CANTIDAD_INVALIDA', () => {
    expect(validarItemObservado(ok({ quantity: 0 }), ctx).issues).toContain('CANTIDAD_INVALIDA');
    expect(validarItemObservado(ok({ quantity: -3 }), ctx).issues).toContain('CANTIDAD_INVALIDA');
  });

  it('capacity_total ≤ 0 (explícito) → CAPACIDAD_TOTAL_INVALIDA', () => {
    expect(validarItemObservado(ok({ capacity_per_unit: undefined, capacity_total: 0 }), ctx).issues).toContain('CAPACIDAD_TOTAL_INVALIDA');
  });

  it('dimensión 0/negativa → DIMENSION_INVALIDA', () => {
    expect(validarItemObservado(ok({ dimensions: { w: 0, d: 600 } }), ctx).issues).toContain('DIMENSION_INVALIDA');
    expect(validarItemObservado(ok({ dimensions: { w: -1, d: 600 } }), ctx).issues).toContain('DIMENSION_INVALIDA');
  });

  it('posición fuera de la envolvente → POSICION_FUERA_DE_ENVOLVENTE; no finita → POSICION_NO_FINITA', () => {
    expect(validarItemObservado(ok({ position: { x: 99999, y: 10 } }), ctx).issues).toContain('POSICION_FUERA_DE_ENVOLVENTE');
    expect(validarItemObservado(ok({ position: { x: 'na', y: 10 } }), ctx).issues).toContain('POSICION_NO_FINITA');
  });

  it('zona inexistente → ZONA_DESCONOCIDA (debe existir en el FloorSpec)', () => {
    expect(validarItemObservado(ok({ zone: 'Terraza' }), ctx).issues).toContain('ZONA_DESCONOCIDA');
  });

  it('página inválida o fuera de rango → PAGINA_INVALIDA / PAGINA_FUERA_DE_RANGO', () => {
    expect(validarItemObservado(ok({ page: 0 }), ctx).issues).toContain('PAGINA_INVALIDA');
    expect(validarItemObservado(ok({ page: 1.5 }), ctx).issues).toContain('PAGINA_INVALIDA');
    expect(validarItemObservado(ok({ page: 9 }), ctx).issues).toContain('PAGINA_FUERA_DE_RANGO');
  });

  it('confidence ausente → FALTA_CONFIANZA; fuera de [0,1] → se recorta', () => {
    expect(validarItemObservado(ok({ confidence: undefined, confianza: undefined }), ctx).issues).toContain('FALTA_CONFIANZA');
    expect(validarItemObservado(ok({ confidence: 5 }), ctx).confidence).toBe(1);
  });

  it('OBSERVED sin evidencia → OBSERVED_SIN_EVIDENCIA', () => {
    expect(validarItemObservado(ok({ evidence: '' }), ctx).issues).toContain('OBSERVED_SIN_EVIDENCIA');
  });

  it('OBSERVED derivado de un cuarto → OBSERVED_DERIVADO_DE_CUARTO (no se infiere mueble de un room)', () => {
    expect(validarItemObservado(ok({ room_derived: true }), ctx).issues).toContain('OBSERVED_DERIVADO_DE_CUARTO');
    // un INFERRED derivado de cuarto es legítimo (no observado)
    expect(validarItemObservado(ok({ origin: 'inferred', room_derived: true, evidence: '' }), ctx).issues)
      .not.toContain('OBSERVED_DERIVADO_DE_CUARTO');
  });

  it('origin fuera del enum → ORIGEN_INVALIDO', () => {
    expect(validarItemObservado(ok({ origin: 'magic' }), ctx).issues).toContain('ORIGEN_INVALIDO');
  });

  it('type/role ausentes → FALTA_TYPE', () => {
    expect(validarItemObservado(ok({ type: '', role: '' }), ctx).issues).toContain('FALTA_TYPE');
  });

  it('PROGRAMA: duplicado exacto → ITEM_DUPLICADO + REVIEW_REQUIRED', () => {
    const r = validarProgramaObservado([ok(), ok()], ctx);
    expect(r.issues.some((x) => x.code === 'ITEM_DUPLICADO')).toBe(true);
    expect(r.state).toBe('REVIEW_REQUIRED');
    expect(r.metrics.invalidos).toBeGreaterThanOrEqual(1);
  });

  it('PROGRAMA: sólo observed válidos → PASS; no-observed → REVIEW_REQUIRED (requiere confirmar)', () => {
    expect(validarProgramaObservado([ok({ position: { x: 100, y: 100 } }), ok({ zone: 'Juntas', position: { x: 3000, y: 100 } })], ctx).state).toBe('PASS');
    const r = validarProgramaObservado([ok({ origin: 'suggested', evidence: '' })], ctx);
    expect(r.state).toBe('REVIEW_REQUIRED');
    expect(r.warnings.some((w) => w.code === 'REQUIERE_CONFIRMACION')).toBe(true);
  });

  it('PROGRAMA: sin observed_program (no-array) → ABSENT (no inventa nada)', () => {
    expect(validarProgramaObservado(null, ctx).state).toBe('ABSENT');
    expect(validarProgramaObservado(undefined, ctx).items).toEqual([]);
  });

  it('DETERMINISTA: mismas entradas → mismo resultado', () => {
    const items = [ok({ position: { x: 1, y: 1 } }), ok({ zone: 'Juntas', position: { x: 2, y: 2 } })];
    expect(validarProgramaObservado(items, ctx)).toEqual(validarProgramaObservado(items, ctx));
  });
});
