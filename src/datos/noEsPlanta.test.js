import { describe, it, expect } from 'vitest';
import { noEsPlanta } from './noEsPlanta.js';

describe('noEsPlanta · un dibujo de mueble no se acepta como plano (E2E 2026-10-20)', () => {
  const exhibidor = { areas: [{ ancho: 0.9, largo: 0.7 }, { ancho: 1.2, largo: 0.7 }, { ancho: 0.9, largo: 0.7 }, { ancho: 0.6, largo: 0.7 }],
    nota: 'El documento es un plano de mobiliario comercial (exhibidor modular), no una planta arquitectónica de oficina; no existen cuartos, muros ni puertas de edificio.' };
  it('el exhibidor de la prueba se rechaza', () => {
    expect(noEsPlanta(exhibidor)).toBeTruthy();
    expect(noEsPlanta({ ...exhibidor, nota: '' })).toBeTruthy();       // por geometría también
  });
  it('Torre Norte (308 m²) sí es planta', () => {
    expect(noEsPlanta({ areas: [{ ancho: 12, largo: 7 }, { ancho: 6, largo: 7 }, { ancho: 5, largo: 5 }], nota: '' })).toBeNull();
  });
  it('un privado chico solo (3 × 3) sí es planta', () => {
    expect(noEsPlanta({ areas: [{ ancho: 3, largo: 3 }] })).toBeNull();
  });
});
