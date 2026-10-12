import { describe,it,expect } from 'vitest';
import { optimizarCorte2D } from '../motor/optimizacionCorte.js';
import { analizarProductoIndustrial } from './analisisIndustrial.js';
import { contextoCatalogoParaIA } from '../voni/conocimiento.js';
import { responder } from '../voni/nucleo.js';

describe('ingeniería industrial · VONI no toca el costo oficial',()=>{
  it('expone retazos reutilizables sin certificarlos como ahorro',()=>{
    const opt=optimizarCorte2D({
      componentes:[{nombre:'Cubierta',insumoId:'m',largoMM:1000,anchoMM:500,piezas:1}],
      formato:{largoMM:2440,anchoMM:1220},
      kerfMM:6,recorteOrillaMM:10,lote:1,
    });
    expect(opt.disponible).toBe(true);
    expect(opt.remanentes.length).toBeGreaterThan(0);
    expect(opt.advisory).toBe(true);
    expect(opt.certificable).toBe(false);
  });

  it('microajustes de nesting son advisory y requieren validación de Diseño',()=>{
    const bom=[
      {nombre:'A',insumoId:'m',largoMM:1210,anchoMM:600,piezas:1,procedencia:'VISIBLE_EN_PLANO'},
      {nombre:'B',insumoId:'m',largoMM:1210,anchoMM:600,piezas:1,procedencia:'VISIBLE_EN_PLANO'},
    ];
    const opt=optimizarCorte2D({componentes:bom,formato:{largoMM:2440,anchoMM:1220},veta:false,kerfMM:6,recorteOrillaMM:10,lote:1});
    expect(opt.hojas).toBeGreaterThan(1);
    const r=analizarProductoIndustrial({
      bom,
      costing:{
        piezas:1,costoUnitario:1000,componentesIgnorados:[],tarifasFaltantes:[],
        formulaCosteo:'ALBA_V1',modeloCosteo:'clasico',mermaProcesoPct:0,
        parametrosCorte:{kerfMM:6,recorteOrillaMM:10,aprovechamientoCorte:80},
        detalleInsumos:[{
          insumoId:'m',nombre:'Melamina prueba',formato:{largoMM:2440,anchoMM:1220},
          veta:false,precio:1000,optimizacionCorte:opt,pct:50,desperdicio:500,
          metodoConsumo:'RENDIMIENTO_GEOMETRICO',usaAprovechamientoGenerico:false,
        }],
      },
    });
    const m=r.recomendaciones.find(x=>x.tipo==='MICROAJUSTE_NESTING');
    expect(m).toBeTruthy();
    expect(m.ahorro_certificado).toBe(false);
    expect(m.evidencia.requiere_validacion_diseno).toBe(true);
    expect(r.matematica.formula_oficial).toBe('ALBA_V1');
  });

  it('señala el 80% genérico como supuesto cuando falta geometría real',()=>{
    const r=analizarProductoIndustrial({
      bom:[{nombre:'Pieza',insumoId:'m',cantidad:1,procedencia:'CONFIRMADO_USUARIO'}],
      costing:{
        piezas:1,costoUnitario:100,componentesIgnorados:[],tarifasFaltantes:[],
        formulaCosteo:'ALBA_V1',modeloCosteo:'clasico',mermaProcesoPct:0,
        parametrosCorte:{kerfMM:6,recorteOrillaMM:10,aprovechamientoCorte:80},
        detalleInsumos:[{insumoId:'m',nombre:'Material',usaAprovechamientoGenerico:true,desperdicio:0,pct:0}],
      },
    });
    expect(r.matematica.supuestos.some(x=>x.code==='APROVECHAMIENTO_GENERICO')).toBe(true);
  });
});

describe('VONI · conocimiento enorme sin inflar el Council',()=>{
  it('envía índice completo y detalle sólo de candidatos',()=>{
    const k=contextoCatalogoParaIA('mampara cristal privacidad');
    expect(k.catalogo_lineas.length).toBeGreaterThanOrEqual(20);
    expect(k.candidatos_detalle.length).toBeLessThanOrEqual(10);
    expect(JSON.stringify(k).length).toBeLessThan(100000);
  });

  it('combina catálogo canónico y Producto Maestro sin campos undefined',async()=>{
    const prov={
      get_catalog_knowledge:async()=>({
        principios:['real'],
        recomendaciones:[{ruta:'privacy4',linea:'Privacy 4',que:'privacidad',productos:[{id:'p4',nombre:'Mampara Privacy'}]}],
        a_la_medida_disponible:true,
      }),
      search_products:async()=>[{id:99,nombre:'MAMPARA DE CRISTAL',codigo:'VH99',familia:'PRIVACY_4'}],
    };
    const r=await responder({query:'qué mampara de cristal me sirve',ctx:{user:{email:'t@vh.test'},role:'ventas'},prov});
    expect(r.respuesta.que_paso).toMatch(/Privacy 4/);
    expect(String(r.respuesta.por_que)).toMatch(/MAMPARA DE CRISTAL/);
    expect(JSON.stringify(r)).not.toContain('undefined');
  });
});
