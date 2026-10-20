// ============================================================================
//  Auditoría ChatGPT 2026-10-19 · reconciliación del programa (antes del solver).
//   VH-AUD-202: el MODELO no decide el uso. Una CONCERTO puede ser silla de juntas o de visita según su destino.
//   VH-AUD-203: la aprobación humana de un reparto vale sólo para ESE reparto (firma), no para cualquier otro.
//   VH-AUD-204: si los dos destinos son explícitos, tienen que ser el mismo (privado ≠ juntas ≠ operativo ≠ recepción).
// ============================================================================
import { describe, it, expect } from 'vitest';
import { confirmarPrograma } from './confirmarPrograma.js';

const R = { product_status: 'RESOLVED', identity_status: 'RESOLVED', price_status: 'SNAPSHOT_DISPLAY', precio_lista_snapshot: 1 };
const mesa = (iid, zona = 'SALA') => ({ ...R, rol: 'juntas', relation_role: 'ANCHOR_MEETING', bancoId: 'mj-2400x1200', instance_id: iid, requirement_id: `req:${zona}`, zone_id: zona, cantidad: 1, nombre: 'Mesa de juntas', w: 2400, d: 1200 });
const juntas = (iid, n, zona = 'SALA') => ({ ...R, rol: 'juntas', relation_role: 'MEETING_SEAT', anchor_role: 'ANCHOR_MEETING', bancoId: 'silla-concerto', anchor_instance_id: iid, requirement_id: `req:${zona}`, zone_id: zona, cantidad: n, nombre: 'Silla CONCERTO' });
const escritorio = (iid) => ({ ...R, rol: 'privado', relation_role: 'ANCHOR_DESK', bancoId: 'dir-1800x2400', instance_id: iid, requirement_id: 'req:DIR', zone_id: 'DIR', cantidad: 1, nombre: 'Escritorio', w: 1800, d: 2400 });
const visita = (iid, n) => ({ ...R, rol: 'privado', relation_role: 'VISITOR_SEAT', anchor_role: 'ANCHOR_DESK', bancoId: 'silla-concerto', anchor_instance_id: iid, requirement_id: 'req:DIR', zone_id: 'DIR', cantidad: n, nombre: 'Silla CONCERTO (visita)' });
const sillasNuevas = (r, rel) => r.confirmadas.filter((p) => p.relation_role === rel).reduce((s, p) => s + p.cantidad, 0);

describe('VH-AUD-202 · CONCERTO: el destino decide el rol, no el modelo', () => {
  it('CONCERTO ×4 ya cotizada (sin rol) + sala de juntas que pide CONCERTO ×4 → 4 en total, 0 nuevas', () => {
    const r = confirmarPrograma({ partidas: [mesa('M1'), juntas('M1', 4)] }, { existentes: [{ id: 'c4', piezaId: 'silla-concerto', nombre: 'Silla CONCERTO', cantidad: 4 }] });
    expect(sillasNuevas(r, 'MEETING_SEAT')).toBe(0);
    expect(r.conflictos).toEqual([]);
    expect(r.enriquecidos.find((e) => e.id === 'c4').patch).toMatchObject({ relation_role: 'MEETING_SEAT', anchor_instance_id: 'M1' });
  });
  it('CONCERTO marcada explícitamente como VISITA no cubre la sala de juntas', () => {
    const r = confirmarPrograma({ partidas: [mesa('M1'), juntas('M1', 4)] }, { existentes: [{ id: 'v4', piezaId: 'silla-concerto', nombre: 'Silla CONCERTO', cantidad: 4, relation_role: 'VISITOR_SEAT' }] });
    expect(sillasNuevas(r, 'MEETING_SEAT')).toBe(4);
    expect(r.enriquecidos.some((e) => e.id === 'v4')).toBe(false);
  });
  it('CONCERTO sin destino y un solo uso posible en el programa (juntas) → se vincula y se explica en el patch', () => {
    const r = confirmarPrograma({ partidas: [mesa('M1'), juntas('M1', 6)] }, { existentes: [{ id: 'c6', piezaId: 'silla-concerto', nombre: 'Silla CONCERTO', cantidad: 6 }] });
    expect(r.enriquecidos.find((e) => e.id === 'c6').patch.relation_role).toBe('MEETING_SEAT');
  });
  it('CONCERTO sin destino con DOS usos posibles (juntas y visita) → NEEDS_REVIEW, sin agregar sillas a ciegas', () => {
    const prop = { partidas: [mesa('M1'), juntas('M1', 4), escritorio('D1'), visita('D1', 2)] };
    const r = confirmarPrograma(prop, { existentes: [{ id: 'c4', piezaId: 'silla-concerto', nombre: 'Silla CONCERTO', cantidad: 4 }] });
    const c = r.conflictos.find((x) => x.code === 'ROL_AMBIGUO');
    expect(c).toMatchObject({ fila_id: 'c4', opciones: ['MEETING_SEAT', 'VISITOR_SEAT'] });
    expect(sillasNuevas(r, 'MEETING_SEAT') + sillasNuevas(r, 'VISITOR_SEAT')).toBe(0);
    // La persona decide "son de juntas": la fila cubre la sala y sólo se agregan las 2 de visita.
    const d = confirmarPrograma(prop, { existentes: [{ id: 'c4', piezaId: 'silla-concerto', nombre: 'Silla CONCERTO', cantidad: 4 }], roles: { c4: 'MEETING_SEAT' } });
    expect(d.conflictos.filter((x) => x.code === 'ROL_AMBIGUO')).toEqual([]);
    expect(sillasNuevas(d, 'MEETING_SEAT')).toBe(0);
    expect(sillasNuevas(d, 'VISITOR_SEAT')).toBe(2);
    expect(d.enriquecidos.find((e) => e.id === 'c4').patch.relation_role).toBe('MEETING_SEAT');
  });
  it('SONATA legacy sigue siendo silla de juntas', () => {
    const r = confirmarPrograma({ partidas: [mesa('M1'), { ...juntas('M1', 4), bancoId: 'silla-sonata' }] }, { existentes: [{ id: 's4', piezaId: 'silla-sonata', nombre: 'Silla SONATA', cantidad: 4 }] });
    expect(sillasNuevas(r, 'MEETING_SEAT')).toBe(0);
  });
  it('ALPHA no cubre juntas ni puestos operativos', () => {
    const r = confirmarPrograma({ partidas: [mesa('M1'), juntas('M1', 1)] }, { existentes: [{ id: 'a1', piezaId: 'silla-alpha', nombre: 'Silla directiva ALPHA', cantidad: 1 }] });
    expect(sillasNuevas(r, 'MEETING_SEAT')).toBe(1);
  });
});

describe('VH-AUD-204 · destinos explícitos tienen que coincidir', () => {
  const op = (iid) => ({ ...R, rol: 'operativo', relation_role: 'ANCHOR_WORKSTATION', bancoId: 'op-8u', instance_id: iid, requirement_id: 'req:OP', zone_id: 'OP', cantidad: 1, nombre: 'Banca', w: 4800, d: 1200 });
  const gaveta = (iid, n, anchor_role = 'ANCHOR_WORKSTATION') => ({ ...R, rol: 'operativo', relation_role: 'UNDERDESK_STORAGE', anchor_role, bancoId: 'gaveta-x', anchor_instance_id: iid, cantidad: n, nombre: 'Gaveta' });
  it('gaveta explícita de PRIVADO no cubre una banca operativa', () => {
    const r = confirmarPrograma({ partidas: [op('B1'), gaveta('B1', 2)] }, { existentes: [{ id: 'g', piezaId: 'gaveta-x', nombre: 'Gaveta', cantidad: 2, relation_role: 'UNDERDESK_STORAGE', anchor_role: 'ANCHOR_DESK' }] });
    expect(r.enriquecidos.some((e) => e.id === 'g')).toBe(false);
    expect(sillasNuevas(r, 'UNDERDESK_STORAGE')).toBe(2);
  });
  it('gaveta explícita OPERATIVA sí cubre la banca operativa', () => {
    const r = confirmarPrograma({ partidas: [op('B1'), gaveta('B1', 2)] }, { existentes: [{ id: 'g', piezaId: 'gaveta-x', nombre: 'Gaveta', cantidad: 2, relation_role: 'UNDERDESK_STORAGE', anchor_role: 'ANCHOR_WORKSTATION' }] });
    expect(r.enriquecidos.some((e) => e.id === 'g')).toBe(true);
  });
  it('silla de juntas explícita no cubre visita de privado (aunque sea el mismo modelo)', () => {
    const r = confirmarPrograma({ partidas: [escritorio('D1'), visita('D1', 2)] }, { existentes: [{ id: 'm2', piezaId: 'silla-concerto', nombre: 'Silla CONCERTO', cantidad: 2, relation_role: 'MEETING_SEAT', anchor_role: 'ANCHOR_MEETING' }] });
    expect(sillasNuevas(r, 'VISITOR_SEAT')).toBe(2);
  });
  it('sin destino en la fila: se usa (fallback controlado)', () => {
    const r = confirmarPrograma({ partidas: [op('B1'), gaveta('B1', 2)] }, { existentes: [{ id: 'g', piezaId: 'gaveta-x', nombre: 'Gaveta', cantidad: 2 }] });
    expect(r.enriquecidos.some((e) => e.id === 'g')).toBe(true);
  });
});

describe('VH-AUD-203 · el reparto aprobado vale sólo para ESE reparto', () => {
  const bench = (iid, req = 'req:OP') => ({ ...R, rol: 'operativo', relation_role: 'ANCHOR_WORKSTATION', bancoId: 'op-8u', instance_id: iid, requirement_id: req, zone_id: 'OP', cantidad: 1, nombre: 'Banca', w: 4800, d: 1200 });
  const seat = (iid, n, req = 'req:OP') => ({ ...R, rol: 'operativo', relation_role: 'WORK_SEAT', anchor_role: 'ANCHOR_WORKSTATION', bancoId: 'silla-win', anchor_instance_id: iid, requirement_id: req, zone_id: 'OP', cantidad: n, nombre: 'WIN' });
  const win = { id: 'w16', piezaId: 'silla-win', nombre: 'WIN', cantidad: 16 };
  const prop = (pares, req) => ({ partidas: [...pares.map(([i]) => bench(i, req)), ...pares.map(([i, n]) => seat(i, n, req))] });
  const aprobar = (p) => { const r = confirmarPrograma(p, { existentes: [win], repartir: ['w16'] }); return { ...win, ...r.enriquecidos.find((e) => e.id === 'w16').patch }; };
  const pregunta = (p, fila) => confirmarPrograma(p, { existentes: [fila] }).conflictos.some((c) => c.code === 'SPLIT_REQUIRED');
  const base = prop([['A', 8], ['B', 8]]);
  it('mismas anclas y cantidades → no vuelve a preguntar', () => { expect(pregunta(base, aprobar(base))).toBe(false); });
  it('sólo cambia el orden → la firma sigue valiendo', () => { expect(pregunta(prop([['B', 8], ['A', 8]]), aprobar(base))).toBe(false); });
  it('cambia una ancla → pregunta', () => { expect(pregunta(prop([['A', 8], ['C', 8]]), aprobar(base))).toBe(true); });
  it('cambia el número de anclas → pregunta', () => { expect(pregunta(prop([['C', 6], ['D', 6], ['E', 4]]), aprobar(base))).toBe(true); });
  it('cambian las cantidades → pregunta', () => { expect(pregunta(prop([['A', 10], ['B', 6]]), aprobar(base))).toBe(true); });
  it('cambia el requerimiento → pregunta', () => { expect(pregunta(prop([['A', 8], ['B', 8]], 'req:OTRO'), aprobar(base))).toBe(true); });
  it('la fila aprobada guarda la firma de la decisión', () => { expect(aprobar(base).reparto_firma).toMatch(/A.*8.*B.*8/); });
});

// Lab de recorridos (C1): 13 GAMMA-E en un renglón (12 operativos + 1 recepción); el plano sólo pedía 1 para la
// recepción desde ese renglón. "Repartir" amarraba el renglón ENTERO a la recepción (2 sillas acabaron allá).
describe('reparto parcial: lo que sobra no queda amarrado al único mueble', () => {
  const R2 = { product_status: 'RESOLVED', identity_status: 'RESOLVED', price_status: 'SNAPSHOT_DISPLAY', precio_lista_snapshot: 1 };
  const rec = { ...R2, rol: 'recepcion', relation_role: 'ANCHOR_RECEPTION', bancoId: 'rec', instance_id: 'RC', requirement_id: 'req:REC', zone_id: 'RECEPCIÓN', cantidad: 1, nombre: 'Recepción', w: 2000, d: 800 };
  const silla = { ...R2, rol: 'recepcion', relation_role: 'WORK_SEAT', anchor_role: 'ANCHOR_RECEPTION', bancoId: 'silla-gamma-e', anchor_instance_id: 'RC', requirement_id: 'req:REC', zone_id: 'RECEPCIÓN', cantidad: 1, nombre: 'GAMMA-E' };
  const g13 = { id: 'g', piezaId: 'p9-silla-operativa-gamma-e-3990', nombre: 'Silla operativa · GAMMA-E', cantidad: 13 };
  it('Repartir 1 de 13 a la recepción: el renglón no queda marcado como "de recepción"', () => {
    const r = confirmarPrograma({ partidas: [rec, silla] }, { existentes: [g13], repartir: ['g'] });
    const p = r.enriquecidos.find((e) => e.id === 'g').patch;
    expect(p.relation_role).toBe('WORK_SEAT');
    expect(p.anchor_role).toBeNull();
    expect(p.zone_id).toBeNull();
    expect(p.anchor_instance_id).toBeNull();
  });
});

// ============================================================================
//  Cierre ChatGPT · P1-PROG-01: el DESTINO explícito por zona/requerimiento/ancla también separa (no sólo recepción).
// ============================================================================
describe('P1-PROG-01 · destino canónico (zona, requerimiento, ancla) para todos los roles', () => {
  const RR = { product_status: 'RESOLVED', identity_status: 'RESOLVED', price_status: 'SNAPSHOT_DISPLAY', precio_lista_snapshot: 1 };
  const ancla = { juntas: 'ANCHOR_MEETING', privado: 'ANCHOR_DESK', operativo: 'ANCHOR_WORKSTATION', recepcion: 'ANCHOR_RECEPTION' };
  const zona = { juntas: 'SALA DE CONSEJO', privado: 'OFICINA CEO', operativo: 'OPERATIVA', recepcion: 'RECEPCIÓN' };
  const dep = (rol, rel, iid, n = 1, banco = 'X') => ({ ...RR, rol, relation_role: rel, anchor_role: ancla[rol], bancoId: banco, anchor_instance_id: iid, requirement_id: `req:${zona[rol]}`, zone_id: zona[rol], cantidad: n, nombre: 'Pieza X' });
  const anc = (rol, iid) => ({ ...RR, rol, relation_role: ancla[rol], bancoId: `a-${rol}`, instance_id: iid, requirement_id: `req:${zona[rol]}`, zone_id: zona[rol], cantidad: 1, nombre: `Ancla ${rol}`, w: 1800, d: 900 });
  const nuevas = (r, rel) => r.confirmadas.filter((p) => p.relation_role === rel).reduce((s, p) => s + p.cantidad, 0);

  it('ataque exacto: SUPPORT_STORAGE de OFICINA CEO (sin anchor_role) NO cubre la de SALA DE CONSEJO', () => {
    const r = confirmarPrograma({ partidas: [anc('juntas', 'M'), dep('juntas', 'SUPPORT_STORAGE', 'M')] },
      { existentes: [{ id: 'g', piezaId: 'X', bancoId: 'X', nombre: 'Pieza X', cantidad: 1, relation_role: 'SUPPORT_STORAGE', zone_id: 'OFICINA CEO', anchor_role: null }] });
    expect(r.enriquecidos.some((e) => e.id === 'g')).toBe(false);
    expect(nuevas(r, 'SUPPORT_STORAGE')).toBe(1);
  });
  for (const rel of ['SUPPORT_STORAGE', 'UNDERDESK_STORAGE', 'WORK_SEAT', 'VISITOR_SEAT']) {
    for (const [de, a] of [['operativo', 'privado'], ['privado', 'juntas'], ['juntas', 'recepcion'], ['recepcion', 'operativo']]) {
      it(`${rel}: fila de ${de} (zona explícita) no cubre ${a}`, () => {
        const r = confirmarPrograma({ partidas: [anc(a, 'K'), dep(a, rel, 'K')] },
          { existentes: [{ id: 'f', piezaId: 'X', bancoId: 'X', nombre: 'Pieza X', cantidad: 1, relation_role: rel, zone_id: zona[de] }] });
        expect(r.enriquecidos.some((e) => e.id === 'f')).toBe(false);
      });
    }
    it(`${rel}: misma zona explícita sí cubre`, () => {
      const r = confirmarPrograma({ partidas: [anc('privado', 'K'), dep('privado', rel, 'K')] },
        { existentes: [{ id: 'f', piezaId: 'X', bancoId: 'X', nombre: 'Pieza X', cantidad: 1, relation_role: rel, zone_id: 'OFICINA CEO' }] });
      expect(r.enriquecidos.some((e) => e.id === 'f')).toBe(true);
    });
  }
  it('sin destino y DOS destinos compatibles (oficina y sala piden 1 c/u) → NEEDS_REVIEW, sin agregar a ciegas', () => {
    const prop = { partidas: [anc('privado', 'P'), anc('juntas', 'M'), dep('privado', 'SUPPORT_STORAGE', 'P'), dep('juntas', 'SUPPORT_STORAGE', 'M')] };
    const r = confirmarPrograma(prop, { existentes: [{ id: 's', piezaId: 'X', bancoId: 'X', nombre: 'Pieza X', cantidad: 1, relation_role: 'SUPPORT_STORAGE' }] });
    const c = r.conflictos.find((x) => x.code === 'DESTINO_AMBIGUO');
    expect(c).toMatchObject({ fila_id: 's' });
    expect(c.opciones.sort()).toEqual(['OFICINA CEO', 'SALA DE CONSEJO']);
    expect(r.enriquecidos.some((e) => e.id === 's')).toBe(false);
    // La persona decide la zona → se vincula ahí y sólo se agrega la otra.
    const d = confirmarPrograma(prop, { existentes: [{ id: 's', piezaId: 'X', bancoId: 'X', nombre: 'Pieza X', cantidad: 1, relation_role: 'SUPPORT_STORAGE' }], destinos: { s: 'SALA DE CONSEJO' } });
    expect(d.conflictos.filter((x) => x.code === 'DESTINO_AMBIGUO')).toEqual([]);
    expect(d.enriquecidos.find((e) => e.id === 's').patch.zone_id).toBe('SALA DE CONSEJO');
    expect(nuevas(d, 'SUPPORT_STORAGE')).toBe(1);
  });
  it('sin destino y UN solo destino compatible → se vincula (fallback controlado)', () => {
    const r = confirmarPrograma({ partidas: [anc('privado', 'P'), dep('privado', 'SUPPORT_STORAGE', 'P')] },
      { existentes: [{ id: 's', piezaId: 'X', bancoId: 'X', nombre: 'Pieza X', cantidad: 1, relation_role: 'SUPPORT_STORAGE' }] });
    expect(r.enriquecidos.some((e) => e.id === 's')).toBe(true);
  });
});
