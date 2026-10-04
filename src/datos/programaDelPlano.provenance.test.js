// P0-PLAN Fase 1 — PROCEDENCIA honesta del programa derivado del plano.
// El bug: el programa presentaba "17 archiveros" y SKUs como si fueran DEL PLANO,
// cuando son REGLAS/ESTIMACIONES. Y los sanitarios no deben generar mobiliario
// (Von Haucke no fabrica escusados). Aquí se fija la disciplina detectado/estimado/
// sugerido y que servicio (sanitarios/site) no produce muebles.
import { describe, it, expect } from 'vitest';
import { programaDelPlano } from './programaDelPlano.js';

// Zona operativa + 2 privados + recepción + sanitarios (servicio) + site (servicio).
const PLANO = [
  { nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 6, largo: 4 },
  { nombre: 'OFICINA CEO', tipo: 'privado', ancho: 4, largo: 3.2 },
  { nombre: 'DIRECCIÓN', tipo: 'privado', ancho: 4, largo: 3.2 },
  { nombre: 'RECEPCIÓN', tipo: 'recepcion', ancho: 4.8, largo: 2.4 },
  { nombre: 'SANITARIOS H', tipo: 'servicio', ancho: 3, largo: 3.2 },
  { nombre: 'SANITARIOS M', tipo: 'servicio', ancho: 3, largo: 2.4 },
  { nombre: 'SITE (IT)', tipo: 'servicio', ancho: 4, largo: 2.4 },
];

describe('programaDelPlano · procedencia honesta', () => {
  const pr = programaDelPlano(PLANO, { largoPuesto: 1500 });

  it('los puestos son ESTIMADOS por área, no "detectados"', () => {
    expect(pr.fuente.operativos).toBe('estimado');
  });

  it('sillas y gavetas son SUGERIDAS (una por puesto), no detectadas', () => {
    expect(pr.fuente.sillasOperativas).toBe('sugerido');
    expect(pr.fuente.gavetas).toBe('sugerido');
    expect(pr.sugeridos.sillasOperativas).toBe(pr.operativos);
    expect(pr.sugeridos.gavetas).toBe(pr.operativos);
  });

  it('los ARCHIVEROS son 1 por PRIVADO (no 1 por puesto) y son sugeridos', () => {
    expect(pr.sugeridos.archiveros).toBe(2);
    expect(pr.fuente.archiveros).toBe('sugerido');
    expect(pr.sugeridos.archiveros).not.toBe(pr.operativos);
  });

  it('las zonas (privados/recepción) sí son DETECTADAS del plano', () => {
    expect(pr.fuente.privados).toBe('detectado');
    expect(pr.fuente.recepcion).toBe('detectado');
    expect(pr.privados).toBe(2);
    expect(pr.recepcion).toBe(true);
  });

  it('SANITARIOS y SITE (servicio) NO generan mobiliario', () => {
    expect(pr.privados).toBe(2);
    expect(pr.juntas).toBe(0);
  });
});
