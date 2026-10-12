// ============================================================================
//  VH-092 / VH-095 (2026-10-12) · REPRODUCCIÓN de la cotización 757 real:
//  18 partidas (7 del programa del plano + 11 de VONI texto) → el solver colocó 9
//  y declaró 25 "sin un mueble que las reciba". Causa: las partidas de VONI no
//  traían relation_role y el solver sólo coloca piezas con rol; el módulo de 8
//  usuarios se clasificaba 'mampara' (4800×80) por la palabra "biombo".
//  Aquí: expandirPiezas (cliente) + asignarDuenos (edge) sobre esas partidas.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { expandirPiezas, tipoDe } from '../../../src/datos/espacio.js';
import { asignarDuenos } from './kit-solver.js';
import { mensajeVendedor } from './opciones.js';

const partidas757 = [
  { id: 'a1', nombre: 'Módulo operativo App LT 8 usuarios (biombo cristal)', bancoId: 'op-8u-4800x1200-cristal', piezaId: 'op-8u-4800x1200-cristal', relation_role: 'ANCHOR_WORKSTATION', instance_id: 'inst:op', functional_group_id: 'fg:op', zone_id: 'ÁREA OPERATIVA', w: 4800, d: 1200, user_capacity: 8, cantidad: 1, source: 'CONFIRMADO_PROGRAMA' },
  { id: 'a2', nombre: 'Módulo directivo App LT', bancoId: 'dir-1800x2400', piezaId: 'dir-1800x2400', relation_role: 'ANCHOR_DESK', instance_id: 'inst:dir', functional_group_id: 'fg:dir', zone_id: 'OFICINA CEO', w: 1800, d: 2400, cantidad: 1, source: 'CONFIRMADO_PROGRAMA' },
  { id: 'a3', nombre: 'Mesa de juntas', bancoId: 'mj-900x900-melamina', piezaId: 'mj-900x900-melamina', relation_role: 'ANCHOR_MEETING', instance_id: 'inst:mj', functional_group_id: 'fg:mj', zone_id: 'SALA DE CONSEJO', w: 900, d: 900, cantidad: 1, source: 'CONFIRMADO_PROGRAMA' },
  { id: 'a4', nombre: 'Módulo recepción 2 usuarios', bancoId: 'rec-2420x830', piezaId: 'rec-2420x830', relation_role: 'ANCHOR_RECEPTION', instance_id: 'inst:rec', functional_group_id: 'fg:rec', zone_id: 'RECEPCIÓN', w: 2420, d: 830, cantidad: 1, source: 'CONFIRMADO_PROGRAMA' },
  { id: 'd1', nombre: 'Silla directiva ALPHA', bancoId: 'silla-alpha', piezaId: 'silla-alpha', relation_role: 'EXECUTIVE_SEAT', anchor_role: 'ANCHOR_DESK', anchor_instance_id: 'inst:dir', functional_group_id: 'fg:dir', cantidad: 1, source: 'CONFIRMADO_PROGRAMA' },
  { id: 'd2', nombre: 'Silla CONCERTO (visita 4 pts)', bancoId: 'silla-concerto', piezaId: 'silla-concerto', relation_role: 'MEETING_SEAT', anchor_role: 'ANCHOR_MEETING', anchor_instance_id: 'inst:mj', functional_group_id: 'fg:mj', cantidad: 4, source: 'CONFIRMADO_PROGRAMA' },
  { id: 'p-1', nombre: 'Banca doble APP LT 1.50 · 8 usuarios · ocupa 6.00 × 1.20 m', piezaId: 'linea-banca_doble', productoId: 'banca_doble', cantidad: 1, w: 6000, d: 1200, origen: 'ia' },
  { id: 'p-2', nombre: 'Eclipse Escritorio Directivo 2.10 m · mano Derecha', piezaId: 'linea-escritorio', productoId: 'escritorio', cantidad: 1, w: 2100, d: 900, origen: 'ia' },
  { id: 'p-3', nombre: 'Eclipse Credenza baja 2.10 × 0.60 m · mano Derecha', piezaId: 'linea-credenza', productoId: 'credenza', cantidad: 1, w: 2100, d: 600, origen: 'ia' },
  { id: 'p-4', nombre: 'Mesa de juntas APP LT 1.20 × 1.20', piezaId: 'linea-mesa_juntas', productoId: 'mesa_juntas', cantidad: 1, w: 1200, d: 1200, origen: 'ia' },
  { id: 'p-5', nombre: 'Mox · Gaveta pedestal 3 cajones · frentes melamina', piezaId: 'linea-pedestal', productoId: 'pedestal', cantidad: 8, w: 380, d: 456, origen: 'ia' },
  { id: 'p-6', nombre: 'Modulor · Archivero horizontal 0.90 · 2 puertas · Melamina y canto ABS', piezaId: 'linea-archivero_h', productoId: 'archivero_h', cantidad: 1, w: 749, d: 900, origen: 'ia' },
  { id: 'p-7', nombre: 'Silla operativa · WIN', piezaId: 'p9-silla-operativa-win-5210', cantidad: 8, origen: 'banco' },
  { id: 'p-8', nombre: 'Silla directiva ALPHA', piezaId: 'silla-alpha', cantidad: 1, origen: 'banco' },
  { id: 'p-9', nombre: 'Silla de visita · CONCERTO', piezaId: 'p9-silla-de-visita-concerto-5470', cantidad: 2, origen: 'banco' },
  { id: 'p-10', nombre: 'Silla · SONATA', piezaId: 'p9-silla-sonata-2420-144', cantidad: 4, origen: 'banco' },
  { id: 'p-11', nombre: 'Recepción (2420 × 830 mm)', piezaId: 'p9-recepcion-29920', cantidad: 1, origen: 'banco' },
  { id: 'd3', nombre: 'Silla SONATA (visita 4 pts)', bancoId: 'silla-sonata', piezaId: 'silla-sonata', relation_role: 'MEETING_SEAT', anchor_role: 'ANCHOR_MEETING', anchor_instance_id: 'inst:mj', functional_group_id: 'fg:mj', cantidad: 4, source: 'CONFIRMADO_PROGRAMA' },
];

describe('VH-095 · el módulo de 8 usuarios NO es una mampara', () => {
  it('tipoDe: "Módulo operativo App LT 8 usuarios (biombo cristal)" → escritorio', () => {
    expect(tipoDe({ nombre: 'Módulo operativo App LT 8 usuarios (biombo cristal)' })).toBe('escritorio');
    expect(tipoDe({ nombre: 'Biombo divisor 6 mm' })).toBe('mampara');          // una mampara real sigue siéndolo
  });
  it('expandirPiezas conserva 4800×1200 (antes 4800×80: la "línea" del plano 2D)', () => {
    const pz = expandirPiezas([partidas757[0]]);
    expect(pz[0].w).toBe(4800);
    expect(pz[0].d).toBe(1200);
    expect(pz[0].tipo).toBe('escritorio');
  });
});

describe('VH-092 · las partidas de VONI entran al solver con ROL y encuentran su mueble', () => {
  const piezas = expandirPiezas(partidas757);

  it('toda pieza que sale al solver trae relation_role (inferido cuando la partida no lo traía)', () => {
    expect(piezas.every((p) => typeof p.relation_role === 'string')).toBe(true);
    const banca = piezas.find((p) => p.id === 'p-1-1');
    expect(banca.relation_role).toBe('ANCHOR_WORKSTATION');
    expect(banca.relation_role_inferida).toBe(true);
    expect(piezas.find((p) => p.id === 'p-2-1').relation_role).toBe('ANCHOR_DESK');
    expect(piezas.find((p) => p.id === 'p-4-1').relation_role).toBe('ANCHOR_MEETING');
    expect(piezas.find((p) => p.id === 'p-11-1').relation_role).toBe('ANCHOR_RECEPTION');
    expect(piezas.find((p) => p.id === 'p-7-1').relation_role).toBe('WORK_SEAT');
    expect(piezas.find((p) => p.id === 'p-10-1').relation_role).toBe('MEETING_SEAT');
  });

  it('asignarDuenos: ya no hay 21 huérfanas; sólo sobran las sillas de más respecto al cupo real', () => {
    const { piezas: asig, unassigned } = asignarDuenos(piezas);
    // Antes: 25 sin dueño (21 de VONI + 4 sillas de juntas). Ahora: cada silla busca un ancla con cupo.
    expect(unassigned.length).toBeLessThan(25);
    const sinDueno = unassigned.map((id) => asig.find((p) => String(p.id) === String(id)));
    // Ninguna ANCLA puede quedar "sin dueño": un escritorio/mesa/recepción se coloca solo.
    expect(sinDueno.every((p) => !String(p.relation_role).startsWith('ANCHOR_'))).toBe(true);
    // Las 8 WIN de VONI encontraron la banca/módulo operativo (cupo 8 + 8 = 16 ≥ 8).
    const win = asig.filter((p) => p.id.startsWith('p-7-'));
    expect(win.every((p) => p.anchor_instance_id)).toBe(true);
    // El pedestal ×8 va bajo escritorio: no entra al solver (se cobra, no ocupa piso).
    expect(piezas.some((p) => p.id.startsWith('p-5-'))).toBe(false);
  });

  it('mensajeVendedor: pluraliza bien y nombra lo que no cupo (nunca "juntass" ni "capacidad del catálogo")', () => {
    const { piezas: asig, unassigned } = asignarDuenos(piezas);
    const areas = [{ nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 8000, largo: 3200 }];
    const mv = mensajeVendedor(areas, asig, { colocacion: [], unplaced: [], unassigned }, {});
    const txt = JSON.stringify(mv);
    expect(txt).not.toMatch(/juntass/);
    expect(txt).not.toMatch(/capacidad del catálogo/);
    if (unassigned.length) expect(txt).toMatch(/sin un escritorio\/mesa con lugar/);
  });
});
