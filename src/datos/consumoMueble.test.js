import {describe,it,expect} from 'vitest';
import {auditarConsumoMueble} from './consumoMueble.js';
import {calcular, PARAMETROS_DEFAULT} from '../motor/calculo.js';
const ins={
 azul:{id:'azul',nombre:'Superficie sólida ASUR azul',seccion:'cubiertas',unidad:'m2',precio:3800,mermaCorte:0},
 placa:{id:'placa',nombre:'Melamina 19mm',seccion:'cubiertas',unidad:'hoja',precio:600,
  formato:{tipo:'tablero',medida:2.9768,largoMM:2440,anchoMM:1220},fraccion:true,mermaCorte:6},
 lamina:{id:'lamina',nombre:'Lámina cal.14',seccion:'metal',unidad:'hoja',precio:800,
  formato:{tipo:'lamina',medida:44.4,largoMM:3048,anchoMM:914},fraccion:true},
 bisagra:{id:'bisagra',nombre:'Bisagra',seccion:'herrajes',unidad:'pza',precio:25},
};
describe('medición universal BOM = piezas físicas × medidas, dinero sólo del motor',()=>{
it('módulo 1.2x0.6 m superficie sólida ASUR obtiene 0.72m² y $2736',()=>{
const cs=[{nombre:'Cubierta ASUR',insumoId:'azul',forma:'area',largoMM:1200,anchoMM:600,piezas:1}];
const res=calcular({componentes:cs},1,ins,PARAMETROS_DEFAULT);
const a=auditarConsumoMueble({componentes:cs,insumos:ins,resultado:res});
expect(a.areaNetaM2).toBeCloseTo(.72);expect(a.grupos[0].costoMotor).toBeCloseTo(2736);
expect(a.totales.costoMaterialPorM2).toBeCloseTo(3800);
});
it('melamina $600/HOJA jamás se multiplica por m²: conserva costo real del motor',()=>{
const cs=[{nombre:'Cubierta',insumoId:'placa',forma:'area',largoMM:1200,anchoMM:600,piezas:1}];
const res=calcular({componentes:cs},1,ins,PARAMETROS_DEFAULT);
const a=auditarConsumoMueble({componentes:cs,insumos:ins,resultado:res});
expect(a.grupos[0].costoNetoTeorico).toBe(null);
expect(a.grupos[0].costoMotor).toBeCloseTo(res.detalleInsumos[0].costo);
expect(a.areaNetaM2).toBeCloseTo(.72);
});
it('no confunde hoja de lamina peso kg con m²; calcula geometría separada',()=>{
const cs=[{nombre:'Frente',insumoId:'lamina',forma:'area',largoMM:2400,anchoMM:150,piezas:1,hojas:.5}];
const res=calcular({componentes:cs},1,ins,PARAMETROS_DEFAULT);
const a=auditarConsumoMueble({componentes:cs,insumos:ins,resultado:res});
expect(a.areaNetaM2).toBeCloseTo(.36);expect(a.grupos[0].costoMotor).toBeCloseTo(400);
expect(a.grupos[0].costoNetoTeorico).toBe(null);
});
it('piezas lineales y bisagras no se suman a los m² desarrollados',()=>{
const a=auditarConsumoMueble({componentes:[{nombre:'Bisagras',insumoId:'bisagra',cantidad:4}],insumos:ins});
expect(a.areaNetaM2).toBe(0);expect(a.grupos).toHaveLength(0);
});
it('una medida faltante no se convierte a m² gratis ni asume formato',()=>{
const a=auditarConsumoMueble({componentes:[{nombre:'Frente desconocido',insumoId:'azul',forma:'area',largoMM:1000,anchoMM:0}],insumos:ins});
expect(a.pendientes).toHaveLength(1);expect(a.valido).toBe(false);
});
it('lote de tres módulos multiplica superficies pero no cambia precio unitario del insumo',()=>{
const cs=[{nombre:'Cubierta',insumoId:'azul',forma:'area',largoMM:1000,anchoMM:500,piezas:2}];
const a=auditarConsumoMueble({componentes:cs,insumos:ins,lote:3});
expect(a.areaNetaM2).toBe(3);expect(a.grupos[0].piezas).toBe(6);
});
it('si el material no está vinculado se muestra pendiente, no costo $0',()=>{
const a=auditarConsumoMueble({componentes:[{nombre:'Desconocido',insumoId:'inexistente',forma:'area',largoMM:1000,anchoMM:1000}],insumos:ins});
expect(a.valido).toBe(false);expect(a.pendientes[0]).toMatch(/falta insumo/);
});
it('sin detalle del motor un precio por hoja no inventa subtotal',()=>{
const cs=[{nombre:'Cubierta',insumoId:'placa',forma:'area',largoMM:1200,anchoMM:600,piezas:1}];
const a=auditarConsumoMueble({componentes:cs,insumos:ins});
expect(a.grupos[0].costoMotor).toBe(null);expect(a.pendientes.join(' ')).toMatch(/motor/);
});
});