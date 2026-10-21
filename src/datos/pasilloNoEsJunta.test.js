import { describe, it, expect } from 'vitest';
import { clasificarCuarto, rolDeCuarto } from './cuartos.js';
import { programaDelPlano } from './programaDelPlano.js';

describe('un pasillo / circulación NO es sala de juntas', () => {
  it('el clasificador manda circulación/pasillo/corredor a servicio (sin muebles)', () => {
    for (const n of ['CIRCULACIÓN', 'Circulacion', 'Pasillo', 'PASILLO principal', 'Corredor', 'Distribuidor']) {
      expect(rolDeCuarto(n)).toBe('servicio');
    }
  });

  it('NO se traga vestíbulo ni acceso (ésos siguen siendo recepción a propósito)', () => {
    expect(clasificarCuarto('Vestíbulo').rol).toBe('recepcion');
    expect(clasificarCuarto('Acceso principal').rol).toBe('recepcion');
  });

  it('plano Prueba 2: la circulación de 22×2 m ya no mete una sala de juntas fantasma', () => {
    // 8 zonas EXACTAS del plano ARQ-01 (metros). Antes del fix: salas = [10,8,6] (el 10 era el pasillo).
    const areas = [
      { nombre: 'OPERATIVA',         ancho: 12, largo: 7 },
      { nombre: 'RECEPCIÓN',         ancho: 6,  largo: 7 },
      { nombre: 'CIRCULACIÓN',       ancho: 22, largo: 2 },
      { nombre: 'SALA DE CONSEJO',   ancho: 7,  largo: 5 },
      { nombre: 'SALA CREATIVA',     ancho: 6,  largo: 5 },
      { nombre: 'CAFÉ',              ancho: 4,  largo: 7 },
      { nombre: 'OFICINA DIRECCIÓN', ancho: 5,  largo: 5 },
      { nombre: 'SITE / IT',         ancho: 4,  largo: 5 },
    ];
    const prog = programaDelPlano(areas);
    // Solo las DOS salas reales (consejo 35m²→8, creativa 30m²→6). El pasillo ya no aporta.
    expect(prog.salas).toEqual([8, 6]);
    expect(prog.salas).not.toContain(10);
    // Lo demás que ya salía bien no se rompe:
    expect(prog.recepcion).toBe(true);
    expect(prog.privados).toBe(1);
  });
});
