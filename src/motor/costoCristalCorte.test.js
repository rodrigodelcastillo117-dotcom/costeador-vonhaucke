// Estimador conservador de cristal cortado (fallback fail-closed).
// Propiedad central: NUNCA subcostea las piezas reales observadas (golden Telcel).
import { describe, it, expect } from 'vitest';
import { estimaPrecioCristalCorte, TARIFAS_CRISTAL } from './costoCristalCorte.js';

// Piezas 6 mm reales del DIV-MATERIALES Telcel DAT'S R5 (precio por pieza real).
// barrenos/saque leídos de la descripción del ERP.
const REALES_6MM = [
  { lab: 'Horizontal cubierta', largoMM: 1150, anchoMM: 550, espesorMM: 6, barrenos: 0, saque: false, real: 465.24 },
  { lab: 'Isla lateral',        largoMM: 1900, anchoMM: 397, espesorMM: 6, barrenos: 4, saque: false, real: 784.47 },
  { lab: 'Isla repisa',         largoMM: 1142, anchoMM: 280, espesorMM: 6, barrenos: 2, saque: false, real: 332.55 },
  { lab: 'Torre frente',        largoMM: 588,  anchoMM: 997, espesorMM: 6, barrenos: 0, saque: false, real: 525.00 },
  { lab: 'Torre barrenada',     largoMM: 962,  anchoMM: 576, espesorMM: 6, barrenos: 4, saque: false, real: 772.47 },
  { lab: 'Torre lateral',       largoMM: 594,  anchoMM: 997, espesorMM: 6, barrenos: 0, saque: false, real: 527.80 },
];

describe('estimaPrecioCristalCorte · seguridad económica (nunca subcostea)', () => {
  for (const p of REALES_6MM) {
    it(`techo ≥ real — ${p.lab}`, () => {
      const r = estimaPrecioCristalCorte(p);
      expect(r.ok).toBe(true);
      // La propiedad que importa: el estimado NUNCA queda por debajo del real.
      expect(r.precio).toBeGreaterThanOrEqual(p.real);
      // Y no es un certificado: exige cotización.
      expect(r.certificable).toBe(false);
      expect(r.requiereCotizacion).toBe(true);
    });
  }

  it('el techo no es absurdamente alto (≤ 2× el real) en las piezas reales', () => {
    for (const p of REALES_6MM) {
      const r = estimaPrecioCristalCorte(p);
      expect(r.precio).toBeLessThanOrEqual(p.real * 2);
    }
  });
});

describe('estimaPrecioCristalCorte · fail-closed (no inventa)', () => {
  it('espesor sin datos (5 mm) → PENDIENTE, sin precio', () => {
    const r = estimaPrecioCristalCorte({ largoMM: 573, anchoMM: 573, espesorMM: 5 });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('ESPESOR_SIN_DATOS');
    expect(r.precio).toBeUndefined();
    expect(r.requiereCotizacion).toBe(true);
  });

  it('espesor desconocido (12 mm) → PENDIENTE', () => {
    const r = estimaPrecioCristalCorte({ largoMM: 500, anchoMM: 500, espesorMM: 12 });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('ESPESOR_SIN_DATOS');
  });

  it('geometría inválida → GEOMETRIA_INVALIDA', () => {
    expect(estimaPrecioCristalCorte({ largoMM: 0, anchoMM: 500, espesorMM: 6 }).code).toBe('GEOMETRIA_INVALIDA');
    expect(estimaPrecioCristalCorte({ largoMM: 500, anchoMM: -1, espesorMM: 6 }).code).toBe('GEOMETRIA_INVALIDA');
    expect(estimaPrecioCristalCorte({}).code).toBe('GEOMETRIA_INVALIDA');
  });
});

describe('estimaPrecioCristalCorte · comportamiento del modelo', () => {
  it('es determinista', () => {
    const inp = { largoMM: 1000, anchoMM: 500, espesorMM: 6, barrenos: 2, saque: true };
    expect(estimaPrecioCristalCorte(inp)).toEqual(estimaPrecioCristalCorte(inp));
  });

  it('cada barreno sube el precio', () => {
    const base = estimaPrecioCristalCorte({ largoMM: 1000, anchoMM: 500, espesorMM: 6, barrenos: 0 });
    const con2 = estimaPrecioCristalCorte({ largoMM: 1000, anchoMM: 500, espesorMM: 6, barrenos: 2 });
    expect(con2.precio).toBeCloseTo(base.precio + 2 * TARIFAS_CRISTAL[6].costoBarreno, 2);
  });

  it('el saque suma su costo', () => {
    const sin = estimaPrecioCristalCorte({ largoMM: 1000, anchoMM: 500, espesorMM: 6, saque: false });
    const con = estimaPrecioCristalCorte({ largoMM: 1000, anchoMM: 500, espesorMM: 6, saque: true });
    expect(con.precio).toBeCloseTo(sin.precio + TARIFAS_CRISTAL[6].costoSaque, 2);
  });

  it('pieza diminuta cae al piso', () => {
    const r = estimaPrecioCristalCorte({ largoMM: 50, anchoMM: 50, espesorMM: 6 });
    expect(r.precio).toBe(TARIFAS_CRISTAL[6].piso);
  });

  it('el precio escala con el área', () => {
    const chica = estimaPrecioCristalCorte({ largoMM: 500, anchoMM: 500, espesorMM: 6 });
    const grande = estimaPrecioCristalCorte({ largoMM: 1000, anchoMM: 1000, espesorMM: 6 });
    expect(grande.precio).toBeGreaterThan(chica.precio);
  });
});
