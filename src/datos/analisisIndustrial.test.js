import {describe,it,expect} from 'vitest';
import {analizarProductoIndustrial} from './analisisIndustrial.js';

describe('analisis industrial VONI',()=>{
  it('nunca llama ahorro certificado a un nesting advisory',()=>{
    const r=analizarProductoIndustrial({
      bom:[{nombre:'Cubierta',insumoId:'mdf',procedencia:'MEASURED'}],
      costing:{costoUnitario:1000,detalleInsumos:[{
        nombre:'MDF',desperdicio:120,pct:35,
        optimizacionCorte:{disponible:true,completo:true,certificable:false,advisory:true,eficiencia_pct:62,hojas:2,area_comprada_mm2:100,area_piezas_mm2:62},
      }]}
    });
    expect(r.eficiencia.ahorro_certificado).toBeNull();
    expect(r.recomendaciones.some(x=>x.tipo==='EFICIENCIA_CORTE'&&x.ahorro_certificado===false)).toBe(true);
  });
  it('pieza fuera de formato bloquea costo emitible',()=>{
    const r=analizarProductoIndustrial({
      bom:[{nombre:'Cubierta',insumoId:'mdf',procedencia:'MEASURED'}],
      costing:{costoUnitario:900,detalleInsumos:[{nombre:'MDF',noCabe:true}]}
    });
    expect(r.costo_emitible).toBe(false);
    expect(r.bloqueos.some(x=>x.code==='PIEZA_NO_CABE')).toBe(true);
  });
  it('BOM supuesto queda en atención aunque haya costo',()=>{
    const r=analizarProductoIndustrial({
      bom:[{nombre:'Pata',insumoId:'ptr',procedencia:'ASSUMED'}],
      costing:{costoUnitario:500,detalleInsumos:[]}
    });
    expect(r.estado).toBe('ATENCION');
    expect(r.cobertura_bom.certificable).toBe(false);
  });
});


it('integra oportunidades de desarrollo de producto en el análisis industrial',()=>{
  const r=analizarProductoIndustrial({
    bom:[
      {nombre:'Lateral',insumoId:'mdf',procedencia:'MEASURED',largoMM:700,anchoMM:500,espesorMM:18,piezas:4},
      {nombre:'Cubierta',insumoId:'mdf',procedencia:'MEASURED',largoMM:1200,anchoMM:600,espesorMM:18,piezas:1},
    ],
    costing:{costoUnitario:1000,detalleInsumos:[]},
  });
  expect(r.desarrollo_producto.metricas.grupos_repetidos).toBeGreaterThan(0);
  expect(r.recomendaciones.some(x=>x.tipo==='REPETIBILIDAD')).toBe(true);
  expect(r.recomendaciones.filter(x=>x.tipo==='REPETIBILIDAD').every(x=>x.ahorro_certificado===false)).toBe(true);
});


  it('PTR con metros agregados pide lista de cortes, no inventa nesting 1D',()=>{
    const r=analizarProductoIndustrial({
      bom:[{nombre:'Estructura',insumoId:'ptr',procedencia:'MEASURED'}],
      costing:{costoUnitario:800,detalleInsumos:[{
        nombre:'PTR 1x2',
        optimizacionCorte1D:{disponible:false,issues:['SIN_PIEZAS_LINEALES'],advisory:true},
      }]}
    });
    const rec=r.recomendaciones.find(x=>x.tipo==='DESPIECE_LINEAL');
    expect(rec).toBeTruthy();
    expect(rec.accion).toMatch(/largos por pieza/i);
    expect(rec.ahorro_certificado).toBe(false);
  });

  it('corte 1D explícito reporta eficiencia advisory',()=>{
    const r=analizarProductoIndustrial({
      bom:[{nombre:'Pata',insumoId:'ptr',procedencia:'MEASURED'}],
      costing:{costoUnitario:800,detalleInsumos:[{
        nombre:'PTR',
        optimizacionCorte1D:{disponible:true,eficiencia_pct:60,tramos:2,piezas_colocadas:4,issues:[],advisory:true},
      }]}
    });
    expect(r.hallazgos.some(x=>x.tipo==='CORTE_1D'&&x.eficiencia_pct===60)).toBe(true);
    expect(r.recomendaciones.some(x=>x.tipo==='EFICIENCIA_CORTE_1D')).toBe(true);
  });

  it('pieza lineal mayor al tramo aparece como bloqueo físico',()=>{
    const r=analizarProductoIndustrial({
      bom:[{nombre:'Travesaño',insumoId:'ptr',procedencia:'MEASURED'}],
      costing:{costoUnitario:800,detalleInsumos:[{
        nombre:'PTR',
        optimizacionCorte1D:{
          disponible:true,eficiencia_pct:0,tramos:0,piezas_colocadas:0,
          issues:[{code:'PIEZA_NO_CABE',id:'Travesaño#1',largo:6500,util_mm:6000}],advisory:true,
        },
      }]}
    });
    expect(r.bloqueos.some(x=>x.code==='PIEZA_LINEAL_NO_CABE')).toBe(true);
  });


describe('analisis industrial · UNKNOWN cost never equals ZERO',()=>{
  it('sin costing puede analizar BOM pero no declarar costo emitible',()=>{
    const r=analizarProductoIndustrial({
      bom:[{nombre:'Cubierta',insumoId:'mdf',procedencia:'MEASURED',largoMM:1200,anchoMM:600,espesorMM:18}],
      costing:null,
    });
    expect(r.costo_emitible).toBe(false);
    expect(r.bloqueos.some(x=>x.code==='SIN_COSTEO')).toBe(true);
  });

  it('costoUnitario=null no se convierte en $0 válido',()=>{
    const r=analizarProductoIndustrial({
      bom:[{nombre:'Cubierta',insumoId:'mdf',procedencia:'MEASURED'}],
      costing:{costoUnitario:null,componentesIgnorados:[],detalleInsumos:[]},
    });
    expect(r.costo_emitible).toBe(false);
    expect(r.bloqueos.some(x=>x.code==='COSTO_INVALIDO')).toBe(true);
  });
});
