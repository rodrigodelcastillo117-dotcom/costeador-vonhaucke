// P0-PLAN Fase 1 — PROCEDENCIA honesta del programa derivado del plano.
// El bug: el programa presentaba "17 archiveros" y SKUs como si fueran DEL PLANO,
// cuando son REGLAS/ESTIMACIONES. Y los sanitarios no deben generar mobiliario
// (Von Haucke no fabrica escusados). Aquí se fija la disciplina detectado/estimado/
// sugerido y que servicio (sanitarios/site) no produce muebles.
import { describe, it, expect } from 'vitest';
import { programaDelPlano, resumenDelPlano } from './programaDelPlano.js';

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

// ============================================================================
//  PUESTOS CONTADOS DEL DIBUJO (no estimados por área).
//  El lector de plano (leer-plano v8) cuenta los escritorios DIBUJADOS en cada
//  isla y los manda en `puestos`. El programa DEBE respetar ese conteo, no
//  re-estimarlo por geometría. Éste es el caso real del "Plano Ejecutivo
//  Complejo": 2 islas de 4 = 8 puestos. Los polígonos de isla salen chicos
//  (~2.2 × 2.1 m); si se estimara por geometría darían 1 c/u = 2 (el bug).
// ============================================================================
describe('programaDelPlano · puestos CONTADOS del plano mandan sobre la geometría', () => {
  const PLANO_OPERATIVO = [
    { nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 12, largo: 8.8, contiene: 2 },
    { nombre: 'Isla 1', tipo: 'open', ancho: 2.18, largo: 2.11, dentroDe: 'ÁREA OPERATIVA', puestos: 4 },
    { nombre: 'Isla 2', tipo: 'open', ancho: 2.52, largo: 2.11, dentroDe: 'ÁREA OPERATIVA', puestos: 4 },
    { nombre: 'OFICINA CEO', tipo: 'privado', ancho: 4, largo: 3.2 },
  ];
  const pr = programaDelPlano(PLANO_OPERATIVO, { largoPuesto: 1500 });

  it('suma los puestos DIBUJADOS (4 + 4 = 8), no la geometría (que daría 2)', () => {
    expect(pr.operativos).toBe(8);
  });

  it('la procedencia de los puestos es DETECTADO (contado), no estimado', () => {
    expect(pr.fuente.operativos).toBe('detectado');
  });

  it('sillas y gavetas sugeridas = puestos contados (8)', () => {
    expect(pr.sugeridos.sillasOperativas).toBe(8);
    expect(pr.sugeridos.gavetas).toBe(8);
  });

  it('el resumen dice "contados del plano", no "estimé ~"', () => {
    const t = resumenDelPlano(pr);
    expect(t).toMatch(/8 puestos operativos \(contados del plano\)/);
    expect(t).not.toMatch(/Estimé ~/);
  });

  it('sin el campo puestos, cae a geometría y marca ESTIMADO (compatibilidad)', () => {
    const sinConteo = PLANO_OPERATIVO.map(({ puestos, ...a }) => a);
    const pr2 = programaDelPlano(sinConteo, { largoPuesto: 1500 });
    expect(pr2.fuente.operativos).toBe('estimado');
    // Geometría: islas chicas → pocos puestos (el viejo comportamiento).
    expect(pr2.operativos).toBeLessThan(8);
  });
});
