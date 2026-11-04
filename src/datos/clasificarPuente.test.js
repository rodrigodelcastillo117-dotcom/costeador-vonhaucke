import { describe, it, expect } from 'vitest';
import { clasificarPuente } from './clasificarPuente.js';

describe('clasificarPuente', () => {
  it('sin puente aprobado para la clave → aprobable', () => {
    expect(clasificarPuente({ insumo_id: 'x', ya_aprobado: null })).toBe('aprobable');
    expect(clasificarPuente({})).toBe('aprobable');
  });
  it('misma clave ya aprobada al MISMO insumo → duplicado', () => {
    expect(clasificarPuente({ insumo_id: 'lamina-3x10-12', ya_aprobado: { id: 27, insumoId: 'lamina-3x10-12', mismo: true } })).toBe('duplicado');
  });
  it('misma clave ya aprobada a OTRO insumo → conflicto', () => {
    expect(clasificarPuente({ insumo_id: 'lamina-3x10-12', ya_aprobado: { id: 27, insumoId: 'otra-cosa', mismo: false } })).toBe('conflicto');
  });
});
