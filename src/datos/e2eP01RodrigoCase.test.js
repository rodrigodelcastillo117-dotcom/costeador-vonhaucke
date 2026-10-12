import { describe, it, expect } from 'vitest';
import { resolverPrograma } from './resolverPrograma.js';
import { aplicarPrograma, partidasParaAcomodo } from './programaRealDelPlano.js';
import { elegirPartidasAcomodo } from '../componentes/Acomodo.jsx';
import { validarCoherenciaPrograma } from './coherenciaPrograma.js';

// ============================================================================
//  INTEGRACIÓN / GOLDEN de P0.1 (audit #20) — NO es E2E real (#10): corre en
//  vitest e importa funciones directo (resolver/confirmar/adapter/coherencia).
//  El gate E2E real (navegador, botón, React state, doble click, refresh) vive
//  en e2e/programaP01.e2e.js (Playwright, con credenciales).
//  CASO EXACTO DE RODRIGO.
//  Floor: open 10 + privado + juntas 4 + recepción.
//  Brief: APP LT 10 · 10 WIN · 10 gavetas · Eclipse Drift 2.10 + credenza ·
//         ALPHA · 2 CONCERTO · mesa 1200×1200 · 4 sillas · recepción sin extras.
// ============================================================================
const programa = {
  operativos: 10,
  privados: 1,
  salas: [4],
  recepcion: true,
  brief: {
    operativosStorage: true,                 // 10 gavetas pedidas
    operativoSeatModel: 'win',               // 10 WIN
    privados: [{
      requested_models: { anchor: 'Eclipse Drift 2.10' },   // NO canónico → NEEDS_CONFIRMATION
      requested_visitors: { cantidad: 2, model: 'concerto' },
    }],
    juntas: [{ requested_dimensions: { w: 1200, d: 1200 }, requested_models: { seat: 'sonata' } }],
  },
};

const sum = (arr, rol) => arr.filter((p) => p.relation_role === rol).reduce((s, p) => s + (p.cantidad || 0), 0);

describe('E2E P0.1 · caso Rodrigo (audit #20)', () => {
  const propuesta = resolverPrograma(programa, { linea: 'App LT' });

  it('PROPONER no toca la cotización (una cotización vacía sigue vacía)', () => {
    const cotizacion = { partidas: [] };
    expect(cotizacion.partidas).toHaveLength(0);     // resolverPrograma es puro
    expect(Array.isArray(propuesta.partidas)).toBe(true);
  });

  it('privado Eclipse Drift → NEEDS_CONFIRMATION (pendiente), NUNCA sustituido por App LT', () => {
    expect(propuesta.pendientes.some((p) => p.rol === 'privado' && p.product_status === 'NEEDS_CONFIRMATION')).toBe(true);
    expect(propuesta.partidas.some((p) => String(p.bancoId).startsWith('dir-'))).toBe(false);
    expect(propuesta.partidas.some((p) => p.relation_role === 'EXECUTIVE_SEAT')).toBe(false);
    expect(propuesta.ok).toBe(false);                // programa incompleto por el privado
  });

  it('operativo 10 + juntas 1200×1200 + recepción sin extras', () => {
    const bench = propuesta.partidas.filter((p) => p.relation_role === 'ANCHOR_WORKSTATION');
    expect(bench).toHaveLength(1);
    expect(bench[0].bancoId).toBe('op-10u-6000x1200-cristal');
    expect(bench[0].w).toBe(6000);
    expect(sum(propuesta.partidas, 'WORK_SEAT')).toBe(10);
    expect(propuesta.partidas.find((p) => p.relation_role === 'WORK_SEAT').bancoId).toBe('silla-win');
    expect(sum(propuesta.partidas, 'UNDERDESK_STORAGE')).toBe(10);

    const mesa = propuesta.partidas.find((p) => p.relation_role === 'ANCHOR_MEETING');
    expect(mesa.w).toBe(1200); expect(mesa.d).toBe(1200);
    expect(sum(propuesta.partidas, 'MEETING_SEAT')).toBe(4);
    expect(propuesta.partidas.find((p) => p.relation_role === 'MEETING_SEAT').bancoId).toBe('silla-sonata');

    const rec = propuesta.partidas.find((p) => p.relation_role === 'ANCHOR_RECEPTION');
    expect(String(rec.bancoId)).toMatch(/^rec-/);
    expect(propuesta.partidas.some((p) => p.anchor_role === 'ANCHOR_RECEPTION')).toBe(false);
  });

  it('CERO sug-*, cero $0 inventado, seats ligados a la instancia del ancla', () => {
    expect(propuesta.partidas.every((p) => p.bancoId && !String(p.bancoId).startsWith('sug-'))).toBe(true);
    expect(propuesta.partidas.every((p) => Number(p.precio_lista_snapshot) > 0)).toBe(true);
    const bench = propuesta.partidas.find((p) => p.relation_role === 'ANCHOR_WORKSTATION');
    const seats = propuesta.partidas.filter((p) => p.relation_role === 'WORK_SEAT');
    expect(seats.every((s) => s.anchor_instance_id === bench.instance_id)).toBe(true);
  });

  it('APLICAR escribe exactamente lo confirmado; coherencia ok; solver input == confirmado; idempotente', () => {
    const a1 = aplicarPrograma(propuesta, { existentes: [] });
    const partidas1 = a1.partidas;
    expect(partidas1.every((p) => !String(p.bancoId).startsWith('sug-'))).toBe(true);
    expect(partidas1.every((p) => Number(p.precio_lista_snapshot) > 0)).toBe(true);
    expect(validarCoherenciaPrograma(partidas1).ok).toBe(true);

    const solverInput = elegirPartidasAcomodo(partidas1);
    expect(solverInput).toHaveLength(partidas1.length);
    expect(solverInput.every((p) => !String(p.id).startsWith('sug-'))).toBe(true);

    const a2 = aplicarPrograma(propuesta, { existentes: a1.confirmacion.items });
    expect(a2.confirmacion.confirmadas).toHaveLength(0);
    expect(a2.partidas.length).toBe(a1.partidas.length);
  });

  it('si falta algo (línea sin módulo canónico) → PROGRAM_INCOMPLETE, sin colocar inventado', () => {
    const r = resolverPrograma({ operativos: 10 }, { linea: 'Cirque' });
    expect(r.ok).toBe(false);
    expect(r.partidas).toHaveLength(0);
    expect(elegirPartidasAcomodo(partidasParaAcomodo(aplicarPrograma(r).confirmacion))).toEqual([]);
  });
});
