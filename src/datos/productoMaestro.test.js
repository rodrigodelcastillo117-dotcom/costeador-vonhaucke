// PRODUCTO MAESTRO · costear por clave desde el BOM confirmado reproduce la hoja real a ±1%.
// El BOM del ENTCBCALP se extrajo de la hoja real de estimaciones C-CO-517R (29 líneas,
// material/MO/GIF). Costearlo con la política VH debe dar su cos_fab real $18,749.37 ±1%,
// SIN depender de VONI. Éste es el camino alcanzable a ±1% para muebles de catálogo.
import { describe, it, expect } from 'vitest';
import { costearBOM, precioLineaBOM } from './productoMaestro.js';
import bomEntcb from './fixtures/bom/ENTCBCALP.json';

describe('PRODUCTO MAESTRO · costeo por clave (±1% vs hoja real)', () => {
  it('ENTCBCALP: el BOM confirmado reproduce cos_fab real $18,749.37 a ±1%', () => {
    const r = costearBOM(bomEntcb, {});           // {} = sin catálogo → usa precios confirmados
    expect(r.clave).toBe('ENTCBCALP');
    expect(Math.abs(r.deltaPct)).toBeLessThanOrEqual(1);         // ±1% exigido
    expect(r.costoFabricacion).toBeCloseTo(18749.37, 0);         // ±$0.5
    expect(r.material).toBeCloseTo(12315.65, 0);
    expect(r.materialCompraVenta).toBeCloseTo(4620, 0);          // LED+gráficos+logo exacto
  });

  it('el BOM es auto-suficiente: ninguna línea queda sin precio', () => {
    const r = costearBOM(bomEntcb, {});
    expect(r.cobertura.sinPrecio).toBe(0);
    expect(r.cobertura.lineas).toBeGreaterThanOrEqual(25);
  });

  it('re-precia con el catálogo VIGENTE cuando el insumo existe (se actualiza con las compras)', () => {
    // catálogo con un precio DISTINTO al confirmado para una línea mapeada (kit LED)
    const insumos = { 'kit-led-5000k': { id: 'kit-led-5000k', precio: 4000, seccion: 'graficos', unidad: 'pza' } };
    const base = costearBOM(bomEntcb, {});
    const conCat = costearBOM(bomEntcb, insumos);
    expect(conCat.cobertura.conCatalogo).toBeGreaterThanOrEqual(1);
    // el LED subió de 3200 a 4000 (+800 material compra-venta → +800×1.06 al costo)
    expect(conCat.costoFabricacion).toBeGreaterThan(base.costoFabricacion);
    expect(conCat.materialCompraVenta).toBeCloseTo(base.materialCompraVenta + 800, 0);
  });

  it('precioLineaBOM: prefiere catálogo usable; si no, el confirmado; si no, sin_precio', () => {
    const linea = { insumoId: 'x', precioConfirmado: 100 };
    expect(precioLineaBOM(linea, { x: { precio: 120 } }).fuente).toBe('catalogo');
    expect(precioLineaBOM(linea, {}).fuente).toBe('confirmado');
    expect(precioLineaBOM({ insumoId: 'x' }, {}).fuente).toBe('sin_precio');   // sin confirmado ni catálogo
  });

  it('robusto: BOM vacío ⇒ 0, no explota', () => {
    expect(costearBOM({}, {}).costoFabricacion).toBe(0);
    expect(costearBOM({ lineas: [] }, {}).cobertura.lineas).toBe(0);
  });

  it('factores POR CLAVE: Telcel 10/25 (×1.35) ≠ Alpura 20/50 — NO son universales', () => {
    const bomTelcel = {
      clave: 'TELCEL-VH', factor_mo: 0.10, factor_gif: 0.25,
      lineas: [{ desc: 'lámina', cantidad: 1, precioConfirmado: 1000, esCompraVenta: false }],
    };
    const r = costearBOM(bomTelcel, {});
    expect(r.material).toBeCloseTo(1000, 6);
    expect(r.manoObra).toBeCloseTo(100, 6);   // 10%
    expect(r.gif).toBeCloseTo(250, 6);         // 25%
    expect(r.costoFabricacion).toBeCloseTo(1350, 6); // ×1.35, no ×1.8
  });

  it('ENTCBCALP ahora usa SUS factores (de la hoja), reproduce $18,749.37', () => {
    const r = costearBOM(bomEntcb, {});
    expect(r.costoFabricacion).toBeCloseTo(18749.37, 0);
    expect(Math.abs(r.deltaPct)).toBeLessThanOrEqual(1);
  });
});
