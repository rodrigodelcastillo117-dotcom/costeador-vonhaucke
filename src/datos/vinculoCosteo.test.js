import { describe, it, expect } from 'vitest';
import { costeosPorVincular, marcarVinculado, esCanonica, avisoVinculosFallidos } from './vinculoCosteo.js';

const K = '0f8fad5b-d9cb-469f-a165-70867728950e';
describe('SEG-01c · qué costeos pedir vincular tras guardar', () => {
  it('sólo renglones especiales con costeoId UUID e id de partida; nunca canónicos ni sin cotización', () => {
    const hechos = new Set();
    const partidas = [
      { id: 'p1', costeoId: K }, { id: 'p2', costeoId: 'no-uuid' }, { id: 'p3' },
      { id: 'p4', costeoId: K, producto_id: 350, producto_version_id: 35 }, { costeoId: K },
    ];
    expect(costeosPorVincular(10, partidas, hechos)).toEqual([{ partidaId: 'p1', costeoId: K }]);
    expect(costeosPorVincular(null, partidas, hechos)).toEqual([]);
  });
  // Reauditoría v2 (hueco propio): antes se descartaba todo renglón con `productoId`, que en el cliente es la CLAVE DE
  // LÍNEA (texto). En modo estricto ese especial legítimo nunca se vinculaba. Canónico = ids NUMÉRICOS, como el servidor.
  it('un especial con clave de línea de texto (productoId) SÍ se vincula; canónico = producto_id y versión numéricos', () => {
    const hechos = new Set();
    const partidas = [
      { id: 'a', costeoId: K, productoId: 'LIBRERO', claveLinea: 'LIBRERO' },
      { id: 'b', costeoId: K, producto_id: 350 },                         // sin versión: el servidor no lo trata como canónico
      { id: 'c', costeoId: K, productoId: '350', productoVersionId: '35' }, // canónico en cualquier grafía
    ];
    expect(costeosPorVincular(10, partidas, hechos).map((p) => p.partidaId)).toEqual(['a', 'b']);
    expect(esCanonica({ producto_id: 7, producto_version_id: 70 })).toBe(true);
    expect(esCanonica({ productoId: 'LIBRERO' })).toBe(false);
  });
  it('P1-03: un vínculo fallido produce un aviso visible y específico; sin fallas, nada', () => {
    expect(avisoVinculosFallidos([])).toBeNull();
    expect(avisoVinculosFallidos([{ partidaId: 'p1', error: 'x' }])).toMatch(/no quedó vinculado.*siguiente guardado.*no se puede emitir/);
    expect(avisoVinculosFallidos([{ partidaId: 'p1', error: 'CONFLICTO_VERSION', conflicto: true }, { partidaId: 'p2', conflicto: true }]))
      .toMatch(/alguien más cambió.*2 renglones especiales/);
    expect(avisoVinculosFallidos([{ partidaId: 'p1', error: 'la partida cambió desde que se vinculó este costeo: recostea' }])).toMatch(/vuelve a costearlo/);
  });
  it('lo ya vinculado en esta sesión no se vuelve a pedir; otra cotización sí', () => {
    const hechos = new Set();
    marcarVinculado(10, { partidaId: 'p1', costeoId: K }, hechos);
    expect(costeosPorVincular(10, [{ id: 'p1', costeoId: K }], hechos)).toEqual([]);
    expect(costeosPorVincular(11, [{ id: 'p1', costeoId: K }], hechos)).toHaveLength(1);
  });
});
