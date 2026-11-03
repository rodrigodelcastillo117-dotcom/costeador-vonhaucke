import { describe, it, expect } from 'vitest';
import { normalizarClaveMaterial } from './claveMaterial.js';

describe('normalizarClaveMaterial · clave estable de memoria', () => {
  it('el mismo material en distinto orden/clave da la MISMA clave', () => {
    const a = normalizarClaveMaterial('Remache pop AM-46 aluminio');
    const b = normalizarClaveMaterial('aluminio remache pop');
    expect(a).toBe(b);
    expect(a).toBe('aluminio pop remache');
  });

  it('ignora medidas, calibre y dimensiones (no fragmentan la memoria)', () => {
    const a = normalizarClaveMaterial('PTR cal.14 negro 1" x 1"');
    const b = normalizarClaveMaterial('PTR negro');
    expect(a).toBe(b);
    expect(a).toBe('negro ptr');
  });

  it('quita acentos y normaliza mayúsculas', () => {
    expect(normalizarClaveMaterial('Silicón estructural')).toBe(
      normalizarClaveMaterial('silicon ESTRUCTURAL'),
    );
  });

  it('descarta palabras de relleno (kit, juego, modelo…) y tokens cortos', () => {
    expect(normalizarClaveMaterial('Kit de corredera modelo 3 cajones')).toBe('cajones corredera');
  });

  it('texto sin nada significativo → clave vacía (no se memoriza)', () => {
    expect(normalizarClaveMaterial('   ')).toBe('');
    expect(normalizarClaveMaterial('25 mm')).toBe('');
    expect(normalizarClaveMaterial(null)).toBe('');
  });

  it('no duplica tokens repetidos', () => {
    expect(normalizarClaveMaterial('bisagra bisagra cazoleta')).toBe('bisagra cazoleta');
  });
});
