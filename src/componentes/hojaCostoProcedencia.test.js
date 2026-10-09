import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// REALITY CUTOVER · la Hoja de Costo nombra la CALIDAD del costo según la
// procedencia de cada MP (capa aditiva: NO cambia el número del motor).
describe('HojaCosto · procedencia del costo (evidencia real vs provisional)', () => {
  const s = fs.readFileSync('src/componentes/HojaCosto.jsx', 'utf8');

  it('resuelve la procedencia de cada MP del desglose (detalleInsumos)', () => {
    expect(s).toContain("from '../datos/precioInsumoBridge.js'");
    expect(s).toContain('resultado.detalleInsumos');
    expect(s).toContain('resolverPrecioInsumoVivo(c.insumoId, ins)');   // capturado-aware (P0-PRICE-TRUST)
  });

  it('"costo con evidencia real" sólo si TODO el material tiene procedencia', () => {
    expect(s).toContain('const costoConEvidenciaReal = mpProc.length > 0 && mpSinEvidencia.length === 0');
    expect(s).toContain('bloqueaCostoOficial');
  });

  it('etiqueta PRECISA (ChatGPT #6): sólo el PRECIO de MP, no "costo con evidencia real"', () => {
    expect(s).toContain('Precios de MP con evidencia real');
    expect(s).toContain('(consumo/MO/GI sin verificar)');
    expect(s).toContain('costo NO oficial');
    // ya NO afirma el genérico "Costo con evidencia real" (sobre-reclamo)
    expect(s).not.toContain('✓ Costo con evidencia real');
  });

  it('FX PROVENANCE: MP en moneda extranjera con FX no verificado NO cuenta como evidencia real', () => {
    expect(s).toContain("String(ins.moneda).toUpperCase() !== 'MXN'");
    expect(s).toContain('&& !fxProvisional');
    expect(s).toContain('FX no verificado');
  });
});
