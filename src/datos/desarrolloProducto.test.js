import {describe,it,expect} from 'vitest';
import {diagnosticoDesarrolloProducto,compararVariantesProducto} from './desarrolloProducto.js';

describe('desarrollo de producto determinista',()=>{
  it('detecta repetibilidad sin inventar ahorro',()=>{
    const r=diagnosticoDesarrolloProducto({componentes:[
      {nombre:'Lateral',insumoId:'mdf18',largoMM:700,anchoMM:500,espesorMM:18,piezas:4},
      {nombre:'Cubierta',insumoId:'mdf18',largoMM:1200,anchoMM:600,espesorMM:18,piezas:1},
    ]});
    expect(r.repetibilidad[0].cantidad).toBe(4);
    expect(r.oportunidades.some(x=>x.tipo==='REPETIBILIDAD')).toBe(true);
    expect(r.oportunidades.every(x=>x.ahorro_certificado===false)).toBe(true);
  });

  it('muchas geometrías únicas generan hipótesis de estandarización, no cambio automático',()=>{
    const comps=Array.from({length:8},(_,i)=>({
      nombre:'P'+i,insumoId:'mdf18',largoMM:500+i*50,anchoMM:300+i*20,espesorMM:18,piezas:1
    }));
    const r=diagnosticoDesarrolloProducto({componentes:comps});
    const o=r.oportunidades.find(x=>x.tipo==='ESTANDARIZACION_GEOMETRIA');
    expect(o).toBeTruthy();
    expect(o.recomendacion).toMatch(/Revisar/);
    expect(o.ahorro_certificado).toBe(false);
  });

  it('BOM sin geometría queda INCOMPLETO',()=>{
    const r=diagnosticoDesarrolloProducto({componentes:[{nombre:'Herraje',insumoId:'bisagra',cantidad:2}]});
    expect(r.estado).toBe('INCOMPLETO');
    expect(r.metricas.piezas_sin_geometria).toBe(2);
  });

  it('compara variantes por métricas y costo sólo cuando ambos costos existen',()=>{
    const a={componentes:[
      {nombre:'A',insumoId:'m1',largoMM:1000,anchoMM:500,espesorMM:18,piezas:2},
      {nombre:'B',insumoId:'m2',largoMM:300,anchoMM:200,espesorMM:18,piezas:1},
    ]};
    const b={componentes:[
      {nombre:'A',insumoId:'m1',largoMM:1000,anchoMM:500,espesorMM:18,piezas:2},
    ]};
    const r=compararVariantesProducto(a,b,1000,900.25);
    expect(r.delta.piezas_totales).toBe(-1);
    expect(r.delta.familias_material).toBe(-1);
    expect(r.delta.costo).toBe(-99.75);
    expect(r.costo_comparable).toBe(true);
  });
});
