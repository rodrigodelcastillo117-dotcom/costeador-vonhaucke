import { describe, it, expect } from 'vitest';
import { optimizarCorte1D, piezasLineales } from './optimizacionCorte.js';

describe('cutting stock 1D · perfiles/PTR advisory', () => {
  it('expande cantidades lineales sin confundir paneles 2D', () => {
    const p = piezasLineales([
      { nombre: 'PTR', forma: 'lineal', largoMM: 1200, piezas: 3 },
      { nombre: 'Panel', largoMM: 1200, anchoMM: 600, piezas: 2 },
    ], 1);
    expect(p).toHaveLength(3);
    expect(p.every(x => x.nombre === 'PTR')).toBe(true);
  });

  it('empaca piezas en tramos con best-fit y reporta desperdicio', () => {
    const r = optimizarCorte1D({
      componentes: [
        { nombre: 'PTR', forma: 'lineal', largoMM: 2000, piezas: 2 },
        { nombre: 'PTR', forma: 'lineal', largoMM: 1000, piezas: 2 },
      ],
      largoTramoMM: 6000,
      kerfMM: 3,
      recortePuntaMM: 10,
    });
    expect(r.disponible).toBe(true);
    expect(r.tramos).toBe(2);
    expect(r.piezas_colocadas).toBe(4);
    expect(r.largo_neto_mm).toBe(6000);
    expect(r.issues).toHaveLength(0);
    expect(r.completo).toBe(true);
    expect(r.certificable).toBe(false);
    expect(r.advisory).toBe(true);
  });

  it('no inventa unión si una pieza es más larga que el tramo', () => {
    const r = optimizarCorte1D({
      componentes: [{ nombre: 'PTR largo', forma: 'lineal', largoMM: 6500, piezas: 1 }],
      largoTramoMM: 6000,
    });
    expect(r.piezas_colocadas).toBe(0);
    expect(r.issues[0].code).toBe('PIEZA_NO_CABE');
    expect(r.completo).toBe(false);
    expect(r.certificable).toBe(false);
  });

  it('mismo input produce exactamente el mismo plan', () => {
    const input = {
      componentes: [
        { nombre: 'A', forma: 'lineal', largoMM: 1450, piezas: 4 },
        { nombre: 'B', forma: 'lineal', largoMM: 700, piezas: 2 },
      ],
      largoTramoMM: 6000,
      kerfMM: 3,
    };
    expect(optimizarCorte1D(input)).toEqual(optimizarCorte1D(input));
  });
});


  it('cantidad en metros NO se interpreta como número de cortes', () => {
    const p = piezasLineales([
      { nombre:'PTR legacy', forma:'lineal', largoMM:1000, cantidad:6 },
    ]);
    expect(p).toHaveLength(0);
  });

  it('piezas explícitas sí habilitan cutting-stock verificable', () => {
    const p = piezasLineales([
      { nombre:'PTR', forma:'lineal', largoMM:1000, piezas:6 },
    ]);
    expect(p).toHaveLength(6);
  });
