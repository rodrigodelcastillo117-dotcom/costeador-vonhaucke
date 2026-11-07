// ENTREGA 1: los 4 BOM TELCEL reconstruidos desde explo_x_id real (C-CO-320R).
// Líneas-hoja acotadas marcador id_0X → costo_total (no "desde el total anterior", que
// arrastraba la sub-explosión y sobre-sumaba). Honesto "hasta donde los datos permitan":
//  · Horizontal/Torre/Isla: 100% identidad, reconcilian al centavo.
//  · Almacén: 67.4% identidad + 2 líneas NECESITA_HUMANO (lámina sin Artículo, cubierta
//    MDF/PVC) que suman $1,172.46; el módulo reconcilia su total pero esas 2 quedan
//    pendientes de identidad — no se inventan.
import { describe, it, expect } from 'vitest';
import { costearBOM } from './productoMaestro.js';
import horiz from './fixtures/bom/TELCEL-VH-HORIZONTAL.json';
import torre from './fixtures/bom/TELCEL-VH-TORRE.json';
import isla from './fixtures/bom/TELCEL-VH-ISLA.json';
import almacen from './fixtures/bom/TELCEL-MOD-ALMACEN.json';

const MODULOS = [
  ['HORIZONTAL', horiz, 4483.13, 100],
  ['TORRE', torre, 2966.15, 100],
  ['ISLA', isla, 3297.84, 100],
  ['ALMACEN', almacen, 3596.14, 67.4],
];

describe('ENTREGA 1 · 4 BOM TELCEL reconstruidos (reconcilian hasta donde los datos permiten)', () => {
  for (const [nombre, bom, material, identEsperada] of MODULOS) {
    it(`${nombre}: líneas suman el material real $${material} (sin inventar ni duplicar)`, () => {
      const suma = bom.lineas.reduce((a, l) => a + l.precioConfirmado * l.cantidad, 0);
      expect(suma).toBeCloseTo(material, 1);
      expect(bom.material_real).toBeCloseTo(material, 2);
      expect(bom.tipo_bom).toBe('BOM_DETALLADO_VERIFICADO');
    });

    it(`${nombre}: cuesta con factores Telcel (×1.35) y es orientativo (precios históricos), no certificable`, () => {
      const r = costearBOM(bom, {});
      expect(r.costoFabricacion).toBeCloseTo(material * 1.35, 0);
      expect(r.emitible).toBe(true);
      expect(r.orientativo).toBe(true);
      expect(r.certificable).toBe(false);
    });

    it(`${nombre}: cobertura de identidad = ${identEsperada}%`, () => {
      const conId = bom.lineas.filter((l) => !l.necesita_humano).reduce((a, l) => a + l.precioConfirmado * l.cantidad, 0);
      expect(100 * conId / material).toBeCloseTo(identEsperada, 0);
    });
  }

  it('ALMACEN: exactamente las 2 líneas sin Artículo quedan NECESITA_HUMANO, sumando $1,172.46', () => {
    const pend = almacen.lineas.filter((l) => l.necesita_humano);
    expect(pend.length).toBe(2);
    expect(pend.every((l) => l.articulo == null)).toBe(true);
    expect(pend.reduce((a, l) => a + l.precioConfirmado, 0)).toBeCloseTo(1172.46, 2);
  });

  it('Horizontal/Torre/Isla NO tienen líneas sin identidad (100% con Artículo real)', () => {
    for (const bom of [horiz, torre, isla]) {
      expect(bom.lineas.some((l) => l.necesita_humano)).toBe(false);
      expect(bom.lineas.every((l) => l.articulo)).toBe(true);
    }
  });
});
