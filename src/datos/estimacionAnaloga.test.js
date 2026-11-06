// Mejora del plano crudo: el benchmark por analogía debe CAZAR el sub-conteo típico de VONI
// (draft −40%) y no molestar cuando el draft es razonable.
import { describe, it, expect } from 'vitest';
import { superficieM2, estimarPorAnalogia, revisarDraftVsAnalogia } from './estimacionAnaloga.js';

const BOMS = [
  { clave: 'ENTCBCALP', nombre: 'Exhibidor para envases de leche Alpura', dims_mm: [594, 2162, 1283], cos_fab_real: 18749.37 },
  { clave: 'COPETE-CAB-516R', nombre: 'Copete abatible de cabecera', dims_mm: [1000, 900, 58], cos_fab_real: 829.01 },
];

describe('estimación por analogía (benchmark de muebles guardados)', () => {
  it('superficieM2 de una caja', () => {
    expect(superficieM2([1000, 1000, 1000])).toBeCloseTo(6, 3); // 6 caras de 1 m²
    expect(superficieM2([0, 0, 0])).toBe(0);
  });

  it('estima por tipo: un exhibidor nuevo usa el costo/m² del exhibidor guardado, no del copete', () => {
    const a = estimarPorAnalogia([600, 2000, 1200], 'exhibidor de leche', BOMS);
    expect(a).toBeTruthy();
    expect(a.base).toEqual(['ENTCBCALP']);        // mismo tipo → sólo el exhibidor
    expect(a.mismoTipo).toBe(true);
    // costo/m² del ENTCBCALP ≈ 18749/9.64 ≈ 1945; superficie nueva ≈ 8.64 → ~16.8k
    expect(a.estimado).toBeGreaterThan(14000);
    expect(a.estimado).toBeLessThan(19000);
  });

  it('CAZA el sub-conteo: el draft real del ENTCBCALP ($11,297, −40%) queda fuera de banda → avisa', () => {
    const r = revisarDraftVsAnalogia(11297, [594, 2162, 1283], 'exhibidor de leche', BOMS);
    expect(r.ok).toBe(false);
    expect(r.ratio).toBeLessThan(0.75);
    expect(r.aviso).toMatch(/POR DEBAJO/);
    expect(r.aviso).toMatch(/falta material/i);
  });

  it('un draft correcto (±, el costo real) NO dispara aviso', () => {
    const r = revisarDraftVsAnalogia(18749.37, [594, 2162, 1283], 'exhibidor de leche', BOMS);
    expect(r.ok).toBe(true);
    expect(r.aviso).toBeNull();
  });

  it('un draft inflado (×1.8) también avisa (por encima)', () => {
    const r = revisarDraftVsAnalogia(18749.37 * 1.8, [594, 2162, 1283], 'exhibidor de leche', BOMS);
    expect(r.ok).toBe(false);
    expect(r.aviso).toMatch(/POR ENCIMA/);
  });

  it('sin BOMs o sin dims: no estima, no bloquea (no inventa)', () => {
    expect(estimarPorAnalogia([600, 2000, 1200], 'x', [])).toBeNull();
    expect(revisarDraftVsAnalogia(1000, null, 'x', BOMS).ok).toBe(true);
  });
});
