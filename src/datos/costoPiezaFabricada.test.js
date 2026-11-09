// Costo de pieza fabricada — pruebas ADVERSARIALES (una por defecto de la auditoria 2026-11-09).
import { describe, it, expect } from 'vitest';
import { desarrolloPlano, calibreDesdeTexto, laminasParaCalibre, costearMateriaPrima } from './costoPiezaFabricada.js';
import { calcular, PARAMETROS_DEFAULT } from '../motor/calculo.js';

// Catalogo AUTORITATIVO de prueba (subset real de catalogo_vigente).
const CAT = [
  { insumo_id: 'erp-ln22310', calibre: 22, formato: { largoMM: 3048, anchoMM: 914, area_m2: 2.786 }, precio: 326.59, precio_id: 8748, unidad: 'hoja', certificable: true, vigente_desde: '2026-01-26', estatus: 'CERTIFICADO', fuente: 'Compras · ERP Intelisis' },
  { insumo_id: 'erp-ln22410', calibre: 22, formato: { largoMM: 3048, anchoMM: 1219, area_m2: 3.716 }, precio: 521.55, precio_id: 13177, unidad: 'hoja', certificable: true, vigente_desde: '2026-10-20', estatus: 'CERTIFICADO', fuente: 'Compras · ERP Intelisis' },
  { insumo_id: 'erp-ln13410', calibre: 13, formato: { largoMM: 3048, anchoMM: 1219, area_m2: 3.716 }, precio: 825.33, precio_id: 7947, unidad: 'hoja', certificable: false, vigente_desde: '2010-10-20', estatus: 'PRELIMINAR', fuente: 'Compras · ERP Intelisis' },
];
const base = (o) => ({ clave: 'X', nombre: 'X', cantidad: 1, ...o });

describe('costoPiezaFabricada — integridad del calculo (adversarial)', () => {
  it('P1.1 fuente AUTORITATIVA: la evidencia trae precio_id + fuente del catalogo, no el seed', () => {
    const r = costearMateriaPrima(base({ clave: 'PL', dims_mm: [400, 230, 3], desc: 'PLACA CALIBRE 22' }), { catalogoLamina: CAT });
    expect(r.evidencia.lamina.insumo_id).toBe('erp-ln22310');
    expect(r.evidencia.lamina.precio).toBe(326.59);          // precio autoritativo, no 378.78 del seed
    expect(r.evidencia.lamina.precio_id).toBe(8748);         // version
    expect(r.evidencia.lamina.fuente).toMatch(/ERP/);
    expect(r.evidencia.lamina.unidad).toBe('hoja');
  });

  it('P1.1 sin catalogo autoritativo: INCOMPLETO, no inventa precio (no cae al seed)', () => {
    const r = costearMateriaPrima(base({ clave: 'PL', dims_mm: [400, 230, 3], desc: 'CALIBRE 22' }), { catalogoLamina: [] });
    expect(r.estado).toBe('INCOMPLETO');
    expect(r.componente).toBeUndefined();
    expect(r.motivo).toMatch(/sin precio autoritativo/);
  });

  it('P1.2 calibre PROPUESTO no se confirma solo -> PRELIMINAR, nunca VERIFICABLE', () => {
    const r = costearMateriaPrima(base({ clave: 'CF', dims_mm: [1106, 828, 13], desc: 'FRENTE EN LAMINA' }), { catalogoLamina: CAT });
    expect(r.estado).toBe('PRELIMINAR');
    expect(r.evidencia.calibre.confirmado).toBe(false);
    expect(r.evidencia.motivos).toEqual(expect.arrayContaining([expect.stringMatching(/calibre no confirmado/)]));
  });

  it('P1.2/P1.3 VERIFICABLE solo con calibre del plano + desarrollo verificado + precio certificable', () => {
    const r = costearMateriaPrima(base({ clave: 'PL', dims_mm: [400, 230, 3], desc: 'PLACA CALIBRE 22' }), { catalogoLamina: CAT });
    expect(r.evidencia.desarrollo.metodo).toBe('VERIFICADO');
    expect(r.evidencia.calibre.confirmado).toBe(true);
    expect(r.evidencia.lamina.certificable).toBe(true);
    expect(r.estado).toBe('VERIFICABLE');
  });

  it('P1.3 desarrollo INFERIDO (L+2D) se marca y baja a PRELIMINAR', () => {
    const r = costearMateriaPrima(base({ clave: 'P', dims_mm: [538, 794, 20], desc: 'PUERTA CALIBRE 22' }), { catalogoLamina: CAT });
    expect(r.evidencia.desarrollo.metodo).toBe('INFERIDO_L2D');
    expect(r.evidencia.desarrollo.largoMM).toBe(794 + 40);
    expect(r.estado).toBe('PRELIMINAR');                     // calibre del plano, pero desarrollo inferido
    expect(r.evidencia.motivos).toEqual(expect.arrayContaining([expect.stringMatching(/inferido/)]));
  });

  it('P1.4 pieza que NO cabe en ningun formato -> BLOQUEADO, nunca una hoja en silencio', () => {
    const r = costearMateriaPrima(base({ clave: 'GIG', dims_mm: [3500, 1500, 3], desc: 'CALIBRE 22' }), { catalogoLamina: CAT });
    expect(r.estado).toBe('BLOQUEADO');
    expect(r.componente).toBeUndefined();
    expect(r.motivo).toMatch(/NO cabe/);
  });

  it('P1.5 cantidad invalida/faltante BLOQUEA (no Number(x)||1)', () => {
    for (const bad of [0, -2, NaN, undefined, null, 'x']) {
      const r = costearMateriaPrima(base({ clave: 'Q', dims_mm: [400, 230, 3], desc: 'CALIBRE 22', cantidad: bad }), { catalogoLamina: CAT });
      expect(r.estado).toBe('BLOQUEADO');
      expect(r.componente).toBeUndefined();
    }
  });

  it('P1.6 nesting por conjunto: 2 piezas de la misma lamina comparten hojas (sin doble conteo)', () => {
    const p = costearMateriaPrima(base({ clave: 'A', dims_mm: [400, 300, 3], desc: 'CALIBRE 22' }), { catalogoLamina: CAT });
    // dos componentes del MISMO insumo
    const comp = p.componente;
    const insumos = { [comp.insumoId]: comp.insumo };
    const una = calcular({ nombre: 't', componentes: [comp] }, 1, insumos, PARAMETROS_DEFAULT).materialTotal;
    const dos = calcular({ nombre: 't', componentes: [comp, { ...comp, nombre: 'B' }] }, 1, insumos, PARAMETROS_DEFAULT).materialTotal;
    expect(dos).toBeGreaterThan(una);               // dos piezas cuestan mas que una
    expect(dos).toBeLessThan(una * 2 + 1);          // pero comparten hoja: menos que 2 hojas independientes
    expect(dos).toBeLessThan(326.59 * 2);           // nunca 2 hojas enteras para 2 piezas chicas
  });

  it('laminasParaCalibre: exacto vs mas cercano', () => {
    expect(laminasParaCalibre(22, CAT).exacto).toBe(true);
    const cerca = laminasParaCalibre(24, CAT);
    expect(cerca.exacto).toBe(false);
    expect(cerca.registros[0].calibre).toBe(22);   // 22 es el mas cercano a 24 en el catalogo de prueba
  });

  it('desarrolloPlano: plano/pestanas/caja/insuficiente', () => {
    expect(desarrolloPlano([400, 230]).metodo).toBe('VERIFICADO');
    expect(desarrolloPlano([538, 794, 20]).metodo).toBe('INFERIDO_L2D');
    expect(desarrolloPlano([1200, 865, 600]).pendiente).toBe(true);
    expect(desarrolloPlano([100]).pendiente).toBe(true);
    expect(calibreDesdeTexto('PLACA CALIBRE 24')).toBe(24);
  });
});
