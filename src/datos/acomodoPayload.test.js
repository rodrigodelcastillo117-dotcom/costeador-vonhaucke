import { describe, it, expect } from 'vitest';
import { programHash, floorHash, planEstaStale, serializarEstable } from './acomodoHash.js';
import { construirPayloadAcomodo, validarFloorSpecGeom } from './acomodoPayload.js';

const PARTIDAS = [
  { id: 'e-win', piezaId: 'silla-win', nombre: 'Silla operativa WIN', cantidad: 10, precioUnitario: 5210, relation_role: 'WORK_SEAT' },
  { id: 'e-mesa', piezaId: 'mj-1200x1200-melamina', nombre: 'Mesa de juntas (1200 x 1200)', cantidad: 1, precioUnitario: 5510, relation_role: 'ANCHOR_MEETING' },
];
const AREAS_M = [
  { nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 8, largo: 3.2, puestos: 10 },
  { nombre: 'SALA DE CONSEJO', tipo: 'juntas', ancho: 7, largo: 3.2 },
];

describe('acomodoHash · program_hash (P0.2 obj 10)', () => {
  it('es estable ante reordenamiento de la lista', () => {
    const a = programHash(PARTIDAS);
    const b = programHash([...PARTIDAS].reverse());
    expect(a).toBe(b);
  });
  it('IGNORA precio/costo (no afectan el layout)', () => {
    const base = programHash(PARTIDAS);
    const otroPrecio = programHash(PARTIDAS.map((p) => ({ ...p, precioUnitario: 99999, costoUnitario: 123 })));
    expect(otroPrecio).toBe(base);
  });
  it('CAMBIA cuando cambia la cantidad', () => {
    const base = programHash(PARTIDAS);
    const masSillas = programHash(PARTIDAS.map((p) => (p.id === 'e-win' ? { ...p, cantidad: 11 } : p)));
    expect(masSillas).not.toBe(base);
  });
  it('CAMBIA cuando cambia la geometría (w/d) aunque el conteo sea igual', () => {
    const base = programHash(PARTIDAS);
    const otraGeo = programHash(PARTIDAS.map((p) => (p.id === 'e-mesa' ? { ...p, w: 3000, d: 1200 } : p)));
    expect(otraGeo).not.toBe(base);
  });
  it('CAMBIA cuando cambia el rol estructural', () => {
    const base = programHash(PARTIDAS);
    const otroRol = programHash(PARTIDAS.map((p) => (p.id === 'e-win' ? { ...p, relation_role: 'VISITOR_SEAT' } : p)));
    expect(otroRol).not.toBe(base);
  });
});

describe('acomodoHash · floor_hash (P0.2 obj 10)', () => {
  it('CAMBIA al redimensionar un área (el bug que el conteo no veía)', () => {
    const base = floorHash(AREAS_M);
    const masGrande = floorHash(AREAS_M.map((a, i) => (i === 0 ? { ...a, ancho: 9 } : a)));
    expect(masGrande).not.toBe(base);
  });
  it('es sensible al ORDEN de áreas (índice de área = identidad)', () => {
    const base = floorHash(AREAS_M);
    const reordenado = floorHash([...AREAS_M].reverse());
    expect(reordenado).not.toBe(base);
  });
  it('CAMBIA al agregar una puerta u obstáculo', () => {
    const base = floorHash(AREAS_M);
    const conPuerta = floorHash(AREAS_M.map((a, i) => (i === 0 ? { ...a, puertas: [{ x: 1, y: 0, ancho: 0.9 }] } : a)));
    const conObst = floorHash(AREAS_M.map((a, i) => (i === 0 ? { ...a, obstaculos: [{ x: 1, y: 1, w: 0.5, h: 0.5, tipo: 'columna' }] } : a)));
    expect(conPuerta).not.toBe(base);
    expect(conObst).not.toBe(base);
  });
});

describe('acomodoHash · planEstaStale', () => {
  const ph = programHash(PARTIDAS); const fh = floorHash(AREAS_M);
  it('plan sin hashes previos (legacy) no se marca stale aquí', () => {
    expect(planEstaStale({ colocacion: [] }, ph, fh)).toBe(false);
  });
  it('stale si cambió program_hash o floor_hash', () => {
    expect(planEstaStale({ program_hash: ph, floor_hash: fh }, ph, fh)).toBe(false);
    expect(planEstaStale({ program_hash: 'p_viejo', floor_hash: fh }, ph, fh)).toBe(true);
    expect(planEstaStale({ program_hash: ph, floor_hash: 'f_viejo' }, ph, fh)).toBe(true);
  });
  it('serializarEstable ordena claves de forma determinista', () => {
    expect(serializarEstable({ b: 1, a: 2 })).toBe(serializarEstable({ a: 2, b: 1 }));
  });
});

describe('acomodoPayload · construirPayloadAcomodo (P0.2 obj 1/2/3)', () => {
  it('happy path: payload canónico con áreas mm, piezas, hashes y requested', () => {
    const r = construirPayloadAcomodo({ partidas: PARTIDAS, areasM: AREAS_M });
    expect(r.ok).toBe(true);
    expect(r.areas).toHaveLength(2);
    expect(r.areas[0].ancho).toBe(8000);            // metros → mm
    expect(r.piezas.length).toBeGreaterThan(0);
    expect(r.program_hash).toMatch(/^p_/);
    expect(r.floor_hash).toMatch(/^f_/);
    expect(r.requested).toBe(r.piezas.length);
    expect(r.descartadosSugeridos).toBe(0);
  });

  it('obj 2: descarta sug-* SIEMPRE y deja rastro (descartadosSugeridos)', () => {
    const conSug = [
      ...PARTIDAS,
      { id: 'sug-1', piezaId: 'silla-win', nombre: 'Silla sugerida', cantidad: 3 },
      { id: 'x', sugeridoPlano: true, piezaId: 'mesa-x', nombre: 'Mesa sugerida', cantidad: 1 },
    ];
    const r = construirPayloadAcomodo({ partidas: conSug, areasM: AREAS_M });
    expect(r.ok).toBe(true);
    expect(r.descartadosSugeridos).toBe(2);
    expect(r.piezas.every((p) => !String(p.id).startsWith('sug-'))).toBe(true);
  });

  it('obj 1: sin partidas confirmadas → rechazo explícito, NO payload', () => {
    const soloSug = [{ id: 'sug-1', nombre: 'x', cantidad: 2 }];
    const r = construirPayloadAcomodo({ partidas: soloSug, areasM: AREAS_M });
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('SIN_PARTIDAS_CONFIRMADAS');
    expect(r.descartadosSugeridos).toBe(1);
  });

  it('obj 3: sin FloorSpec → rechazo SIN_FLOORSPEC (no se acomoda)', () => {
    const r = construirPayloadAcomodo({ partidas: PARTIDAS, areasM: [] });
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('SIN_FLOORSPEC');
  });

  it('obj 3: FloorSpec con área degenerada → FLOORSPEC_INVALIDO con detalle', () => {
    const malas = [{ nombre: 'MALA', ancho: 0, largo: 3 }];
    const r = construirPayloadAcomodo({ partidas: PARTIDAS, areasM: malas });
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('FLOORSPEC_INVALIDO');
    expect(r.detalles.some((d) => d.includes('AREA_ANCHO_INVALIDO'))).toBe(true);
  });

  it('validarFloorSpecGeom detecta vacío y dimensiones no finitas', () => {
    expect(validarFloorSpecGeom([]).ok).toBe(false);
    expect(validarFloorSpecGeom([{ nombre: 'a', ancho: 4, largo: 3 }]).ok).toBe(true);
    expect(validarFloorSpecGeom([{ nombre: 'a', ancho: NaN, largo: 3 }]).ok).toBe(false);
  });
});
