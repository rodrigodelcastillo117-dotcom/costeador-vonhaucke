import { describe, it, expect } from 'vitest';
import { senalesCotizacion, senalesInsumos, problemasDeEmision } from './senales.js';

describe('senalesCotizacion', () => {
  it('sin partidas, no hay señales', () => {
    expect(senalesCotizacion([])).toEqual([]);
  });

  it('avisa cuántos renglones son estimados', () => {
    const partidas = [
      { precioReal: true, precioUnitario: 100, costoUnitario: 50 },   // firme
      { ruta: 'sinCalibrar', precioUnitario: 100, costoUnitario: 50 }, // estimado
      { ruta: 'otraSinCalibrar', precioUnitario: 100, costoUnitario: 50 }, // estimado
    ];
    const s = senalesCotizacion(partidas, 40);
    const aviso = s.find((x) => x.texto.includes('estimado'));
    expect(aviso.texto).toContain('2 de 3');
  });

  it('no avisa de estimados si todos son firmes', () => {
    const partidas = [{ precioReal: true, precioUnitario: 100, costoUnitario: 50 }];
    const s = senalesCotizacion(partidas, 40);
    expect(s.find((x) => x.texto.includes('estimado'))).toBeUndefined();
  });

  it('avisa cuando un renglón queda debajo del margen mínimo', () => {
    // margen = (100 - 70) / 100 = 30%, por debajo del mínimo de 40%
    const partidas = [{ precioReal: true, precioUnitario: 100, costoUnitario: 70 }];
    const s = senalesCotizacion(partidas, 40);
    const aviso = s.find((x) => x.tipo === 'roja');
    expect(aviso.texto).toContain('1 renglón queda');
  });

  it('ignora piezas de banco al calcular margen bajo', () => {
    const partidas = [{ deBanco: true, precioReal: true, precioUnitario: 100, costoUnitario: 99 }];
    const s = senalesCotizacion(partidas, 40);
    expect(s.find((x) => x.tipo === 'roja')).toBeUndefined();
  });

  it('no avisa de margen bajo cuando todos están arriba del mínimo', () => {
    const partidas = [{ precioReal: true, precioUnitario: 100, costoUnitario: 50 }];
    const s = senalesCotizacion(partidas, 40);
    expect(s.find((x) => x.tipo === 'roja')).toBeUndefined();
  });
});

describe('senalesInsumos', () => {
  it('sin insumos, no hay señales', () => {
    expect(senalesInsumos([])).toEqual([]);
  });

  it('avisa cuántos insumos no traen fuente', () => {
    const insumos = [{ id: 'a', fuente: 'compras' }, { id: 'b' }, { id: 'c' }];
    const s = senalesInsumos(insumos);
    expect(s[0].texto).toContain('2 de 3');
  });

  it('no avisa si todos traen fuente', () => {
    const insumos = [{ id: 'a', fuente: 'compras' }, { id: 'b', fuente: 'erp' }];
    expect(senalesInsumos(insumos)).toEqual([]);
  });
});

describe('problemasDeEmision', () => {
  it('renglones completos: se puede emitir', () => {
    const p = [{ nombre: 'Banca', cantidad: 2, precioUnitario: 17600 }];
    expect(problemasDeEmision(p)).toEqual([]);
  });

  it('bloquea un renglón sin cantidad', () => {
    const p = [{ nombre: 'Banca', precioUnitario: 17600 }];
    const probs = problemasDeEmision(p);
    expect(probs.length).toBe(1);
    expect(probs[0]).toContain('cantidad');
  });

  it('bloquea cantidad 0 y precio 0 (no son números válidos para emitir)', () => {
    const p = [{ nombre: 'X', cantidad: 0, precioUnitario: 0 }];
    expect(problemasDeEmision(p).length).toBe(2); // cantidad y precio
  });

  it('bloquea un renglón sin precio aunque tenga cantidad', () => {
    const p = [{ nombre: 'Especial', cantidad: 3 }];
    expect(problemasDeEmision(p)[0]).toContain('precio');
  });

  it('una pieza de banco con precio real SÍ se puede emitir (costo desconocido no bloquea)', () => {
    const p = [{ nombre: 'Silla banco', cantidad: 4, precioUnitario: 5210, deBanco: true, costoUnitario: 0 }];
    expect(problemasDeEmision(p)).toEqual([]);
  });

  it('usa un nombre de respaldo cuando el renglón no tiene nombre', () => {
    expect(problemasDeEmision([{ precioUnitario: 100 }])[0]).toContain('Renglón 1');
  });
});
