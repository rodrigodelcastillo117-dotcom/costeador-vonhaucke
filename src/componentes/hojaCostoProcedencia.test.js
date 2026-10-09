import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// REALITY CUTOVER · la Hoja de Costo nombra la CALIDAD del costo según la
// procedencia de cada MP (capa aditiva: NO cambia el número del motor).
describe('HojaCosto · procedencia del costo (evidencia real vs provisional)', () => {
  const s = fs.readFileSync('src/componentes/HojaCosto.jsx', 'utf8');

  it('resuelve la procedencia de cada MP del desglose (detalleInsumos)', () => {
    expect(s).toContain("from '../datos/precioInsumoBridge.js'");
    expect(s).toContain('resultado.detalleInsumos');
    expect(s).toContain('resolverPrecioInsumo(c.insumoId, ins)');
  });

  it('"costo con evidencia real" sólo si TODO el material tiene procedencia', () => {
    expect(s).toContain('const costoConEvidenciaReal = mpProc.length > 0 && mpSinEvidencia.length === 0');
    expect(s).toContain('bloqueaCostoOficial');
  });

  it('muestra el estado honesto: evidencia real, o N materiales sin evidencia (no oficial)', () => {
    expect(s).toContain('Costo con evidencia real');
    expect(s).toContain('sin evidencia suficiente — costo no oficial');
  });
});
