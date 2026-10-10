import {describe,it,expect} from 'vitest';
import {costearSpec,lineaCocreada} from './cocrear.js';
import {PARAMETROS_DEFAULT} from '../motor/calculo.js';
const producto={id:'asur-m1',familia:'recepcion',clasificacion:'NEW_SPECIAL',nombre:'Counter ASUR',
 componentes:[{nombre:'Cubierta ASUR azul',insumoId:'solid-surface-azul',forma:'area',largoMM:1200,anchoMM:600,piezas:1}]};
const base={id:'solid-surface-azul',nombre:'Superficie sólida azul ASUR',unidad:'m2',
 seccion:'cubiertas',clase:'directa',precio:3800,precioBase:3800,fuenteCatalogo:'compras',
 estadoEconomia:'ESTIMADO_AUTORIZADO_ASUR',precioCertificable:false};
describe('Cocrear: nunca oficializar estimaciones de Compras/ASUR',()=>{
it('ASUR tiene estimado calculado pero no costo oficial ni línea emitible',()=>{
 const r=costearSpec(producto,{'solid-surface-azul':base},PARAMETROS_DEFAULT);
 expect(r.estimated_amount).toBeGreaterThan(0);
 expect(r.official_cost).toBeNull();
 expect(r.unresolved_lines.join(' ')).toMatch(/validación de Compras/);
 const linea=lineaCocreada(producto,r);
 expect(linea.requiere_desarrollo).toBe(true);
 expect(linea.sinPrecioAutorizado).toBe(true);
});
it('un precio propuesto de compra también queda provisional, aunque venga de ERP',()=>{
 const r=costearSpec(producto,{'solid-surface-azul':{...base,estadoEconomia:'ERP_DOCUMENTADO',precio:3640,precioCertificable:false}},PARAMETROS_DEFAULT);
 expect(r.official_cost).toBeNull();
 expect(r.estimated_amount).toBeGreaterThan(0);
});
it('precio aprobado con material especificado conserva la ruta normal de costeo',()=>{
 const r=costearSpec(producto,{'solid-surface-azul':{...base,estadoEconomia:'APROBADO',precioCertificable:true}},PARAMETROS_DEFAULT);
 expect(r.official_cost).toBeGreaterThan(0);
 expect(r.unresolved_lines).toEqual([]);
});
});
