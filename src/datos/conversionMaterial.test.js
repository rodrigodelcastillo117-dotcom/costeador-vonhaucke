import { describe, it, expect } from 'vitest';
import { convertirConsumoACompra, FAMILIA_CONVERSION } from './conversionMaterial.js';

describe('conversionMaterial · estrategia por familia (ChatGPT P0-R9-10)', () => {
  it('TABLERO: compra HOJA ← costeo m² (DIVIDE por área de hoja)', () => {
    const r = convertirConsumoACompra({ familia: 'tablero', unidad_consumo: 'm2', unidad_compra: 'hoja', consumo: 0.8, params: { area_hoja_m2: 2.98 } });
    expect(r.issues).toEqual([]);
    expect(r.cantidad_compra).toBeCloseTo(0.8 / 2.98, 5);     // hojas
    expect(r.estrategia).toBe('TABLERO_M2_A_HOJA');
  });

  it('LÁMINA: compra KG ← costeo m² (MULTIPLICA por kg/m² = peso, NO división genérica)', () => {
    // lámina acero cal.20 ≈ 0.9 mm → 7850 kg/m³ × 0.0009 m ≈ 7.065 kg/m²
    const r = convertirConsumoACompra({ familia: 'lamina', unidad_consumo: 'm2', unidad_compra: 'kg', consumo: 2, params: { kg_por_m2: 7.065 } });
    expect(r.issues).toEqual([]);
    expect(r.cantidad_compra).toBeCloseTo(2 * 7.065, 5);      // 14.13 kg (× no ÷)
    expect(r.estrategia).toBe('LAMINA_M2_A_KG');
  });

  it('PERFIL: compra TRAMO ← costeo m (DIVIDE por largo del tramo)', () => {
    const r = convertirConsumoACompra({ familia: 'perfil', unidad_consumo: 'm', unidad_compra: 'tramo', consumo: 15, params: { largo_tramo_m: 6 } });
    expect(r.cantidad_compra).toBeCloseTo(2.5, 5);            // tramos (fracción permitida)
    expect(r.estrategia).toBe('PERFIL_M_A_TRAMO');
  });

  it('HERRAJE: compra JUEGO ← costeo pz (DIVIDE por pz por juego)', () => {
    const r = convertirConsumoACompra({ familia: 'herraje', unidad_consumo: 'pz', unidad_compra: 'juego', consumo: 10, params: { pz_por_juego: 2 } });
    expect(r.cantidad_compra).toBe(5);
    expect(r.estrategia).toBe('HERRAJE_PZ_A_JUEGO');
  });

  it('mismas unidades → 1:1 (cualquier familia)', () => {
    const r = convertirConsumoACompra({ familia: 'tablero', unidad_consumo: 'm2', unidad_compra: 'm2', consumo: 3.2 });
    expect(r.cantidad_compra).toBe(3.2);
    expect(r.estrategia).toBe('1:1');
  });

  it('FALTA el parámetro de la familia → FALTA_PARAM_CONVERSION (no se inventa)', () => {
    const r = convertirConsumoACompra({ familia: 'lamina', unidad_consumo: 'm2', unidad_compra: 'kg', consumo: 2, params: {} });
    expect(r.issues).toContain('FALTA_PARAM_CONVERSION');
    expect(r.cantidad_compra).toBeNull();
  });

  it('familia/unidades no modeladas → CONVERSION_FAMILIA_DESCONOCIDA (nunca división genérica)', () => {
    const r = convertirConsumoACompra({ familia: 'tablero', unidad_consumo: 'm2', unidad_compra: 'kg', consumo: 2, params: {} });
    expect(r.issues).toContain('CONVERSION_FAMILIA_DESCONOCIDA');
    expect(r.cantidad_compra).toBeNull();
  });

  it('DETERMINISTA y expone las familias', () => {
    expect(Object.values(FAMILIA_CONVERSION)).toEqual(['tablero', 'lamina', 'perfil', 'herraje']);
    const a = convertirConsumoACompra({ familia: 'lamina', unidad_consumo: 'm2', unidad_compra: 'kg', consumo: 2, params: { kg_por_m2: 7 } });
    const b = convertirConsumoACompra({ familia: 'lamina', unidad_consumo: 'm2', unidad_compra: 'kg', consumo: 2, params: { kg_por_m2: 7 } });
    expect(a).toEqual(b);
  });
});
