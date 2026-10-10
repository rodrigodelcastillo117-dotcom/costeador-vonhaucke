import {describe,it,expect} from 'vitest';
import {calcular, costeoEmitible, PARAMETROS_DEFAULT} from './calculo.js';
const ins={
 acero:{id:'acero',nombre:'Lámina de acero cal.14',seccion:'metal',precio:816.48,
  unidad:'hoja',clase:'directa',fraccion:true,formato:{tipo:'lamina',medida:44.4,largoMM:3048,anchoMM:914}},
 azul:{id:'azul',nombre:'Superficie sólida azul ASUR 12 mm',seccion:'cubiertas',precio:3800,unidad:'m2',clase:'directa'},
};
describe('P0 dinero: geometría REAL ≠ peso/hojas inventados',()=>{
it('lámina con 2.4x0.15m NO se convierte en .36 kg por el motor',()=>{
const c={nombre:'Zócalo',insumoId:'acero',forma:'area',largoMM:2400,anchoMM:150,piezas:1,hojas:0};
const r=calcular({componentes:[c]},1,ins,PARAMETROS_DEFAULT);
expect(r.componentesIgnorados.join(' ')).toMatch(/fracción de hoja/);
expect(r.detalleInsumos).toHaveLength(0);
expect(costeoEmitible(r).emitible).toBe(false);
});
it('fracción real explícita de lámina se costea exactamente 0.50 hoja × $816.48',()=>{
const c={nombre:'Zócalo',insumoId:'acero',forma:'area',largoMM:2400,anchoMM:150,piezas:1,hojas:.5};
const r=calcular({componentes:[c]},1,ins,PARAMETROS_DEFAULT);
expect(r.materialTotal).toBeCloseTo(816.48*.5,2);
expect(r.componentesIgnorados).toHaveLength(0);
});
it('superficie sólida m2 usa las cotas, no requiere fracción de hoja',()=>{
const c={nombre:'Counter ASUR',insumoId:'azul',forma:'area',largoMM:2400,anchoMM:650,piezas:1};
const r=calcular({componentes:[c]},1,ins,PARAMETROS_DEFAULT);
expect(r.materialTotal).toBeCloseTo(2.4*.65*3800);
expect(r.componentesIgnorados).toHaveLength(0);
});
it('cantidad de piezas explícita cero en BOM nuevo NO produce costo como una',()=>{
const c={nombre:'Panel',insumoId:'azul',forma:'area',largoMM:1000,anchoMM:1000,piezas:0};
const r=calcular({componentes:[c]},1,ins,PARAMETROS_DEFAULT);
expect(r.componentesIgnorados.join(' ')).toMatch(/cantidad inválida/);
expect(costeoEmitible(r).emitible).toBe(false);
});
});