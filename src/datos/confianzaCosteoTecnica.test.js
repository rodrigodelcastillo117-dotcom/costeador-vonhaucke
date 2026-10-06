import { describe, it, expect } from 'vitest';
import { confianzaTecnicaCosteo } from './confianzaCosteoTecnica.js';

describe('confianzaTecnicaCosteo',()=>{
  it('da 100 sólo cuando precio, BOM, motor y fórmula están respaldados',()=>{
    const r=confianzaTecnicaCosteo({
      resultado:{formulaCosteo:'ALBA_V1',detalleInsumos:[{insumoId:'a',nombre:'A',costo:100}]},
      insumos:{a:{fuente:'TDC'}},
      industrial:{costo_emitible:true,cobertura_bom:{total:1,certificable:1},bloqueos:[],matematica:{formula_oficial:'ALBA_V1'}},
    });
    expect(r.score).toBe(100);
    expect(r.estado).toBe('ALTA');
  });

  it('penaliza evidencia faltante y nunca la convierte en certeza',()=>{
    const r=confianzaTecnicaCosteo({
      resultado:{formulaCosteo:'ALBA_V1',detalleInsumos:[{insumoId:'a',nombre:'A',costo:100},{insumoId:'b',nombre:'B',costo:100}]},
      insumos:{a:{fuente:'compra'}},
      industrial:{costo_emitible:false,cobertura_bom:{total:2,certificable:1},bloqueos:[{code:'COSTO_FALTANTE'}],matematica:{formula_oficial:'ALBA_V1'}},
    });
    expect(r.score).toBeLessThan(80);
    expect(r.estado).toBe('BAJA');
    expect(r.material_sin_fuente).toEqual(['B']);
  });

  it('expone dimensiones no evaluables sin inventar un porcentaje de precio',()=>{
    const r=confianzaTecnicaCosteo({
      resultado:{formulaCosteo:'ALBA_V1',detalleInsumos:[]},
      industrial:{costo_emitible:true,cobertura_bom:{total:0,certificable:0},bloqueos:[],matematica:{formula_oficial:'ALBA_V1'}},
    });
    expect(r.dimensiones.find((d)=>d.key==='precios').valor).toBeNull();
    expect(r.dimensiones.find((d)=>d.key==='bom').valor).toBeNull();
  });
});
