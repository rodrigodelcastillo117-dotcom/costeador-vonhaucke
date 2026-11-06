// CALIBRACIÓN contra hojas REALES del depto de estimaciones Von Haucke (2026-11-06).
// La política de costo de fabricación (fabricado ×1.8 + compra-venta ×1.06) debe reproducir
// AL CENTAVO el costo de fabricación real cuando el material está completo. Estos dos muebles
// tienen hoja real de estimaciones (material/MO/GIF/cos_fab); el test NO usa precios de catálogo
// (que cambian con las compras), sino el MATERIAL ya sumado por tipo, para medir SÓLO el modelo.
//
//  C-CO-517R ENTCBCALP: fabricado $7,695.65 (id_01) + compra-venta $4,620.00 (id_02 LED/gráficos)
//                        → MO $1,585.33 (20%/1%) + GIF $4,848.39 (50%/5%) = cos_fab $18,749.37
//  C-CO-516R copete:     fabricado $460.57 (todo metal/herrajes) → cos_fab $829.01
import { describe, it, expect } from 'vitest';
import { costoFabricacionVH, esCompraVenta, POLITICA_VH } from './calculo.js';

const detalle = (fab, cv) => [
  ...(fab ? [{ seccion: 'metal', costo: fab }] : []),
  ...(cv ? [{ seccion: 'graficos', costo: cv }] : []),
];
const cerca = (a, b, tolPct = 1) => Math.abs(a - b) / b * 100 <= tolPct;

describe('CALIBRACIÓN · política VH reproduce la hoja real de estimaciones (±1%)', () => {
  it('ENTCBCALP: fab $7,695.65 + cv $4,620 ⇒ cos_fab $18,749.37 (al centavo)', () => {
    const r = costoFabricacionVH(detalle(7695.65, 4620));
    expect(cerca(r.costoFabricacion, 18749.37)).toBe(true);
    expect(r.costoFabricacion).toBeCloseTo(18749.37, 1);   // ±$0.05
    expect(r.material).toBeCloseTo(12315.65, 1);
    expect(r.manoObra).toBeCloseTo(1585.33, 1);
    expect(r.gif).toBeCloseTo(4848.39, 1);
  });

  it('copete C-CO-516R: fab $460.57 (todo fabricado) ⇒ cos_fab $829.01 (±1%)', () => {
    const r = costoFabricacionVH(detalle(460.57, 0));
    expect(cerca(r.costoFabricacion, 829.01)).toBe(true);
    expect(r.costoFabricacion).toBeCloseTo(829.03, 1);
  });

  it('factores exactos: fabricado ×1.8, compra-venta ×1.06', () => {
    expect(costoFabricacionVH(detalle(1000, 0)).costoFabricacion).toBeCloseTo(1800, 6);
    expect(costoFabricacionVH(detalle(0, 1000)).costoFabricacion).toBeCloseTo(1060, 6);
  });

  it('desglose: MO=20% del fabricado y 1% de compra-venta; GIF=50%(fab+MO) y 5% de cv', () => {
    const r = costoFabricacionVH(detalle(1000, 500));
    expect(r.manoObra).toBeCloseTo(1000 * 0.20 + 500 * 0.01, 6);     // 205
    expect(r.gif).toBeCloseTo((1000 + 200) * 0.50 + 500 * 0.05, 6);   // 625
  });

  it('clasificación: gráficos/iluminación = compra-venta; lo demás = fabricado', () => {
    expect(esCompraVenta('graficos')).toBe(true);
    expect(esCompraVenta('iluminacion')).toBe(true);
    for (const s of ['cubiertas', 'metal', 'herrajes', 'acabados', 'electrico', 'maderas']) {
      expect(esCompraVenta(s)).toBe(false);
    }
  });

  it('robusto: ignora costos no finitos o ≤0, no explota con lista vacía', () => {
    expect(costoFabricacionVH([]).costoFabricacion).toBe(0);
    const r = costoFabricacionVH([{ seccion: 'metal', costo: 100 }, { seccion: 'metal', costo: 0 }, { seccion: 'graficos', costo: NaN }]);
    expect(r.costoFabricacion).toBeCloseTo(180, 6);
  });

  it('la política viva es 20/50 — 1/5 (si cambia, este número cambia a propósito)', () => {
    expect(POLITICA_VH).toEqual({ moFab: 0.20, gifFab: 0.50, moCV: 0.01, gifCV: 0.05 });
  });
});
