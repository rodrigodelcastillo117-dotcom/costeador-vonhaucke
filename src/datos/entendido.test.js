import { describe, it, expect } from 'vitest';
import { loQueEntendi } from './entendido.js';

// ============================================================================
//  "ESTO ENTENDÍ" — lo que hace que valga la pena un paso más antes de acomodar
//  no es repetir la lista: es CACHAR lo que no cuadra (gente sin silla,
//  privados vacíos) cuando todavía se puede corregir de un toque.
// ============================================================================
const PARTIDAS = [
  { id: 'p1', nombre: 'Banca doble APP LT 1.50 · 10 usuarios', cantidad: 2 },
  { id: 'p2', nombre: 'Eclipse · Escritorio directivo 2.40', cantidad: 1 },
  { id: 'p3', nombre: 'Alba · Mesa de juntas 3.60 m', cantidad: 1 },
  { id: 'p4', nombre: 'Modulor · Archivero horizontal 0.75', cantidad: 4 },
  { id: 'p5', nombre: 'Gaveta rodante Mox', cantidad: 6 },
  { id: 'p6', nombre: 'Silla operativa WIN', cantidad: 12 },
  { id: 'p7', nombre: 'Silla de visita CONCERTO', cantidad: 2 },
];
const AREAS = [
  { nombre: 'Open space', ancho: 20, largo: 15 },
  { nombre: 'Privado 1', tipo: 'privado', ancho: 4, largo: 3 },
  { nombre: 'Privado 2', tipo: 'privado', ancho: 4, largo: 3 },
];

describe('lo que Voni entendió', () => {
  const r = loQueEntendi(PARTIDAS, AREAS);

  it('cuenta PERSONAS, no muebles: 2 bancas de 10 + 1 directivo = 21 puestos', () => {
    expect(r.puestos).toBe(21);
  });

  it('separa la silla de trabajo de la de visita y de la gaveta', () => {
    expect(r.sillas).toBe(12);
    expect(r.visitas).toBe(2);
    expect(r.gavetas).toBe(6);
  });

  it('cada renglón apunta a SU partida: el ± cambia la de verdad, no una copia', () => {
    const puestos = r.grupos.find((g) => g.clave === 'puestos');
    expect(puestos.renglones.map((x) => x.id)).toEqual(['p1', 'p2']);
  });

  it('CACHA que faltan sillas antes de acomodar', () => {
    expect(r.avisos.some((a) => /faltan 7/.test(a.texto))).toBe(true);
  });

  it('CACHA los privados que se quedarían vacíos', () => {
    expect(r.avisos.some((a) => /privado\(s\) y hay 1 escritorio/.test(a.texto))).toBe(true);
  });

  it('y avisa si todavía no hay espacio', () => {
    const sinEspacio = loQueEntendi(PARTIDAS, []);
    expect(sinEspacio.espacio.hay).toBe(false);
    expect(sinEspacio.avisos.some((a) => /dónde va el proyecto/.test(a.texto))).toBe(true);
  });

  it('el titular se lee de un vistazo', () => {
    expect(r.titular).toMatch(/324 m²/);
    expect(r.titular).toMatch(/2 privados/);
    expect(r.titular).toMatch(/21 puestos de trabajo/);
    expect(r.titular).toMatch(/14 sillas/);
  });

  it('un proyecto que sí cuadra no inventa avisos', () => {
    const ok = loQueEntendi([
      { id: 'a', nombre: 'Eclipse · Escritorio directivo 2.40', cantidad: 2 },
      { id: 'b', nombre: 'Silla operativa WIN', cantidad: 2 },
    ], [{ nombre: 'Privado 1', tipo: 'privado', ancho: 4, largo: 3 }]);
    expect(ok.avisos).toEqual([]);
  });

  it('sin muebles no truena ni inventa nada', () => {
    const vacio = loQueEntendi([], []);
    expect(vacio.grupos).toEqual([]);
    expect(vacio.puestos).toBe(0);
  });

  it('caso CEO: SONATA de juntas no se cuenta como silla de trabajo ni crea sobrante falso', () => {
    const ceo = loQueEntendi([
      { id: 'bench', nombre: 'Banca doble APP LT 1.50 · 8 usuarios', cantidad: 3 },
      { id: 'priv', nombre: 'Eclipse Escritorio Directivo 2.10 m', cantidad: 4 },
      { id: 'win', nombre: 'Silla operativa · WIN', cantidad: 24 },
      { id: 'alpha', nombre: 'Silla directiva ALPHA', cantidad: 4 },
      { id: 'sonata', nombre: 'Silla · SONATA', cantidad: 20 },
      { id: 'visita', nombre: 'Silla de visita · CONCERTO', cantidad: 8 },
      { id: 'gav', nombre: 'Mox · Gaveta pedestal 3 cajones', cantidad: 24 },
      { id: 'j1', nombre: 'Mesa de juntas APP LT 2.40 × 1.20', cantidad: 1 },
      { id: 'j2', nombre: 'Cirque · Mesa de juntas 2.40', cantidad: 2 },
    ], [
      { nombre: 'PRIVADO 1', tipo: 'privado', ancho: 4.5, largo: 3 },
      { nombre: 'PRIVADO 2', tipo: 'privado', ancho: 4.5, largo: 3 },
      { nombre: 'PRIVADO 3', tipo: 'privado', ancho: 4.5, largo: 3 },
      { nombre: 'PRIVADO 4', tipo: 'privado', ancho: 4.5, largo: 3 },
      { nombre: 'APARTADO 1 (6 PAX)', tipo: 'open', ancho: 6.75, largo: 3.5 },
    ]);

    expect(ceo.puestos).toBe(28);          // 24 bench + 4 privados
    expect(ceo.sillas).toBe(28);           // 24 WIN + 4 ALPHA
    expect(ceo.visitas).toBe(8);
    expect(ceo.reunion).toBe(20);          // SONATA aparte
    expect(ceo.totalSillas).toBe(56);
    expect(ceo.gavetas).toBe(24);
    expect(ceo.avisos.some((a) => /sillas de trabajo.*sobran/i.test(a.texto))).toBe(false);
  });
});

// VH-095 (2026-10-12): el "sobran 8" de la cotización 757 era por partidas DUPLICADAS
// (programa + VONI). Con la conciliación, las cuentas por función cuadran.
import { reconciliarNuevasConPrograma as reconciliarVH095 } from './reconciliarPartidas.js';
import { loQueEntendi as loQueEntendiVH095 } from './entendido.js';
describe('VH-095 · capacidad por función tras conciliar', () => {
  const programa = [
    { id: 'a1', nombre: 'Módulo operativo App LT 8 usuarios (biombo cristal)', bancoId: 'op-8u-4800x1200-cristal', relation_role: 'ANCHOR_WORKSTATION', instance_id: 'i:op', functional_group_id: 'fg:op', user_capacity: 8, cantidad: 1, precioUnitario: 23070, source: 'CONFIRMADO_PROGRAMA' },
    { id: 'd1', nombre: 'Silla operativa WIN', bancoId: 'silla-win', relation_role: 'WORK_SEAT', anchor_instance_id: 'i:op', functional_group_id: 'fg:op', cantidad: 8, precioUnitario: 5210, source: 'CONFIRMADO_PROGRAMA' },
    { id: 'd2', nombre: 'Silla SONATA (visita 4 pts)', bancoId: 'silla-sonata', relation_role: 'MEETING_SEAT', anchor_instance_id: 'i:mj', cantidad: 4, precioUnitario: 2420, source: 'CONFIRMADO_PROGRAMA' },
  ];
  const texto = [
    { id: 'p1', nombre: 'Banca doble APP LT 1.50 · 8 usuarios · ocupa 6.00 × 1.20 m', piezaId: 'linea-banca_doble', productoId: 'banca_doble', cantidad: 1, precioUnitario: 26145, w: 6000, d: 1200 },
    { id: 'p2', nombre: 'Silla operativa · WIN', piezaId: 'p9-silla-operativa-win-5210', cantidad: 8, precioUnitario: 5210 },
    { id: 'p3', nombre: 'Silla · SONATA', piezaId: 'p9-silla-sonata-2420-144', cantidad: 4, precioUnitario: 2420 },
  ];
  it('sin conciliar las cuentas se inflan (16 puestos / 16 sillas); conciliado: 8 para 8, sin "sobran"', () => {
    const sin = loQueEntendiVH095([...programa, ...texto]);
    expect(sin.grupos.find((g) => g.clave === 'puestos').cuentaTotal).toBe(16);
    expect(sin.grupos.find((g) => g.clave === 'sillas').cuentaTotal).toBe(16);
    const { partidas } = reconciliarVH095(programa, texto);
    const con = loQueEntendiVH095(partidas);
    expect(con.avisos.some((a) => /sobran/.test(a.texto))).toBe(false);
    const puestos = con.grupos.find((g) => g.clave === 'puestos');
    const sillas = con.grupos.find((g) => g.clave === 'sillas');
    expect(puestos.cuentaTotal).toBe(8);
    expect(sillas.cuentaTotal).toBe(8);
    // las SONATA de juntas no cuentan como sillas de trabajo
    expect(con.grupos.find((g) => g.clave === 'reunion')?.cuentaTotal || 0).toBe(4);
  });
});
