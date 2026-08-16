import { describe, it, expect } from 'vitest';
import { precioPorUsuarioAppLT, precioDeLista, buscarPrecioVenta } from './preciosVenta.js';

// ---------------------------------------------------------------------------
//  BANCAS APP LT POR USUARIO (Rodrigo, 2026-08-16): "saca el precio por usuario
//  y ponlo; en el caso de 10, lo multiplicas por 10".
//  Estas pruebas fijan la escalera contra los PRESUPUESTOS CERRADOS, que es lo
//  único que puede decir si un precio está bien.
// ---------------------------------------------------------------------------
describe('banca doble App LT: precio por usuario', () => {
  const lista = (n, largoMM = 1200) => precioPorUsuarioAppLT({ producto: 'banca_doble', largoMM, usuarios: n }).lista;

  it('reproduce el precio REAL de Tradeco: 10 usuarios = $28,540', () => {
    expect(lista(10)).toBe(28540);
  });

  it('reproduce el presupuesto Mixue: 6 usuarios ≈ $17,600', () => {
    expect(Math.abs(lista(6) - 17600)).toBeLessThan(50);
  });

  it('reproduce Mixue de 8 usuarios ≈ $23,340', () => {
    expect(Math.abs(lista(8) - 23340)).toBeLessThan(50);
  });

  it('el precio por usuario BAJA con el volumen, nunca sube', () => {
    const porU = [4, 6, 8, 10, 12].map((n) => lista(n) / n);
    for (let i = 1; i < porU.length; i++) expect(porU[i]).toBeLessThanOrEqual(porU[i - 1] + 1);
  });

  it('interpola entre escalones en vez de saltar', () => {
    const v = lista(7) / 7;
    expect(v).toBeLessThan(2933 + 1);
    expect(v).toBeGreaterThan(2918 - 1);
  });

  it('un módulo más largo cuesta más, y se marca como derivado', () => {
    const r = precioPorUsuarioAppLT({ producto: 'banca_doble', largoMM: 1500, usuarios: 10 });
    expect(r.lista).toBeGreaterThan(lista(10));
    expect(r.derivado).toBe(true);
  });

  it('no se mete donde no le toca: sólo banca doble', () => {
    expect(precioPorUsuarioAppLT({ producto: 'escritorio', largoMM: 1500 })).toBe(null);
    expect(precioPorUsuarioAppLT({ producto: 'banca_doble', largoMM: 1200 })).toBe(null);
  });

  it('el precio REAL del papel sigue mandando sobre la escalera', () => {
    const real = buscarPrecioVenta('applt', { producto: 'banca_doble', largoMM: 1200, fondoMM: 1200, usuarios: 6, biombo: 'pet' });
    expect(real).toBeTruthy();
    expect(Math.round(precioDeLista(real.lista))).toBe(17600);
  });
});
