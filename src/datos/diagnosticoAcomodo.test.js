import { describe, it, expect } from 'vitest';
import { diagnosticoNoColocadas, resumenDiagnostico } from './diagnosticoAcomodo.js';
import { expandirPiezas } from './espacio.js';
import { construirPayloadAcomodo } from './acomodoPayload.js';

const areas = [{ nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 8000, largo: 3200 }, { nombre: 'SALA DE CONSEJO', tipo: 'juntas', ancho: 7000, largo: 3200 }];
const piezas = [
  { id: 'b-1', nombre: 'Banca doble APP LT 8 usuarios', relation_role: 'ANCHOR_WORKSTATION', instance_id: 'inst:op', requirement_id: 'req:op', functional_group_id: 'fg:op', zone_id: 'ÁREA OPERATIVA', w: 6000, d: 1200, huella_fuente: 'PARTIDA', elegibilidad: 'CONFIRMADO' },
  { id: 'b2-1', nombre: 'Módulo operativo App LT 8 usuarios', relation_role: 'ANCHOR_WORKSTATION', instance_id: 'inst:op', requirement_id: 'req:op', functional_group_id: 'fg:op', zone_id: 'ÁREA OPERATIVA', w: 4800, d: 1200, huella_fuente: 'PARTIDA', elegibilidad: 'PRELIMINAR' },
  { id: 'w-1', nombre: 'Silla operativa WIN', relation_role: 'WORK_SEAT', anchor_instance_id: 'b-1', functional_group_id: 'fg:op', w: 600, d: 600, huella_fuente: 'INFERIDA', elegibilidad: 'CONFIRMADO' },
  { id: 'w-9', nombre: 'Silla operativa WIN', relation_role: 'WORK_SEAT', functional_group_id: 'fg:libre:open', w: 600, d: 600, huella_fuente: 'INFERIDA', elegibilidad: 'CONFIRMADO' },
  { id: 'm-1', nombre: 'Mesa de juntas 3.00', relation_role: 'ANCHOR_MEETING', instance_id: 'inst:mj', zone_id: 'SALA DE CONSEJO', w: 3000, d: 1200, huella_fuente: 'NOMBRE', elegibilidad: 'CONFIRMADO' },
  { id: 's-1', nombre: 'Silla SONATA', relation_role: 'MEETING_SEAT', anchor_instance_id: 'm-1', w: 600, d: 600, huella_fuente: 'INFERIDA', elegibilidad: 'CONFIRMADO' },
  { id: 'c-1', nombre: 'Credenza', relation_role: 'SUPPORT_STORAGE', w: 2100, d: 600, huella_fuente: 'PARTIDA', elegibilidad: 'CONFIRMADO' },
];
const plan = {
  colocacion: [{ id: 'b-1', area: 0, x: 0, y: 0 }, { id: 'w-1', area: 0, x: 0, y: 1500 }],
  unassigned: ['w-9', 'c-1'],
  no_cupieron: [{ anchorId: 'm-1', piezas: ['m-1', 's-1'], invariante: 'NO_SPACE' }],
};

describe('VH-093 · diagnóstico por pieza', () => {
  const filas = diagnosticoNoColocadas({ piezas, plan, excluidas: [{ id: 'x-1', nombre: 'Mueble sin catálogo', codigo: 'UNRESOLVED_PRODUCT' }], areas });
  const por = (id) => filas.find((f) => f.id === id);
  it('cada pieza no colocada tiene código, zona, medida con fuente y acción', () => {
    expect(filas.map((f) => f.id).sort()).toEqual(['b2-1', 'c-1', 'm-1', 's-1', 'w-9', 'x-1'].sort());
    for (const f of filas) { expect(f.codigo).toBeTruthy(); expect(f.accion).toBeTruthy(); }
    expect(por('m-1').zona).toBe('SALA DE CONSEJO');
    expect(por('m-1').huella_fuente).toBe('nombre comercial');
  });
  it('dos anclas para el mismo requerimiento → DUPLICATED_REQUIREMENT (no "capacidad del catálogo")', () => {
    expect(por('b2-1').codigo).toBe('DUPLICATED_REQUIREMENT');
  });
  it('silla sin ancla → MISSING_ANCHOR; mesa que no cupo → NO_SPACE; su silla → DEPENDENCY_MISMATCH', () => {
    expect(por('w-9').codigo).toBe('MISSING_ANCHOR');
    expect(por('m-1').codigo).toBe('NO_SPACE');
    expect(por('s-1').codigo).toBe('DEPENDENCY_MISMATCH');
    expect(por('s-1').motivo).toMatch(/Mesa de juntas/);
  });
  it('referencia sin identidad → UNRESOLVED_PRODUCT; huella supuesta se señala como secundario', () => {
    expect(por('x-1').codigo).toBe('UNRESOLVED_PRODUCT');
    expect(por('w-9').secundarios).toContain('UNKNOWN_FOOTPRINT');   // en el fixture la silla viene INFERIDA a propósito
  });
  it('resumen por código', () => {
    const r = Object.fromEntries(resumenDiagnostico(filas).map((x) => [x.codigo, x.n]));
    expect(r.MISSING_ANCHOR).toBe(2);
    expect(r.DUPLICATED_REQUIREMENT).toBe(1);
  });
});

describe('VH-092 · elegibilidad A/B/C en el payload del solver', () => {
  const partidas = [
    { id: 'p1', nombre: 'Banca doble APP LT 8 usuarios · ocupa 6.00 × 1.20 m', piezaId: 'linea-banca_doble', productoId: 'banca_doble', cantidad: 1, precioUnitario: 26145, w: 6000, d: 1200 },
    { id: 'p2', nombre: 'Módulo directivo App LT', bancoId: 'dir-1800x2400', productoId: 1904, cantidad: 1, sinPrecioAutorizado: true, relation_role: 'ANCHOR_DESK', w: 1800, d: 2400 },
    { id: 'p3', nombre: 'Mueble que alguien tecleó', cantidad: 2, precioUnitario: 0 },
    { id: 'p4', nombre: 'Silla operativa · WIN', piezaId: 'p9-silla-operativa-win-5210', cantidad: 2, precioUnitario: 5210 },
  ];
  const payload = construirPayloadAcomodo({ partidas, areasM: [{ nombre: 'OP', tipo: 'open', ancho: 8, largo: 3.2 }] });
  it('CONFIRMADO / PRELIMINAR / REFERENCIA se separan; la referencia se dibuja pero queda listada y bloquea VALIDADO', () => {
    expect(payload.ok).toBe(true);
    const e = Object.fromEntries(payload.piezas.map((p) => [p.id, p.elegibilidad]));
    expect(e['p1-1']).toBe('CONFIRMADO');
    expect(e['p2-1']).toBe('PRELIMINAR');
    expect(e['p3-1']).toBe('REFERENCIA');
    expect(e['p4-1']).toBe('CONFIRMADO');
    expect(payload.referencias.map((x) => x.id)).toEqual(['p3-1', 'p3-2']);
    expect(payload.referencias[0].codigo).toBe('UNRESOLVED_PRODUCT');
    expect(payload.requested).toBe(6);
  });
  it('la procedencia de la huella viaja con cada pieza; producto sin precio autorizado ⇒ acomodo PRELIMINAR', () => {
    const h = Object.fromEntries(payload.piezas.map((p) => [p.id, p.huella_fuente]));
    expect(h['p1-1']).toBe('PARTIDA');
    expect(h['p4-1']).toBe('ESTANDAR');                      // silla: huella estándar, no supuesta
    expect(payload.preliminar).toBe(true);                     // por el módulo directivo sin precio autorizado
    expect(payload.resumenElegibilidad).toEqual({ confirmadas: 3, preliminares: 1, huellasInferidas: 2, referencias: 2 });
    // un mueble tecleado sin medida queda con huella supuesta (INFERIDA) → diagnóstico UNKNOWN_FOOTPRINT si no cupo
    expect(payload.piezas.find((p) => p.id === 'p3-1').huella_fuente).toBe('INFERIDA');
  });
});

describe('VH-094 · la banca 6000×1200 llega con su huella real hasta la pieza del solver', () => {
  it('expandirPiezas conserva 6000×1200 y la marca como ancla de 8 usuarios', () => {
    const [pz] = expandirPiezas([{ id: 'b', nombre: 'Banca doble APP LT 1.50 · 8 usuarios · ocupa 6.00 × 1.20 m', piezaId: 'linea-banca_doble', productoId: 'banca_doble', cantidad: 1, precioUnitario: 26145, w: 6000, d: 1200 }]);
    expect([pz.w, pz.d]).toEqual([6000, 1200]);
    expect(pz.relation_role).toBe('ANCHOR_WORKSTATION');
    expect(pz.tipo).toBe('escritorio');
    expect(pz.huella_fuente).toBe('PARTIDA');
  });
});
