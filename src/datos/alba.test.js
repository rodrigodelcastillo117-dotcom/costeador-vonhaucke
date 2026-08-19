import { describe, it, expect } from 'vitest';
import { generarAlba } from './alba.js';
import { INSUMOS_SEMILLA, mapaInsumos } from './insumos.js';
import { calcular } from '../motor/calculo.js';

// ===========================================================================
//  SELECTOR DE COLOR (2026-08-18) — Alba varía el ESPESOR de melamina según
//  la pieza (19mm vs 28mm), no solo el color; el escritorio recto de 1.80 m
//  (config por default) usa 28mm, que es el caso que se prueba aquí.
// ===========================================================================
describe('Alba: color de melamina', () => {
  const INS = mapaInsumos(INSUMOS_SEMILLA);
  const base = { producto: 'escritorio', forma: 'recta', largo: '1800', lado: 'D', finish: 'ABS' };

  it('sin color, sigue usando el insumo genérico melamina-28 (sin cambios)', () => {
    const g = generarAlba({ ...base });
    const cubierta = g.componentes.find((c) => /^melamina-28/.test(c.insumoId));
    expect(cubierta.insumoId).toBe('melamina-28');
  });

  it('con color, el insumoId de la cubierta cambia al id con color', () => {
    const g = generarAlba({ ...base, color: 'walnut' });
    const cubierta = g.componentes.find((c) => /^melamina-28/.test(c.insumoId));
    expect(cubierta.insumoId).toBe('melamina-28-walnut');
  });

  it('un color más caro (gris-humo-lm) da un costo total mayor que uno barato (frosty-white)', () => {
    const barato = calcular({ componentes: generarAlba({ ...base, color: 'frosty-white' }).componentes, modoManoObra: 'porcentaje' }, 1, INS);
    const caro = calcular({ componentes: generarAlba({ ...base, color: 'gris-humo-lm' }).componentes, modoManoObra: 'porcentaje' }, 1, INS);
    expect(caro.materialTotal).toBeGreaterThan(barato.materialTotal);
  });
});
