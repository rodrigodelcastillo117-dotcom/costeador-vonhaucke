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


// Reproduce la configuración REAL de 92 insumos consultada en Supabase,
// sólo nombres e IDs (sin precios privados): no contiene nogal por acabado.
const catalogoActivo92 = {
  divisor: { id: 'divisor-melamina', nombre: 'Divisor de melamina', seccion: 'mamparas' },
  faldon: { id: 'faldon-melamina', nombre: 'Faldon melamina', seccion: 'cubiertas' },
  mel9: { id: 'melamina-9', nombre: 'Melamina 9 mm (biombo)', seccion: 'cubiertas' },
  mel16: { id: 'melamina-16', nombre: 'Melamina 16 mm', seccion: 'cubiertas' },
  mel19: { id: 'melamina-19', nombre: 'Melamina / EcoLegno 19 mm', seccion: 'cubiertas' },
  mel28: { id: 'melamina-28', nombre: 'Melamina ABS 28 mm (cubierta APP LT)', seccion: 'cubiertas' },
};
describe('regresión P-01 contra el catálogo activo de 92 insumos', () => {
  it('nunca recomienda divisor, faldón, melamina 9/16/28 para puertas 18 mm nogal', () => {
    const opciones = opcionesMaterialPlano('melamina nogal claro 18 mm', catalogoActivo92);
    expect(opciones.map(x => x.id)).toEqual(['melamina-19']);
    expect(opciones[0].confirmable).toBe(false);
    expect(opciones[0].advertencia).toMatch(/no identifica el acabado/i);
  });
  it('sin espesor especificado no escoge un tablero arbitrario', () => {
    const opciones = opcionesMaterialPlano('melamina nogal claro', catalogoActivo92);
    expect(opciones).toEqual([]);
  });
  it('muestra el verdadero artículo Walnut 19 mm sólo cuando está en el catálogo económico', () => {
    const actualizado = {
      ...catalogoActivo92,
      walnut: { id: 'melamina-19-walnut', nombre: 'Melamina 19 mm, Walnut', seccion: 'cubiertas' },
    };
    const opciones = opcionesMaterialPlano('melamina 18 mm color nogal claro', actualizado);
    expect(opciones.map(x => x.id)).toEqual(['melamina-19-walnut']);
    expect(opciones[0].confirmable).toBe(true);
    expect(opciones[0].advertencia).toMatch(/18 mm.*19 mm/i);
  });
  it('ignora MDF melaminizado porque el sustrato no es el tablero solicitado', () => {
    const actualizado = {
      ...catalogoActivo92,
      mdf: { id: 'mdf-16-walnut', nombre: 'MDF melamina 2 caras 16 mm Walnut (nogal)', seccion: 'cubiertas' },
    };
    const opciones = opcionesMaterialPlano('melamina 18 mm nogal claro', actualizado);
    expect(opciones.map(x => x.id)).toEqual(['melamina-19']);
  });
});
