import { describe, it, expect } from 'vitest';
import { resolverOperativos, expandirDependientes } from '../../src/datos/resolverPrograma.js';
import { expandirPiezas } from '../../src/datos/espacio.js';
import { topologiaDeProducto, clasificarFuenteTopologia } from '../../src/datos/placementTopologia.js';
import { resolverKits } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';

// ============================================================================
//  P0.2c · GAP10 · FLUJO REAL: resolverOperativos(8) → expandirDependientes →
//  expandirPiezas → resolverKits. SIN inyectar topology/placement_profile/
//  productoId/relation_role/user_capacity artificiales. + GAP11 (INFERRED≠FOUND).
// ============================================================================
describe('P0.2c · GAP10 · 1 operativo para 8 por el flujo real → DOUBLE_FACE 4+4', () => {
  it('resolverOperativos(8, App LT) resuelve un módulo real y le ADJUNTA la topología (no inyectada)', () => {
    const { resoluciones } = resolverOperativos(8, { linea: 'App LT' });
    expect(resoluciones.length).toBeGreaterThan(0);
    const a = resoluciones[0];
    expect(a.relation_role).toBe('ANCHOR_WORKSTATION');
    expect(a.usuarios).toBeGreaterThanOrEqual(2);
    expect(a.placement_profile).toBeTruthy();
    expect(a.placement_profile.topology).toBe('DOUBLE_FACE');
    expect(['USER_CONFIRMED', 'CATALOG']).toContain(a.placement_profile.provenance);
  });

  it('E2E: el ancla real + sus dependientes reales → resolverKits → 4 side A + 4 side B', () => {
    const { resoluciones } = resolverOperativos(8, { linea: 'App LT' });
    const a = resoluciones[0];
    const U = Number(a.usuarios);
    const deps = expandirDependientes(a, {});
    const seatDep = deps.find((d) => d.relation_role === 'WORK_SEAT');
    expect(seatDep, 'el programa real genera WORK_SEAT').toBeTruthy();
    expect(Number(seatDep.cantidad)).toBe(U);

    const anchorPartida = { id: 'A', nombre: a.nombre, w: a.w, d: a.d, cantidad: 1, relation_role: a.relation_role, functional_group_id: 'g', user_capacity: a.usuarios, placement_profile: a.placement_profile, zone_id: 'OP' };
    const seatPartida = { id: 'S', nombre: seatDep.nombre || 'Silla operativa', w: 600, d: 600, cantidad: U, relation_role: seatDep.relation_role, functional_group_id: 'g', zone_id: 'OP', anchor_instance_id: 'A-1' };
    const piezas = expandirPiezas([anchorPartida, seatPartida]);
    const anchor = piezas.find((p) => p.relation_role === 'ANCHOR_WORKSTATION');
    expect(anchor.placement_profile.topology).toBe('DOUBLE_FACE');

    const sol = resolverKits([{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 14000, largo: 9000 }], piezas);
    const seats = sol.colocacion.filter((c) => c.side === 'A' || c.side === 'B');
    expect(seats.filter((c) => c.side === 'A').length).toBe(Math.ceil(U / 2));
    expect(seats.filter((c) => c.side === 'B').length).toBe(Math.floor(U / 2));
    expect(seats.every((c) => c.anchor_instance_id === anchor.id)).toBe(true);
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
