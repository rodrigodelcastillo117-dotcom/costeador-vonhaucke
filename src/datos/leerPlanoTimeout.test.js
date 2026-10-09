import { describe, it, expect } from 'vitest';
import { TIMEOUT_LECTURA_MS } from './leerPlanoArchivo.js';

// ChatGPT #1: en PROD una lectura real de plano tardó 64.841 s y el cliente la
// abortaba a los 60 s. El timeout debe superar con holgura esa duración observada.
describe('leerPlanoDeArchivo · timeout real (ChatGPT #1)', () => {
  it('el timeout supera la lectura real observada (64.841 s) con holgura', () => {
    expect(TIMEOUT_LECTURA_MS).toBeGreaterThan(64841);
    expect(TIMEOUT_LECTURA_MS).toBeGreaterThanOrEqual(120000);  // ≥ 2 min de holgura
  });
});
