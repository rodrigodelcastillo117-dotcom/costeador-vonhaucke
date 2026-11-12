import { describe, it, expect } from 'vitest';
import { cruceDeFamilia } from './materialMatch.js';

// Candado de familia: una confirmación humana (o un reuso de memoria) NUNCA debe mapear un
// material a otro de OTRA familia. El pecado real que esto cierra (puente #79, 2026-11):
// "cristal templado" quedó confirmado como acrílico-6 → falseaba el costo de toda cotización
// con vidrio y ensuciaba la cola de "Aprobar puentes". Determinista, sin red.
describe('cruceDeFamilia — una confirmación no puede cruzar de familia de material', () => {
  it('BLOQUEA cristal templado → acrílico (caso real #79)', () => {
    const r = cruceDeFamilia('cristal templado', 'acrilico-6');
    expect(r.cruza).toBe(true);
    expect(r.famPide).toBe('cristal');
    expect(r.famIns).toBe('acrilico');
  });

  it('BLOQUEA cristal templado → nombre de insumo acrílico', () => {
    expect(cruceDeFamilia('cristal templado', 'Acrílico 6 mm').cruza).toBe(true);
  });

  it('BLOQUEA lámina negra → acero inoxidable (metales distintos)', () => {
    expect(cruceDeFamilia('lamina negra cal 18', 'Acero inoxidable 304').cruza).toBe(true);
  });

  it('PERMITE cristal → cristal (misma familia, otro espesor)', () => {
    expect(cruceDeFamilia('cristal templado', 'Cristal templado 6 mm').cruza).toBe(false);
  });

  it('PERMITE melamina ↔ MDF (paneles de madera sustituibles: cambio de acabado, no de familia)', () => {
    const r = cruceDeFamilia('MDF 19 mm', 'Melamina 16 mm Blanco');
    expect(r.famPide).toBe('mdf');
    expect(r.famIns).toBe('melamina');
    expect(r.cruza).toBe(false);
  });

  it('NO inventa cruce cuando no se reconoce la familia del insumo (clave ERP cruda)', () => {
    expect(cruceDeFamilia('acrilico blanco', 'erp-ln18310').cruza).toBe(false);
  });

  it('NO bloquea #81 (acrílico blanco → acrílico traslúcido): misma familia; la variante la atrapa el conflicto de aprobación, no este candado', () => {
    expect(cruceDeFamilia('acrilico blanco', 'acrilico-traslucido-3').cruza).toBe(false);
  });

  it('NO bloquea texto vacío (no se sabe → no se inventa conflicto)', () => {
    expect(cruceDeFamilia('', 'acrilico-6').cruza).toBe(false);
    expect(cruceDeFamilia('cristal', '').cruza).toBe(false);
  });
});
