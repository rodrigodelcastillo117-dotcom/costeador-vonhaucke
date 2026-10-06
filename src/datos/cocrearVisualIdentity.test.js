import {describe,it,expect} from 'vitest';
import {construirProductSpec} from './cocrear.js';
import {visualRevisionHash} from './visualRevision.js';
import {modeloTecnico3DDesdeSpec} from './productModel3D.js';

const clasif={clasificacion:'NEW_SPECIAL',parent_product_id:null,parent_product_version:null,change_set:[]};
const dna={tono:'medio',nivel:'medio',forma:'recta',estilo:'corporativo'};

describe('Cocrear concept identity contract',()=>{
  it('ProductSpec conserva concepto/layout/tipología',()=>{
    const intent={
      familia:'mesa',_concepto:'B',_concepto_nombre:'Módulos',_concepto_layout:'modulos',
      tipologia_cocrear:'operativo_colaborativo',
      dimensiones:{ancho_mm:2400,prof_mm:1200,alto_mm:750},
      materiales:[],acabados:[],caracteristicas:[],capacidad:{personas:8},
    };
    const s=construirProductSpec(intent,dna,clasif,{componentes:[]});
    expect(s).toMatchObject({concepto:'B',layout_conceptual:'modulos',tipologia_cocrear:'operativo_colaborativo'});
  });

  it('modelo técnico lleva exactamente la firma visual del spec',()=>{
    const intent={
      familia:'mesa',_concepto:'A',_concepto_layout:'isla',tipologia_cocrear:'operativo_colaborativo',
      dimensiones:{ancho_mm:1200,prof_mm:600,alto_mm:750},
      materiales:[],acabados:[],caracteristicas:[],capacidad:{personas:4},
    };
    const s=construirProductSpec(intent,dna,clasif,{componentes:[
      {nombre:'Cubierta',insumoId:'mdf',largoMM:1200,anchoMM:600,espesorMM:18,piezas:1}
    ]});
    const m=modeloTecnico3DDesdeSpec(s);
    expect(m.visualRevisionHash).toBe(visualRevisionHash(s));
  });
});
