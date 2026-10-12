import { describe, it, expect } from 'vitest';
import { preciosVH } from './politicaVH.js';

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
