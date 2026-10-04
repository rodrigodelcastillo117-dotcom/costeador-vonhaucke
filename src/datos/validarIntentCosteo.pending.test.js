// P0-05 — MATERIAL_PENDING debe SOBREVIVIR el contrato IA→costeo. Antes
// validarIntentCosteo exigía insumoId obligatorio y tumbaba la intención completa
// cuando la IA dejaba una familia pendiente (p.ej. solid surface ausente). Ahora un
// componente sin insumoId sobrevive SI declara material_solicitado + un match
// pendiente; el motor lo bloquea (nunca se inventa ni se costea en $0).
import { describe, it, expect } from 'vitest';
import { validarIntentCosteo } from './validarIntentCosteo.js';

const base = (componentes) => ({ cantidad: 1, pieza: { componentes } });

describe('P0-05 MATERIAL_PENDING sobrevive validarIntentCosteo', () => {
  it('acepta un componente pendiente (insumoId="" + material_solicitado + NOT_AVAILABLE)', () => {
    const r = validarIntentCosteo(base([
      { insumoId: 'melamina-19', nombre: 'Costado', cantidad: 1.2 },
      { insumoId: '', nombre: 'Cubierta', material_solicitado: 'superficie sólida azul', material_match: 'NOT_AVAILABLE', largoMM: 1600, anchoMM: 700 },
    ]));
    expect(r.ok).toBe(true);
    const pend = r.intent.pieza.componentes.find((c) => c.nombre === 'Cubierta');
    expect(pend).toBeTruthy();
    expect(pend.insumoId).toBe('');            // NO se inventa un id
    expect(pend.pendiente).toBe(true);         // marcado para UI/motor
    expect(pend.material_solicitado).toBe('superficie sólida azul'); // se conserva el QUÉ se pidió
    expect(pend.material_match).toBe('NOT_AVAILABLE');
  });

  it('acepta SUBSTITUTE_SUGGESTED como pendiente (no entra al costo solo)', () => {
    const r = validarIntentCosteo(base([
      { insumoId: '', nombre: 'Frente', material_solicitado: 'HPL walnut', material_match: 'SUBSTITUTE_SUGGESTED', cantidad: 2 },
    ]));
    expect(r.ok).toBe(true);
    expect(r.intent.pieza.componentes[0].pendiente).toBe(true);
  });

  it('RECHAZA insumoId vacío "a secas" (sin material declarado) — sigue siendo error', () => {
    const r = validarIntentCosteo(base([
      { insumoId: '', nombre: 'Misterio', cantidad: 1 },
    ]));
    expect(r.ok).toBe(false);
    expect(r.issues.some((x) => x.field.endsWith('.insumoId'))).toBe(true);
  });

  it('un match EXACT sin insumoId es contradicción → se rechaza', () => {
    const r = validarIntentCosteo(base([
      { insumoId: '', nombre: 'X', material_solicitado: 'melamina 19', material_match: 'EXACT', cantidad: 1 },
    ]));
    expect(r.ok).toBe(false);
  });

  it('sigue rechazando campos económicos del cliente aunque haya pendientes', () => {
    const r = validarIntentCosteo(base([
      { insumoId: '', nombre: 'Cubierta', material_solicitado: 'solid surface', material_match: 'NOT_AVAILABLE', precio: 999 },
    ]));
    expect(r.ok).toBe(false);
    expect(r.code).toBe('FORBIDDEN_FINANCIAL_FIELD');
  });
});
