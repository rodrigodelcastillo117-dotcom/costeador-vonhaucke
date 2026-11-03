// Reconocimiento de familia para consumibles de fijación/latch (plano TELCEL real: remache,
// clavo, pasador salían sin familia → no se podían amarrar a su específico con precio).
import { describe, it, expect } from 'vitest';
import { familiaDeMaterial } from './materialMatch.js';

describe('familiaDeMaterial · consumibles de fijación y latch', () => {
  it('remache / clavo / perno / grapa → tornilleria (mayúsc. y minúsc.)', () => {
    expect(familiaDeMaterial('Remache pop AM-46 aluminio')).toBe('tornilleria');
    expect(familiaDeMaterial('REMACHE POP AM-46 ALUMINIO')).toBe('tornilleria');
    expect(familiaDeMaterial('Clavo en rollo 2"')).toBe('tornilleria');
    expect(familiaDeMaterial('Perno de anclaje')).toBe('tornilleria');
    expect(familiaDeMaterial('Grapa para engrapadora neumatica')).toBe('tornilleria');
  });
  it('pasador / cerrojo → herraje_cerradura', () => {
    expect(familiaDeMaterial('Pasador modelo 36 con boton de seguridad')).toBe('herraje_cerradura');
    expect(familiaDeMaterial('PASADOR DE CERROJO 15 cm galvanizado')).toBe('herraje_cerradura');
  });
  it('no pisa el material base nombrado primero (no rompe VH-176)', () => {
    expect(familiaDeMaterial('Lamina de acero con remaches')).toBe('metal_lamina');
    expect(familiaDeMaterial('MDF 19 mm atornillado')).toBe('mdf');
  });
});
