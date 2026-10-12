import {describe,it,expect} from 'vitest';
import { calcularCosteoVivo, piezaVirtualDeCosteo, parametrosEfectivosCosteo } from './costeoVivo.js';
import { calcular, modeloParaPieza } from './calculo.js';

const estado={
  parametros:{ margenObjetivo:50, factorIndirectosFabrica:12, mermaProceso:5, empaquePorPieza:0 },
  insumos:{
    mdf:{id:'mdf',nombre:'MDF',seccion:'cubiertas',clase:'directa',unidad:'m2',precio:300,fraccion:true,mermaCorte:0},
  },
};
const costeo={
  nombre:'Mesa prueba', piezas:2, modoManoObra:'porcentaje',
  factorDirecta:null,factorIndirecta:null,preparacionHoras:0,
  horas:{pm:0,carpinteria:0,pintura:0,acabados:0,tapiceria:0},
  componentes:[{nombre:'Cubierta',insumoId:'mdf',cantidad:1,piezas:1,largoMM:1200,anchoMM:600}],
};

describe('costeo vivo canónico',()=>{
  it('coincide exactamente con la ejecución manual del mismo motor',()=>{
    const pieza=piezaVirtualDeCosteo(costeo);
    const base=parametrosEfectivosCosteo(estado,costeo);
    const {par}=modeloParaPieza(base,pieza);
    const manual=calcular(pieza,costeo.piezas,estado.insumos,par);
    const vivo=calcularCosteoVivo(estado,costeo);
    expect(vivo.resultado).toEqual(manual);
    expect(vivo.par).toEqual(par);
  });
  it('overrides de costeo pisan sólo los parámetros permitidos',()=>{
    const x=parametrosEfectivosCosteo(estado,{...costeo,mermaProceso:9});
    expect(x.mermaProceso).toBe(9);
    expect(x.margenObjetivo).toBe(50);
  });
});
