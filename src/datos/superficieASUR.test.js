import {describe,it,expect} from 'vitest';
import {calcularSuperficieASUR} from './superficieASUR.js';
import {construirCatalogoCompras} from './catalogoComprasEfectivo.js';
const refs=[
{id:'solid-surface-azul',nombre:'ASUR superficie azul 12 mm',unidad_costeo:'m2',seccion:'cubiertas',activo:true},
{id:'solid-surface',nombre:'Superficie sólida 12 mm',unidad_costeo:'m2',seccion:'cubiertas',activo:true},
{id:'adhesivo-solid-surface',nombre:'Adhesivo igualado',unidad_costeo:'pza',seccion:'cubiertas',activo:true},
];
const ins=construirCatalogoCompras({},refs,[],[]).insumos;
describe('ASUR: área REAL por módulo a partir de las caras medibles',()=>{
it('cubierta 1.20x0.60 = 0.72 m² × 3800 + cartucho 1050',()=>{
const r=calcularSuperficieASUR([
{insumoId:'solid-surface-azul',nombre:'Cubierta',largoMM:1200,anchoMM:600,piezas:1},
{insumoId:'adhesivo-solid-surface',nombre:'Adhesivo',cantidad:1}],ins);
expect(r.areaTotalM2).toBeCloseTo(.72);
expect(r.costoSuperficie).toBeCloseTo(2736);
expect(r.totalConocido).toBeCloseTo(3786);
expect(r.costoMaterialConAdhesivoPorM2).toBeCloseTo(3786/.72);
expect(r.incluyeMerma).toBe(false);
});
it('frente y cantos se suman solo si el BOM los trae, sin duplicar cubierta',()=>{
const r=calcularSuperficieASUR([
{insumoId:'solid-surface-azul',largoMM:2000,anchoMM:600,piezas:1},
{insumoId:'solid-surface-azul',largoMM:2000,anchoMM:150,piezas:1},
{insumoId:'solid-surface-azul',largoMM:600,anchoMM:150,piezas:2}],ins);
expect(r.areaTotalM2).toBeCloseTo(1.68);
expect(r.costoSuperficie).toBeCloseTo(1.68*3800);
});
it('cantidad de 2 módulos multiplica área y adhesivo, sin suponer merma',()=>{
const r=calcularSuperficieASUR([{insumoId:'solid-surface-azul',largoMM:1000,anchoMM:500,piezas:1},
{insumoId:'adhesivo-solid-surface',cantidad:1}],ins,2);
expect(r.areaTotalM2).toBe(1);
expect(r.cartuchos).toBe(2);
expect(r.totalConocido).toBe(1*3800+2*1050);
});
it('si falta una cota no completa precio ni crea m2 fantasma',()=>{
const r=calcularSuperficieASUR([{insumoId:'solid-surface-azul',largoMM:1200,anchoMM:0}],ins);
expect(r.haySuperficie).toBe(true);
expect(r.areaTotalM2).toBe(0);
expect(r.pendientes).toHaveLength(1);
expect(r.costoMaterialConAdhesivoPorM2).toBe(null);
});
it('MDF y HPL nunca cuentan como superficie sólida ASUR',()=>{
const r=calcularSuperficieASUR([{insumoId:'mdf',largoMM:1400,anchoMM:900}],ins);
expect(r.haySuperficie).toBe(false);
});
it('precio registrado real posterior reemplaza tarifa de mercado',()=>{
const p={id:88,insumo_id:'solid-surface-azul',precio:3550,precio_compra:3550,unidad_compra:'m2',factor_conversion:1,estado:'propuesto_validado',evidence_status:'documentada',source_document:'OC-ASUR',source_record_id:'SKU-A1'};
const mercado=construirCatalogoCompras({},refs,[p],[]).insumos;
const r=calcularSuperficieASUR([{insumoId:'solid-surface-azul',largoMM:1000,anchoMM:1000}],mercado);
expect(r.costoSuperficie).toBe(3550);
});
});