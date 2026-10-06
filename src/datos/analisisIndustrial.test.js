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
