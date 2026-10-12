import { describe, it, expect } from 'vitest';
import { spatialSpecDe, procedenciaSpatial, clearancesDe } from '../../supabase/functions/acomodar-espacio/spatial-core.js';

describe('ProductRevision → SpatialSpec canónico', () => {
  it('lee spatial_spec desde producto_versiones.atributos sin desempaquetar en el caller', () => {
    const pieza = {
      id: 'desk-r7', w: 1400, d: 700,
      atributos: {
        spatial_spec: {
          version: 'SPATIAL_SPEC_V1',
          clearance_mm: { top: 100, right: 150, bottom: 900, left: 150 },
          source: 'ENGINEERING', confidence: 'alta', verified: true,
        },
      },
    };
    expect(spatialSpecDe(pieza).version).toBe('SPATIAL_SPEC_V1');
    expect(clearancesDe(pieza, 0)).toEqual({ top: 100, right: 150, bottom: 900, left: 150 });
    expect(procedenciaSpatial(pieza)).toEqual({ source: 'ENGINEERING', confidence: 'alta', verified: true });
  });

  it('soporta una ProductRevision anidada y rota los clearances con la pieza', () => {
    const pieza = {
      id: 'storage-r2', w: 1200, d: 450,
      product_revision: {
        atributos: {
          spatial_spec: {
            clearance_mm: { top: 50, right: 100, bottom: 650, left: 100 },
            source: 'CATALOG', confidence: 'media', verified: false,
          },
        },
      },
    };
    expect(clearancesDe(pieza, 90)).toEqual({ top: 100, right: 50, bottom: 100, left: 650 });
    expect(procedenciaSpatial(pieza).source).toBe('CATALOG');
    expect(procedenciaSpatial(pieza).verified).toBe(false);
  });

  it('sin spatial_spec no inventa clearance', () => {
    const pieza = { id: 'legacy', w: 1000, d: 600, atributos: { familia: 'escritorio' } };
    expect(spatialSpecDe(pieza)).toEqual({});
    expect(clearancesDe(pieza, 0)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});
