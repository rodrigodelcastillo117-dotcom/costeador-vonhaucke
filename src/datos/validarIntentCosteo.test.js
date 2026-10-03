// ============================================================================
//  Adversarial del DTO estricto de costeo. El cliente manda INTENCIÓN TÉCNICA;
//  cualquier campo económico se RECHAZA (no se ignora). Contrato {ok,code,issues}.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { validarIntentCosteo } from './validarIntentCosteo.js';

const intentValido = {
  producto: 'escritorio',
  cantidad: 1,
  pieza: { componentes: [{ insumoId: 'melamina-28', largoMM: 1500, anchoMM: 600, piezas: 1 }] },
};

describe('validarIntentCosteo — allowlist (rechaza dinero del cliente)', () => {
  it('intención técnica válida → ok', () => {
    const r = validarIntentCosteo(intentValido);
    expect(r.ok).toBe(true);
    expect(r.intent.pieza.componentes[0].insumoId).toBe('melamina-28');
  });

  // EL CASO CLAVE: vendedor manda margen=0 para abaratar → DEBE FALLAR.
  it('margen=0 (ataque seller) → FORBIDDEN_FINANCIAL_FIELD', () => {
    const r = validarIntentCosteo({ ...intentValido, pieza: { ...intentValido.pieza, margen: 0 } });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('FORBIDDEN_FINANCIAL_FIELD');
  });

  for (const campo of ['precio', 'precioBase', 'costo', 'proveedor', 'factorDirecta', 'factorIndirecta', 'parModelo', 'modeloCosteo', 'descuento', 'rol']) {
    it(`campo económico '${campo}' en cualquier nivel → FORBIDDEN_FINANCIAL_FIELD`, () => {
      const r = validarIntentCosteo({ ...intentValido, [campo]: 1 });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('FORBIDDEN_FINANCIAL_FIELD');
    });
  }

  it('objeto `insumo` inline en un componente → FORBIDDEN_FINANCIAL_FIELD', () => {
    const r = validarIntentCosteo({ ...intentValido, pieza: { componentes: [{ insumoId: 'x', insumo: { precio: 1 } }] } });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('FORBIDDEN_FINANCIAL_FIELD');
  });

  it('precio inline en un componente → FORBIDDEN_FINANCIAL_FIELD', () => {
    const r = validarIntentCosteo({ ...intentValido, pieza: { componentes: [{ insumoId: 'x', precio: 999 }] } });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('FORBIDDEN_FINANCIAL_FIELD');
  });
});

describe('validarIntentCosteo — input inválido → INVALID_INPUT (no se cuela)', () => {
  for (const [etq, cantidad] of [['-1', -1], ['0', 0], ['1.5', 1.5], ['NaN', NaN], ['string', '3'], ['Infinity', Infinity]]) {
    it(`cantidad ${etq} → INVALID_INPUT`, () => {
      const r = validarIntentCosteo({ ...intentValido, cantidad });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('INVALID_INPUT');
    });
  }
  it('dimensión negativa → INVALID_INPUT', () => {
    const r = validarIntentCosteo({ cantidad: 1, pieza: { componentes: [{ insumoId: 'x', largoMM: -5 }] } });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('INVALID_INPUT');
  });
  it('sin componentes → INVALID_INPUT', () => {
    const r = validarIntentCosteo({ cantidad: 1, pieza: { componentes: [] } });
    expect(r.ok).toBe(false);
  });
  it('sin body → INVALID_INPUT', () => {
    expect(validarIntentCosteo(null).ok).toBe(false);
  });
});
