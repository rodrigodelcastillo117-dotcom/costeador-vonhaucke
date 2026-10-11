// ============================================================================
//  CADENA COMPLETA: lectura del plano → contrato canónico → programa.
//
//  Por qué existe (2026-10-10). VH-002 ("puestos inflados: el programa re-estima
//  por geometría ignorando los escritorios dibujados") se marcó FIXED · VERIFIED
//  con 10 tests… y volvió a producción en beaa005. ¿Cómo? Cada test probaba UNA
//  función aislada (programaDelPlano recibía `puestos` a mano y lo respetaba),
//  pero en la app el dato pasa por floorPlan.bloqueGeometria/cuantizar antes de
//  llegar al programa, y esa capa lo tiraba. Ningún test caminaba la cadena.
//
//  Regla del Bloque 0: un bug de cadena se cierra con un test de cadena.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { areasDeLectura } from './planoLeido.js';
import { aMM, aMetros, bloqueGeometria, cuantizar, areasCanonicas } from './floorPlan.js';
import { programaDelPlano } from './programaDelPlano.js';

// Lo que devuelve leer-plano (v8) para el "Plano Ejecutivo Complejo": un área
// operativa con DOS islas chicas (≈2.2 × 2.1 m) donde el lector CONTÓ 4
// escritorios dibujados en cada una. Por geometría saldría 1 por isla.
const rect = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
const LECTURA = {
  envolvente: { ancho: 16000, largo: 8800 },
  tieneCotas: true,
  areas: [
    { nombre: 'ÁREA OPERATIVA', tipo: 'open', forma: 'poligono', dentroDe: '', confianza: 'alta',
      circulo: { cx: 0, cy: 0, r: 0 }, puntos: rect(0, 0, 12000, 8800) },
    { nombre: 'Isla 1', tipo: 'open', forma: 'poligono', dentroDe: 'ÁREA OPERATIVA', confianza: 'alta',
      circulo: { cx: 0, cy: 0, r: 0 }, puntos: rect(1000, 1000, 2180, 2110), puestos: 4 },
    { nombre: 'Isla 2', tipo: 'open', forma: 'poligono', dentroDe: 'ÁREA OPERATIVA', confianza: 'alta',
      circulo: { cx: 0, cy: 0, r: 0 }, puntos: rect(5000, 1000, 2520, 2110), puestos: 4 },
    { nombre: 'OFICINA CEO', tipo: 'privado', forma: 'poligono', dentroDe: '', confianza: 'alta',
      circulo: { cx: 0, cy: 0, r: 0 }, puntos: rect(12000, 0, 4000, 3200) },
  ],
};

describe('puestos contados · sobreviven la cadena completa', () => {
  const { areas: leidas } = areasDeLectura(LECTURA);

  it('1) el lector deja `puestos` en cada isla', () => {
    const islas = leidas.filter((a) => /^Isla/.test(a.nombre));
    expect(islas.map((a) => a.puestos)).toEqual([4, 4]);
  });

  it('2) el contrato canónico lo TRANSPORTA (m→mm→m), no lo filtra', () => {
    expect(aMM(leidas).filter((a) => /^Isla/.test(a.nombre)).map((a) => a.puestos)).toEqual([4, 4]);
    expect(aMetros(aMM(leidas)).filter((a) => /^Isla/.test(a.nombre)).map((a) => a.puestos)).toEqual([4, 4]);
    expect(cuantizar(leidas).filter((a) => /^Isla/.test(a.nombre)).map((a) => a.puestos)).toEqual([4, 4]);
    const b = bloqueGeometria(leidas);
    expect(b.areasM.filter((a) => /^Isla/.test(a.nombre)).map((a) => a.puestos)).toEqual([4, 4]);
    expect(b.areas.filter((a) => /^Isla/.test(a.nombre)).map((a) => a.puestos)).toEqual([4, 4]);
    // Rehidratar desde lo guardado (areasM o sólo areas legacy) tampoco lo pierde.
    expect(areasCanonicas({ areasM: b.areasM }).filter((a) => /^Isla/.test(a.nombre)).map((a) => a.puestos)).toEqual([4, 4]);
    expect(areasCanonicas({ areas: b.areas }).filter((a) => /^Isla/.test(a.nombre)).map((a) => a.puestos)).toEqual([4, 4]);
  });

  it('3) el programa recibe lo que Voni/Acomodo guardaron y suma 4 + 4 = 8 DETECTADOS', () => {
    // Exactamente el camino de Voni.jsx:107 / Acomodo.jsx:220 → CotizadorIA.jsx:232.
    const guardado = bloqueGeometria(leidas);
    const pr = programaDelPlano(guardado.areasM, { largoPuesto: 1500 });
    expect(pr.operativos).toBe(8);
    expect(pr.fuente.operativos).toBe('detectado');
  });

  it('4) control: sin el campo, la cadena cae a geometría y marca ESTIMADO', () => {
    const sinConteo = { ...LECTURA, areas: LECTURA.areas.map(({ puestos, ...a }) => a) };
    const guardado = bloqueGeometria(areasDeLectura(sinConteo).areas);
    const pr = programaDelPlano(guardado.areasM, { largoPuesto: 1500 });
    expect(pr.fuente.operativos).toBe('estimado');
    expect(pr.operativos).toBeLessThan(8);
  });

  it('5) un `puestos` basura (0, negativo, texto) NO viaja', () => {
    const sucio = [{ nombre: 'Isla X', tipo: 'open', ancho: 2, largo: 2, puestos: 0 },
      { nombre: 'Isla Y', tipo: 'open', ancho: 2, largo: 2, puestos: -3 },
      { nombre: 'Isla Z', tipo: 'open', ancho: 2, largo: 2, puestos: 'cuatro' }];
    for (const a of aMM(sucio)) expect(a).not.toHaveProperty('puestos');
  });
});
