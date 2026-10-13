// ============================================================================
//  ACOMODO 10 · VH-A10-02 (RC) · LAS SILLAS CABEN: holgura de acceso detrás de cada silla.
//
//  El kit de una banca doble medía cubierta + 600 mm de silla por cara, sin el piso para retirar la
//  silla y levantarse. El solver pega los kits al muro primero, así que las sillas quedaban contra el
//  muro o contra una columna: "pegada al muro: no hay espacio para sentarse" (C4), "bloqueada por una
//  columna" (C2, C5) o "acceso justo (100 / 500 mm)". Geometría de las pruebas = la de la lectura REAL
//  de los planos del laboratorio (lab/noche/p10x/cotizar): OPERATIVA de C5 (14 × 8 m, columna P1) y de
//  C2 (16 × 8 m con el lobby curvo, columnas P1/P2).
//  El objetivo de acceso es el MISMO de siempre (600 mm: QUALITY_ACCESS_TARGET_MM / ACCESO_EJECUTIVO).
// ============================================================================
import { describe, it, expect } from 'vitest';
import { componerKit, resolverKitsMulti } from './kit-solver.js';
import { construirRespuestaAcomodo } from './recoveryPipeline.js';
import { juzgarSemantico, QUALITY_ACCESS_TARGET_MM } from './semanticPlacementJudge.js';

const banca = (id, w, usuarios, zona = 'OPERATIVA') => ([
  { id, nombre: `Módulo operativo App LT ${usuarios} usuarios`, relation_role: 'ANCHOR_WORKSTATION', w, d: 1200, tipo: 'escritorio', zone_id: zona,
    functional_group_id: `fg:${id}`, user_capacity: usuarios, placement_profile: { topology: 'DOUBLE_FACE', provenance: 'CATALOG' } },
  ...Array.from({ length: usuarios }, (_, i) => ({ id: `${id}-silla-${i + 1}`, nombre: 'Silla operativa WIN', relation_role: 'WORK_SEAT', anchor_role: 'ANCHOR_WORKSTATION',
    anchor_instance_id: id, functional_group_id: `fg:${id}`, w: 600, d: 600, tipo: 'asiento', zone_id: zona })),
]);

// OPERATIVA de C5_ele (lectura real, mm locales).
const OPERATIVA_C5 = { nombre: 'OPERATIVA', tipo: 'open', ancho: 14000, largo: 8000, poly: [[0, 0], [14000, 0], [14000, 8000], [0, 8000]],
  obstaculos: [{ x: 6800, y: 3800, w: 400, h: 400, tipo: 'columna', clave: 'P1' }, { x: 6100, y: 7100, w: 1800, h: 1800, tipo: 'puerta' },
    { x: 13100, y: 1100, w: 1800, h: 1800, tipo: 'puerta' }, { x: 13100, y: 5000, w: 1800, h: 1800, tipo: 'puerta' }],
  puertas: [
    { x: 7000, y: 8000, ancho: 900, tieneBarrido: true, bisagraX: 7450, bisagraY: 8000, anguloCerradaDeg: 180, sentido: 'horario', barridoDeg: 90 },
    { x: 14000, y: 2000, ancho: 900, tieneBarrido: true, bisagraX: 14000, bisagraY: 1550, anguloCerradaDeg: 90, sentido: 'antihorario', barridoDeg: 90 },
    { x: 14000, y: 5900, ancho: 900, tieneBarrido: true, bisagraX: 14000, bisagraY: 5450, anguloCerradaDeg: 90, sentido: 'antihorario', barridoDeg: 90 }] };

// OPERATIVA de C2_curvo (lectura real: 16 × 8 m menos el lobby curvo).
const OPERATIVA_C2 = { nombre: 'OPERATIVA', tipo: 'open', ancho: 16000, largo: 8000,
  poly: [[6000, 0], [16000, 0], [16000, 8000], [0, 8000], [0, 6000], [1042, 5909], [2052, 5638], [3000, 5196], [3857, 4596], [4596, 3857], [5196, 3000], [5638, 2052], [5909, 1042]],
  obstaculos: [{ x: 7840, y: 3800, w: 400, h: 400, tipo: 'columna', clave: 'P1' }, { x: 13850, y: 3850, w: 400, h: 400, tipo: 'columna', clave: 'P2' },
    { x: 3050, y: 7100, w: 1800, h: 1800, tipo: 'puerta' }, { x: 11150, y: 7100, w: 1800, h: 1800, tipo: 'puerta' }],
  puertas: [
    { x: 3950, y: 8000, ancho: 900, tieneBarrido: true, bisagraX: 3500, bisagraY: 8000, anguloCerradaDeg: 0, sentido: 'antihorario', barridoDeg: 90 },
    { x: 12050, y: 8000, ancho: 900, tieneBarrido: true, bisagraX: 12500, bisagraY: 8000, anguloCerradaDeg: 180, sentido: 'horario', barridoDeg: 90 }] };

const problemasDeAcceso = (areas, r) => juzgarSemantico(areas, r.plan.piezas, r.plan.colocacion).issues
  .filter((i) => /^ACTIVE_SIDE_/.test(i.code));

describe('VH-A10-02 · el kit reserva la holgura para retirar la silla', () => {
  it('banca doble: 600 mm de acceso detrás de cada fila, fuera del cuerpo del kit', () => {
    const [ancla, ...sillas] = banca('b', 4800, 8);
    const k = componerKit(ancla, sillas, []);
    expect(k.d).toBe(1200 + 2 * 600 + 2 * QUALITY_ACCESS_TARGET_MM);   // cubierta + 2 sillas + 2 franjas
    expect(k.cuerpo).toEqual({ x: 0, y: 600, w: 4800, d: 2400 });        // lo que ocupa piso (para el pasillo de 1 m)
    expect(k.franjas).toHaveLength(8);
    for (const f of k.franjas) expect(f.d).toBe(600);
  });
  it('C5 · OPERATIVA 14 × 8 m con columna: las 20 sillas con acceso ≥ 600 mm (antes, una contra la columna)', () => {
    const areas = [OPERATIVA_C5];
    const r = construirRespuestaAcomodo(areas, [...banca('b1', 6000, 10), ...banca('b2', 6000, 10)]);
    expect(r.plan.colocacion).toHaveLength(22);
    expect(problemasDeAcceso(areas, r)).toEqual([]);
    expect(r.status).toBe('PASS');
  });
  it('C2 · OPERATIVA curva 16 × 8 m con dos columnas: 16 sillas con acceso ≥ 600 mm (antes, una bloqueada y otra a 500 mm)', () => {
    const areas = [OPERATIVA_C2];
    const r = construirRespuestaAcomodo(areas, [...banca('b1', 4800, 8), ...banca('b2', 4800, 8)]);
    expect(r.plan.colocacion).toHaveLength(18);
    expect(problemasDeAcceso(areas, r)).toEqual([]);
    expect(r.status).toBe('PASS');
  });
  it('sin piso para la holgura no se inventa: la banca cabe pegada y el juez lo sigue marcando', () => {
    // 4.8 × 2.4 m: entra la banca con sus sillas, NO entran las franjas. Se coloca (no se pierde el mueble)
    // y la revisión semántica dice "pegada al muro" — nunca PASS.
    const areas = [{ nombre: 'OPERATIVA', tipo: 'open', ancho: 4800, largo: 2400, puertas: [] }];
    const r = construirRespuestaAcomodo(areas, banca('b', 4800, 8));
    expect(r.plan.colocacion).toHaveLength(9);
    expect(problemasDeAcceso(areas, r).some((i) => i.code === 'ACTIVE_SIDE_BLOCKED_BY_WALL')).toBe(true);
    expect(r.status).not.toBe('PASS');
  });
  it('el mínimo (mueble sin sus sillas) ya no arrastra el desfase de la silla: el directivo entra aunque su silla no', () => {
    // 2.5 × 1.9 m: el módulo directivo de 1.8 × 2.4 m cabe girado; con su ejecutivo y su franja, no. Antes el
    // "mínimo" conservaba los 1.2 m de la silla y la franja y pedía 3.6 m: el mueble salía como "no cupo".
    const areas = [{ nombre: 'PRIVADO B', tipo: 'privado', ancho: 2500, largo: 1900, puertas: [] }];
    const piezas = [
      { id: 'dir', nombre: 'Módulo directivo App LT', relation_role: 'ANCHOR_DESK', w: 1800, d: 2400, zone_id: 'PRIVADO B', functional_group_id: 'fg:dir' },
      { id: 'alpha', nombre: 'Silla directiva ALPHA', relation_role: 'EXECUTIVE_SEAT', anchor_role: 'ANCHOR_DESK', anchor_instance_id: 'dir', functional_group_id: 'fg:dir', w: 600, d: 600, zone_id: 'PRIVADO B' },
    ];
    const r = resolverKitsMulti(areas, piezas);
    expect(r.colocacion.map((c) => c.id)).toEqual(['dir']);
    expect(r.unplaced).toEqual([expect.objectContaining({ anchorId: 'dir', invariante: 'NO_SPACE_PARA_SILLAS', piezas: ['alpha'] })]);
  });
  it('la holgura nunca cae sobre una columna', () => {
    const areas = [{ nombre: 'OPERATIVA', tipo: 'open', ancho: 6000, largo: 5000, puertas: [], obstaculos: [{ x: 2600, y: 700, w: 400, h: 400, tipo: 'columna' }] }];
    const r = resolverKitsMulti(areas, banca('b', 4800, 8));
    expect(problemasDeAcceso(areas, { plan: r })).toEqual([]);
  });
});
