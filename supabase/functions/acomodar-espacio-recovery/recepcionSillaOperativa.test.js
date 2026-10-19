// ============================================================================
//  Dirección 2026-10-19 (Rodrigo): la recepción lleva la silla OPERATIVA (GAMMA-E) de cada persona que atiende.
//  Antes el juez semántico sólo admitía VISITOR_SEAT junto a ANCHOR_RECEPTION y la silla operativa salía
//  KIT_FUNCTIONAL_RELATION_BROKEN (FAIL → el acomodo no se publicaba).
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { construirRespuestaAcomodo } from './recoveryPipeline.js';

const C2 = JSON.parse(readFileSync(new URL('../../../bench/acomodo-calidad/fixtures/c2-curvo-request.json', import.meta.url), 'utf8'));
const lobby = { ...C2.areas.find((a) => a.nombre === 'LOBBY'), poly: undefined, polygon: undefined };
const mostrador = C2.piezas.find((q) => q.relation_role === 'ANCHOR_RECEPTION');
const silla = (i, extra = {}) => ({ id: `rec-op-${i}`, nombre: 'Silla operativa GAMMA-E', w: 600, d: 600, tipo: 'silla',
  functional_group_id: mostrador.functional_group_id, relation_role: 'WORK_SEAT', anchor_role: 'ANCHOR_RECEPTION', zone_id: 'LOBBY', ...extra });

describe('recepción con su silla operativa', () => {
  it('mostrador + 2 sillas operativas: colocadas, semántica PASS, publicable', () => {
    const r = construirRespuestaAcomodo([lobby], [mostrador, silla(1), silla(2)]);
    expect(r.layoutSpec.placed).toBe(3);
    expect(r.layoutSpec.unassigned).toEqual([]);
    expect(r.layoutSpec.validation.semantic_gate.sem_status).toBe('PASS');
    expect(r.layoutSpec.status).toBe('PASS');
  });
  it('una silla operativa suelta (otro grupo) se adopta al mostrador de su zona', () => {
    const r = construirRespuestaAcomodo([lobby], [mostrador, silla(1, { functional_group_id: 'fg:suelta' })]);
    expect(r.layoutSpec.placed).toBe(2);
    expect(r.layoutSpec.unassigned).toEqual([]);
    expect(r.layoutSpec.validation.semantic_gate.sem_status).toBe('PASS');
  });
});
