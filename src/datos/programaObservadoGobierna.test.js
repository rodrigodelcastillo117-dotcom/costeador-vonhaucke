import { describe, it, expect } from 'vitest';
import { programRequirementsDesdeObservado, proponerProgramaDesdeObservado } from './programaRealDelPlano.js';

// Item observado "real" (OBSERVED + evidencia + confianza + cantidad).
const obs = (over = {}) => ({
  kind: 'furniture', type: 'bench', role: 'operational', quantity: 4,
  capacity_per_unit: 2, evidence: 'dibujado', confidence: 0.9, origin: 'observed', ...over,
});

describe('observed_program GOBIERNA el programa (ChatGPT P0-R8-1)', () => {
  it('capacidad observada manda los PUESTOS, no el número de muebles', () => {
    const { entrada, gobernables } = programRequirementsDesdeObservado([obs()]);  // 4 benches × 2 = 8 puestos
    expect(entrada.operativos).toBe(8);
    expect(gobernables).toBe(1);
  });

  it('privados → cuenta muebles; juntas → sala con su capacidad; recepción → bandera', () => {
    const { entrada } = programRequirementsDesdeObservado([
      obs({ type: 'privado', role: 'private_office', quantity: 3, capacity_per_unit: 1 }),
      obs({ type: 'mesa junta', role: 'meeting', quantity: 1, capacity_per_unit: 8 }),
      obs({ type: 'recepcion', role: 'reception', quantity: 1, capacity_per_unit: 1 }),
    ]);
    expect(entrada.privados).toBe(3);
    expect(entrada.salas).toEqual([8]);
    expect(entrada.recepcion).toBe(true);
  });

  it('SUGGESTED/INFERRED NO gobiernan: van a pendientes (requieren confirmación)', () => {
    const { entrada, pendientes, gobernables } = programRequirementsDesdeObservado([
      obs({ origin: 'suggested' }),
      obs({ origin: 'inferred' }),
    ]);
    expect(entrada.operativos).toBe(0);
    expect(gobernables).toBe(0);
    expect(pendientes.every((p) => p.code === 'REQUIERE_CONFIRMACION')).toBe(true);
  });

  it('rol desconocido NO se inventa: ROLE_NO_MAPEADO (vocabulario = siguiente P0)', () => {
    const { pendientes, gobernables } = programRequirementsDesdeObservado([obs({ type: 'cafetera', role: 'amenity_coffee' })]);
    expect(gobernables).toBe(0);
    expect(pendientes[0].code).toBe('ROLE_NO_MAPEADO');
  });

  it('item OBSERVED con issue (sin evidencia) NO gobierna', () => {
    const { gobernables, pendientes } = programRequirementsDesdeObservado([obs({ evidence: '' })]);
    expect(gobernables).toBe(0);
    expect(pendientes[0].code).toBe('REQUIERE_CONFIRMACION');
  });

  it('proponerProgramaDesdeObservado: nada gobernable → null (el caller usa la heurística de áreas)', () => {
    expect(proponerProgramaDesdeObservado([], {})).toBeNull();
    expect(proponerProgramaDesdeObservado([obs({ origin: 'suggested' })], {})).toBeNull();
  });

  it('proponerProgramaDesdeObservado: con observado gobernable → propuesta marcada y con pendientes', () => {
    const p = proponerProgramaDesdeObservado([obs(), obs({ type: 'cafetera', role: 'amenity_coffee' })], { linea: 'App LT' });
    expect(p).not.toBeNull();
    expect(p.gobernadoPorObservado).toBe(true);
    expect(p.propuesta).toBeTruthy();                       // pasó por el ProductResolver
    expect(p.observadoPendientes.some((x) => x.code === 'ROLE_NO_MAPEADO')).toBe(true);
  });
});
