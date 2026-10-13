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

// VH-110: la lista de observaciones semánticas del ganador viaja al cliente (antes sólo conteos).
import { describe as describeSem, it as itSem, expect as expectSem } from 'vitest';
import { construirRespuestaAcomodo as construirSem } from './recoveryPipeline.js';
describeSem('VH-110 · sem_issues en la respuesta', () => {
  itSem('seleccion.ganador_eval.sem_issues es un arreglo con code/severity y cuadra con los conteos', () => {
    const areas = [{ nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 6000, largo: 7000, x: 0, y: 0 }];
    const piezas = [
      { id: 'd1', nombre: 'Escritorio APP LT 1.50 × 0.75', w: 1500, d: 750, relation_role: 'ANCHOR_WORKSTATION', zone_id: 'ÁREA OPERATIVA', functional_group_id: 'fg:libre:general' },
      { id: 'd2', nombre: 'Escritorio APP LT 1.50 × 0.75', w: 1500, d: 750, relation_role: 'ANCHOR_WORKSTATION', zone_id: 'ÁREA OPERATIVA', functional_group_id: 'fg:libre:general' },
    ];
    const r = construirSem(areas, piezas);
    const ge = r.layoutSpec.seleccion.ganador_eval;
    expectSem(Array.isArray(ge.sem_issues)).toBe(true);
    expectSem(ge.sem_issues.filter((i) => i.severity === 'fail').length).toBe(ge.semFail);
    expectSem(ge.sem_issues.filter((i) => i.severity === 'review').length).toBe(ge.semReview);
    for (const i of ge.sem_issues) expectSem(typeof i.code).toBe('string');
  });
});

// VH-112 · el solver sienta a los 8 WIN en la banca "8 usuarios" aunque el cliente no mande user_capacity.
import { capacidadAncla as capAncla } from './kit-solver.js';
describeSem('VH-112 · capacidad de la banca', () => {
  itSem('capacidadAncla: user_capacity > nombre "8 usuarios" > topología doble > ancho/1500', () => {
    expectSem(capAncla({ relation_role: 'ANCHOR_WORKSTATION', w: 6000, d: 1200, user_capacity: 8 })).toBe(8);
    expectSem(capAncla({ relation_role: 'ANCHOR_WORKSTATION', w: 6000, d: 1200, nombre: 'Banca doble APP LT 1.50 · 8 usuarios · ocupa 6.00 × 1.20 m' })).toBe(8);
    expectSem(capAncla({ relation_role: 'ANCHOR_WORKSTATION', w: 6000, d: 1200, nombre: 'Banca doble APP LT', placement_profile: { topology: 'DOUBLE_FACE' } })).toBe(8);
    expectSem(capAncla({ relation_role: 'ANCHOR_WORKSTATION', w: 6000, d: 1200, nombre: 'Módulo operativo' })).toBe(4);
  });
  itSem('8 WIN + banca "8 usuarios" sin user_capacity: 0 sin asignar', () => {
    const areas = [{ nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 8000, largo: 3200, x: 0, y: 0 }];
    const piezas = [
      { id: 'b-1', nombre: 'Banca doble APP LT 1.50 · 8 usuarios · ocupa 6.00 × 1.20 m', w: 6000, d: 1200, relation_role: 'ANCHOR_WORKSTATION', zone_id: 'ÁREA OPERATIVA', functional_group_id: 'fg:libre:operativo', placement_profile: { topology: 'DOUBLE_FACE', provenance: 'INFERRED' } },
      ...Array.from({ length: 8 }, (_, i) => ({ id: `w-${i + 1}`, nombre: 'Silla operativa · WIN', w: 600, d: 600, relation_role: 'WORK_SEAT', zone_id: 'ÁREA OPERATIVA', functional_group_id: 'fg:libre:operativo' })),
    ];
    const r = construirSem(areas, piezas);
    expectSem(r.layoutSpec.unassigned).toHaveLength(0);
    expectSem(r.plan.colocacion.length).toBe(9);
  });
});

describeSem('VH-112b · capacidad con tope geométrico y grupos libres repartidos', () => {
  itSem('user_capacity explícita se respeta hasta el tope físico (6 m: 20; 1.5 m: 4); dos bancas de 12 y 16 WIN: 0 encimados', () => {
    expectSem(capAncla({ relation_role: 'ANCHOR_WORKSTATION', w: 6000, d: 1200, user_capacity: 12 })).toBe(12);
    expectSem(capAncla({ relation_role: 'ANCHOR_WORKSTATION', w: 6000, d: 1200, user_capacity: 40 })).toBe(20);
    expectSem(capAncla({ relation_role: 'ANCHOR_WORKSTATION', w: 1500, d: 750, user_capacity: 8 })).toBe(4);
    expectSem(capAncla({ relation_role: 'ANCHOR_WORKSTATION', w: 4800, d: 1200, user_capacity: 8 })).toBe(8);
    const areas = [{ nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 14000, largo: 7000, x: 0, y: 0 }];
    const piezas = [
      ...[1, 2].map((i) => ({ id: `b-1-${i}`, nombre: 'Banca doble APP LT 1.50 · 8 usuarios · ocupa 6.00 × 1.20 m', w: 6000, d: 1200, relation_role: 'ANCHOR_WORKSTATION', zone_id: 'ÁREA OPERATIVA', functional_group_id: 'fg:req:ÁREA OPERATIVA:operativo:0:#1', user_capacity: 12, placement_profile: { topology: 'DOUBLE_FACE', provenance: 'INFERRED' } })),
      ...Array.from({ length: 16 }, (_, i) => ({ id: `w-1-${i + 1}`, nombre: 'Silla operativa · WIN', w: 600, d: 600, relation_role: 'WORK_SEAT', zone_id: 'ÁREA OPERATIVA', functional_group_id: 'fg:req:ÁREA OPERATIVA:operativo:0:#1' })),
    ];
    const r = construirSem(areas, piezas);
    expectSem(r.layoutSpec.validation.issues.filter((i) => i.severity === 'fail')).toEqual([]);
    expectSem(r.plan.colocacion.length).toBe(18);
  });
  itSem('16 SONATA de un grupo libre repartidas entre dos salas no son FUNCTIONAL_GROUP_SPLIT', () => {
    const areas = [{ nombre: 'SALA A', tipo: 'juntas', ancho: 6000, largo: 4000, x: 0, y: 0 }, { nombre: 'SALA B', tipo: 'juntas', ancho: 6000, largo: 4000, x: 7000, y: 0 }];
    const mesa = (id, z, g) => ({ id, nombre: 'Mesa de juntas APP LT 2.40 × 1.20', w: 2400, d: 1200, relation_role: 'ANCHOR_MEETING', zone_id: z, functional_group_id: g, user_capacity: 8 });
    const piezas = [mesa('m-1-1', 'SALA A', 'fg:req:SALA A:juntas:0:#0'), mesa('m-1#2-1', 'SALA B', 'fg:req:SALA B:juntas:1:#0'),
      ...Array.from({ length: 16 }, (_, i) => ({ id: `s-1-${i + 1}`, nombre: 'Silla · SONATA', w: 600, d: 600, relation_role: 'MEETING_SEAT', functional_group_id: 'fg:libre:juntas' }))];
    const r = construirSem(areas, piezas);
    expectSem(r.layoutSpec.validation.issues.filter((i) => i.code === 'FUNCTIONAL_GROUP_SPLIT')).toEqual([]);
    expectSem(r.plan.colocacion.length).toBe(18);
  });
});

describeSem('VH-112c · topología desconocida no encima sillas', () => {
  itSem('dos bancas de 6 m sin perfil (una cara) con 16 WIN: 0 encimados; lo que no cabe se reporta', () => {
    const areas = [{ nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 14000, largo: 7000, x: 0, y: 0 }];
    const piezas = [
      ...[1, 2].map((i) => ({ id: `b-1-${i}`, nombre: 'Módulo operativo', w: 6000, d: 1200, relation_role: 'ANCHOR_WORKSTATION', zone_id: 'ÁREA OPERATIVA', functional_group_id: 'fg:req:X', user_capacity: 12 })),
      ...Array.from({ length: 16 }, (_, i) => ({ id: `w-1-${i + 1}`, nombre: 'Silla operativa · WIN', w: 600, d: 600, relation_role: 'WORK_SEAT', zone_id: 'ÁREA OPERATIVA', functional_group_id: 'fg:req:X' })),
    ];
    const r = construirSem(areas, piezas);
    expectSem(r.layoutSpec.validation.issues.filter((i) => i.code === 'OVERLAP')).toEqual([]);
    expectSem(r.plan.colocacion.filter((c) => /^w-/.test(c.id)).length + (r.layoutSpec.no_cupieron?.length || 0) + (r.layoutSpec.unassigned?.length || 0)).toBe(16);
  });
});

// ============================================================================
//  VH-119 (2026-10-12) · DESPACHO PRIVADO: el solver sentaba al ejecutivo JUNTO a sus visitas (fila única
//  SINGLE_FACE) y el juez no admitía visitas en un escritorio → TODO despacho con sillas de visita caía en
//  NEEDS_SEMANTIC_REVIEW (proyectos 867 y 869 reproducidos contra el edge RC en Deno). Ahora: ejecutivo
//  detrás (BACK), visitas al frente (FRONT); el juez exige exactamente eso.
// ============================================================================
import { layoutDesk, layoutDeTopologia as layoutTopo119 } from './placementProfiles.js';
import { juzgarSemantico as juzgar119 } from './semanticPlacementJudge.js';
describeSem('VH-119 · escritorio privado: ejecutivo detrás, visitas al frente', () => {
  const areas = [{ nombre: 'OFICINA DIRECCIÓN', tipo: 'privado', ancho: 4500, largo: 4000, x: 0, y: 0 }];
  const piezas = [
    { id: 'e-1-1', nombre: 'Eclipse Escritorio Directivo 2.10 m', w: 2100, d: 900, tipo: 'escritorio', relation_role: 'ANCHOR_DESK', functional_group_id: 'fg:libre:privado', zone_id: 'OFICINA DIRECCIÓN' },
    { id: 'a-1-1', nombre: 'Silla directiva ALPHA', w: 600, d: 600, tipo: 'asiento', relation_role: 'EXECUTIVE_SEAT', functional_group_id: 'fg:libre:privado', zone_id: 'OFICINA DIRECCIÓN' },
    { id: 'v-1-1', nombre: 'Silla de visita · CONCERTO', w: 600, d: 600, tipo: 'asiento', relation_role: 'VISITOR_SEAT', functional_group_id: 'fg:libre:privado', zone_id: 'OFICINA DIRECCIÓN' },
    { id: 'v-1-2', nombre: 'Silla de visita · CONCERTO', w: 600, d: 600, tipo: 'asiento', relation_role: 'VISITOR_SEAT', functional_group_id: 'fg:libre:privado', zone_id: 'OFICINA DIRECCIÓN' },
    { id: 'c-1-1', nombre: 'Eclipse Credenza baja 2.10', w: 2100, d: 600, tipo: 'archivo', relation_role: 'SUPPORT_STORAGE', functional_group_id: 'fg:libre:general', zone_id: 'OFICINA DIRECCIÓN' },
  ];
  itSem('layoutDesk: ejecutivo en BACK (mira al escritorio), visitas en FRONT, en el orden de las sillas', () => {
    const lay = layoutDesk(2100, 900, 3, ['VISITOR_SEAT', 'EXECUTIVE_SEAT', 'VISITOR_SEAT']);
    expectSem(lay.seats.map((s) => [s.slot_id, s.side, s.facing])).toEqual([['seat_F1', 'FRONT', 'UP'], ['seat_X1', 'BACK', 'DOWN'], ['seat_F2', 'FRONT', 'UP']]);
    // franja de acceso 600 + silla ejecutiva 600 + tablero 900 + visitas 600 = 2700
    expectSem(lay.anchor.dy).toBe(1200); expectSem(lay.seats[1].dy).toBe(600); expectSem(lay.seats[0].dy).toBe(2100); expectSem(lay.kitD).toBe(2700);
    expectSem(layoutTopo119('DESK', 2100, 900, 1).seats[0].side).toBe('BACK');          // sin roles: la primera es el ejecutivo
    expectSem(layoutTopo119('DESK', 2100, 900, 0).kitD).toBe(900);
  });
  itSem('pipeline completo: 5 piezas colocadas, ejecutivo detrás, visitas al frente, sin sem_issues, status != NEEDS_SEMANTIC_REVIEW', () => {
    const r = construirSem(areas, piezas);
    const col = r.plan.colocacion; const porId = Object.fromEntries(col.map((c) => [c.id, c]));
    expectSem(col).toHaveLength(5);
    expectSem([porId['a-1-1'].side, porId['v-1-1'].side, porId['v-1-2'].side]).toEqual(['BACK', 'FRONT', 'FRONT']);
    expectSem(porId['a-1-1'].y).toBeLessThan(porId['e-1-1'].y);                          // detrás = arriba del tablero
    expectSem(porId['v-1-1'].y).toBeGreaterThan(porId['e-1-1'].y);
    expectSem(r.seleccion.ganador_eval.sem_issues).toEqual([]);
    expectSem(r.layoutSpec.status).not.toBe('NEEDS_SEMANTIC_REVIEW');
    expectSem(r.layoutSpec.validation.issues.filter((i) => i.severity === 'fail')).toEqual([]);
  });
  itSem('el juez sigue fallando si el ejecutivo queda al FRENTE o una silla operativa cuelga del escritorio', () => {
    const r = construirSem(areas, piezas);
    const col = r.plan.colocacion.map((c) => (c.id === 'a-1-1' ? { ...c, side: 'FRONT' } : c));
    const issues = juzgar119(areas, piezas, col).issues;
    expectSem(issues.filter((i) => i.code === 'KIT_FUNCTIONAL_RELATION_BROKEN').map((i) => i.id)).toEqual(['a-1-1']);
    const piezasMal = piezas.map((p) => (p.id === 'v-1-2' ? { ...p, relation_role: 'WORK_SEAT' } : p));
    const r2 = construirSem(areas, piezasMal);
    // una silla operativa no cuelga de un escritorio: queda sin mueble que la reciba y el acomodo es PARCIAL, no se encima ni se disfraza
    expectSem(r2.unassigned).toEqual(['v-1-2']);
    expectSem(r2.layoutSpec.status).toBe('PARTIAL');
  });
});

// ============================================================================
//  VH-120 (Fase 3) · CAPACIDAD CON FUENTE. APP LT 4800×1200 y 6000×1200, una y dos bancas, varias cantidades de
//  usuarios. La capacidad declarada (CATALOGO/USUARIO) manda hasta el tope FÍSICO (una silla cada 600 mm por
//  cara, preliminar); lo que no cabe queda sin lugar y se reporta como conflicto; nunca dos personas en un lugar.
// ============================================================================
import { capacidadConFuente } from './kit-solver.js';
describeSem('VH-120 · capacidad con fuente y tope geométrico', () => {
  const banca = (id, w, extra = {}) => ({ id, nombre: 'Banca doble APP LT', w, d: 1200, tipo: 'escritorio', relation_role: 'ANCHOR_WORKSTATION', functional_group_id: 'fg:op', zone_id: 'OPERATIVA', placement_profile: { topology: 'DOUBLE_FACE', provenance: 'CATALOG' }, ...extra });
  const sillas = (n) => Array.from({ length: n }, (_, i) => ({ id: `w-${i + 1}`, nombre: 'Silla operativa · WIN', w: 600, d: 600, tipo: 'asiento', relation_role: 'WORK_SEAT', functional_group_id: 'fg:op', zone_id: 'OPERATIVA' }));
  const area = [{ nombre: 'OPERATIVA', tipo: 'open', ancho: 14000, largo: 8000, x: 0, y: 0 }];
  const solapes = (r) => {
    const by = Object.fromEntries(r.plan.piezas.map((p) => [p.id, p])); const col = r.plan.colocacion; const out = [];
    const box = (c) => { const p = by[c.id]; const g = c.rot % 180 !== 0; return { x: c.x, y: c.y, w: g ? p.d : p.w, d: g ? p.w : p.d }; };
    for (let i = 0; i < col.length; i++) for (let j = i + 1; j < col.length; j++) { const a = box(col[i]), b = box(col[j]); if (a.x < b.x + b.w - 5 && a.x + a.w > b.x + 5 && a.y < b.y + b.d - 5 && a.y + a.d > b.y + 5) out.push([col[i].id, col[j].id]); }
    return out;
  };
  itSem('fuentes: CATALOGO / USUARIO / INFERIDA / GEOMETRICA; tope 16 en 4.80 m y 20 en 6.00 m', () => {
    expectSem(capacidadConFuente(banca('b', 4800, { user_capacity: 8, capacity_source: 'CATALOGO' }))).toMatchObject({ capacidad: 8, declarada: 8, fuente: 'CATALOGO', tope_geometrico: 16, preliminar: false, conflicto: null });
    expectSem(capacidadConFuente(banca('b', 6000, { user_capacity: 12, capacity_source: 'USUARIO' }))).toMatchObject({ capacidad: 12, fuente: 'USUARIO', tope_geometrico: 20, conflicto: null });
    expectSem(capacidadConFuente(banca('b', 6000, { nombre: 'Banca doble APP LT 1.50 · 8 usuarios' }))).toMatchObject({ capacidad: 8, fuente: 'INFERIDA' });
    expectSem(capacidadConFuente(banca('b', 6000, { nombre: 'Módulo operativo' }))).toMatchObject({ capacidad: 8, declarada: null, fuente: 'GEOMETRICA', preliminar: true, conflicto: 'CAPACIDAD_ESTIMADA' });
    expectSem(capacidadConFuente(banca('b', 4800, { user_capacity: 40, capacity_source: 'USUARIO' }))).toMatchObject({ capacidad: 16, declarada: 40, tope_geometrico: 16, conflicto: 'CAPACIDAD_SUPERA_GEOMETRIA' });
    expectSem(capacidadConFuente({ id: 'e', nombre: 'Escritorio', w: 1800, d: 800, relation_role: 'ANCHOR_DESK' })).toMatchObject({ capacidad: 1, fuente: 'GEOMETRICA', tope_geometrico: null, conflicto: null });
  });
  for (const [w, cap, n, esperadas, sinLugar] of [[4800, 8, 8, 8, 0], [4800, 8, 12, 8, 4], [4800, 16, 16, 16, 0], [6000, 8, 8, 8, 0], [6000, 12, 12, 12, 0], [6000, 20, 20, 20, 0], [6000, 40, 24, 20, 4]]) {
    itSem(`una banca ${w}×1200 capacidad ${cap} con ${n} sillas ⇒ ${esperadas} sentadas, ${sinLugar} sin lugar, sin solapes`, () => {
      const r = construirSem(area, [banca('b-1', w, { user_capacity: cap, capacity_source: 'USUARIO' }), ...sillas(n)]);
      const sentadas = r.plan.colocacion.filter((c) => c.id.startsWith('w-')).length;
      expectSem(sentadas).toBe(esperadas);
      expectSem((r.unassigned || []).length + (r.no_cupieron || []).reduce((s, u) => s + u.piezas.filter((id) => id.startsWith('w-')).length, 0)).toBe(sinLugar);
      expectSem(solapes(r)).toEqual([]);
      const capInfo = r.layoutSpec.validation.capacidad.find((c) => c.id === 'b-1');
      expectSem(capInfo).toMatchObject({ fuente: 'USUARIO', declarada: cap, usada: Math.min(cap, 2 * Math.floor(w / 600)) });
      if (cap > 2 * Math.floor(w / 600)) expectSem(capInfo.conflicto).toBe('CAPACIDAD_SUPERA_GEOMETRIA'); else expectSem(capInfo.conflicto).toBe(null);
      if (sinLugar) expectSem(r.layoutSpec.status).not.toBe('PASS');
    });
  }
  itSem('dos bancas 6000×1200 de 8 con 16 sillas ⇒ 8 + 8, PASS, sin solapes; con 20 sillas ⇒ 16 sentadas y 4 sin lugar', () => {
    const dos = [banca('b-1', 6000, { user_capacity: 8, capacity_source: 'CATALOGO' }), banca('b-2', 6000, { user_capacity: 8, capacity_source: 'CATALOGO' })];
    const r = construirSem(area, [...dos, ...sillas(16)]);
    const porAncla = {}; for (const p of r.plan.piezas) if (p.relation_role === 'WORK_SEAT' && p.anchor_instance_id) porAncla[p.anchor_instance_id] = (porAncla[p.anchor_instance_id] || 0) + 1;
    expectSem(porAncla).toEqual({ 'b-1': 8, 'b-2': 8 });
    expectSem(r.plan.colocacion).toHaveLength(18); expectSem(solapes(r)).toEqual([]); expectSem(r.layoutSpec.status).toBe('PASS');
    const r2 = construirSem(area, [...dos, ...sillas(20)]);
    expectSem(r2.plan.colocacion.filter((c) => c.id.startsWith('w-'))).toHaveLength(16);
    expectSem(r2.unassigned).toHaveLength(4); expectSem(solapes(r2)).toEqual([]); expectSem(r2.layoutSpec.status).not.toBe('PASS');
  });
  itSem('banca sin topología declarada (UNKNOWN) no es doble: una cara, nunca dos personas en un lugar', () => {
    const r = construirSem(area, [banca('b-1', 6000, { user_capacity: 12, capacity_source: 'USUARIO', placement_profile: undefined }), ...sillas(12)]);
    expectSem(solapes(r)).toEqual([]);
    expectSem(r.plan.colocacion.filter((c) => c.id.startsWith('w-')).length).toBeLessThanOrEqual(10);   // ⌊6000/600⌋ por la única cara
    expectSem(r.layoutSpec.status).not.toBe('PASS');
  });
});

// VH-119b · la franja de acceso del ejecutivo es CIRCULACIÓN: el pasillo de 1 m se mide desde la silla, no
// desde la franja. OFICINA CEO del golden 757 (4.0 × 3.2 m): la credenza vuelve a caber detrás del ejecutivo;
// el archivero de 0.90 ya no cabe con el pasillo de 1 m y se reporta (no se encima ni se esconde).
describeSem('VH-119b · credenza detrás del ejecutivo en el privado de 4.0 × 3.2', () => {
  const ceo = [{ nombre: 'OFICINA CEO', tipo: 'privado', ancho: 4000, largo: 3200, x: 0, y: 0 }];
  const base = [
    { id: 'p-2-1', nombre: 'Eclipse Escritorio Directivo 2.10 m', w: 2100, d: 900, tipo: 'escritorio', relation_role: 'ANCHOR_DESK', functional_group_id: 'fg:libre:privado', zone_id: 'OFICINA CEO' },
    { id: 'p-8-1', nombre: 'Silla directiva ALPHA', w: 600, d: 600, tipo: 'asiento', relation_role: 'EXECUTIVE_SEAT', functional_group_id: 'fg:libre:privado', zone_id: 'OFICINA CEO' },
    { id: 'p-9-1', nombre: 'Silla de visita · CONCERTO', w: 600, d: 600, tipo: 'asiento', relation_role: 'VISITOR_SEAT', functional_group_id: 'fg:libre:privado', zone_id: 'OFICINA CEO' },
    { id: 'p-9-2', nombre: 'Silla de visita · CONCERTO', w: 600, d: 600, tipo: 'asiento', relation_role: 'VISITOR_SEAT', functional_group_id: 'fg:libre:privado', zone_id: 'OFICINA CEO' },
    { id: 'p-3-1', nombre: 'Eclipse Credenza baja 2.10', w: 2100, d: 600, tipo: 'archivo', relation_role: 'SUPPORT_STORAGE', functional_group_id: 'fg:libre:general', zone_id: 'OFICINA CEO' },
  ];
  itSem('escritorio + 3 sillas + credenza: todo colocado, ejecutivo BACK, credenza sin encimar y a ≥ 1 m de la silla', () => {
    const r = construirSem(ceo, base);
    expectSem(r.plan.colocacion).toHaveLength(5);
    const by = Object.fromEntries(r.plan.colocacion.map((c) => [c.id, c]));
    expectSem(by['p-8-1'].side).toBe('BACK');
    expectSem(r.layoutSpec.validation.issues.filter((i) => i.severity === 'fail')).toEqual([]);
    expectSem(r.seleccion.ganador_eval.hardOk).toBe(true);
  });
  // COT-P1-027c (2026-10-13): esta prueba documentaba un LÍMITE del solver, no una imposibilidad física
  // ("5 de 6, el archivero no cabe por el pasillo de 1 m"). El metro se exigía también ENTRE la credenza y
  // el archivero puestos lado a lado, donde nadie camina. El validador duro siempre aceptó dos muebles
  // adosados (hueco 0); ahora el solver también: los dos guardados comparten muro, con el respaldo a la
  // pared y el frente libre hacia el cuarto, y el metro frente al escritorio se conserva.
  itSem('con el archivero de 0.90 además: 6 de 6 — credenza y archivero adosados sobre el mismo muro, frentes libres, nada encimado', () => {
    const r = construirSem(ceo, [...base, { id: 'p-6-1', nombre: 'Modulor Archivero horizontal 0.90', w: 749, d: 900, tipo: 'archivo', relation_role: 'SUPPORT_STORAGE', functional_group_id: 'fg:libre:general', zone_id: 'OFICINA CEO' }]);
    expectSem(r.plan.colocacion).toHaveLength(6);
    expectSem(r.no_cupieron || []).toEqual([]);
    expectSem(r.layoutSpec.validation.issues.filter((i) => i.severity === 'fail')).toEqual([]);
    expectSem(r.seleccion.ganador_eval.hardOk).toBe(true);
    const by = Object.fromEntries(r.plan.colocacion.map((c) => [c.id, c]));
    const pz = Object.fromEntries(r.plan.piezas.map((p) => [p.id, p]));
    const rect = (id) => { const c = by[id], p = pz[id], g = c.rot === 90; return { x: c.x, y: c.y, w: g ? p.d : p.w, d: g ? p.w : p.d }; };
    const cred = rect('p-3-1'), arch = rect('p-6-1'), desk = rect('p-2-1');
    const encima = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.d && a.y + a.d > b.y;
    expectSem(encima(cred, arch)).toBe(false);
    // respaldo al muro derecho (x + w = 4000) y frente hacia el escritorio, a ≥ 1 m de él
    for (const g of [cred, arch]) { expectSem(g.x + g.w).toBe(4000); expectSem(g.x - (desk.x + desk.w)).toBeGreaterThanOrEqual(1000); }
    expectSem(by['p-3-1'].topology).toBe('STORAGE');
    expectSem(by['p-8-1'].side).toBe('BACK');   // el ejecutivo sigue detrás de su escritorio
  });
});
