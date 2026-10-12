import { describe, it, expect } from 'vitest';
import { topologiaDeConfiguracion, placementProfileDeResolucion, topologiaDeProducto } from '../../src/datos/placementTopologia.js';

// ============================================================================
//  P0.2c · GAP14 · la regla USER_CONFIRMED de Rodrigo es ESTRECHA: SÓLO
//  "1 operativo para 8 personas" = DOUBLE_FACE. No se extrapola a otras capacidades
//  sin evidencia CATALOG explícita.
// ============================================================================
describe('P0.2c · GAP14 · no generalizar la regla de Rodrigo', () => {
  it('1 · "1 operativo para 8" → DOUBLE_FACE USER_CONFIRMED', () => {
    const r = topologiaDeConfiguracion({ relation_role: 'ANCHOR_WORKSTATION', usuarios: 8 });
    expect(r.topology).toBe('DOUBLE_FACE');
    expect(r.provenance).toBe('USER_CONFIRMED');
  });
  it('2 · workstation 4 usuarios SIN evidencia → NO asumir DOUBLE_FACE', () => {
    expect(topologiaDeConfiguracion({ relation_role: 'ANCHOR_WORKSTATION', usuarios: 4 })).toBeNull();
    expect(placementProfileDeResolucion({ relation_role: 'ANCHOR_WORKSTATION', usuarios: 4, bancoId: 'op-4u-generico', nombre: 'App LT · Módulo operativo' })).toBeNull();
  });
  it('3 · workstation 6 usuarios SIN evidencia → NO asumir DOUBLE_FACE', () => {
    expect(topologiaDeConfiguracion({ relation_role: 'ANCHOR_WORKSTATION', usuarios: 6 })).toBeNull();
    expect(placementProfileDeResolucion({ relation_role: 'ANCHOR_WORKSTATION', usuarios: 6, bancoId: 'op-6u-generico', nombre: 'App LT · Módulo operativo' })).toBeNull();
  });
  it('4 · producto con identidad CATALOG "bench doble" (6 u) → DOUBLE_FACE CATALOG (la identidad manda, no la capacidad)', () => {
    const r = placementProfileDeResolucion({ relation_role: 'ANCHOR_WORKSTATION', usuarios: 6, id: 'p9-app-lt-bench-doble-17600', nombre: 'App LT · Bench doble' });
    expect(r.topology).toBe('DOUBLE_FACE');
    expect(r.provenance).toBe('CATALOG');
    expect(topologiaDeProducto({ id: 'p9-app-lt-bench-doble-17600' }).provenance).toBe('CATALOG');
  });
  it('5 · 10 y 12 usuarios sin evidencia → NO DOUBLE_FACE (no extrapola)', () => {
    expect(topologiaDeConfiguracion({ relation_role: 'ANCHOR_WORKSTATION', usuarios: 10 })).toBeNull();
    expect(topologiaDeConfiguracion({ relation_role: 'ANCHOR_WORKSTATION', usuarios: 12 })).toBeNull();
  });
});
