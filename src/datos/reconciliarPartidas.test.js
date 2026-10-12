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
