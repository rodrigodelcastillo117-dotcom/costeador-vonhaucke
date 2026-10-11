// GOLDEN · El motor en modo 'intelisis' debe reproducir el "REPORTE DEL COTIZADOR DE
// PRECIOS" de Intelisis (ERP de Von Haucke). Fixture: 15 artículos de la línea APPS LT
// (Alba), reportes del 12/08/2026 entregados por Dirección (Drive "presupuestos cotizador
// vonhaucke"). Si esta prueba se rompe, cambió la fórmula oficial: NO se toca sin aprobación.
//
// Qué se compara, por artículo: materia prima, mano de obra (horas × $/h por centro),
// gastos indirectos (horas × $/h GIF por centro), costo de fabricación, gastos de operación
// (30 %), costo total, precio (×1.20) y precio de lista (×3 = "Factor 200").
import { describe, it, expect } from 'vitest';
import { calcular, precioVenta, PARAMETROS_DEFAULT } from './calculo.js';
import reportes from './fixtures/intelisis_alba_2026-08-12.json';

// Centros de trabajo Intelisis → áreas del motor.
const AREA = { Metal: 'pm', Pintura: 'pintura', Acabados: 'acabados', Madera: 'carpinteria', 'Tapicería': 'tapiceria', Otros: 'otros' };
const CERO = { pm: 0, carpinteria: 0, pintura: 0, acabados: 0, tapiceria: 0, otros: 0 };

function armar(rep) {
  const insumos = {}, componentes = [], horas = {}, costoHoraArea = {}, costoHoraGIF = {};
  rep.materiales.forEach((m, i) => {
    const id = `${m.codigo}_${i}`;
    const esHoja = /^hoja$/i.test(m.unidad);
    insumos[id] = { nombre: m.descripcion, seccion: (m.categoria || 'otros').toLowerCase(), unidad: m.unidad, precio: m.ultimo_costo,
      ...(esHoja ? { formato: { medida: 1, unidad: 'hoja' } } : {}) };
    // Intelisis consume FRACCIÓN de hoja (0.031 hoja): el motor lo modela con `hojas`.
    componentes.push(esHoja ? { nombre: m.descripcion, insumoId: id, hojas: m.cantidad } : { nombre: m.descripcion, insumoId: id, cantidad: m.cantidad });
  });
  for (const c of rep.costos.mano_obra.por_centro) {
    if (c.horas == null) continue;
    const ar = AREA[c.centro];
    if (!ar) throw new Error(`centro sin mapear: ${c.centro}`);
    horas[ar] = (horas[ar] || 0) + c.horas; costoHoraArea[ar] = c.costo_hora;
  }
  for (const c of rep.costos.gastos_indirectos.por_centro) { if (c.horas != null) costoHoraGIF[AREA[c.centro]] = c.costo_hora; }
  const par = { ...PARAMETROS_DEFAULT, modeloCosteo: 'intelisis', usarCostoPorArea: true,
    costoHoraArea: { ...CERO, ...costoHoraArea }, costoHoraGIF: { ...CERO, ...costoHoraGIF },
    gastosOperacionPct: rep.factores.gastos_operacion, utilidadPct: rep.factores.utilidad,
    factorPrecioLista: 1 + rep.factores.precio_lista / 100, mermaProceso: 0 };
  const pieza = { nombre: rep.articulo, modeloCosteo: 'intelisis', modoManoObra: 'horas', horas, componentes };
  return { pieza, insumos, par };
}

describe('golden · motor intelisis reproduce los reportes del ERP (15 artículos APPS LT)', () => {
  it('el fixture tiene 15 reportes con factores 30/20/200', () => {
    expect(reportes).toHaveLength(15);
    for (const r of reportes) expect(r.factores).toEqual({ gastos_operacion: 30, utilidad: 20, precio_lista: 200 });
  });

  for (const rep of reportes) {
    it(`${rep.articulo}: MP, MO, GIF, fabricación, gastos op., costo total y precio al centavo`, () => {
      const { pieza, insumos, par } = armar(rep);
      const r = calcular(pieza, 1, insumos, par);
      const I = rep.costos;
      expect(r.estadoCosto).toBe('completo');
      // Tolerancia 0.05: el reporte imprime cada renglón redondeado a centavos y suma los redondeados.
      expect(r.materialTotal).toBeCloseTo(I.materia_prima.total, 1);
      expect(Math.abs(r.materialTotal - I.materia_prima.total)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(r.manoObra - I.mano_obra.total)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(r.indirectosFabrica - I.gastos_indirectos.total)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(r.costoFabricacion - I.total_fabricacion)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(r.gastosOperacion - I.gastos_operacion)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(r.costoUnitario - I.costo_total)).toBeLessThanOrEqual(0.05);
      const pv = precioVenta(r.costoUnitario, par);
      expect(Math.abs(pv.precio - I.precio)).toBeLessThanOrEqual(0.05);
      // Precio de lista: Intelisis lo imprime en pesos enteros (redondeo propio del ERP, ≤ 1 %).
      expect(Math.abs(pv.lista - I.precio_lista) / I.precio_lista).toBeLessThan(0.01);
    });
  }
});
