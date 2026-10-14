import { describe, it, expect } from 'vitest';
import { costeosPorVincular, marcarVinculado } from './vinculoCosteo.js';

const K = '0f8fad5b-d9cb-469f-a165-70867728950e';
describe('SEG-01c · qué costeos pedir vincular tras guardar', () => {
  it('sólo renglones especiales con costeoId UUID e id de partida; nunca canónicos ni sin cotización', () => {
    const hechos = new Set();
    const partidas = [
      { id: 'p1', costeoId: K }, { id: 'p2', costeoId: 'no-uuid' }, { id: 'p3' },
      { id: 'p4', costeoId: K, producto_id: 350 }, { costeoId: K },
    ];
    expect(costeosPorVincular(10, partidas, hechos)).toEqual([{ partidaId: 'p1', costeoId: K }]);
    expect(costeosPorVincular(null, partidas, hechos)).toEqual([]);
  });
  it('lo ya vinculado en esta sesión no se vuelve a pedir; otra cotización sí', () => {
    const hechos = new Set();
    marcarVinculado(10, { partidaId: 'p1', costeoId: K }, hechos);
    expect(costeosPorVincular(10, [{ id: 'p1', costeoId: K }], hechos)).toEqual([]);
    expect(costeosPorVincular(11, [{ id: 'p1', costeoId: K }], hechos)).toHaveLength(1);
  });
});
