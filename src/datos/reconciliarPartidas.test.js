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

// ============================================================================
//  VH-116 · REPARTO SÓLO CON DECISIÓN EXPLÍCITA. La cantidad no prueba intención: sin decisión,
//  NEEDS_REVIEW con opciones; nada se mueve, nada se pierde, nada se duplica sin justificación.
// ============================================================================
describe('VH-116 · anclas con cantidad > 1 frente a varias zonas', () => {
  const PROG = (o) => ({ source: 'CONFIRMADO_PROGRAMA', ...o });
  const mesaProg = (z, idx, extra = {}) => PROG({ id: `p${z}`, nombre: 'Mesa de juntas', bancoId: 'mj-2400x1200', cantidad: 1, relation_role: 'ANCHOR_MEETING', requirement_id: `req:SALA ${z}:juntas:${idx}`, instance_id: `inst:${z}`, functional_group_id: `fg:${z}`, zone_id: `SALA ${z}`, w: 2400, d: 1200, user_capacity: 8, precioUnitario: 9000, ...extra });
  const mesaUsuario = (extra = {}) => ({ id: 'm-1', nombre: 'Mesa de juntas APP LT 2.40 × 1.20', cantidad: 2, piezaId: 'linea-mesa_juntas', precioUnitario: 9800, w: 2400, d: 1200, ...extra });
  const mesas = (r) => r.partidas.filter((p) => p.relation_role === 'ANCHOR_MEETING');
  const unidades = (r) => mesas(r).reduce((s, p) => s + (Number(p.cantidad) || 1), 0);

  it('1 · mesa ×2 ya atada a A, programa con B: sin decisión NEEDS_REVIEW (puedeRepartir), nada se mueve ni se pierde', () => {
    const r = reconciliarNuevasConPrograma([mesaProg('B', 1)], [mesaUsuario({ relation_role: 'ANCHOR_MEETING', requirement_id: 'req:SALA A:juntas:0', instance_id: 'inst:A', functional_group_id: 'fg:A', zone_id: 'SALA A' })]);
    expect(r.ambiguas).toHaveLength(1);
    expect(r.ambiguas[0]).toMatchObject({ id: 'm-1', puedeRepartir: true, motivo: 'CANTIDAD_MAYOR_QUE_LUGAR', cantidad: 2 });
    expect(r.ambiguas[0].opciones.map((o) => o.zona)).toEqual(['SALA B']);
    expect(r.sustituidas).toEqual([]);
    expect(mesas(r).find((m) => m.id === 'm-1')).toMatchObject({ cantidad: 2, zone_id: 'SALA A' });
    expect(r.partidas.find((p) => p.id === 'pB')).toBeTruthy();              // la mesa del programa de B sigue (requerimiento distinto, no duplicado)
  });
  it('1b · con decisión "repartir": una unidad a B, la instancia B del programa se consume, cantidades completas', () => {
    const r = reconciliarNuevasConPrograma([mesaProg('B', 1)], [mesaUsuario({ relation_role: 'ANCHOR_MEETING', requirement_id: 'req:SALA A:juntas:0', instance_id: 'inst:A', functional_group_id: 'fg:A', zone_id: 'SALA A' })], { decisiones: { 'm-1': 'repartir' } });
    expect(r.ambiguas).toEqual([]);
    expect(r.partidas.filter((p) => p.source === 'CONFIRMADO_PROGRAMA')).toHaveLength(0);
    expect(mesas(r).map((m) => [m.id, m.cantidad, m.zone_id, m.instance_id, m.precioUnitario, m.piezaId]).sort((a, b) => a[0].length - b[0].length)).toEqual([
      ['m-1', 1, 'SALA A', 'inst:A', 9800, 'linea-mesa_juntas'], ['m-1#2', 1, 'SALA B', 'inst:B', 9800, 'linea-mesa_juntas']]);
    expect(unidades(r)).toBe(2);
  });
  it('2 · mesa ×2 expresamente para A (decisión = conservar / opción A): las dos se quedan en A y B no se toca', () => {
    const existentes = [mesaProg('B', 1)];
    const nueva = mesaUsuario({ relation_role: 'ANCHOR_MEETING', requirement_id: 'req:SALA A:juntas:0', instance_id: 'inst:A', functional_group_id: 'fg:A', zone_id: 'SALA A' });
    const r = reconciliarNuevasConPrograma(existentes, [nueva], { decisiones: { 'm-1': 'conservar' } });
    expect(r.ambiguas).toEqual([]);
    expect(mesas(r).find((m) => m.id === 'm-1')).toMatchObject({ cantidad: 2, zone_id: 'SALA A' });
    expect(r.partidas.find((p) => p.id === 'pB')).toBeTruthy();
  });
  it('3 · modelos/medidas distintos: el reparto conserva identidad, precio y medidas de la persona y marca capacidad distinta', () => {
    const progB = mesaProg('B', 1, { nombre: 'Mesa de juntas 1.20', bancoId: 'mj-1200x1200', w: 1200, d: 1200, user_capacity: 4 });
    const r = reconciliarNuevasConPrograma([progB], [mesaUsuario({ relation_role: 'ANCHOR_MEETING', requirement_id: 'req:SALA A:juntas:0', instance_id: 'inst:A', zone_id: 'SALA A', user_capacity: 8 })], { decisiones: { 'm-1': 'repartir' } });
    const b = mesas(r).find((m) => m.id === 'm-1#2');
    expect(b).toMatchObject({ zone_id: 'SALA B', w: 2400, d: 1200, precioUnitario: 9800, piezaId: 'linea-mesa_juntas', user_capacity: 8, sustituyePrograma: 'mj-1200x1200' });
  });
  it('4 · dos bancas en dos zonas operativas (antes de aplicar): sin decisión NEEDS_REVIEW; con "repartir" una por zona', () => {
    const bancaProg = (z) => PROG({ id: `b${z}`, nombre: 'Módulo operativo', bancoId: 'op-8u', cantidad: 1, relation_role: 'ANCHOR_WORKSTATION', requirement_id: `req:${z}:op:0`, instance_id: `inst:${z}`, functional_group_id: `fg:${z}`, zone_id: z, w: 4800, d: 1200, user_capacity: 8 });
    const nueva = { id: 'b-1', nombre: 'Banca doble APP LT 1.50 · 8 usuarios · ocupa 6.00 × 1.20 m', cantidad: 2, piezaId: 'linea-banca_doble', precioUnitario: 26145, w: 6000, d: 1200 };
    const sin = reconciliarNuevasConPrograma([bancaProg('OPERATIVA 1'), bancaProg('OPERATIVA 2')], [nueva]);
    expect(sin.ambiguas).toHaveLength(1); expect(sin.ambiguas[0].puedeRepartir).toBe(true); expect(sin.sustituidas).toEqual([]);
    expect(sin.partidas.filter((p) => p.source === 'CONFIRMADO_PROGRAMA')).toHaveLength(2);
    const con = reconciliarNuevasConPrograma([bancaProg('OPERATIVA 1'), bancaProg('OPERATIVA 2')], [nueva], { decisiones: { 'b-1': 'repartir' } });
    expect(con.partidas.filter((p) => p.source === 'CONFIRMADO_PROGRAMA')).toHaveLength(0);
    expect(con.partidas.filter((p) => p.relation_role === 'ANCHOR_WORKSTATION').map((p) => [p.cantidad, p.zone_id, p.user_capacity]).sort()).toEqual([[1, 'OPERATIVA 1', 8], [1, 'OPERATIVA 2', 8]]);
  });
  it('5 · tres salas y cantidades parciales: 2 para 3 no se reparte solo (habría que inferir qué sala pierde); se elige sala; 3 cubre las tres; 4 deja resto', () => {
    const tres = () => [mesaProg('A', 0), mesaProg('B', 1), mesaProg('C', 2)];
    const sin = reconciliarNuevasConPrograma(tres(), [mesaUsuario()]);
    expect(sin.ambiguas).toHaveLength(1);
    expect(sin.ambiguas[0]).toMatchObject({ id: 'm-1', cantidad: 2, puedeRepartir: false });
    expect(sin.ambiguas[0].opciones.map((o) => o.zona)).toEqual(['SALA A', 'SALA B', 'SALA C']);
    expect(sin.partidas.filter((p) => p.source === 'CONFIRMADO_PROGRAMA')).toHaveLength(3);     // nada se consume sin decisión
    const forzado = reconciliarNuevasConPrograma(tres(), [mesaUsuario()], { decisiones: { 'm-1': 'repartir' } });
    expect(forzado.ambiguas).toHaveLength(1);                                                   // 'repartir' con cantidad parcial no se acepta
    const eligeA = reconciliarNuevasConPrograma(tres(), [mesaUsuario()], { decisiones: { 'm-1': 'pA' } });
    expect(eligeA.ambiguas).toEqual([]);
    expect(eligeA.partidas.map((p) => [p.id, p.cantidad, p.zone_id]).sort()).toEqual([['m-1', 2, 'SALA A'], ['pB', 1, 'SALA B'], ['pC', 1, 'SALA C']]);
    expect(unidades(eligeA)).toBe(4);                                                           // 2 (decisión de la persona) + B + C: nada se pierde
    const justo = reconciliarNuevasConPrograma(tres(), [mesaUsuario({ cantidad: 3 })], { decisiones: { 'm-1': 'repartir' } });
    expect(justo.partidas.filter((p) => p.source === 'CONFIRMADO_PROGRAMA')).toHaveLength(0);
    expect(justo.partidas.map((p) => p.zone_id).sort()).toEqual(['SALA A', 'SALA B', 'SALA C']);
    expect(unidades(justo)).toBe(3);
    const sobra = reconciliarNuevasConPrograma(tres(), [mesaUsuario({ cantidad: 4 })], { decisiones: { 'm-1': 'repartir' } });
    expect(sobra.partidas.find((p) => p.id === 'm-1#resto')).toMatchObject({ cantidad: 1, precioUnitario: 9800 });
    expect(unidades(sobra)).toBe(4);
  });
  it('6 · idempotente: volver a aplicar sobre el resultado no cambia nada', () => {
    const r1 = reconciliarNuevasConPrograma([mesaProg('A', 0), mesaProg('B', 1)], [mesaUsuario()], { decisiones: { 'm-1': 'repartir' } });
    const prog = r1.partidas.filter((p) => p.source === 'CONFIRMADO_PROGRAMA');
    const persona = r1.partidas.filter((p) => p.source !== 'CONFIRMADO_PROGRAMA');
    const r2 = reconciliarNuevasConPrograma(prog, persona);
    expect(r2.sustituidas).toEqual([]); expect(r2.ambiguas).toEqual([]);
    expect(r2.partidas.map((p) => [p.id, p.cantidad, p.zone_id]).sort()).toEqual(r1.partidas.map((p) => [p.id, p.cantidad, p.zone_id]).sort());
  });
});

// ---------------------------------------------------------------------------
//  2026-10-16 · Cotización 757 real (golden): el programa guardó DOS renglones de sillas para el
//  MISMO lugar de la SALA DE CONSEJO (4 CONCERTO y 4 SONATA, misma instancia de mesa). La persona
//  pidió 4 SONATA. Antes: las SONATA del programa se fusionaban con las de la persona, pero las 4
//  CONCERTO se quedaban → 8 sillas cobradas para una mesa de 4, y como el reparto de lugares va por
//  id, las CONCERTO del programa se sentaban y las SONATA de la persona quedaban "sin mesa".
// ---------------------------------------------------------------------------
describe('mismo requerimiento repetido en el programa (cotización 757)', () => {
  const sillaProg = (modelo, precio) => ({
    id: `juntas|MEETING_SEAT|inst:req:SALA DE CONSEJO:juntas:0:#0::silla-${modelo}`, nombre: `Silla ${modelo.toUpperCase()} (visita 4 pts)`,
    bancoId: `silla-${modelo}`, piezaId: `silla-${modelo}`, relation_role: 'MEETING_SEAT', anchor_role: 'ANCHOR_MEETING',
    anchor_instance_id: 'inst:req:SALA DE CONSEJO:juntas:0:#0', functional_group_id: 'fg:req:SALA DE CONSEJO:juntas:0:#0',
    cantidad: 4, precioUnitario: precio, source: 'CONFIRMADO_PROGRAMA',
  });
  const prog757 = [sillaProg('concerto', 5140), sillaProg('sonata', 2420)];
  const sonata = { id: 'p-10', nombre: 'Silla · SONATA', piezaId: 'p9-silla-sonata-2420-144', cantidad: 4, precioUnitario: 2420, origen: 'banco' };

  it('RED→GREEN: las 4 SONATA de la persona cubren el lugar; las 4 CONCERTO repetidas del programa se van (4 sillas, no 8)', () => {
    const { partidas, sustituidas } = reconciliarNuevasConPrograma(prog757, [sonata]);
    const sillas = partidas.filter((p) => p.relation_role === 'MEETING_SEAT');
    expect(sillas.map((p) => p.id)).toEqual(['p-10']);
    expect(sillas.reduce((n, p) => n + p.cantidad, 0)).toBe(4);
    expect(partidas.find((p) => p.id === 'p-10').anchor_instance_id).toBe('inst:req:SALA DE CONSEJO:juntas:0:#0');
    // queda dicho, no se borra en silencio
    const dup = sustituidas.find((s) => s.duplicadoDelMismoRequerimiento);
    expect(dup).toMatchObject({ de: 'Silla CONCERTO (visita 4 pts)', a: 'Silla · SONATA', rol: 'MEETING_SEAT' });
  });

  it('el precio y la cantidad de lo que eligió la persona no se tocan', () => {
    const p10 = reconciliarNuevasConPrograma(prog757, [sonata]).partidas.find((p) => p.id === 'p-10');
    expect([p10.cantidad, p10.precioUnitario, p10.piezaId]).toEqual([4, 2420, 'p9-silla-sonata-2420-144']);
  });

  it('si la persona pide MENOS de lo que cubre cada renglón, nada repetido se quita (sólo la parte sustituida)', () => {
    const { partidas } = reconciliarNuevasConPrograma(prog757, [{ ...sonata, cantidad: 2 }]);
    expect(partidas.filter((p) => p.relation_role === 'MEETING_SEAT').reduce((n, p) => n + p.cantidad, 0)).toBe(2 + 2 + 4);
  });

  it('renglones del programa de OTRA mesa (otra instancia) no se tocan', () => {
    const otra = { ...sillaProg('concerto', 5140), id: 'otra|concerto', anchor_instance_id: 'inst:req:SALA B:juntas:1:#0', functional_group_id: 'fg:req:SALA B:juntas:1:#0' };
    const { partidas } = reconciliarNuevasConPrograma([...prog757, otra], [{ ...sonata, anchor_instance_id: 'inst:req:SALA DE CONSEJO:juntas:0:#0' }]);
    expect(partidas.find((p) => p.id === 'otra|concerto')).toBeTruthy();
  });

  it('idempotente: aplicar otra vez no cambia nada', () => {
    const r1 = reconciliarNuevasConPrograma(prog757, [sonata]);
    const r2 = reconciliarNuevasConPrograma(r1.partidas, []);
    expect(r2.partidas).toEqual(r1.partidas);
  });
});

// Barrido de botones 19-oct (qa/botones-red): una WIN de la persona sin zona y el programa con sólo la GAMMA-E de
// RECEPCIÓN → "WIN sustituye a GAMMA-E" (10 sillas operativas tomaban el lugar de la de recepción). Destinos distintos.
describe('fusión de duplicados respeta el destino (VH-AUD-204)', () => {
  it('silla operativa WIN (open) no sustituye a la silla de RECEPCIÓN del programa', () => {
    const programa = [{ id: 'g', source: 'CONFIRMADO_PROGRAMA', nombre: 'Silla operativa · GAMMA-E', bancoId: 'silla-gamma-e', cantidad: 2,
      relation_role: 'WORK_SEAT', anchor_role: 'ANCHOR_RECEPTION', zone_id: 'RECEPCIÓN', requirement_id: 'req:RECEPCIÓN' }];
    const persona = [{ id: 'w', nombre: 'Silla operativa · WIN', piezaId: 'p9-silla-operativa-win-5210', cantidad: 10 }];
    const r = reconciliarNuevasConPrograma(programa, persona);
    expect(r.sustituidas).toEqual([]);
    expect(r.partidas.find((p) => p.id === 'g')).toBeTruthy();
  });
  it('una silla de recepción declarada sí concilia con la de recepción del programa', () => {
    const programa = [{ id: 'g', source: 'CONFIRMADO_PROGRAMA', nombre: 'Silla operativa · GAMMA-E', bancoId: 'silla-gamma-e', cantidad: 1,
      relation_role: 'WORK_SEAT', anchor_role: 'ANCHOR_RECEPTION', zone_id: 'RECEPCIÓN', requirement_id: 'req:RECEPCIÓN' }];
    const persona = [{ id: 'w', nombre: 'Silla operativa · WIN', piezaId: 'p9-silla-operativa-win-5210', cantidad: 1, nota: 'para quien atiende la recepción' }];
    expect(reconciliarNuevasConPrograma(programa, persona).sustituidas.length).toBe(1);
  });
});
