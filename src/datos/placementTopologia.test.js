import { it, expect } from 'vitest';
import { topologiaDeProducto } from './placementTopologia.js';

// VH-112 · "Banca doble" en español también es DOUBLE_FACE (INFERRED); el id de catálogo sigue siendo CATALOG.
it('"Banca doble APP LT 1.50 · 8 usuarios" ⇒ DOUBLE_FACE inferida; id bench-doble ⇒ CATALOG; "Escritorio" ⇒ null', () => {
  expect(topologiaDeProducto({ nombre: 'Banca doble APP LT 1.50 · 8 usuarios · ocupa 6.00 × 1.20 m', piezaId: 'linea-banca_doble' })).toMatchObject({ topology: 'DOUBLE_FACE', provenance: 'INFERRED' });
  expect(topologiaDeProducto({ id: 'p9-app-lt-bench-doble-23340', nombre: 'App LT · Bench doble' })).toMatchObject({ topology: 'DOUBLE_FACE', provenance: 'CATALOG' });
  expect(topologiaDeProducto({ nombre: 'Escritorio APP LT 1.50 × 0.75' })).toBe(null);
});
