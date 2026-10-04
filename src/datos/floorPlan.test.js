// ============================================================================
//  Contrato canónico del plano (floorPlan.js): una sola verdad del espacio.
//  areasM (metros) es la verdad; areas (mm) se deriva; round-trip estable.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { aMM, aMetros, areasCanonicas, bloqueGeometria, cuantizar } from './floorPlan.js';
import { acomodarLocal } from './planner.js';

const areaM = {
  nombre: 'Open space', tipo: 'open', nivel: 0, x: 1.5, y: 2, ancho: 6, largo: 4,
  poly: [[0, 0], [6, 0], [6, 4], [0, 4]],
  obstaculos: [{ x: 1, y: 1, w: 0.4, h: 0.4, tipo: 'columna' }],
  puertas: [{ x: 0, y: 2, ancho: 0.9 }],
  dentroDe: null, contiene: ['juntas'],
};

describe('floorPlan · contrato canónico', () => {
  it('aMM convierte metros→mm (enteros) conservando forma/huecos/puertas/nivel/x-y', () => {
    const mm = aMM([areaM])[0];
    expect(mm.ancho).toBe(6000);
    expect(mm.largo).toBe(4000);
    expect(mm.x).toBe(1500); expect(mm.y).toBe(2000);
    expect(mm.poly[2]).toEqual([6000, 4000]);
    expect(mm.obstaculos[0]).toMatchObject({ x: 1000, y: 1000, w: 400, h: 400, tipo: 'columna' });
    expect(mm.puertas[0]).toMatchObject({ x: 0, y: 2000, ancho: 900 });
    expect(mm.nivel).toBe(0);
    expect(mm.contiene).toEqual(['juntas']);
  });

  it('round-trip metros→mm→metros es estable', () => {
    const back = aMetros(aMM([areaM]))[0];
    expect(back.ancho).toBe(6);
    expect(back.largo).toBe(4);
    expect(back.poly[2]).toEqual([6, 4]);
    expect(back.obstaculos[0].w).toBeCloseTo(0.4, 6);
    expect(back.puertas[0].ancho).toBeCloseTo(0.9, 6);
  });

  it('x/y sólo viajan si existen (zona sin posición real no inventa coordenadas)', () => {
    const sinPos = aMM([{ nombre: 'Zona', ancho: 3, largo: 2 }])[0];
    expect('x' in sinPos).toBe(false);
    expect('y' in sinPos).toBe(false);
  });

  it('areasCanonicas prefiere areasM (verdad) sobre areas mm', () => {
    const acomodo = { areasM: [{ nombre: 'M', ancho: 5, largo: 5 }], areas: [{ nombre: 'MM', ancho: 9999, largo: 9999 }] };
    expect(areasCanonicas(acomodo)[0].nombre).toBe('M');
    expect(areasCanonicas(acomodo)[0].ancho).toBe(5);
  });

  it('areasCanonicas convierte legacy mm→metros si no hay areasM', () => {
    const acomodo = { areas: [{ nombre: 'Legacy', ancho: 3000, largo: 2000 }] };
    const r = areasCanonicas(acomodo)[0];
    expect(r.ancho).toBe(3);
    expect(r.largo).toBe(2);
  });

  it('areasCanonicas vacío ⇒ [] (arranca en EmpezarEspacio, no inventa espacio)', () => {
    expect(areasCanonicas(null)).toEqual([]);
    expect(areasCanonicas({})).toEqual([]);
  });

  it('bloqueGeometria deja areasM (verdad) y areas (mm derivado) SIEMPRE en sync', () => {
    const b = bloqueGeometria([areaM]);
    expect(b.areasM[0].ancho).toBe(6);         // metros, la verdad
    expect(b.areas[0].ancho).toBe(6000);       // mm, derivado consistente
    expect(b.areas).toEqual(aMM(b.areasM));    // nunca dos verdades
  });

  // ---- GATES del Floor Editor (criterios de cierre) ----

  it('GATE 1 · areasM→areas→areasM IDÉNTICO a 1 mm, aunque entre ruido de float', () => {
    const ruidoso = [{ nombre: 'A', ancho: 2.3999999997, largo: 1.6500000002, x: 0.1000000001, y: 0.2,
      poly: [[0, 0], [2.3999999997, 0], [2.4, 1.65]], obstaculos: [{ x: 0.3999999, y: 0.5, w: 0.4, h: 0.4, tipo: 'columna' }] }];
    const canon = cuantizar(ruidoso);
    // tras cuantizar, el round-trip es punto fijo (idempotente) — cero deriva.
    expect(cuantizar(canon)).toEqual(canon);
    expect(aMetros(aMM(canon))).toEqual(canon);
    expect(canon[0].ancho).toBe(2.4);
    expect(canon[0].obstaculos[0].x).toBe(0.4);
  });

  it('GATE 2 · legacy abre y guarda sin moverse (load→save→load idempotente)', () => {
    const legacy = { areas: [{ nombre: 'Open', ancho: 6000, largo: 4000, obstaculos: [{ x: 1000, y: 1000, w: 400, h: 400, tipo: 'columna' }] }] };
    const cargado1 = areasCanonicas(legacy);
    const guardado = bloqueGeometria(cargado1);
    const cargado2 = areasCanonicas(guardado);
    expect(cargado2).toEqual(cargado1);        // no se movió nada
  });

  it('GATE 4 · puertas/muros/columnas/zonas sobreviven save→reload', () => {
    const full = [{ nombre: 'Open', ancho: 6, largo: 4, dentroDe: null, contiene: ['juntas'], nivel: 1,
      obstaculos: [{ x: 1, y: 1, w: 0.4, h: 0.4, tipo: 'columna' }, { x: 2, y: 0, w: 0.1, h: 3, tipo: 'muro' }],
      puertas: [{ x: 0, y: 2, ancho: 0.9 }] }];
    const reload = areasCanonicas(bloqueGeometria(full))[0];
    expect(reload.puertas).toHaveLength(1);
    expect(reload.obstaculos.map((o) => o.tipo)).toEqual(['columna', 'muro']);
    expect(reload.contiene).toEqual(['juntas']);
    expect(reload.nivel).toBe(1);
  });

  it('GATE 7 · planner/reacomodar: acomodarLocal da el MISMO resultado sobre áreas canónicas', () => {
    const areasM = [{ nombre: 'Operativa', tipo: 'open', ancho: 6, largo: 5 }];
    const piezas = [{ id: 'd1', nombre: 'Escritorio', w: 1500, d: 700, tipo: 'escritorio' }, { id: 's1', nombre: 'Silla', w: 600, d: 600, tipo: 'asiento' }];
    const r1 = acomodarLocal(aMM(areasM), piezas, {});
    const r2 = acomodarLocal(aMM(cuantizar(areasM)), piezas, {});
    // cuantizar no cambia la geometría canónica → el motor produce lo mismo (determinista).
    expect(r2.colocacion).toEqual(r1.colocacion);
    expect(r2.caben).toBe(r1.caben);
  });
});
