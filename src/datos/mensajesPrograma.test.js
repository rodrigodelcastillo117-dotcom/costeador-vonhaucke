import { describe, it, expect } from 'vitest';
import { mensajePendientePrograma } from './mensajesPrograma.js';

describe('mensajePendientePrograma — nunca enseña el código crudo', () => {
  it('ESCRITORIO_SOLICITADO_NO_CANONICO → español claro con acción, sin el enum', () => {
    const m = mensajePendientePrograma({ rol: 'privado', faltante: { reason: 'ESCRITORIO_SOLICITADO_NO_CANONICO', requested: { model: 'Eclipse', dimensions: '2.10 m' } } });
    expect(m).not.toContain('NO_CANONICO');
    expect(m).not.toContain('_');
    expect(m.toLowerCase()).toContain('escritorio');
    expect(m).toContain('Eclipse 2.10 m');
    expect(m.toLowerCase()).toContain('especial');
  });

  it('ASIENTO_SOLICITADO_NO_CANONICO → habla de silla, sin enum', () => {
    const m = mensajePendientePrograma({ rol: 'recepción', faltante: { reason: 'ASIENTO_SOLICITADO_NO_CANONICO', requested: { model: 'SONATA' } } });
    expect(m).not.toContain('NO_CANONICO');
    expect(m.toLowerCase()).toContain('silla');
    expect(m).toContain('SONATA');
  });

  it('sin reason / NEEDS_CONFIRMATION → confirmación clara, sin enum', () => {
    for (const r of [undefined, null, '', 'NEEDS_CONFIRMATION']) {
      const m = mensajePendientePrograma({ faltante: { reason: r, requested: { model: 'Mesa' } } });
      expect(m).not.toContain('NEEDS_CONFIRMATION');
      expect(m.toLowerCase()).toContain('confirm');
    }
  });

  it('código desconocido futuro → NUNCA se filtra crudo', () => {
    const m = mensajePendientePrograma({ faltante: { reason: 'ALGO_RARO_NUEVO_XYZ', requested: {} } });
    expect(m).not.toContain('ALGO_RARO_NUEVO_XYZ');
    expect(m).not.toMatch(/[A-Z]{3,}_[A-Z]/); // sin SCREAMING_SNAKE
    expect(m.toLowerCase()).toContain('confirm');
  });

  it('tolera objeto vacío sin romper', () => {
    expect(() => mensajePendientePrograma()).not.toThrow();
    expect(() => mensajePendientePrograma({})).not.toThrow();
  });
});
