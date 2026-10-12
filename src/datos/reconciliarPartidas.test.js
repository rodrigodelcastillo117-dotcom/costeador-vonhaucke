import { describe, it, expect } from 'vitest';
import { reconciliarNuevasConPrograma } from './reconciliarPartidas.js';

// Reproducción de la cotización 757 (2026-10-12): programa aplicado PRIMERO, VONI texto DESPUÉS.
const programa = [
  { id: 'a1', nombre: 'Módulo operativo App LT 8 usuarios (biombo cristal)', bancoId: 'op-8u-4800x1200-cristal', relation_role: 'ANCHOR_WORKSTATION', instance_id: 'inst:op', functional_group_id: 'fg:op', zone_id: 'ÁREA OPERATIVA', requirement_id: 'req:op', w: 4800, d: 1200, user_capacity: 8, cantidad: 1, precioUnitario: 23070, source: 'CONFIRMADO_PROGRAMA', sinPrecioAutorizado: true },
  { id: 'a2', nombre: 'Módulo directivo App LT', bancoId: 'dir-1800x2400', relation_role: 'ANCHOR_DESK', instance_id: 'inst:dir', functional_group_id: 'fg:dir', zone_id: 'OFICINA CEO', w: 1800, d: 2400, cantidad: 1, precioUnitario: 15780, source: 'CONFIRMADO_PROGRAMA' },
  { id: 'a3', nombre: 'Mesa de juntas', bancoId: 'mj-900x900-melamina', relation_role: 'ANCHOR_MEETING', instance_id: 'inst:mj', functional_group_id: 'fg:mj', zone_id: 'SALA DE CONSEJO', w: 900, d: 900, cantidad: 1, precioUnitario: 4260, source: 'CONFIRMADO_PROGRAMA' },
  { id: 'd1', nombre: 'Silla directiva ALPHA', bancoId: 'silla-alpha', relation_role: 'EXECUTIVE_SEAT', anchor_role: 'ANCHOR_DESK', anchor_instance_id: 'inst:dir', functional_group_id: 'fg:dir', cantidad: 1, precioUnitario: 11950, source: 'CONFIRMADO_PROGRAMA' },
  { id: 'd2', nombre: 'Silla CONCERTO (visita 4 pts)', bancoId: 'silla-concerto', relation_role: 'MEETING_SEAT', anchor_role: 'ANCHOR_MEETING', anchor_instance_id: 'inst:mj', functional_group_id: 'fg:mj', cantidad: 4, precioUnitario: 5140, source: 'CONFIRMADO_PROGRAMA' },
];
const texto = [
  { id: 'p-1', nombre: 'Banca doble APP LT 1.50 · 8 usuarios · ocupa 6.00 × 1.20 m', piezaId: 'linea-banca_doble', productoId: 'banca_doble', cantidad: 1, precioUnitario: 26145, w: 6000, d: 1200, origen: 'ia' },
  { id: 'p-2', nombre: 'Eclipse Escritorio Directivo 2.10 m · mano Derecha', piezaId: 'linea-escritorio', productoId: 'escritorio', cantidad: 1, precioUnitario: 81470, w: 2100, d: 900, origen: 'ia' },
  { id: 'p-3', nombre: 'Eclipse Credenza baja 2.10 × 0.60 m · mano Derecha', piezaId: 'linea-credenza', productoId: 'credenza', cantidad: 1, precioUnitario: 43720, w: 2100, d: 600, origen: 'ia' },
  { id: 'p-4', nombre: 'Mesa de juntas APP LT 1.20 × 1.20', piezaId: 'linea-mesa_juntas', productoId: 'mesa_juntas', cantidad: 1, precioUnitario: 8214, w: 1200, d: 1200, origen: 'ia' },
  { id: 'p-7', nombre: 'Silla operativa · WIN', piezaId: 'p9-silla-operativa-win-5210', cantidad: 8, precioUnitario: 5210, origen: 'banco' },
  { id: 'p-8', nombre: 'Silla directiva ALPHA', piezaId: 'silla-alpha', cantidad: 1, precioUnitario: 11950, origen: 'banco' },
  { id: 'p-10', nombre: 'Silla · SONATA', piezaId: 'p9-silla-sonata-2420-144', cantidad: 4, precioUnitario: 2420, origen: 'banco' },
];

describe('VH-090 · reconciliarNuevasConPrograma', () => {
  it('cada ancla del usuario sustituye a la genérica del programa del mismo rol y hereda su estructura', () => {
    const { partidas, sustituidas } = reconciliarNuevasConPrograma(programa, texto);
    const anclas = partidas.filter((p) => String(p.relation_role || '').startsWith('ANCHOR_'));
    expect(anclas.map((p) => p.id).sort()).toEqual(['p-1', 'p-2', 'p-4']);     // una por rol, las del usuario
    const banca = partidas.find((p) => p.id === 'p-1');
    expect(banca.instance_id).toBe('inst:op');
    expect(banca.functional_group_id).toBe('fg:op');
    expect(banca.zone_id).toBe('ÁREA OPERATIVA');
    expect(banca.user_capacity).toBe(8);
    expect(banca.w).toBe(6000);                                                // la medida del usuario gana
    expect(banca.precioUnitario).toBe(26145);                                  // precio intacto
    expect(sustituidas.map((s) => s.rol)).toEqual(expect.arrayContaining(['ANCHOR_WORKSTATION', 'ANCHOR_DESK', 'ANCHOR_MEETING']));
  });

  it('las sillas del usuario sustituyen a las del programa del mismo rol y quedan atadas a su ancla', () => {
    const { partidas } = reconciliarNuevasConPrograma(programa, texto);
    expect(partidas.filter((p) => p.relation_role === 'EXECUTIVE_SEAT')).toHaveLength(1);
    const alpha = partidas.find((p) => p.id === 'p-8');
    expect(alpha.anchor_instance_id).toBe('inst:dir');
    const sonata = partidas.find((p) => p.id === 'p-10');
    expect(sonata.relation_role).toBe('MEETING_SEAT');
    expect(sonata.anchor_instance_id).toBe('inst:mj');
    expect(partidas.find((p) => p.id === 'd2')).toBeUndefined();              // CONCERTO de juntas se fue
  });

  it('lo que no tiene equivalente en el programa entra tal cual (credenza, WIN sin ancla de programa de sillas)', () => {
    const { partidas } = reconciliarNuevasConPrograma(programa, texto);
    expect(partidas.find((p) => p.id === 'p-3')).toBeTruthy();
    expect(partidas.find((p) => p.id === 'p-7')).toBeTruthy();
    expect(partidas).toHaveLength(programa.length + texto.length - 5);        // 5 sustituciones
  });

  it('sin programa previo no cambia nada', () => {
    const { partidas, sustituidas } = reconciliarNuevasConPrograma([], texto);
    expect(partidas).toEqual(texto);
    expect(sustituidas).toHaveLength(0);
  });

  it('es idempotente respecto a lo ya sustituido: una segunda tanda no vuelve a tomar la misma fila', () => {
    const r1 = reconciliarNuevasConPrograma(programa, texto.slice(0, 1));
    const r2 = reconciliarNuevasConPrograma(r1.partidas, [{ id: 'p-x', nombre: 'Banca doble APP LT 6 usuarios', piezaId: 'linea-banca_doble', cantidad: 1, precioUnitario: 1 }]);
    expect(r2.sustituidas).toHaveLength(0);
    expect(r2.partidas.filter((p) => p.relation_role === 'ANCHOR_WORKSTATION')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
//  Release gate (2026-10-13): conciliación en proyectos con varias zonas.
//  Respeta requirement_id / zone_id / ancla / grupo; ambigüedad ⇒ NEEDS_REVIEW.
// ---------------------------------------------------------------------------
const P = (o) => ({ source: 'CONFIRMADO_PROGRAMA', sinPrecioAutorizado: true, cantidad: 1, ...o });
const mesa = (zona, banco, w) => P({ id: `mj:${zona}`, nombre: `Mesa de juntas ${w / 1000} m`, bancoId: banco, relation_role: 'ANCHOR_MEETING', requirement_id: `req:${zona}:juntas:0`, instance_id: `inst:${zona}`, functional_group_id: `fg:${zona}`, zone_id: zona, w, d: 1200 });
const escritorio = (zona) => P({ id: `dir:${zona}`, nombre: 'Módulo directivo App LT', bancoId: 'dir-1800x2400', relation_role: 'ANCHOR_DESK', requirement_id: `req:${zona}:privado:0`, instance_id: `inst:${zona}`, functional_group_id: `fg:${zona}`, zone_id: zona, w: 1800, d: 2400 });
const win = (zona, n) => P({ id: `win:${zona}`, nombre: 'Silla operativa WIN', bancoId: 'silla-win', relation_role: 'WORK_SEAT', anchor_instance_id: `inst:${zona}`, functional_group_id: `fg:${zona}`, zone_id: zona, cantidad: n });

describe('conciliación con varias zonas (release gate)', () => {
  it('dos salas con mesas distintas: una mesa nueva SIN zona es ambigua → NEEDS_REVIEW, nada se sustituye', () => {
    const prog = [mesa('SALA A', 'mj-2400x1200', 2400), mesa('SALA B', 'mj-3000x1200', 3000)];
    const nueva = { id: 'n1', nombre: 'Mesa de juntas APP LT 1.20 × 1.20', piezaId: 'linea-mesa_juntas', productoId: 'mesa_juntas', cantidad: 1, precioUnitario: 8214, w: 1200, d: 1200 };
    const r = reconciliarNuevasConPrograma(prog, [nueva]);
    expect(r.sustituidas).toHaveLength(0);
    expect(r.ambiguas).toHaveLength(1);
    expect(r.ambiguas[0].opciones.map((o) => o.zona).sort()).toEqual(['SALA A', 'SALA B']);
    expect(r.partidas).toHaveLength(3);                                  // las dos del programa + la nueva, intactas
  });
  it('con zona explícita en la nueva partida sólo sustituye en ESA sala', () => {
    const prog = [mesa('SALA A', 'mj-2400x1200', 2400), mesa('SALA B', 'mj-3000x1200', 3000)];
    const r = reconciliarNuevasConPrograma(prog, [{ id: 'n1', nombre: 'Mesa de juntas APP LT 1.20 × 1.20', piezaId: 'linea-mesa_juntas', productoId: 'mesa_juntas', cantidad: 1, precioUnitario: 8214, zone_id: 'SALA B', w: 1200, d: 1200 }]);
    expect(r.ambiguas).toHaveLength(0);
    expect(r.sustituidas).toHaveLength(1);
    expect(r.partidas.find((p) => p.id === 'mj:SALA A')).toBeTruthy();   // la otra sala no se toca
    expect(r.partidas.find((p) => p.id === 'n1').instance_id).toBe('inst:SALA B');
  });
  it('decisión explícita de la persona resuelve la ambigüedad sin inventar zona', () => {
    const prog = [mesa('SALA A', 'mj-2400x1200', 2400), mesa('SALA B', 'mj-3000x1200', 3000)];
    const nueva = { id: 'n1', nombre: 'Mesa de juntas APP LT 1.20 × 1.20', piezaId: 'linea-mesa_juntas', productoId: 'mesa_juntas', cantidad: 1, precioUnitario: 8214 };
    const r = reconciliarNuevasConPrograma(prog, [nueva], { decisiones: { n1: 'mj:SALA A' } });
    expect(r.ambiguas).toHaveLength(0);
    expect(r.partidas.find((p) => p.id === 'n1').zone_id).toBe('SALA A');
    expect(r.partidas.find((p) => p.id === 'mj:SALA B')).toBeTruthy();
  });
  it('dos despachos con escritorios del mismo rol: un escritorio nuevo sin zona NO sustituye arbitrariamente', () => {
    const prog = [escritorio('DESPACHO 1'), escritorio('DESPACHO 2')];
    const r = reconciliarNuevasConPrograma(prog, [{ id: 'n1', nombre: 'Eclipse Escritorio Directivo 2.10 m', piezaId: 'linea-escritorio', productoId: 'escritorio', cantidad: 1, precioUnitario: 81470, w: 2100, d: 900 }]);
    expect(r.sustituidas).toHaveLength(0);
    expect(r.ambiguas[0].rol).toBe('ANCHOR_DESK');
  });
  it('un solo despacho: sí sustituye (no hay ambigüedad) y hereda requirement/zona', () => {
    const r = reconciliarNuevasConPrograma([escritorio('DESPACHO 1')], [{ id: 'n1', nombre: 'Eclipse Escritorio Directivo 2.10 m', piezaId: 'linea-escritorio', productoId: 'escritorio', cantidad: 1, precioUnitario: 81470, w: 2100, d: 900 }]);
    expect(r.sustituidas).toHaveLength(1);
    expect(r.partidas.find((p) => p.id === 'n1').requirement_id).toBe('req:DESPACHO 1:privado:0');
  });
  it('dos grupos WIN en zonas distintas: 8 WIN nuevas sin zona → ambiguo; con zona → sustituye sólo ese grupo', () => {
    const prog = [win('OPERATIVA 1', 8), win('OPERATIVA 2', 6)];
    const sinZona = reconciliarNuevasConPrograma(prog, [{ id: 'n1', nombre: 'Silla operativa · WIN', piezaId: 'p9-silla-operativa-win-5210', cantidad: 8, precioUnitario: 5210 }]);
    expect(sinZona.ambiguas).toHaveLength(1);
    expect(sinZona.partidas.filter((p) => p.relation_role === 'WORK_SEAT' && p.source === 'CONFIRMADO_PROGRAMA')).toHaveLength(2);
    const conZona = reconciliarNuevasConPrograma(prog, [{ id: 'n1', nombre: 'Silla operativa · WIN', piezaId: 'p9-silla-operativa-win-5210', cantidad: 8, precioUnitario: 5210, zone_id: 'OPERATIVA 2' }]);
    expect(conZona.sustituidas).toHaveLength(1);
    expect(conZona.partidas.find((p) => p.id === 'win:OPERATIVA 1').cantidad).toBe(8);   // intacto
  });
  it('cantidad parcial: 6 WIN nuevas contra 8 del programa (misma zona) → 6 de la persona + 2 del programa, nunca se borra el requerimiento', () => {
    const r = reconciliarNuevasConPrograma([win('OPERATIVA 1', 8)], [{ id: 'n1', nombre: 'Silla operativa · WIN', piezaId: 'p9-silla-operativa-win-5210', cantidad: 6, precioUnitario: 5210 }]);
    expect(r.sustituidas[0].parcial).toBe(true);
    expect(r.sustituidas[0].restante).toBe(2);
    const resto = r.partidas.find((p) => p.id === 'win:OPERATIVA 1');
    expect(resto.cantidad).toBe(2);
    expect(resto.cantidadAjustadaPorConciliacion).toBe(true);
    expect(r.partidas.find((p) => p.id === 'n1').anchor_instance_id).toBe('inst:OPERATIVA 1');
  });
  it('configuración distinta: banca de 8 contra módulo de 10 → sustituye pero lo marca (capacidadDistinta)', () => {
    const prog = [P({ id: 'op', nombre: 'Módulo operativo App LT 10 usuarios', bancoId: 'op-10u-6000x1200-cristal', relation_role: 'ANCHOR_WORKSTATION', requirement_id: 'req:op', instance_id: 'inst:op', functional_group_id: 'fg:op', zone_id: 'OPERATIVA', user_capacity: 10, w: 6000, d: 1200 })];
    const r = reconciliarNuevasConPrograma(prog, [{ id: 'n1', nombre: 'Banca doble APP LT 1.50 · 8 usuarios', piezaId: 'linea-banca_doble', productoId: 'banca_doble', cantidad: 1, precioUnitario: 26145, w: 6000, d: 1200, user_capacity: 8 }]);
    expect(r.sustituidas[0].capacidadDistinta).toBe(true);
    expect(r.sustituidas[0].capacidadPrograma).toBe(10);
    expect(r.partidas.find((p) => p.id === 'n1').user_capacity).toBe(8);        // la de la persona, no la del programa
  });
  it('requirement_id explícito manda sobre la zona', () => {
    const prog = [mesa('SALA A', 'mj-2400x1200', 2400), mesa('SALA B', 'mj-3000x1200', 3000)];
    const r = reconciliarNuevasConPrograma(prog, [{ id: 'n1', nombre: 'Mesa de juntas 1.20', piezaId: 'linea-mesa_juntas', productoId: 'mesa_juntas', cantidad: 1, precioUnitario: 1, requirement_id: 'req:SALA B:juntas:0', zone_id: 'SALA A' }]);
    expect(r.partidas.find((p) => p.id === 'n1').instance_id).toBe('inst:SALA B');
  });
});

describe('VH-116 · un ancla con cantidad ≥ anclas del programa en zonas distintas se reparte', () => {
  const PROG = (o) => ({ source: 'CONFIRMADO_PROGRAMA', ...o });
  const dosSalas = [
    PROG({ id: 'pa', nombre: 'Mesa de juntas', bancoId: 'mj-2400x1200', cantidad: 1, relation_role: 'ANCHOR_MEETING', requirement_id: 'req:SALA A:juntas:0', instance_id: 'inst:A', functional_group_id: 'fg:A', zone_id: 'SALA A', w: 2400, d: 1200, user_capacity: 8 }),
    PROG({ id: 'pb', nombre: 'Mesa de juntas', bancoId: 'mj-2400x1200', cantidad: 1, relation_role: 'ANCHOR_MEETING', requirement_id: 'req:SALA B:juntas:0', instance_id: 'inst:B', functional_group_id: 'fg:B', zone_id: 'SALA B', w: 2400, d: 1200, user_capacity: 8 }),
  ];
  it('"Mesa de juntas APP LT 2.40 × 1.20 ×2" cubre las dos salas: dos filas, una por zona, y cero mesas del programa', () => {
    const r = reconciliarNuevasConPrograma(dosSalas, [{ id: 'm-1', nombre: 'Mesa de juntas APP LT 2.40 × 1.20', cantidad: 2, piezaId: 'linea-mesa_juntas', w: 2400, d: 1200 }]);
    expect(r.ambiguas).toEqual([]);
    expect(r.partidas.filter((p) => p.source === 'CONFIRMADO_PROGRAMA')).toHaveLength(0);
    const mesas = r.partidas.filter((p) => p.relation_role === 'ANCHOR_MEETING');
    expect(mesas).toHaveLength(2);
    expect(mesas.map((m) => m.zone_id).sort()).toEqual(['SALA A', 'SALA B']);
    expect(mesas.map((m) => m.instance_id).sort()).toEqual(['inst:A', 'inst:B']);
    expect(mesas.every((m) => m.cantidad === 1 && m.repartidaPorConciliacion)).toBe(true);
    expect(new Set(mesas.map((m) => m.id)).size).toBe(2);
    expect(r.sustituidas.filter((s) => s.repartida)).toHaveLength(2);
  });
  it('cantidad 3 para dos salas: dos repartidas + 1 sobrante sin estructura', () => {
    const r = reconciliarNuevasConPrograma(dosSalas, [{ id: 'm-1', nombre: 'Mesa de juntas APP LT 2.40 × 1.20', cantidad: 3, piezaId: 'linea-mesa_juntas', w: 2400, d: 1200 }]);
    const mesas = r.partidas.filter((p) => p.relation_role === 'ANCHOR_MEETING');
    expect(mesas).toHaveLength(3);
    const sobra = mesas.find((m) => m.id === 'm-1#resto');
    expect(sobra.cantidad).toBe(1); expect(sobra.instance_id).toBeUndefined();
  });
  it('cantidad 1 para dos salas sigue siendo AMBIGUA (la persona decide la zona)', () => {
    const r = reconciliarNuevasConPrograma(dosSalas, [{ id: 'm-1', nombre: 'Mesa de juntas APP LT 2.40 × 1.20', cantidad: 1, piezaId: 'linea-mesa_juntas', w: 2400, d: 1200 }]);
    expect(r.ambiguas).toHaveLength(1);
    expect(r.partidas.filter((p) => p.source === 'CONFIRMADO_PROGRAMA')).toHaveLength(2);
  });
});

describe('VH-116 · al APLICAR: la mesa ×2 ya atada a la SALA A reparte su segunda unidad a la SALA B', () => {
  it('queda una fila por sala y la mesa del programa de la SALA B no se agrega aparte', () => {
    const progB = { source: 'CONFIRMADO_PROGRAMA', id: 'pb', nombre: 'Mesa de juntas', bancoId: 'mj-2400x1200', cantidad: 1, relation_role: 'ANCHOR_MEETING', requirement_id: 'req:SALA B:juntas:0', instance_id: 'inst:B', functional_group_id: 'fg:B', zone_id: 'SALA B', w: 2400, d: 1200, user_capacity: 8 };
    const mesaUsuario = { id: 'm-1', nombre: 'Mesa de juntas APP LT 2.40 × 1.20', cantidad: 2, piezaId: 'linea-mesa_juntas', w: 2400, d: 1200, relation_role: 'ANCHOR_MEETING', requirement_id: 'req:SALA A:juntas:0', instance_id: 'inst:A', functional_group_id: 'fg:A', zone_id: 'SALA A', user_capacity: 8 };
    const r = reconciliarNuevasConPrograma([progB], [mesaUsuario]);
    expect(r.partidas.filter((p) => p.source === 'CONFIRMADO_PROGRAMA')).toHaveLength(0);
    const mesas = r.partidas.filter((p) => p.relation_role === 'ANCHOR_MEETING');
    expect(mesas).toHaveLength(2);
    expect(mesas.find((m) => m.id === 'm-1')).toMatchObject({ cantidad: 1, zone_id: 'SALA A', instance_id: 'inst:A' });
    expect(mesas.find((m) => m.id === 'm-1#2')).toMatchObject({ cantidad: 1, zone_id: 'SALA B', instance_id: 'inst:B', repartidaPorConciliacion: true });
  });
});

describe('VH-112 · la capacidad declarada en el nombre manda sobre la del módulo del programa', () => {
  it('"Banca doble … 8 usuarios" vs módulo de 12 ⇒ user_capacity 8 (inferida)', () => {
    const prog = { source: 'CONFIRMADO_PROGRAMA', id: 'p', nombre: 'Módulo operativo 12 usuarios', bancoId: 'op-12u', cantidad: 1, relation_role: 'ANCHOR_WORKSTATION', requirement_id: 'req:OP:0', instance_id: 'inst:OP', functional_group_id: 'fg:OP', zone_id: 'ÁREA OPERATIVA', w: 9000, d: 1200, user_capacity: 12 };
    const r = reconciliarNuevasConPrograma([prog], [{ id: 'b-1', nombre: 'Banca doble APP LT 1.50 · 8 usuarios · ocupa 6.00 × 1.20 m', cantidad: 2, piezaId: 'linea-banca_doble', w: 6000, d: 1200 }]);
    const b = r.partidas.find((p) => p.id === 'b-1');
    expect(b.user_capacity).toBe(8); expect(b.user_capacity_inferida).toBe(true);
  });
});
