import { describe, it, expect } from 'vitest';
import { proponerPrograma } from '../../src/datos/programaRealDelPlano.js';
import { expandirPiezas } from '../../src/datos/espacio.js';
import { topologiaDeProducto, clasificarFuenteTopologia } from '../../src/datos/placementTopologia.js';
import { resolverKits } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';

// ============================================================================
//  P0.2c · GAP15 · FLUJO PRODUCTIVO REAL (sin reconstruir partidas a mano):
//  proponerPrograma({operativos:8}) → preview (adapter productivo partidasPropuestas/
//  aPartidaAcomodo) → expandirPiezas → resolverKits. La topología/capacidad/dueño
//  deben SOBREVIVIR por el camino real. + GAP11 (INFERRED ≠ SOURCE_FOUND).
// ============================================================================
describe('P0.2c · GAP15 · 1 operativo para 8 por el CAMINO PRODUCTIVO REAL → 4A+4B', () => {
  it('proponerPrograma({operativos:8}).preview trae ancla DOUBLE_FACE + capacidad, SIN fabricar', () => {
    const { preview } = proponerPrograma({ operativos: 8 }, { linea: 'App LT' });
    const anchor = preview.find((p) => p.relation_role === 'ANCHOR_WORKSTATION');
    expect(anchor, 'hay un ancla operativa real').toBeTruthy();
    // topología sobrevivió el adapter real (no se inyectó en el test).
    expect(anchor.placement_profile).toBeTruthy();
    expect(anchor.placement_profile.topology).toBe('DOUBLE_FACE');
    expect(['USER_CONFIRMED', 'CATALOG']).toContain(anchor.placement_profile.provenance);
    expect(anchor.user_capacity).toBe(8);
    // identidad estable real (no un id='A' fabricado).
    expect(anchor.instance_id || anchor.id).toBeTruthy();
    expect(anchor.bancoId).toBeTruthy();
  });

  it('E2E: preview real → expandirPiezas → resolverKits → 4 side A + 4 side B, dueño correcto', () => {
    const { preview } = proponerPrograma({ operativos: 8 }, { linea: 'App LT' });
    const piezas = expandirPiezas(preview);
    const anchorPieza = piezas.find((p) => p.relation_role === 'ANCHOR_WORKSTATION');
    expect(anchorPieza.placement_profile.topology).toBe('DOUBLE_FACE');   // llegó hasta la pieza
    const sol = resolverKits([{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 14000, largo: 9000 }], piezas);
    const seats = sol.colocacion.filter((c) => c.side === 'A' || c.side === 'B');
    expect(seats.length).toBe(8);
    expect(seats.filter((c) => c.side === 'A').length).toBe(4);
    expect(seats.filter((c) => c.side === 'B').length).toBe(4);
    expect(seats.every((c) => c.anchor_instance_id === anchorPieza.id)).toBe(true);
    expect(new Set(seats.map((c) => c.slot_id)).size).toBe(8);
    expect(sol.unassigned.length).toBe(0);
  });
});

describe('P0.2c · GAP11 · SOURCE_FOUND excluye inferencias por nombre', () => {
  it('nombre "bench doble" SIN id de catálogo → INFERRED → SOURCE_PARTIAL (no FOUND)', () => {
    const soloNombre = { nombre: 'Mueble bench doble genérico', medidas: '4800 × 1200 mm', usuarios: 8, categoria: 'Operativos / Bench' };
    expect(topologiaDeProducto(soloNombre).provenance).toBe('INFERRED');
    expect(clasificarFuenteTopologia(soloNombre)).toBe('SOURCE_PARTIAL');
  });
  it('id de catálogo bench-doble → CATALOG → SOURCE_FOUND', () => {
    const conId = { id: 'p9-app-lt-bench-doble-23340', nombre: 'App LT · Bench doble', categoria: 'Operativos / Bench', usuarios: 8, medidas: '4800 × 1200 mm' };
    expect(topologiaDeProducto(conId).provenance).toBe('CATALOG');
    expect(clasificarFuenteTopologia(conId)).toBe('SOURCE_FOUND');
  });
});
