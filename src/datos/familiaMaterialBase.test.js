import { describe, it, expect } from 'vitest';
import { familiaDeMaterial, aplicarPoliticaMaterial } from './materialMatch.js';
import { INSUMOS_SEMILLA, mapaInsumos } from './insumos.js';
import { mapIaComps } from './mapIaComps.js';

// VH-176 (librero 5×8, Operación 10/10, corridas p10b/p10c/p10d): la IA mandó "Respaldo" con
// insumoId melamina-16-walnut y material_solicitado "Melamina 16 mm Walnut, una pieza atornillada"; el
// cliente lo re-amarraba a TORNILLERÍA ("Acabado/color distinto"), porque /tornill/ encontraba
// "a-tornill-ada" y los consumibles van antes que los tableros en la tabla de familias.
describe('VH-176 · el material base manda sobre el accesorio que lo acompaña', () => {
  it.each([
    ['Melamina 16 mm Walnut, una pieza atornillada', 'melamina'],
    ['Respaldo MDF 6 mm atornillado', 'mdf'],
    ['MDF 18 mm lacado blanco', 'mdf'],
    ['Melamina 19 mm pegada con adhesivo', 'melamina'],
    ['Cubierta de cristal templado con bisagra', 'cristal'],
    ['Melamina 19 mm con jaladera', 'melamina'],
    ['Panel melamina 19 mm con canto PVC', 'melamina'],
  ])('%s → %s', (t, fam) => expect(familiaDeMaterial(t)).toBe(fam));

  it.each([
    ['Jaladera de acero inoxidable', 'herraje_jaladera'],
    ['Pintura electrostática para acero', 'pintura_polvo'],
    ['Tapacanto PVC 2 mm Walnut', 'tapacanto'],
    ['Bisagra cierre lento acero', 'herraje_bisagra'],
    ['Corredera telescópica de acero 450 mm', 'herraje_corredera'],
    ['Tornillo 8x1 1/2', 'tornilleria'],
    ['Tornillería de ensamble y respaldo', 'tornilleria'],
    ['Pijas para madera', 'tornilleria'],
  ])('si el texto EMPIEZA por el accesorio no cambia: %s → %s', (t, fam) => expect(familiaDeMaterial(t)).toBe(fam));

  it('el respaldo del librero conserva su melamina (no se re-amarra a tornillería)', () => {
    const ins = mapaInsumos(INSUMOS_SEMILLA);
    const z = { nombre: 'Respaldo', insumoId: 'melamina-16-walnut', material_solicitado: 'Melamina 16 mm Walnut, una pieza atornillada', material_match: 'EXACT', forma: 'area', largoMM: 1800, anchoMM: 900, cantidad: 1, hojas: 0.45 };
    const [r] = mapIaComps({ piezas: [z] }, ins);
    expect(r.insumoId).toBe('melamina-16-walnut');
    expect(r.insumoId).not.toBe('tornilleria');
  });
});
