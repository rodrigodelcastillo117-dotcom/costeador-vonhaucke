import { describe, it, expect } from 'vitest';
import { programaRealDelPlano, resolverYConfirmar, partidasParaAcomodo } from './programaRealDelPlano.js';
import { validarCoherenciaPrograma } from './coherenciaPrograma.js';

describe('programaRealDelPlano · cadena completa FloorSpec → Acomodo (P0.1)', () => {
  const areasM = [
    { nombre: 'OFICINA CEO', tipo: 'privado', ancho: 4, largo: 3.2 },
    { nombre: 'SALA DE CONSEJO', tipo: 'juntas', ancho: 7, largo: 3.2, puestos: 4 },
    { nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 8, largo: 3.2, puestos: 10 },
    { nombre: 'RECEPCIÓN', tipo: 'recepcion', ancho: 4, largo: 2.4 },
  ];

  it('produce SOLO partidas reales confirmadas (cero sug-*, con bancoId e identidad)', () => {
    const r = programaRealDelPlano(areasM, { linea: 'App LT' });
    expect(r.partidas.length).toBeGreaterThan(0);
    expect(r.partidas.every((p) => p.bancoId && !String(p.bancoId).startsWith('sug-'))).toBe(true);
    expect(r.partidas.every((p) => p.source === 'CONFIRMADO_PROGRAMA')).toBe(true);
    expect(r.partidas.every((p) => Number(p.precio_lista_snapshot) > 0)).toBe(true);
    // la geometría es del catálogo, nunca la fantasma 7500
    expect(r.partidas.some((p) => p.w === 7500)).toBe(false);
  });

  it('las partidas reales PASAN validarCoherenciaPrograma (ancla presente, no bloqueos)', () => {
    const r = programaRealDelPlano(areasM, { linea: 'App LT' });
    const v = validarCoherenciaPrograma(r.partidas);
    expect(v.ok).toBe(true);
    expect(v.bloqueos).toHaveLength(0);
  });

  it('idempotente: re-aplicar el mismo plano sobre lo confirmado no duplica', () => {
    const r1 = programaRealDelPlano(areasM, { linea: 'App LT' });
    const r2 = programaRealDelPlano(areasM, { linea: 'App LT', existentes: r1.confirmacion.items });
    expect(r2.confirmacion.confirmadas).toHaveLength(0);
    expect(r2.partidas.length).toBe(r1.partidas.length);
  });
});

describe('resolverYConfirmar · GOLDEN APP LT 10 directo (P0.1 · #5)', () => {
  const r = resolverYConfirmar({ operativos: 10, privados: 0, salas: [], recepcion: false }, { linea: 'App LT' });

  it('exactamente 1 bench real 6000×1200 + 10 sillas operativas + 10 gavetas, coherente', () => {
    const bench = r.partidas.filter((p) => p.anchor_role === 'ANCHOR_WORKSTATION' && !p.relation_role);
    expect(bench).toHaveLength(1);
    expect(bench[0].bancoId).toBe('op-10u-6000x1200-cristal');
    expect(bench[0].w).toBe(6000);
    const sillas = r.partidas.filter((p) => p.relation_role === 'WORK_SEAT').reduce((s, p) => s + p.cantidad, 0);
    const gavetas = r.partidas.filter((p) => p.relation_role === 'UNDERDESK_STORAGE').reduce((s, p) => s + p.cantidad, 0);
    expect(sillas).toBe(10);
    expect(gavetas).toBe(10);
    expect(validarCoherenciaPrograma(r.partidas).ok).toBe(true);
    expect(r.ok).toBe(true);
  });

  it('nombre semántico reconocible pero mismo producto real', () => {
    const bench = r.partidas.find((p) => p.anchor_role === 'ANCHOR_WORKSTATION' && !p.relation_role);
    expect(bench.nombre).toMatch(/bench operativo/i);
    expect(bench.piezaId).toBe('op-10u-6000x1200-cristal');
  });

  it('partidasParaAcomodo no produce nada cuando no hay confirmación', () => {
    expect(partidasParaAcomodo(null)).toEqual([]);
    expect(partidasParaAcomodo({ items: [] })).toEqual([]);
  });
});
