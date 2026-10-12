import {describe,it,expect} from 'vitest';
import {normalizarMaterialIntelisis,normalizarOperacionIntelisis,normalizarBomIntelisis} from './intelisisAdapter.js';

describe('Intelisis read-only contract',()=>{
  it('no convierte una fila sin evidencia en precio verificado',()=>{
    const x=normalizarMaterialIntelisis({clave_erp:'MAT-1',precio:100,unidad_compra:'hoja',vigencia:'2026-10-05'});
    expect(x.evidence_status).toBe('incompleta');
    expect(x.issues).toContain('FALTA_EVIDENCIA');
  });
  it('preserva MO y GIF por hora como conceptos distintos',()=>{
    const x=normalizarOperacionIntelisis({producto:'P1',operacion:'Corte',centro:'Madera',horas:2,tarifa_mo_hora:54.55,tarifa_gif_hora:190.82});
    expect(x.tarifa_mo_hora).toBe(54.55);
    expect(x.tarifa_gif_hora).toBe(190.82);
  });
  it('rechaza BOM sin unidad de consumo',()=>{
    const x=normalizarBomIntelisis({producto:'P1',componente:'Cubierta',clave_material:'MAT-1',cantidad:1});
    expect(x.evidence_status).toBe('incompleta');
    expect(x.issues).toContain('FALTA_UNIDAD_CONSUMO');
  });
});


  it('unidad de compra distinta a consumo exige conversión positiva',()=>{
    const x=normalizarMaterialIntelisis({
      clave_erp:'LAM-1', precio:1200, unidad_compra:'kg', unidad_consumo:'hoja',
      vigencia:'2026-10-05', evidencia:'OC-9'
    });
    expect(x.evidence_status).toBe('incompleta');
    expect(x.issues).toContain('FALTA_CONVERSION_UNIDAD');
  });

  it('BOM ERP sin versión/evidencia/merma nunca queda verificado',()=>{
    const x=normalizarBomIntelisis({
      producto:'P1', componente:'Cubierta', clave_material:'MAT-1',
      cantidad:1, unidad_consumo:'hoja'
    });
    expect(x.evidence_status).toBe('incompleta');
    expect(x.issues).toEqual(expect.arrayContaining(['FALTA_VERSION_RECETA','FALTA_EVIDENCIA','FALTA_MERMA']));
  });

  it('BOM ERP completo sí puede quedar verificado',()=>{
    const x=normalizarBomIntelisis({
      producto:'P1', version_receta:'R3', componente:'Cubierta', clave_material:'MAT-1',
      cantidad:1, unidad_consumo:'hoja', merma_pct:5, evidencia:'EXP-778'
    });
    expect(x.evidence_status).toBe('verificada');
    expect(x.issues).toEqual([]);
  });
