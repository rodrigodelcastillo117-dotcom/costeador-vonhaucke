import {describe,it,expect} from 'vitest';
import {modeloTecnico3DDesdeSpec,solidsHastaEtapa,MODEL3D_STATUS} from './productModel3D.js';

describe('ProductModel3D · BOM truth only',()=>{
  it('sin BOM no inventa un modelo técnico',()=>{
    const r=modeloTecnico3DDesdeSpec({});
    expect(r.status).toBe(MODEL3D_STATUS.NONE);
    expect(r.solids).toEqual([]);
  });

  it('sin espesor explícito la pieza queda pendiente, no asume 18 mm',()=>{
    const r=modeloTecnico3DDesdeSpec({componentes:[{nombre:'Cubierta',largoMM:1200,anchoMM:600,piezas:1}]});
    expect(r.status).toBe(MODEL3D_STATUS.NONE);
    expect(r.issues[0].faltan).toContain('espesor/alto');
  });

  it('BOM completo genera vista explotada determinista',()=>{
    const spec={componentes:[
      {nombre:'Pata PTR',largoMM:700,anchoMM:40,espesorMM:40,piezas:2,semantic_role:'pata'},
      {nombre:'Cubierta',largoMM:1200,anchoMM:600,espesorMM:28,piezas:1,semantic_role:'cubierta'},
    ]};
    const a=modeloTecnico3DDesdeSpec(spec),b=modeloTecnico3DDesdeSpec(spec);
    expect(a.status).toBe(MODEL3D_STATUS.EXPLODED_READY);
    expect(a.solids).toEqual(b.solids);
    expect(a.representation).toBe('EXPLODED_NOT_ASSEMBLED');
    expect(a.solids).toHaveLength(3);
  });

  it('4D preliminar revela únicamente etapas <= actual',()=>{
    const r=modeloTecnico3DDesdeSpec({componentes:[
      {nombre:'Pata',largoMM:700,anchoMM:40,espesorMM:40,piezas:1,semantic_role:'pata'},
      {nombre:'Cubierta',largoMM:1200,anchoMM:600,espesorMM:28,piezas:1,semantic_role:'cubierta'},
      {nombre:'Módulo eléctrico',largoMM:300,anchoMM:80,espesorMM:50,piezas:1,semantic_role:'electrico'},
    ]});
    expect(solidsHastaEtapa(r,1)).toHaveLength(1);
    expect(solidsHastaEtapa(r,2)).toHaveLength(2);
    expect(solidsHastaEtapa(r,4)).toHaveLength(3);
    expect(r.certification).toBe('PRELIMINARY');
    expect(r.sequence_source).toBe('DERIVED');
  });
});
