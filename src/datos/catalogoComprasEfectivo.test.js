import { describe, expect, it } from 'vitest';
import { construirCatalogoCompras, evaluarPrecioCompra, ordenarPrecios } from './catalogoComprasEfectivo.js';
import { calcular, PARAMETROS_DEFAULT, costoNetoComponente } from '../motor/calculo.js';

const item = (id, nombre, unidad_costeo='pza') => ({id,nombre,unidad_costeo,seccion:unidad_costeo==='hoja'?'cubiertas':'herrajes',activo:true});
const p = (id, data={}) => ({
  id:100,insumo_id:id,precio:65,precio_compra:65,factor_conversion:1,
  unidad_compra:'pza',estado:'propuesto_validado',evidence_status:'referenciada',
  confidence:'media',fuente:'Compras, lista 2026',vigente_hasta:null,...data,
});

describe('P0: integración real de catálogo Compras 259 → motor sin precios inventados', () => {
  it('incluye artículo comprado no presente en los 92 con su precio y procedencia', () => {
    const r = construirCatalogoCompras({ viejo:{id:'viejo',precio:10,unidad:'pza'} }, [
      item('nuevo','Bisagra industrial concreta','pza'),
    ], [p('nuevo',{precio:19.50,precio_compra:19.50})],[]);
    expect(r.insumos.nuevo.precio).toBe(19.5);
    expect(r.insumos.nuevo.nombre).toBe('Bisagra industrial concreta');
    expect(r.insumos.nuevo.codigoCompras).toBe('nuevo');
    expect(r.insumos.nuevo.fuenteCompra).toMatch(/Compras/);
    expect(r.insumos.nuevo.estadoEconomia).toBe('REFERENCIA_COMPRAS');
    expect(r.insumos.nuevo.precioCertificable).toBe(false);
    expect(r.insumos.viejo.precio).toBe(10);
    expect(r.stats.catalogo).toBe(1);
  });
  it('preserva clave ERP, documento, precio MXN y versión de evidencia', () => {
    const row=p('nivelador',{id:289,precio:17.73,precio_compra:17.73,estado:'propuesto',evidence_status:'documentada',
      contract_status:'DATA_TRUTH_V1',confidence:'alta',source_system:'intelisis',source_document:'APP_LT_Pedido_38247',
      source_record_id:'MVLUTO15188109',cost_unit:'pza',cost_unit_price_mxn:17.73,unidad_compra:'pieza'});
    const {insumos}=construirCatalogoCompras({},[item('nivelador','Tornillo nivelador cromado')],[row],[]);
    expect(insumos.nivelador.clavesERP).toContain('MVLUTO15188109');
    expect(insumos.nivelador.fuenteCompra).toBe('APP_LT_Pedido_38247');
    expect(insumos.nivelador.precio).toBe(17.73);
    expect(insumos.nivelador.estadoEconomia).toBe('ERP_DOCUMENTADO');
    expect(insumos.nivelador.precioCertificable).toBe(false);
  });
  it('preserva TODAS las versiones y prioriza precio documental ERP vs semilla', () => {
    const seed=p('lamina',{id:12,estado:'propuesto_validado',precio:850,precio_compra:850,unidad_compra:'hoja',evidence_status:'referenciada'});
    const truth=p('lamina',{id:287,estado:'propuesto',precio:816.48,precio_compra:816.48,unidad_compra:'hoja',
      evidence_status:'documentada',contract_status:'DATA_TRUTH_V1',source_system:'intelisis',
      source_document:'APP_LT_Pedido_38247',source_record_id:'MVLSLA05260202'});
    const {insumos}=construirCatalogoCompras({},[item('lamina','Lamina negra 3x10 cal. 14','hoja')],[seed,truth],[]);
    expect(insumos.lamina.precio).toBe(816.48);
    expect(insumos.lamina.versionesPrecio).toHaveLength(2);
    expect(insumos.lamina.formatoPendiente).toBe(true);
    expect(insumos.lamina.precioCertificable).toBe(false);
  });
  it('hoja sin formato: un área NO cuesta pero consumo explícito de 0.5 hoja sí', () => {
    const {insumos}=construirCatalogoCompras({},[item('hoja','Melamina nogal 16 mm','hoja')],
      [p('hoja',{precio:600,precio_compra:600,unidad_compra:'hoja'})],[]);
    const sinHojas=calcular({nombre:'Panel',componentes:[{insumoId:'hoja',nombre:'Panel',forma:'area',largoMM:1200,anchoMM:600,cantidad:1}]},1,insumos,PARAMETROS_DEFAULT);
    expect(sinHojas.componentesIgnorados.some(x=>x.includes('fracción de hoja'))).toBe(true);
    const conHojas=calcular({nombre:'Panel',componentes:[{insumoId:'hoja',nombre:'Panel',forma:'area',largoMM:1200,anchoMM:600,hojas:0.5}]},1,insumos,PARAMETROS_DEFAULT);
    expect(conHojas.materialTotal).toBeCloseTo(300,8);
    expect(costoNetoComponente({hojas:0.5},insumos.hoja)).toBeCloseTo(300,8);
    expect(conHojas.componentesIgnorados).toHaveLength(0);
  });
  it('líneas de insumo sin precio quedan a la vista pero NUNCA en $0 como si tuvieran precio', () => {
    const x=construirCatalogoCompras({},[item('sin','Superficie sólida','m2')],[],[]).insumos.sin;
    expect(x.disponibleCosteo).toBe(false);
    expect(x.precio).toBeUndefined();
    expect(x.estadoEconomia).toBe('SIN_PRECIO');
  });
  it('conversión kg → hoja requiere precio consistente con factor', () => {
    const ref=item('acero','Lamina acero cal.14','hoja');
    const valid=p('acero',{precio:816.48,precio_compra:18.3892,factor_conversion:44.4,unidad_compra:'kg'});
    const imp=p('acero',{precio:16,precio_compra:18.3892,factor_conversion:44.4,unidad_compra:'kg'});
    expect(evaluarPrecioCompra(valid,ref).aptoEstimacion).toBe(true);
    expect(evaluarPrecioCompra(imp,ref).estado).toBe('PRECIO_CONVERSION_CONFLICTO');
  });
  it('USD sin tasa MXN no se trata como costo MXN', () => {
    const ref=item('usd','Pintura','kg');
    expect(evaluarPrecioCompra(p('usd',{precio:6.69,precio_compra:6.69,unidad_compra:'kg'}),ref,{moneda:'USD'}).aptoEstimacion).toBe(false);
  });
  it('precio aprobado + evidencia no cambia el hecho de que unidad y uso físico se comprueban', () => {
    const approved=p('soldadura',{precio:65,precio_compra:65,unidad_compra:'kg',estado:'aprobado',
      evidence_status:'concordante',approved_at:'2026-10-01T00:00:00Z'});
    expect(evaluarPrecioCompra(approved,item('soldadura','Soldadura','kg')).cert).toBe(true);
    expect(evaluarPrecioCompra(approved,item('soldadura','Soldadura','hoja')).cert).toBe(false);
  });
  it('sin_evidencia queda visible y costeable como comparativo pero NUNCA certificado', () => {
    const econ=evaluarPrecioCompra(p('bisagra',{estado:'propuesto',evidence_status:'sin_evidencia'}),item('bisagra','Bisagra'));
    expect(econ.aptoEstimacion).toBe(true);
    expect(econ.estado).toBe('SIN_EVIDENCIA');
    expect(econ.cert).toBe(false);
  });
});
