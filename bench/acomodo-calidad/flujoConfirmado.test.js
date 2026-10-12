import { describe, it, expect } from 'vitest';
import { proponerPrograma, aplicarPrograma } from '../../src/datos/programaRealDelPlano.js';
import { expandirPiezas } from '../../src/datos/espacio.js';
import { resolverKits } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';

// ============================================================================
//  P0.2c · GAP16 · CAMINO CONFIRMADO (sin preview): proponerPrograma → aplicarPrograma
//  → partidas CONFIRMADAS → expandirPiezas → resolverKits. La topología/capacidad
//  confirmada debe SOBREVIVIR la confirmación y la reutilización (idempotencia).
//  NO se inyecta placement_profile/topology/user_capacity: debe viajar por el cable real.
// ============================================================================
describe('P0.2c · GAP16 · 1 operativo para 8 por el camino CONFIRMADO → 4A+4B', () => {
  it('confirmado → Acomodo: ancla DOUBLE_FACE (provenance conservada) + capacidad 8', () => {
    const { propuesta } = proponerPrograma({ operativos: 8 }, { linea: 'App LT' });
    const { partidas } = aplicarPrograma(propuesta);
    const anchor = partidas.find((p) => p.relation_role === 'ANCHOR_WORKSTATION');
    expect(anchor, 'hay ancla operativa confirmada').toBeTruthy();
    expect(anchor.placement_profile, 'la topología sobrevivió la confirmación').toBeTruthy();
    expect(anchor.placement_profile.topology).toBe('DOUBLE_FACE');
    expect(['USER_CONFIRMED', 'CATALOG']).toContain(anchor.placement_profile.provenance);
    expect(anchor.user_capacity).toBe(8);
  });

  it('E2E confirmado: partidas confirmadas → expandirPiezas → resolverKits → 4 A + 4 B', () => {
    const { propuesta } = proponerPrograma({ operativos: 8 }, { linea: 'App LT' });
    const { partidas } = aplicarPrograma(propuesta);
    const piezas = expandirPiezas(partidas);
    const anchorPieza = piezas.find((p) => p.relation_role === 'ANCHOR_WORKSTATION');
    expect(anchorPieza.placement_profile.topology).toBe('DOUBLE_FACE');
    const sol = resolverKits([{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 14000, largo: 9000 }], piezas);
    const seats = sol.colocacion.filter((c) => c.side === 'A' || c.side === 'B');
    expect(seats.length).toBe(8);
    expect(seats.filter((c) => c.side === 'A').length).toBe(4);
    expect(seats.filter((c) => c.side === 'B').length).toBe(4);
    expect(seats.every((c) => c.anchor_instance_id === anchorPieza.id)).toBe(true);
    expect(new Set(seats.map((c) => c.slot_id)).size).toBe(8);
  });

  it('idempotencia: re-aplicar reutilizando lo confirmado → la topología sigue sobreviviendo', () => {
    const { propuesta } = proponerPrograma({ operativos: 8 }, { linea: 'App LT' });
    const a1 = aplicarPrograma(propuesta);
    // Reutiliza lo ya confirmado como existentes: el patch estructural NO pisa la topología.
    const a2 = aplicarPrograma(propuesta, { existentes: a1.partidas });
    const anchor2 = a2.partidas.find((p) => p.relation_role === 'ANCHOR_WORKSTATION');
    expect(anchor2.placement_profile, 'topología sobrevive la reutilización').toBeTruthy();
    expect(anchor2.placement_profile.topology).toBe('DOUBLE_FACE');
  });
});
