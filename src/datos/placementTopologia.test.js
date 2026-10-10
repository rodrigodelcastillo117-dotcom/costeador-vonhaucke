import { describe, it, expect } from 'vitest';
import { topologiaDeProducto } from './placementTopologia.js';

// RESCATE (E2E Torre Sur 14:48Z): bench de LÍNEA (applt/banca_doble) y guardado libre
// llegaban al solver con topología UNKNOWN → SEMANTIC_PROFILE_UNKNOWN (revisión).
describe('topologiaDeProducto · identidad de línea', () => {
  it('RED→GREEN: applt/banca_doble ⇒ DOUBLE_FACE con procedencia CATALOG', () => {
    const t = topologiaDeProducto({ productoId: 'banca_doble', nombre: 'Banca doble APP LT 1.50 · 8 usuarios · ocupa 6.00 × 1.20 m' });
    expect(t).toMatchObject({ topology: 'DOUBLE_FACE', provenance: 'CATALOG' });
  });
  it('banca_sencilla ⇒ SINGLE_FACE CATALOG; nombre "Banca doble" sin id ⇒ INFERRED', () => {
    expect(topologiaDeProducto({ productoId: 'banca_sencilla', nombre: 'Banca sencilla APP LT' })).toMatchObject({ topology: 'SINGLE_FACE', provenance: 'CATALOG' });
    expect(topologiaDeProducto({ nombre: 'Banca doble de 6' })).toMatchObject({ topology: 'DOUBLE_FACE', provenance: 'INFERRED' });
  });
  it('credenza / archivero / escritorio NO reciben topología aquí (guardado = UNKNOWN a propósito: con SINGLE_FACE el kit no cabía junto al escritorio)', () => {
    expect(topologiaDeProducto({ productoId: 'credenza', nombre: 'Eclipse Credenza baja 2.10 × 0.60 m' })).toBeNull();
    expect(topologiaDeProducto({ piezaId: 'arch-modulor-2p-900', nombre: 'Archivero Modulor 2 puertas' })).toBeNull();
    expect(topologiaDeProducto({ productoId: 'escritorio', nombre: 'Eclipse Escritorio Directivo 2.10 m' })).toBeNull();
  });
});
