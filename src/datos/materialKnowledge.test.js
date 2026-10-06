import {describe,it,expect} from 'vitest';
import {catalogoTecnicoMateriales,buscarMaterialTecnico,describirFormatoTecnico,contieneEconomiaMaterial} from './materialKnowledge.js';

describe('material knowledge seller-safe',()=>{
  const insumos={
    mdf18:{nombre:'MDF 18 mm',seccion:'cubiertas',unidad:'hoja',precio:999.99,proveedor:'X',formato:{largoMM:2440,anchoMM:1220,medida:2.9768},veta:false},
    nogal:{nombre:'Chapa nogal',seccion:'chapas',unidad:'hoja',precio:450,formato:{largoMM:2500,anchoMM:1250},veta:true},
    ptr:{nombre:'PTR 1x2',seccion:'metal',unidad:'m',precio:40,formato:{tipo:'tramo',nombre:'tramo de 6 m',medida:6}},
  };
  it('elimina economía pero conserva formato técnico',()=>{
    const c=catalogoTecnicoMateriales(insumos);
    expect(c[0].precio).toBeUndefined();
    expect(c[0].proveedor).toBeUndefined();
    expect(contieneEconomiaMaterial(c)).toBe(false);
    expect(c.find(x=>x.id==='mdf18').formato).toMatchObject({largo_mm:2440,ancho_mm:1220});
  });
  it('describe medidas reales, no default inventado',()=>{
    const m=catalogoTecnicoMateriales(insumos).find(x=>x.id==='mdf18');
    expect(describirFormatoTecnico(m)).toBe('formato 2440 × 1220 mm');
  });
  it('si no hay formato documentado lo dice',()=>{
    expect(describirFormatoTecnico({nombre:'X',formato:{}})).toBe('formato físico no documentado');
  });
  it('busca por nombre técnico',()=>{
    expect(buscarMaterialTecnico(catalogoTecnicoMateriales(insumos),'hoja MDF')[0].id).toBe('mdf18');
  });
});


  it('PTR/tramo documentado expone longitud comercial, sin precio',()=>{
    const m=catalogoTecnicoMateriales(insumos).find(x=>x.id==='ptr');
    expect(m.formato.tipo).toBe('tramo');
    expect(m.formato.largo_comercial_mm).toBe(6000);
    expect(describirFormatoTecnico(m)).toBe('tramo 6.00 m');
    expect(m.precio).toBeUndefined();
  });
