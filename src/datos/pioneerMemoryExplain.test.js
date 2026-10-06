import { describe, it, expect } from 'vitest';
import { explicarCosteo } from './explicacionCosteo.js';
import { construirPrecedentesCosteo } from './precedentesCosteo.js';
import { ejecutarTool, toolsParaRol } from '../voni/tools.js';
import fs from 'node:fs';

describe('Explicabilidad de costeo · no crea un segundo motor',()=>{
  it('repite al centavo los números ya calculados y deja la fórmula visible',()=>{
    const r={
      piezas:2,formulaCosteo:'ALBA_V1',modeloCosteo:'clasico',
      materialDirecto:1000.11,materialIndirecto:200.22,materialTotal:1200.33,
      manoObra:240.07,preparacion:50.05,empaque:20.02,
      indirectosFabrica:720.21,gastosOperacion:0,costoFabricacion:2230.68,
      costoLote:2230.68,costoLoteConMerma:2230.68,costoUnitario:1115.34,
      mermaProcesoPct:0,parametrosCorte:{kerfMM:6,recorteOrillaMM:10,aprovechamientoCorte:80},
      detalleInsumos:[{insumoId:'m1',nombre:'MDF',seccion:'cubiertas',metodoConsumo:'RENDIMIENTO_GEOMETRICO',tipoAlbaAplicado:'cubierta',costo:1000.11,desperdicio:100,pct:10}],
      componentesIgnorados:[],tarifasFaltantes:[],
    };
    const e=explicarCosteo(r,{nombre:'Prueba'});
    expect(e.matematicas.material_total).toBe(1200.33);
    expect(e.matematicas.mano_obra).toBe(240.07);
    expect(e.matematicas.indirectos_fabrica).toBe(720.21);
    expect(e.matematicas.costo_unitario).toBe(1115.34);
    expect(e.formula).toBe('ALBA_V1');
    expect(e.nota).toMatch(/No recalcula/i);
  });

  it('expone supuesto de aprovechamiento genérico en vez de ocultarlo',()=>{
    const e=explicarCosteo({
      costoUnitario:100,materialTotal:60,manoObra:10,indirectosFabrica:30,
      parametrosCorte:{aprovechamientoCorte:80},
      detalleInsumos:[{insumoId:'x',nombre:'Material X',costo:60,usaAprovechamientoGenerico:true}],
    });
    expect(e.supuestos.join(' ')).toMatch(/80%/);
  });
});

describe('Memoria de precedentes · aprende sólo de verdad defendible',()=>{
  const actual=[
    {nombre:'Cubierta nogal',insumoId:'mdf-nogal'},
    {nombre:'Pata acero',insumoId:'ptr'},
  ];
  const base={id:1,expediente_id:1,rev:2,nombre:'Escritorio previo',creado:'2026-10-01',bom:[
    {nombre:'Cubierta nogal',insumoId:'mdf-nogal'},
    {nombre:'Pata acero',insumoId:'ptr'},
  ]};

  it('NO convierte null en costo cero ni aprende de revisiones incompletas',()=>{
    const rows=[
      {...base,costo:{estado_costo:'completo',costoUnitario:null}},
      {...base,id:2,costo:{estado_costo:'incompleto',costoUnitario:999}},
    ];
    expect(construirPrecedentesCosteo(actual,rows,[])).toEqual([]);
  });

  it('acepta una revisión completa o economía oficial y la etiqueta como precedente',()=>{
    const rows=[
      {...base,id:3,producto_version_id:77,costo:{estado_costo:'incompleto',costoUnitario:123}},
      {...base,id:4,producto_version_id:null,costo:{estado_costo:'completo',costoUnitario:456.78,formula_version:'ALBA_V1'}},
    ];
    const ecos=[{producto_version_id:77,costo_oficial_referencia:500.12,formula_version:'ALBA_V1',fuente:'TDC'}];
    const out=construirPrecedentesCosteo(actual,rows,ecos);
    expect(out.length).toBe(2);
    expect(out.some(x=>x.costo_oficial===500.12&&x.fuente==='TDC')).toBe(true);
    expect(out.some(x=>x.costo_oficial===456.78&&x.fuente==='expediente_revision_completa')).toBe(true);
  });

  it('prioriza similitud de materiales/nombres y no declara autoridad',()=>{
    const rows=[
      {...base,id:5,costo:{estado_costo:'completo',costoUnitario:400}},
      {...base,id:6,nombre:'Locker distinto',bom:[{nombre:'Puerta locker',insumoId:'lamina'}],costo:{estado_costo:'completo',costoUnitario:900}},
    ];
    const out=construirPrecedentesCosteo(actual,rows,[]);
    expect(out[0].revision_id).toBe(5);
    expect(out[0].similitud).toBeGreaterThan(0.9);
  });
});

describe('Memoria económica · permisos',()=>{
  it('ventas nunca recibe la tool; Diseño/Dirección/Costeador/CFO sí',()=>{
    expect(toolsParaRol('ventas')).not.toContain('get_costing_precedents');
    for(const r of ['diseno','direccion','costeador','cfo']) expect(toolsParaRol(r)).toContain('get_costing_precedents');
  });

  it('la capa de tools bloquea un vendedor aunque exista un proveedor',async()=>{
    const r=await ejecutarTool('get_costing_precedents',{user:{id:'u'},role:'ventas'}, {}, {
      get_costing_precedents:async()=>({precedentes:[{costo_oficial:123}]})
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('sin_permiso');
  });

  it('los precedentes económicos no se guardan en aprendizajes seller-readable',()=>{
    const s=fs.readFileSync('src/voni/proveedorReal.js','utf8');
    const i=s.indexOf('get_costing_precedents:');
    const b=s.slice(i,s.indexOf('get_material_technical:',i));
    expect(b).toContain("from('expediente_revisiones')");
    expect(b).toContain("from('producto_version_economia')");
    expect(b).not.toContain("from('aprendizajes')");
  });
});

describe('UX explicable en Costear y Cocrear',()=>{
  it('ambas superficies muestran cómo se obtuvo el costo',()=>{
    const a=fs.readFileSync('src/componentes/Costeador.jsx','utf8');
    const b=fs.readFileSync('src/componentes/CocrearV3.jsx','utf8');
    expect(a).toContain('Así calculé este mueble');
    expect(a).toContain('explicacionCosteo');
    expect(b).toContain('Cómo llegó VONI a este costo');
    expect(b).toContain('explicacionCosteo');
  });
});
