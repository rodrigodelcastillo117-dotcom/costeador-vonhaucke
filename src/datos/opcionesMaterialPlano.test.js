import { describe, expect, it } from 'vitest';
import { opcionesMaterialPlano } from './opcionesMaterialPlano.js';
const catalogo = {
  nogal: { id: 'melamina-19-nogal', nombre: 'Melamina 19 mm, Nogal Neo TX' },
  walnut: { id: 'melamina-19-walnut', nombre: 'Melamina 19 mm, Walnut' },
  blanca: { id: 'melamina-19-blanca', nombre: 'Melamina blanca 19 mm' },
  acero: { id: 'acero', nombre: 'Lámina acero cal.14' },
};
describe('materiales del plano P-01 — sugerencias sin costo inventado', () => {
  it('ofrece sólo alternativas nogal/walnut de melamina para 18 mm nogal', () => {
    const a = opcionesMaterialPlano('melamina 18 mm color nogal claro', catalogo);
    expect(a.map(x => x.id)).toEqual(['melamina-19-nogal', 'melamina-19-walnut']);
  });
  it('no mezcla metal con melamina', () => {
    expect(opcionesMaterialPlano('melamina 18 mm color nogal claro', catalogo).some(x => x.id === 'acero')).toBe(false);
  });
  it('no inventa candidatos cuando no hay familia', () => {
    expect(opcionesMaterialPlano('bisagra', catalogo)).toEqual([]);
  });
});
