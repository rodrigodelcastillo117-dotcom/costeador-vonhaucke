import { describe, it, expect } from 'vitest';
import { costoFabVH, preciosVH } from './politicaVH.js';

describe('política VH · costo de fabricación (T.D.C. real)', () => {
  // Ancla: copete C-CO-516R id_01 de Alba (2026-09-30), verificado al centavo.
  it('copete: material 460.57 → MO 92.11 → indirecto 276.33 → costo fab 829.01', () => {
    const c = costoFabVH(460.57, 'mueble_fabricado');
    expect(c.mo).toBe(92.11);
    expect(c.indirecto).toBe(276.33);
    expect(c.costoFab).toBe(829.01);
  });

  it('MO = material × 0.20 y indirecto = MO × 3 (mueble fabricado)', () => {
    const c = costoFabVH(1000, 'mueble_fabricado');
    expect(c.mo).toBe(200);
    expect(c.indirecto).toBe(600);
    expect(c.costoFab).toBe(1800); // material × 1.8
  });

  it('componente fabricado usa MO 0.15 (mismo indirecto ×3)', () => {
    const c = costoFabVH(1000, 'componente_fabricado');
    expect(c.mo).toBe(150);
    expect(c.indirecto).toBe(450);
  });

  it('compra-venta casi no carga MO ni indirecto', () => {
    const c = costoFabVH(1000, 'mueble_compra_venta');
    expect(c.mo).toBe(10);        // ×0.01
    expect(c.indirecto).toBe(0.5); // MO ×0.05
  });

  it('el indirecto se calcula sobre la MO YA redondeada (da 276.33, no 276.34)', () => {
    // 460.57×0.2 = 92.114 → 92.11; 92.11×3 = 276.33 (no 276.342)
    expect(costoFabVH(460.57).indirecto).toBe(276.33);
  });

  it('material inválido no explota', () => {
    expect(costoFabVH(null).costoFab).toBe(0);
    expect(costoFabVH(-50).costoFab).toBe(0);
  });
});

describe('política VH · niveles de precio', () => {
  it('copete: precio mínimo ≈ 1285, lista = mín/0.7, precio2 = mín/0.42', () => {
    const p = preciosVH(829.01, { tipo: 'mueble_fabricado', volumen: 'alto' });
    expect(p.precioMin).toBeCloseTo(1284.97, 2);   // Alba lo redondea comercial a 1290
    expect(p.precioLista).toBeCloseTo(p.precioMin / 0.7, 2);
    expect(p.precio2).toBeCloseTo(p.precioMin / 0.42, 2);
  });

  it('a mayor volumen, menor factor → menor precio mínimo', () => {
    const alto = preciosVH(1000, { volumen: 'alto' }).precioMin;      // ×1.55
    const bajo = preciosVH(1000, { volumen: 'bajo' }).precioMin;      // ×2.35
    expect(alto).toBeLessThan(bajo);
    expect(alto).toBe(1550);
    expect(bajo).toBe(2350);
  });
});
