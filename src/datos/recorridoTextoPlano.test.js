// ============================================================================
//  Laboratorio de recorridos (2026-10-19, run 39355206065): COTIZAR POR TEXTO y DESPUÉS subir el plano — el camino de
//  la prueba E2E de Rodrigo. Lo que el auditor encontró en producción:
//   1. Las 16 CONCERTO de las salas (nota "Modelo de casa para salas de juntas/consejo") se trataban como VISITA: 2 en
//      recepción, 14 sin colocar.
//   2. Las dos mesas se repartían por tamaño, ignorando que la nota de cada una dice su sala (consejo / creativa).
//   3. "Esto entendí" decía "18 sillas de trabajo para 17 puestos" (la recepción no contaba como puesto) y ponía las
//      CONCERTO de juntas como "sillas de visita".
// ============================================================================
import { describe, it, expect } from 'vitest';
import { inferRole, confirmarPrograma } from './confirmarPrograma.js';
import { construirPayloadAcomodo } from './acomodoPayload.js';
import { loQueEntendi } from './entendido.js';

const concerto = { id: 'con', nombre: 'Silla de visita · CONCERTO', piezaId: 'p9-silla-de-visita-concerto-5470', cantidad: 16, precioUnitario: 5470, nota: 'Modelo de casa para salas de juntas/consejo.' };

describe('1 · una CONCERTO cuya nota dice "sala de juntas/consejo" es silla de JUNTAS', () => {
  it('inferRole: juntas por la nota; sin nota sigue siendo visita (legacy)', () => {
    expect(inferRole(concerto)).toBe('MEETING_SEAT');
    expect(inferRole({ ...concerto, nota: '' })).toBe('VISITOR_SEAT');
    expect(inferRole({ ...concerto, nota: '2 visitas para la oficina de dirección' })).toBe('VISITOR_SEAT');
  });
  it('confirmarPrograma: cubre las sillas de las 2 salas (pide repartir), no agrega CONCERTO nuevas', () => {
    const R = { product_status: 'RESOLVED', identity_status: 'RESOLVED', price_status: 'SNAPSHOT_DISPLAY', precio_lista_snapshot: 1 };
    const mesa = (iid, z) => ({ ...R, rol: 'juntas', relation_role: 'ANCHOR_MEETING', bancoId: 'mj', instance_id: iid, requirement_id: `req:${z}`, zone_id: z, cantidad: 1, nombre: 'Mesa', w: 2400, d: 1200 });
    const sillas = (iid, n, z) => ({ ...R, rol: 'juntas', relation_role: 'MEETING_SEAT', anchor_role: 'ANCHOR_MEETING', bancoId: 'silla-concerto', anchor_instance_id: iid, requirement_id: `req:${z}`, zone_id: z, cantidad: n, nombre: 'Silla CONCERTO' });
    const prop = { partidas: [mesa('C', 'SALA DE CONSEJO'), mesa('K', 'SALA CREATIVA'), sillas('C', 10, 'SALA DE CONSEJO'), sillas('K', 6, 'SALA CREATIVA')] };
    const r = confirmarPrograma(prop, { existentes: [concerto] });
    expect(r.confirmadas.filter((p) => p.relation_role === 'MEETING_SEAT')).toEqual([]);
    expect(r.conflictos.filter((c) => c.code === 'ROL_AMBIGUO')).toEqual([]);
    expect(r.conflictos.filter((c) => c.code === 'SPLIT_REQUIRED').every((c) => c.fila_id === 'con')).toBe(true);
    const d = confirmarPrograma(prop, { existentes: [concerto], repartir: ['con'] });
    expect(d.conflictos).toEqual([]);
    expect(d.confirmadas.filter((p) => p.relation_role === 'MEETING_SEAT')).toEqual([]);
  });
  it('acomodo: las CONCERTO de juntas entran como MEETING_SEAT', () => {
    const areasM = [{ nombre: 'SALA DE CONSEJO', tipo: 'juntas', x: 0, y: 0, ancho: 7, largo: 5, asientos: 10 }, { nombre: 'RECEPCIÓN', tipo: 'recepcion', x: 7, y: 0, ancho: 6, largo: 5, puestos: 1 }];
    const r = construirPayloadAcomodo({ partidas: [{ id: 'm', nombre: 'Mesa de juntas APP LT 2.40 × 1.20', cantidad: 1, w: 2400, d: 1200, precioUnitario: 1 }, concerto], areasM });
    expect(new Set(r.piezas.filter((p) => p.id.startsWith('con-')).map((p) => p.relation_role))).toEqual(new Set(['MEETING_SEAT']));
  });
});

describe('2 · la mesa va a la sala que dice su nota, no por tamaño', () => {
  const areasM = [
    { nombre: 'SALA DE CONSEJO', tipo: 'juntas', x: 0, y: 0, ancho: 7, largo: 5, asientos: 10 },
    { nombre: 'SALA CREATIVA', tipo: 'juntas', x: 7, y: 0, ancho: 5, largo: 5, asientos: 6 },
  ];
  it('Eclipse 1.80 "para la sala de consejo" → SALA DE CONSEJO; App LT 2.40 "Sala creativa" → SALA CREATIVA', () => {
    const partidas = [
      { id: 'ecl', nombre: 'Eclipse Mesa de consejo modular recta 1.80 m', cantidad: 1, w: 1800, d: 1100, precioUnitario: 1, nota: 'Mesa de consejo corrida/modular armada para 10 lugares.' },
      { id: 'app', nombre: 'Mesa de juntas APP LT 2.40 × 1.20', cantidad: 1, w: 2400, d: 1200, precioUnitario: 1, nota: 'Sala creativa resuelta con mesa de juntas App LT de 2.40 m para 6 lugares.' },
    ];
    const r = construirPayloadAcomodo({ partidas, areasM });
    const zona = (pref) => r.piezas.filter((p) => p.id.startsWith(pref)).map((p) => p.zone_id);
    expect(zona('ecl-')).toEqual(['SALA DE CONSEJO']);
    expect(zona('app-')).toEqual(['SALA CREATIVA']);
  });
});

describe('3 · "Esto entendí": la recepción es un puesto; las CONCERTO de juntas son de reunión', () => {
  const partidas = [
    { id: 'b', nombre: 'Banca doble APP LT 1.50 · 8 usuarios · ocupa 6.00 × 1.20 m', cantidad: 2 },
    { id: 'r', nombre: 'Ergonova 4 · Recepción 1.80 m · repisa Melamina ABS · Melamina ABS', piezaId: 'p9-ergonova-4-recepcion-16585', cantidad: 1 },
    { id: 'e', nombre: 'Eclipse Escritorio Directivo 2.40 m · mano Derecha', cantidad: 1 },
    { id: 'w', nombre: 'Silla operativa · WIN', cantidad: 16 },
    { id: 'g', nombre: 'Silla operativa · GAMMA-E', cantidad: 1, nota: '1 persona que atiende recepción.' },
    { id: 'a', nombre: 'Silla directiva ALPHA', cantidad: 1 },
    { id: 'd', nombre: 'Silla de visita · DELTA', cantidad: 2 },
    concerto,
  ];
  it('18 puestos (16 + recepción + dirección) para 18 sillas de trabajo: sin "sobran"', () => {
    const e = loQueEntendi(partidas, []);
    expect(e.puestos).toBe(18);
    expect(e.sillas).toBe(18);
    expect(e.avisos.map((a) => a.texto).join(' ')).not.toMatch(/sobran|faltan/);
  });
  it('las 16 CONCERTO de juntas van en reunión, no en visita', () => {
    const e = loQueEntendi(partidas, []);
    expect(e.visitas).toBe(2);
    expect(e.reunion).toBe(16);
  });
});

describe('4 · una mesa que no alcanza para las personas de su sala se avisa (no se deja pasar)', () => {
  it('Eclipse modular 1.80 m "para 10 lugares" → aviso; App LT 2.40 "para 6 lugares" → sin aviso', () => {
    const e = loQueEntendi([
      { id: 'ecl', nombre: 'Eclipse Mesa de consejo modular recta 1.80 m', cantidad: 1, nota: 'Mesa de consejo corrida/modular armada para 10 lugares; el motor ajusta módulos según largo requerido.' },
      { id: 'app', nombre: 'Mesa de juntas APP LT 2.40 × 1.20', cantidad: 1, nota: 'Sala creativa resuelta con mesa de juntas App LT de 2.40 m para 6 lugares.' },
    ], []);
    const t = e.avisos.map((a) => a.texto).join(' | ');
    expect(t).toMatch(/Eclipse Mesa de consejo modular recta 1\.80 m.*6 lugares.*10/);
    expect(t).not.toMatch(/APP LT 2\.40/);
  });
});

// Recorrido plano→reabrir (lab 19-oct, run 39358970210): el lector agregó "ÁREA SIN ROTULAR (esquina superior derecha)"
// tipo open SIN puestos. El programa le estimaba 8 puestos por geometría (24 en vez de 16) y mandaba LOS DOS bancos de 12
// a ese rincón vacío; OPERATIVA (16 escritorios dibujados) quedaba sin nada.
import { proponerProgramaDelPlano } from './programaRealDelPlano.js';
describe('5 · un área abierta sin escritorios dibujados no inventa puestos cuando el plano sí los cuenta', () => {
  const areas = [
    { nombre: 'OFICINA DIRECCIÓN', tipo: 'privado', x: 0, y: 0, ancho: 5, largo: 5, puestos: 1 },
    { nombre: 'SALA DE CONSEJO', tipo: 'juntas', x: 5, y: 0, ancho: 7, largo: 5, asientos: 10 },
    { nombre: 'ÁREA SIN ROTULAR (esquina superior derecha)', tipo: 'open', x: 17, y: 0, ancho: 7, largo: 5 },
    { nombre: 'OPERATIVA', tipo: 'open', x: 0, y: 7, ancho: 12, largo: 7, puestos: 16 },
    { nombre: 'RECEPCIÓN', tipo: 'recepcion', x: 12, y: 7, ancho: 6, largo: 7, puestos: 1 },
  ];
  it('16 puestos (no 24), todo en OPERATIVA, y un aviso que nombra el área sin escritorios', () => {
    const r = proponerProgramaDelPlano(areas, { linea: 'App LT' });
    expect(r.programaDetectado.operativos).toBe(16);
    const ops = r.propuesta.partidas.filter((p) => p.relation_role === 'ANCHOR_WORKSTATION' || (p.relation_role === 'WORK_SEAT' && p.anchor_role === 'ANCHOR_WORKSTATION'));
    expect(new Set(ops.map((p) => p.zone_id))).toEqual(new Set(['OPERATIVA']));
    const sillas = r.propuesta.partidas.filter((p) => p.relation_role === 'WORK_SEAT' && p.anchor_role === 'ANCHOR_WORKSTATION').reduce((s, p) => s + p.cantidad, 0);
    expect(sillas).toBe(16);
    expect(r.programaDetectado.avisos.join(' ')).toMatch(/SIN ROTULAR.*no tiene escritorios dibujados/);
  });
});
