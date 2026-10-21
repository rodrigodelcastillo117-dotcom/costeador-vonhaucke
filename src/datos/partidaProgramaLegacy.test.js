import { describe, it, expect } from 'vitest';
import { actualizarPartidaDePrograma, actualizarPartidasDePrograma, actualizarPartidaDeBanco } from './programaRealDelPlano.js';
import { identidadDeCatalogo } from './precioAutorizado.js';

// Renglones REALES de la cotización 4048 (guardada antes de CATALOG_LIST): no se podían emitir.
const viejo = (bancoId, productoId, pv, precio, extra = {}) => ({
  id: `x:${bancoId}`, bancoId, source_ref: bancoId, productoId: String(productoId), producto_id: String(productoId),
  producto_version_id: String(pv), precio_lista_snapshot: precio, precioUnitario: precio, cantidad: 3,
  source: 'CONFIRMADO_PROGRAMA', price_status: 'SNAPSHOT_DISPLAY', precioReal: false, precioAutorizado: false,
  sinPrecioAutorizado: true, costoPendiente: true, costoUnitario: null, relation_role: 'ANCHOR_DESK', ...extra,
});

describe('cotizaciones viejas: renglones del programa se re-evalúan al abrir', () => {
  for (const [ref, pid, pv, precio] of [
    ['dir-1800x2400', 1904, 814, 15780], ['silla-gamma-e', 1927, 152, 3990],
    ['mj-3000x1200', 1913, 1232, 18560], ['silla-alpha', 1926, 132, 11950],
  ]) {
    it(`${ref}: SNAPSHOT_DISPLAY → CATALOG_LIST con el renglón de lista vigente`, () => {
      const cat = identidadDeCatalogo('banco', ref);
      expect(cat?.lista_precio_item_id).toBeTruthy();
      const q = actualizarPartidaDePrograma(viejo(ref, pid, pv, precio));
      expect(q.price_status).toBe('CATALOG_LIST');
      expect(q.lista_precio_item_id).toBe(cat.lista_precio_item_id);
      expect(q.producto_id).toBe(pid);
      expect(q).toMatchObject({ precioReal: true, precioAutorizado: true, sinPrecioAutorizado: false, costoPendiente: false, costoDesconocido: true });
      // nada más cambia: precio, cantidad, rol
      expect(q.precioUnitario).toBe(precio);
      expect(q.cantidad).toBe(3);
      expect(q.relation_role).toBe('ANCHOR_DESK');
    });
  }

  it('versión que no coincide con el catálogo: se queda bloqueado (fail-closed)', () => {
    const p = viejo('silla-alpha', 1926, 999999, 11950);
    expect(actualizarPartidaDePrograma(p)).toBe(p);
  });
  it('sin precio: se queda bloqueado', () => {
    const p = viejo('silla-alpha', 1926, 132, null, { precioUnitario: null });
    expect(actualizarPartidaDePrograma(p)).toBe(p);
  });
  it('renglones que no son del programa no se tocan', () => {
    const p = { ...viejo('silla-alpha', 1926, 132, 11950), source: undefined };
    expect(actualizarPartidaDePrograma(p)).toBe(p);
  });
  it('lista sin cambios devuelve la misma referencia (no re-render)', () => {
    const l = [{ nombre: 'x' }];
    expect(actualizarPartidasDePrograma(l)).toBe(l);
    expect(actualizarPartidasDePrograma(undefined)).toBe(undefined);
  });
});

// Cotización 4048, líneas 9–16: renglones del BANCO (Voni) guardados sin identidad de catálogo.
describe('cotizaciones viejas: renglones del banco sin identidad', () => {
  const REFS = ['p9-silla-operativa-win-5210', 'silla-alpha', 'p9-silla-de-visita-concerto-5470', 'mj-3000x1200',
    'p9-silla-sonata-2420-144', 'p9-recepcion-29920', 'p9-silla-operativa-gamma-e-3990', 'arch-modulor-2p-900'];
  const viejoBanco = (piezaId, precio = 1000) => ({ piezaId, nombre: piezaId, cantidad: 2, precioUnitario: precio,
    deBanco: true, precioReal: true, origen: 'banco', loteIA: 'ia-1' });
  for (const ref of REFS) {
    it(`${ref}: recibe producto, versión y renglón de lista del catálogo`, () => {
      const cat = identidadDeCatalogo('banco', ref);
      const q = actualizarPartidaDeBanco(viejoBanco(ref));
      expect(q).toMatchObject({ source_type: 'banco', source_ref: ref, producto_id: cat.producto_id,
        producto_version_id: cat.producto_version_id, lista_precio_item_id: cat.lista_precio_item_id,
        precio_lista_snapshot: 1000, precioUnitario: 1000, cantidad: 2 });
      expect(cat.lista_precio_item_id).toBeTruthy();
    });
  }
  it('ya con identidad, sin piezaId, o que no es del banco: no se toca', () => {
    for (const p of [{ ...viejoBanco('silla-alpha'), producto_id: 1 }, { ...viejoBanco('silla-alpha'), piezaId: null },
      { ...viejoBanco('silla-alpha'), deBanco: false }, viejoBanco('no-existe-en-catalogo')]) {
      expect(actualizarPartidaDeBanco(p)).toBe(p);
    }
  });
  it('la lista aplica ambas reparaciones', () => {
    const l = actualizarPartidasDePrograma([viejoBanco('silla-alpha'), { nombre: 'x' }]);
    expect(l[0].lista_precio_item_id).toBeTruthy();
    expect(l[1]).toEqual({ nombre: 'x' });
  });
});
