import { describe, it, expect } from 'vitest';
import { generarRio } from './rio.js';
import { INSUMOS_SEMILLA, mapaInsumos } from './insumos.js';
import { calcular } from '../motor/calculo.js';

// ===========================================================================
//  SELECTOR DE COLOR (2026-08-18) — primera línea, además de App LT, que se
//  prueba con el catálogo real de acabados. Sin `config.color`, el
//  comportamiento debe ser IDÉNTICO al de antes de este cambio (regresión
//  cero); con color, el costo tiene que moverse en la dirección que dice el
//  catálogo real (blanco absoluto barato, antracite/RAL caro).
// ===========================================================================
describe('Río: color de melamina', () => {
  const INS = mapaInsumos(INSUMOS_SEMILLA);
  const base = { producto: 'bench_recto_sencillo', usuarios: '2', largo: '1200', finish: 'ABS' };

  it('sin color, sigue usando el insumo genérico melamina-28 (sin cambios)', () => {
    const g = generarRio({ ...base });
    const cubierta = g.componentes.find((c) => /^melamina-28/.test(c.insumoId));
    expect(cubierta.insumoId).toBe('melamina-28');
  });

  it('con color, el insumoId de la cubierta cambia al id con color', () => {
    const g = generarRio({ ...base, color: 'blanco-absoluto' });
    const cubierta = g.componentes.find((c) => /^melamina-28/.test(c.insumoId));
    expect(cubierta.insumoId).toBe('melamina-28-blanco-absoluto');
  });

  it('un color más caro (antracite-oak-tx) da un costo total mayor que uno barato (blanco-absoluto)', () => {
    const barato = calcular({ componentes: generarRio({ ...base, color: 'blanco-absoluto' }).componentes, modoManoObra: 'porcentaje' }, 1, INS);
    const caro = calcular({ componentes: generarRio({ ...base, color: 'antracite-oak-tx' }).componentes, modoManoObra: 'porcentaje' }, 1, INS);
    expect(caro.materialTotal).toBeGreaterThan(barato.materialTotal);
  });

  it('un color inexistente no truena: se queda con el insumo base', () => {
    const g = generarRio({ ...base, color: 'color-que-no-existe' });
    const cubierta = g.componentes.find((c) => /^melamina-28/.test(c.insumoId));
    expect(cubierta.insumoId).toBe('melamina-28');
  });
});
