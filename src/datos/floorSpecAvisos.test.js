// VH-064: la validación determinista del servidor llega a la persona, en español, y baja el nivel.
import { describe, it, expect } from 'vitest';
import { avisosDeValidacion, problemasDeValidacion, estadoServidor, nivelCombinado } from './floorSpecAvisos.js';

describe('floorSpecAvisos', () => {
  it('traduce avisos conocidos con su zona/campo', () => {
    const v = { warnings: [
      { field: 'envolvente', code: 'ASSUMED_CRITICAL_GEOMETRY' },
      { field: 'areas[2]', code: 'LOW_CONFIDENCE_ZONE', zone: 'Break' },
      { field: 'puertas[0]', code: 'DOOR_SWING_UNVERIFIED' },
    ] };
    const t = avisosDeValidacion(v);
    expect(t).toHaveLength(3);
    expect(t[0]).toMatch(/SUPUSO/);
    expect(t[1]).toMatch(/Break/);
    expect(t[2]).toMatch(/puertas\[0\]/);
  });
  it('un código desconocido NO se pierde: se enseña tal cual', () => {
    const t = avisosDeValidacion({ warnings: [{ code: 'NUEVO_CODIGO', field: 'x', message: 'detalle' }] });
    expect(t[0]).toContain('NUEVO_CODIGO');
    expect(t[0]).toContain('detalle');
    expect(avisosDeValidacion({ warnings: [{}] })[0]).toContain('SIN_CÓDIGO');
  });
  it('los problemas de FAIL explican los números (cotas vs envolvente)', () => {
    const t = problemasDeValidacion({ issues: [
      { field: 'grid.horizontal', code: 'GRID_ENVELOPE_MISMATCH', sum_mm: 15400, envelope_mm: 16000, tolerance_mm: 160 },
      { field: 'areas[1].puntos[2]', code: 'POINT_OUTSIDE_ENVELOPE', x: 16200, y: 300 },
    ] });
    expect(t[0]).toMatch(/15400 mm/); expect(t[0]).toMatch(/16000 mm/); expect(t[0]).toMatch(/160 mm/);
    expect(t[1]).toMatch(/16200 mm, 300 mm/);
  });
  it('sin validación o con lista ausente devuelve vacío y SIN_VALIDACION', () => {
    expect(avisosDeValidacion(undefined)).toEqual([]);
    expect(problemasDeValidacion({})).toEqual([]);
    expect(estadoServidor(undefined)).toBe('SIN_VALIDACION');
    expect(estadoServidor({ validation: { state: 'pass' } })).toBe('PASS');
    expect(estadoServidor({ validation: { state: 'RARO' } })).toBe('SIN_VALIDACION');
  });
  it('el servidor sólo puede BAJAR el nivel, nunca subirlo', () => {
    expect(nivelCombinado('alta', 'PASS')).toBe('alta');
    expect(nivelCombinado('alta', 'REVIEW_REQUIRED')).toBe('media');
    expect(nivelCombinado('alta', 'SIN_VALIDACION')).toBe('media');
    expect(nivelCombinado('media', 'REVIEW_REQUIRED')).toBe('media');
    expect(nivelCombinado('baja', 'PASS')).toBe('baja');
    expect(nivelCombinado('alta', 'FAIL')).toBe('baja');
    expect(nivelCombinado('media', 'FAIL')).toBe('baja');
    expect(nivelCombinado('nula', 'PASS')).toBe('nula');
    expect(nivelCombinado('nula', 'FAIL')).toBe('nula');
  });
});

describe('VH-094 · avisos repetidos se resumen con conteo', () => {
  it('5 puertas sin barrido → un solo renglón, sin índices internos', () => {
    const warnings = [0, 1, 2, 3, 4].map((i) => ({ field: `puertas[${i}]`, code: 'DOOR_SWING_UNVERIFIED' }));
    const out = avisosDeValidacion({ warnings });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/^5 puertas sin bisagra/);
    expect(out[0]).not.toMatch(/puertas\[/);
  });
  it('una sola puerta conserva el texto individual; otros códigos no se tocan', () => {
    const out = avisosDeValidacion({ warnings: [{ field: 'puertas[0]', code: 'DOOR_SWING_UNVERIFIED' }, { code: 'NO_DIMENSION_AUTHORITY' }] });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatch(/El plano no trae cotas/);
    expect(out[1]).toMatch(/^Una puerta \[puertas\[0\]\]/);
  });
});
