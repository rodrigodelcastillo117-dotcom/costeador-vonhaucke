// ============================================================================
//  App · un costo DESCONOCIDO nunca se vuelve CERO en "Costear especial → Agregar" (comportamiento).
//  Antes: `not.toContain('costoUnitario: 0')` sobre el texto de App.jsx. Ahora ejecuta
//  partidaAutoritativaDeCosteo (la lógica que usa onAgregarCotizacion) con costos ausentes/no finitos.
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import { partidaAutoritativaDeCosteo } from '../datos/agregarCosteo.js';

const COSTEO = { nombre: 'Especial avanzado', piezas: 1, componentes: [] };
const servidorCon = (costo) => vi.fn(async () => ({ ok: true, estado: 'certificado', warnings: [], ...costo }));
const correr = (resultado, costearServidor) => partidaAutoritativaDeCosteo({
  costeo: COSTEO, resultado, precio: 5000, margen: 40, costearServidor, pendientes: () => [], nuevoId: () => 'p1',
});

describe('App · UNKNOWN cost never becomes ZERO for advanced special', () => {
  const desconocidos = [undefined, null, '', '   ', NaN, Infinity, 'abc'];

  it('costo del CLIENTE desconocido ⇒ no se agrega, aunque el servidor dé un costo', async () => {
    for (const v of desconocidos) {
      const r = await correr({ costoUnitario: v, componentesIgnorados: [] }, servidorCon({ costo: { costoUnitario: 800 } }));
      expect(r.ok, String(v)).toBe(false);
      expect(r.partida).toBeUndefined();
      expect(r.error).toContain('no es finito o no quedó certificado');
    }
  });

  it('costo del SERVIDOR desconocido (o sin bloque costo) ⇒ no se agrega', async () => {
    for (const v of desconocidos) {
      const r = await correr({ costoUnitario: 800, componentesIgnorados: [] }, servidorCon({ costo: { costoUnitario: v } }));
      expect(r.ok, String(v)).toBe(false);
      expect(r.partida).toBeUndefined();
    }
    const sinBloque = await correr({ costoUnitario: 800, componentesIgnorados: [] }, servidorCon({}));
    expect(sinBloque.ok).toBe(false);
  });

  it('ambos desconocidos ⇒ no se agrega (UNKNOWN + UNKNOWN no "coinciden" en $0)', async () => {
    const r = await correr({ componentesIgnorados: [] }, servidorCon({ costo: {} }));
    expect(r.ok).toBe(false);
    expect(r.partida).toBeUndefined();
  });

  it('con costo conocido y certificado, la partida NUNCA lleva costo 0 ni pendiente', async () => {
    const r = await correr({ costoUnitario: 812.4, componentesIgnorados: [] }, servidorCon({ costo: { costoUnitario: 812.4 } }));
    expect(r.ok).toBe(true);
    expect(r.partida.costoUnitario).toBe(812.4);
    expect(r.partida.costoPendiente).toBe(false);
  });
});
