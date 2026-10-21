import { describe, it, expect } from 'vitest';
import { identidadDeCatalogo } from './precioAutorizado.js';
import { BANCO } from './banco.js';

// E2E 2026-10-20: las piezas del banco que agregaba Voni para Dirección no llevaban
// identidad de catálogo y la emisión pedía "confirmar el costo" de sillas y mesas compradas.
describe('identidadDeCatalogo · piezas del banco', () => {
  it('toda pieza del banco trae producto, versión e item de lista vigente', () => {
    const sin = BANCO.filter((b) => !identidadDeCatalogo('banco', b.id)).map((b) => b.id);
    expect(sin).toEqual([]);
  });
  it('forma exacta que lee el servidor', () => {
    const id = identidadDeCatalogo('banco', 'p9-silla-operativa-gamma-e-3990');
    expect(id).toEqual({ source_type: 'banco', source_ref: 'p9-silla-operativa-gamma-e-3990', producto_id: 1881, producto_version_id: 1549, lista_precio_item_id: 957 });
  });
  it('sin match ⇒ null (la partida queda como estaba)', () => {
    expect(identidadDeCatalogo('banco', 'no-existe')).toBeNull();
    expect(identidadDeCatalogo('banco', null)).toBeNull();
  });
});
