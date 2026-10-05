import { describe, it, expect } from 'vitest';
import { expandirPiezas } from './espacio.js';

describe('Acomodo · pin de ProductRevision', () => {
  it('cada instancia expandida conserva la revisión exacta de la QuoteLine', () => {
    const piezas = expandirPiezas([{
      id: 'linea-7', nombre: 'Escritorio operativo', cantidad: 3,
      w: 1200, d: 700, productoId: 44, producto_version_id: 1933,
    }]);
    expect(piezas).toHaveLength(3);
    expect(piezas.map((p) => p.producto_version_id)).toEqual([1933, 1933, 1933]);
    expect(piezas.map((p) => p.productoId)).toEqual([44, 44, 44]);
  });

  it('acepta alias legacy/camelCase sin perder el pin de revisión', () => {
    const [p] = expandirPiezas([{
      id: 'legacy', nombre: 'Credenza', cantidad: 1,
      w: 900, d: 450, producto_id: 8, productoVersionId: 55,
    }]);
    expect(p.producto_version_id).toBe(55);
    expect(p.productoId).toBe(8);
  });

  it('un spatial_spec explícito de una línea no versionada viaja; una versionada será revalidada server-side', () => {
    const spec = { version: 'SPATIAL_SPEC_V1', source: 'USER', confidence: 'alta', verified: true, clearance_mm: 100 };
    const [p] = expandirPiezas([{
      id: 'draft', nombre: 'Especial', cantidad: 1, w: 800, d: 600, spatial_spec: spec,
    }]);
    expect(p.spatial_spec).toEqual(spec);
  });
});
