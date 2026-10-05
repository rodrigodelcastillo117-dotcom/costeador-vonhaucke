import { describe, it, expect } from 'vitest';
import { areasDeLectura, resumenLectura } from './planoLeido.js';
import { aMM, aMetros, cuantizar } from './floorPlan.js';

const base = {
  envolvente: { ancho: 6000, largo: 4000 },
  areas: [{
    nombre: 'Privado', tipo: 'privado', forma: 'poligono', dentroDe: '', puestos: 0, confianza: 'alta',
    puntos: [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }],
    circulo: { cx: 0, cy: 0, r: 0 },
  }],
};

describe('pipeline de puerta verificable · lector → canónico → solver', () => {
  it('preserva bisagra, sentido, ángulo y barrido al pasar mm→m→mm', () => {
    const lectura = {
      ...base,
      puertas: [{
        x: 0, y: 1800, ancho: 900,
        tieneBarrido: true,
        bisagraX: 0, bisagraY: 1350,
        anguloCerradaDeg: 90,
        sentido: 'antihorario', barridoDeg: 90,
        confianza: 'alta',
      }],
    };
    const { areas } = areasDeLectura(lectura);
    expect(areas[0].puertas[0]).toMatchObject({
      x: 0, y: 1.8, ancho: 0.9,
      tieneBarrido: true,
      bisagraX: 0, bisagraY: 1.35,
      anguloCerradaDeg: 90,
      sentido: 'antihorario', barridoDeg: 90,
      confianza: 'alta',
    });
    const mm = aMM(areas);
    expect(mm[0].puertas[0]).toMatchObject({
      x: 0, y: 1800, ancho: 900,
      bisagraX: 0, bisagraY: 1350,
      anguloCerradaDeg: 90,
      sentido: 'antihorario', barridoDeg: 90,
      tieneBarrido: true,
    });
    expect(aMetros(mm)[0].puertas[0]).toMatchObject(areas[0].puertas[0]);
    expect(cuantizar(areas)[0].puertas[0]).toMatchObject(areas[0].puertas[0]);
  });

  it('puerta sin evidencia no gana certeza durante ninguna transformación', () => {
    const lectura = {
      ...base,
      puertas: [{
        x: 0, y: 1800, ancho: 900,
        tieneBarrido: false,
        bisagraX: 0, bisagraY: 0,
        anguloCerradaDeg: 0,
        sentido: 'desconocido', barridoDeg: 0,
        confianza: 'baja',
      }],
    };
    const { areas } = areasDeLectura(lectura);
    expect(areas[0].puertas[0].tieneBarrido).toBe(false);
    expect(areas[0].puertas[0].sentido).toBe('desconocido');
    expect(aMM(areas)[0].puertas[0].tieneBarrido).toBe(false);
    const r = resumenLectura(lectura);
    expect(r.puertasPendientes).toBe(1);
    expect(r.confiable).toBe(false);
    expect(r.problemas.join(' ')).toMatch(/barrido verificable/i);
  });

  it('mantiene compatibilidad con puertas legacy sin campos de barrido', () => {
    const lectura = { ...base, puertas: [{ x: 0, y: 1800, ancho: 900 }] };
    const { areas } = areasDeLectura(lectura);
    expect(areas[0].puertas[0]).toEqual({ x: 0, y: 1.8, ancho: 0.9 });
    const r = resumenLectura(lectura);
    expect(r.puertas).toBe(1);
    expect(r.puertasPendientes).toBe(0);
  });
});
