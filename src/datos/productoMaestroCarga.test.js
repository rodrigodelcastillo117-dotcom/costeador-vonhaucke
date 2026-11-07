// REGRESIÓN P1 (2026-11-07): el loader en vivo debe traer los factores POR CLAVE y tipo_bom.
// Bug "test verde / prod roto": los unit tests usan el fixture (que YA trae factor_mo/factor_gif),
// pero cargarBOMporClave los omitía del SELECT → en la app en vivo el costeo por clave caía a la
// política genérica (×1.8) en vez de los factores reales → ENTCBCALP ~+18% de error.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { costearBOM } from './productoMaestro.js';
import bomEntcb from './fixtures/bom/ENTCBCALP.json';

const cargaSrc = readFileSync(fileURLToPath(new URL('./productoMaestroCarga.js', import.meta.url)), 'utf8');

describe('LOADER · trae factores por clave + tipo_bom (si no, la app miente el costo)', () => {
  it('el SELECT de cargarBOMporClave incluye factor_mo, factor_gif, material_real y tipo_bom', () => {
    const sel = cargaSrc.match(/\.select\(([`'"])([\s\S]*?)\1\)/);
    expect(sel, 'no encontré el .select() de cargarBOMporClave').toBeTruthy();
    const cols = sel[2];
    for (const req of ['factor_mo', 'factor_gif', 'material_real', 'tipo_bom', 'lineas', 'cos_fab_real']) {
      expect(cols, `falta la columna ${req} en el SELECT`).toContain(req);
    }
  });

  it('ENTCBCALP: con factores reproduce ±1% (y su factor blended ≈ política genérica)', () => {
    const r = costearBOM(bomEntcb, {});
    expect(Math.abs(r.deltaPct)).toBeLessThanOrEqual(1);
  });

  it('factores por clave CRÍTICOS en TELCEL (10/25 ≠ genérico 20/50): sin ellos ~33% de error', () => {
    // Clave estilo Telcel: material fabricado, factores reales 10% MO / 25% GIF (×1.35).
    const lineas = [{ desc: 'lámina acero', cantidad: 1, precioConfirmado: 1000, esCompraVenta: false }];
    const conFactores = costearBOM({ clave: 'TEL', factor_mo: 0.10, factor_gif: 0.25, lineas }, {});
    const sinFactores = costearBOM({ clave: 'TEL', lineas }, {}); // cae a la política genérica fab ×1.8
    expect(conFactores.costoFabricacion).toBeCloseTo(1350, 2);     // ×1.35 real
    expect(sinFactores.costoFabricacion).toBeCloseTo(1800, 2);     // ×1.8 genérico (MAL para Telcel)
    const errorRelativo = Math.abs(sinFactores.costoFabricacion - conFactores.costoFabricacion) / conFactores.costoFabricacion * 100;
    expect(errorRelativo).toBeGreaterThan(25);                     // el loader DEBE traer los factores
  });
});
