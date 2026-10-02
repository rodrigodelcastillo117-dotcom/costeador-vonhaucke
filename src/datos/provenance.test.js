// N11 — procedencia (provenance) de Voni 2.0. Pura, determinista.
import { describe, it, expect } from 'vitest';
import {
  procedenciaDePartida, resumenProcedencia, desconocidosRequierenDesarrollo,
  interpretacionComercial, NIVELES,
} from './provenance.js';

const n = (pt) => procedenciaDePartida(pt).nivel;

describe('procedenciaDePartida', () => {
  it('CONFIRMADO: precio real + identidad de Product Master', () => {
    expect(n({ deBanco: true, precioReal: true, producto_id: 123, confianza: 'alta' })).toBe(NIVELES.CONFIRMADO);
    expect(n({ precioReal: true, lista_precio_item_id: 9 })).toBe(NIVELES.CONFIRMADO);
  });
  it('SUGERIDO: lo propuso Voni (acompañante) aunque tenga identidad', () => {
    expect(n({ sugerido: true, precioReal: true, producto_id: 1 })).toBe(NIVELES.SUGERIDO);
  });
  it('INFERIDO: confianza media o ruta de catálogo, sin precio firme', () => {
    expect(n({ confianza: 'media', ruta: 'alba' })).toBe(NIVELES.INFERIDO);
    expect(n({ ruta: 'eclipse', precioReal: false })).toBe(NIVELES.INFERIDO);
  });
  it('SUPUESTO: estimación, confianza baja con ruta pero sin precio', () => {
    expect(n({ confianza: 'baja', ruta: 'alba' })).toBe(NIVELES.SUPUESTO);
  });
  it('REQUIERE_DESARROLLO: sin precio autorizado (fail-closed vendedor)', () => {
    expect(n({ sinPrecioAutorizado: true })).toBe(NIVELES.REQUIERE_DESARROLLO);
  });
  it('REQUIERE_DESARROLLO: desconocido sin identidad, sin firmeza, sin ruta', () => {
    expect(n({ confianza: 'baja' })).toBe(NIVELES.REQUIERE_DESARROLLO);
    expect(n({})).toBe(NIVELES.REQUIERE_DESARROLLO);
  });
  it('nunca truena con null/undefined', () => {
    expect(() => procedenciaDePartida(null)).not.toThrow();
  });
});

describe('resumenProcedencia', () => {
  it('cuenta por nivel y marca atención', () => {
    const r = resumenProcedencia([
      { deBanco: true, precioReal: true, producto_id: 1 },
      { confianza: 'media', ruta: 'alba' },
      { sinPrecioAutorizado: true },
    ]);
    expect(r.conteo.CONFIRMADO).toBe(1);
    expect(r.conteo.INFERIDO).toBe(1);
    expect(r.conteo.REQUIERE_DESARROLLO).toBe(1);
    expect(r.total).toBe(3);
    expect(r.pctFirme).toBe(33);
    expect(r.requiereAtencion).toBe(true);
  });
  it('vacío => sin atención', () => {
    expect(resumenProcedencia([]).requiereAtencion).toBe(false);
  });
});

describe('desconocidos -> REQUIERE_DESARROLLO (nunca inventa SKU)', () => {
  it('mapea strings de noEncontrado', () => {
    const d = desconocidosRequierenDesarrollo(['Mueble raro', '  ', 'Lockers']);
    expect(d).toHaveLength(2);
    expect(d[0].nivel).toBe(NIVELES.REQUIERE_DESARROLLO);
    expect(d[0].texto).toBe('Mueble raro');
  });
});

describe('interpretacionComercial', () => {
  it('adjunta procedencia a cada producto y arma resumen + pendientes', () => {
    const r = interpretacionComercial({
      partidas: [{ precioReal: true, producto_id: 1 }, { confianza: 'baja' }],
      preguntas: ['¿Cuántos puestos?', null],
      noEncontrado: ['Barra de café'],
    });
    expect(r.productos[0].procedencia.nivel).toBe(NIVELES.CONFIRMADO);
    expect(r.productos[1].procedencia.nivel).toBe(NIVELES.REQUIERE_DESARROLLO);
    expect(r.preguntas).toEqual(['¿Cuántos puestos?']);
    expect(r.requiereDesarrollo).toHaveLength(1);
    expect(r.resumen.total).toBe(2);
  });
});
