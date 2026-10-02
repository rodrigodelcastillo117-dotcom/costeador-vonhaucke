import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { calcular, formulaDePieza, FORMULA_ALBA_V1 } from './calculo.js';
import { costoAlba } from './formulaAlba.js';

describe('Cutover a Alba — producto nuevo usa la fórmula oficial', () => {
  // Una pieza de PRODUCTO NUEVO (como la arma AsistenteEspecial ya migrado) no trae
  // factores a mano ⇒ fórmula ALBA_V1.
  it('pieza sin factores ⇒ formulaDePieza = ALBA_V1', () => {
    expect(formulaDePieza({ modoManoObra: 'porcentaje' })).toBe(FORMULA_ALBA_V1);
  });
  it('pieza con 55/12 ⇒ LEGACY_55 (histórico, reproducible)', () => {
    expect(formulaDePieza({ factorDirecta: 55, factorIndirecta: 12 })).toBe('LEGACY_55');
  });

  // Mismo BOM: Alba y Legacy55 dan números DISTINTOS (ambos caminos siguen vivos:
  // Alba para nuevo, Legacy solo para reproducir históricos).
  it('mismo BOM: Alba ≠ Legacy55 (cada camino funciona)', () => {
    const insumos = { t: { id: 't', nombre: 'Tablero', seccion: 'cubiertas', clase: 'directa', unidad: 'hoja', precio: 600, formato: { medida: 2.9768 }, fraccion: true } };
    const comps = [{ nombre: 'Panel', insumoId: 't', hojas: 1, piezas: 1, cantidad: 1 }];
    const alba = calcular({ componentes: comps, modoManoObra: 'porcentaje' }, 1, insumos, {});
    const legacy = calcular({ componentes: comps, modoManoObra: 'porcentaje', factorDirecta: 55, factorIndirecta: 12 }, 1, insumos, {});
    expect(alba.costoUnitario).not.toBe(legacy.costoUnitario);
  });

  // BENCH DE ALBA — referencias humanas por categoría, al centavo (formulaAlba.js).
  it('bench Alba: omega/cubierta/cristal reproducen la T.D.C. humana al centavo', () => {
    expect(costoAlba(46.67, 'general').fab).toBeCloseTo(83.99, 1);  // metal/general ×1.80
    expect(costoAlba(381.84, 'cubierta').fab).toBeCloseTo(610.96, 1); // cubierta ×1.60
    expect(costoAlba(717.67, 'cristal').fab).toBeCloseTo(760.73, 1);  // compra-venta/cristal ×1.06
  });

  // GUARD DE FUENTE — el flujo de PRODUCTO NUEVO ya no hardcodea 55/12. El literal
  // legacy `factorDirecta: 55, factorIndirecta: 12` no debe existir en AsistenteEspecial
  // (la reapertura histórica usa `c.factorDirecta ?? 55`, que es otra cosa y sí se permite).
  it('AsistenteEspecial ya no trae el override legacy `factorDirecta: 55, factorIndirecta: 12`', () => {
    const src = readFileSync(fileURLToPath(new URL('../componentes/AsistenteEspecial.jsx', import.meta.url)), 'utf8');
    expect(src).not.toContain('factorDirecta: 55, factorIndirecta: 12');
    expect(src).not.toContain('factorDirecta: 55,');
  });
});
