// Caracterización: la lectura única reproduce lo que planner.rolArea y floorSpec.zonaSemantica
// devolvían el 2026-10-11 para 30 nombres reales, salvo el caso documentado (Site).
import { describe, it, expect } from 'vitest';
import { clasificarCuarto, ZONA } from './cuartos.js';

const ANTES = [
  // nombre · rolArea · zonaSemantica (salida real medida antes de consolidar)
  ['Sala de espera', 'lounge', 'GENERICA'], ['Recepción', 'recepcion', 'RECEPCION'], ['Lobby', 'recepcion', 'RECEPCION'],
  ['Sala de juntas', 'juntas', 'SALA_CONSEJO'], ['Sala de consejo', 'juntas', 'SALA_CONSEJO'], ['Board room', 'juntas', 'SALA_CONSEJO'],
  ['Oficina CEO', 'privado', 'OFICINA_CEO'], ['Dirección General', 'privado', 'OFICINA_CEO'], ['Privado', 'privado', 'GENERICA'],
  ['Gerencia', 'privado', 'GENERICA'], ['Lounge', 'lounge', 'GENERICA'], ['Cafetería', 'lounge', 'GENERICA'], ['Cocina', 'servicio', 'GENERICA'],
  ['Comedor', 'lounge', 'GENERICA'], ['Área operativa', 'open', 'AREA_OPERATIVA'], ['Open space', 'open', 'AREA_OPERATIVA'],
  ['Isla 1', 'open', 'AREA_OPERATIVA'],   // vocabulario del lector del CEO: una isla es área operativa ['Capacitación', 'general', 'GENERICA'], ['Sala de capacitación', 'general', 'GENERICA'],
  ['Archivo', 'general', 'GENERICA'], ['Bodega', 'general', 'GENERICA'], ['Baños', 'servicio', 'SANITARIOS'], ['Pasillo', 'servicio', 'GENERICA'],
  ['War room', 'general', 'GENERICA'], ['Huddle', 'general', 'GENERICA'], ['Phone booth', 'general', 'GENERICA'], ['Cabina', 'general', 'GENERICA'],
  ['Sala de descanso', 'lounge', 'GENERICA'], ['Terraza', 'general', 'GENERICA'],
];

describe('clasificarCuarto · caracterización', () => {
  it.each(ANTES)('%s → %s / %s', (nombre, rol, zona) => {
    expect(clasificarCuarto(nombre)).toEqual({ rol, zona });
  });
  it('Site/IT: antes el planner lo trataba como general (le acomodaba muebles) mientras floorSpec lo prohibía; ahora es servicio', () => {
    expect(clasificarCuarto('Site')).toEqual({ rol: 'servicio', zona: ZONA.SITE });
    expect(clasificarCuarto('Cuarto de rack')).toEqual({ rol: 'servicio', zona: ZONA.SITE });
  });
  it('sanitarios antes que site (saNITarios contiene "it")', () => {
    expect(clasificarCuarto('Sanitarios hombres').zona).toBe(ZONA.SANITARIOS);
  });
  it('tipo explícito no es cosa de este módulo: nombre vacío → general/GENERICA', () => {
    expect(clasificarCuarto('')).toEqual({ rol: 'general', zona: ZONA.GENERICA });
    expect(clasificarCuarto(null)).toEqual({ rol: 'general', zona: ZONA.GENERICA });
  });
});
