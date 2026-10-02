import { describe, it, expect } from 'vitest';
import { aceptaCorrida } from './AsistenteEspecial.jsx';

// Anti-contaminación de estado entre productos: una respuesta async de un plano viejo NO debe
// pisar el estado del plano nuevo. Simula: A) analizas producto A (corrida 1); B) sin recargar
// subes producto B (corrida 2); C) llega tarde la respuesta de A (id 1) → debe DESCARTARSE.
describe('aceptaCorrida — expediente atómico por analysis_id', () => {
  it('acepta la respuesta de la corrida vigente', () => {
    expect(aceptaCorrida(2, 2)).toBe(true);
  });
  it('DESCARTA una respuesta async de una corrida anterior (producto A pisando B)', () => {
    expect(aceptaCorrida(1, 2)).toBe(false);
  });
  it('acepta llamadas sin id (compat legado)', () => {
    expect(aceptaCorrida(null, 5)).toBe(true);
    expect(aceptaCorrida(undefined, 5)).toBe(true);
  });
  it('secuencia A→B: tras subir B, solo B aplica', () => {
    let actual = 1;            // corrida de A
    const idA = actual;
    actual = 2;                // el usuario sube B (nueva corrida) antes de que A responda
    const idB = actual;
    expect(aceptaCorrida(idA, actual)).toBe(false); // respuesta tardía de A → descartada
    expect(aceptaCorrida(idB, actual)).toBe(true);  // respuesta de B → aplicada
  });
});
