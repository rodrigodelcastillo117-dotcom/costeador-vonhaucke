// N4 — modelo de evidencia y contradicciones. Puro.
import { describe, it, expect } from 'vitest';
import { evidencia, resolverCampo, modeloEvidencia, FUENTES } from './evidencia.js';

describe('evidencia', () => {
  it('asigna confianza por fuente', () => {
    expect(evidencia(120, FUENTES.VISIBLE_EN_PLANO).confianza).toBe(0.9);
    expect(evidencia(120, FUENTES.SUPUESTO).confianza).toBe(0.3);
    expect(evidencia(120, 'INVENTADA').fuente).toBe(FUENTES.SUPUESTO); // fail-safe
  });
});

describe('resolverCampo', () => {
  it('coincidencia dentro de tolerancia → resuelto con la fuente más confiable', () => {
    const r = resolverCampo('ancho', [
      { valor: 1200, fuente: FUENTES.VISIBLE_EN_PLANO, origen: 'planta' },
      { valor: 1210, fuente: FUENTES.INFERIDO_ESTRUCTURAL, origen: 'elevación' },
    ], { tolRel: 0.02, unidad: 'mm' });
    expect(r.contradiccion).toBeNull();
    expect(r.resuelto.valor).toBe(1200);
    expect(r.resuelto.fuente).toBe(FUENTES.VISIBLE_EN_PLANO);
  });

  it('discrepancia real → CONTRADICCIÓN con UNA pregunta, no elige solo', () => {
    const r = resolverCampo('ancho de la credenza', [
      { valor: 1200, fuente: FUENTES.VISIBLE_EN_PLANO, origen: 'planta' },
      { valor: 1250, fuente: FUENTES.VISIBLE_EN_PLANO, origen: 'elevación A-A' },
    ], { unidad: 'mm' });
    expect(r.resuelto).toBeNull();
    expect(r.contradiccion).toBeTruthy();
    expect(r.contradiccion.requiereConfirmacion).toBe(true);
    expect(r.contradiccion.opciones).toHaveLength(2);
    expect(r.contradiccion.pregunta).toContain('ancho de la credenza');
    expect(r.contradiccion.pregunta).toContain('1200');
    expect(r.contradiccion.pregunta).toContain('1250');
  });

  it('CONFIRMADO_USUARIO cierra la contradicción', () => {
    const r = resolverCampo('ancho', [
      { valor: 1200, fuente: FUENTES.VISIBLE_EN_PLANO },
      { valor: 1250, fuente: FUENTES.VISIBLE_EN_PLANO },
      { valor: 1230, fuente: FUENTES.CONFIRMADO_USUARIO },
    ]);
    expect(r.contradiccion).toBeNull();
    expect(r.resuelto.valor).toBe(1230);
    expect(r.confianza).toBe(1);
  });
});

describe('modeloEvidencia', () => {
  it('resuelve varios campos y junta contradicciones (una por campo)', () => {
    const m = modeloEvidencia({
      ancho: [{ valor: 1200, fuente: FUENTES.VISIBLE_EN_PLANO }, { valor: 1400, fuente: FUENTES.VISIBLE_EN_PLANO }],
      alto: [{ valor: 750, fuente: FUENTES.VISIBLE_EN_PLANO }, { valor: 750, fuente: FUENTES.INFERIDO_ESTRUCTURAL }],
    });
    expect(m.requiereConfirmacion).toBe(true);
    expect(m.contradicciones).toHaveLength(1); // sólo ancho
    expect(m.resuelto.alto.valor).toBe(750);
    expect(m.confianza).toBeGreaterThan(0);
  });
  it('sin datos no truena', () => {
    expect(modeloEvidencia({}).requiereConfirmacion).toBe(false);
  });
});
