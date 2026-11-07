// BLOQUE 2b (orden #3): reconstrucción de BOM TELCEL desde explo_x_id real.
// Sólo HORIZONTAL reconcilia línea→total (9 líneas = $4,483.13 exacto); Torre/Isla/Almacén
// tienen sub-bloques anidados duplicados (suma ≫ total) y quedan AGREGADO_HISTORICO
// pendientes — NO se fuerza una reconstrucción inventada (orden: "no inventes ni dupliques").
import { describe, it, expect } from 'vitest';
import { costearBOM } from './productoMaestro.js';
import bomHoriz from './fixtures/bom/TELCEL-VH-HORIZONTAL.json';

describe('TELCEL · reconstrucción desde explo_x_id (sólo lo que reconcilia)', () => {
  it('HORIZONTAL: 9 líneas reales reconcilian el material ($4,483.13) y reproducen cos_fab', () => {
    const r = costearBOM(bomHoriz, {});
    expect(bomHoriz.tipo_bom).toBe('BOM_DETALLADO_VERIFICADO');
    expect(bomHoriz.lineas.length).toBe(9);
    const sumaMaterial = bomHoriz.lineas.reduce((a, l) => a + l.precioConfirmado * l.cantidad, 0);
    expect(sumaMaterial).toBeCloseTo(4483.13, 2);          // líneas = material_real exacto
    expect(r.material).toBeCloseTo(4483.13, 2);
    expect(r.costoFabricacion).toBeCloseTo(6052.23, 1);    // ×1.35 (10/25)
  });

  it('HORIZONTAL cuesta con precios HISTÓRICOS → emitible pero orientativo, NO certificable aún', () => {
    const r = costearBOM(bomHoriz, {});
    expect(r.emitible).toBe(true);
    expect(r.orientativo).toBe(true);     // los precios de línea son costo_última_compra histórico
    expect(r.certificable).toBe(false);   // se certifica cuando el catálogo tenga precio vigente
    expect(r.bloqueos.length).toBe(0);
  });

  it('cada línea trae su identidad de artículo (no inventada): articulo + unidad', () => {
    for (const l of bomHoriz.lineas) {
      expect(l.articulo, 'toda línea reconstruida conserva su artículo ERP').toBeTruthy();
      expect(l.insumoId).toBeNull();      // mapeo al catálogo = acción gobernada aparte (no inventar)
    }
  });
});
