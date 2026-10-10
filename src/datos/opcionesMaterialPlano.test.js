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


describe('P0 — planos metal/hardware contra catálogo real (sin inventar ingeniería)', () => {
  const reales = {
    ptr:{id:'ptr',nombre:'Tubo / PTR 1"x2" cal. 16',seccion:'metal'},
    ptr14:{id:'ptr-14',nombre:'Tubo / PTR cal. 14',seccion:'metal'},
    lamina14:{id:'lamina-14',nombre:'Lamina de acero cal. 14',seccion:'metal'},
    lamina18:{id:'lamina-18',nombre:'Lamina de acero cal. 18',seccion:'metal'},
    bisagra:{id:'bisagra',nombre:'Bisagra',seccion:'herrajes'},
    soldadura:{id:'soldadura',nombre:'Soldadura',seccion:'metal'},
    niveladorPlataforma:{id:'nivelador-plataforma',nombre:'Tornillo nivelador 3/8 plataforma',seccion:'herrajes', disponibleCosteo:false},
  };
  it('PTR negro sin sección/calibre: muestra referencias, ninguna confirma ingeniería', () => {
    const opts = opcionesMaterialPlano('PTR estructura metálica negra', reales);
    expect(opts.length).toBeGreaterThan(0);
    expect(opts.every(x => x.confirmable === false && /ptr/i.test(x.nombre))).toBe(true);
  });
  it('lámina negra: propone lámina pero nunca un perfil PTR ni HPL', () => {
    const opts = opcionesMaterialPlano('lámina negra', reales);
    expect(opts.map(x=>x.id)).toEqual(expect.arrayContaining(['lamina-14','lamina-18']));
    expect(opts.some(x=>x.id === 'ptr-14')).toBe(false);
    expect(opts.every(x=>!x.confirmable)).toBe(true);
  });
  it('si plano pide calibre 18 jamás muestra calibre 14', () => {
    expect(opcionesMaterialPlano('lámina negra cal. 18', reales).map(x=>x.id)).toEqual(['lamina-18']);
  });
  it('herrajes y consumibles existentes son visibles sin liberar costeos oficiales', () => {
    const bis = opcionesMaterialPlano('bisagra', reales);
    const sol = opcionesMaterialPlano('soldadura', reales);
    expect(bis.map(x=>x.id)).toEqual(['bisagra']);
    expect(sol.map(x=>x.id)).toEqual(['soldadura']);
    expect(bis[0].confirmable).toBe(false);
    expect(sol[0].confirmable).toBe(false);
  });
  it('referencia exclusivamente de Compras nunca es confirmable ni contiene precio', () => {
    const opts = opcionesMaterialPlano('nivelador', reales);
    expect(opts).toHaveLength(1);
    expect(opts[0].fuenteCatalogo).toBe('compras');
    expect(opts[0].confirmable).toBe(false);
    expect(opts[0].precio).toBeUndefined();
  });
});

describe('ASUR: la IA ofrece insumo real y precio autorizado sin convertirlo en MDF', () => {
 const catalogo={
  'solid-surface':{id:'solid-surface',nombre:'Superficie sólida 12 mm Corian',seccion:'cubiertas',unidad:'m2',disponibleCosteo:true,precioCertificable:false},
  'solid-surface-azul':{id:'solid-surface-azul',nombre:'Superficie sólida 12 mm AZUL mineral (ASUR)',seccion:'cubiertas',unidad:'m2',disponibleCosteo:true,precioCertificable:false},
  'adhesivo-solid-surface':{id:'adhesivo-solid-surface',nombre:'Adhesivo acrílico solid surface',seccion:'cubiertas',unidad:'pza'},
  mdf:{id:'mdf',nombre:'MDF 19mm',seccion:'cubiertas'},
 };
 it('el plano dice azul y sólo propone la tarifa azul para m2',()=>{
   const a=opcionesMaterialPlano('superficie sólida azul de ASUR 12 mm',catalogo);
   expect(a.map(x=>x.id)).toEqual(['solid-surface-azul']);
   expect(a[0].confirmable).toBe(true);
   expect(a[0].advertencia).toMatch(/ESTIMACIÓN/);
 });
 it('no convierte adhesivo en tablero por coincidir solid surface',()=>{
   const a=opcionesMaterialPlano('superficie sólida 12 mm',catalogo);
   expect(a.map(x=>x.id)).not.toContain('adhesivo-solid-surface');
   expect(a.map(x=>x.id)).not.toContain('mdf');
 });
});
