// ============================================================================
// ANALISIS INDUSTRIAL · revisión determinista de BOM/costeo para VONI.
//
// NO inventa costos ni geometría. Convierte señales de los motores ya existentes
// en hallazgos accionables: evidencia, fabricabilidad, merma, corte y eficiencia.
// Los ahorros del nesting son POTENCIALES/ADVISORY hasta validación de Producción.
// ============================================================================
import { auditarEvidenciaBOM } from './evidencia.js';
import { diagnosticoDesarrolloProducto } from './desarrolloProducto.js';

const n=(x)=>Number.isFinite(Number(x))?Number(x):null;
const pct=(x)=>n(x)==null?null:Math.round(n(x)*10)/10;

export function analizarProductoIndustrial({bom=[],costing=null}={}){
  const componentes=Array.isArray(bom)?bom:[];
  const evidencia=auditarEvidenciaBOM(componentes);
  const desarrollo=diagnosticoDesarrolloProducto({ componentes });
  const detalles=Array.isArray(costing?.detalleInsumos)?costing.detalleInsumos:[];
  const hallazgos=[];
  const bloqueos=[];
  const recomendaciones=[];

  if(!componentes.length){
    bloqueos.push({code:'SIN_BOM',titulo:'Sin BOM',detalle:'No existe un despiece técnico que permita revisar fabricación.'});
  }

  for(const issue of evidencia.issues||[]){
    if(issue.code==='MATERIAL_NO_CONFIRMADO'){
      bloqueos.push({code:issue.code,titulo:'Material no confirmado',detalle:`${issue.nombre}: falta insumo/material canónico.`});
    }else{
      bloqueos.push({code:issue.code,titulo:'Evidencia técnica pendiente',detalle:`${issue.nombre}: ${issue.procedencia||'UNKNOWN'} no sostiene certificación.`});
    }
  }

  let areaComprada=0,areaNeta=0,desperdicioCosto=0;
  for(const d of detalles){
    const nombre=d?.nombre||d?.insumoId||'Material';
    if(d?.noCabe){
      bloqueos.push({
        code:'PIEZA_NO_CABE',
        titulo:'Pieza fuera de formato',
        detalle:`${nombre}: una o más piezas no caben en el formato de compra actual.`,
      });
      recomendaciones.push({
        tipo:'FABRICABILIDAD',
        prioridad:'ALTA',
        accion:`Revisar formato comercial, unión o rediseño de ${nombre}; no autorizar precio hasta resolver.`,
        confianza:1,
        ahorro_certificado:false,
      });
    }

    const opt=d?.optimizacionCorte;
    if(opt?.disponible){
      const ef=pct(opt.eficiencia_pct);
      hallazgos.push({
        tipo:'CORTE_2D',material:nombre,eficiencia_pct:ef,
        completo:opt.completo===true,certificable:opt.certificable===true,
        advisory:opt.advisory===true,hojas:opt.hojas??null,
      });
      if(opt.completo===false){
        bloqueos.push({code:'NESTING_INCOMPLETO',titulo:'Nesting incompleto',detalle:`${nombre}: no todas las piezas pudieron colocarse.`});
      }else if(ef!=null&&ef<70){
        recomendaciones.push({
          tipo:'EFICIENCIA_CORTE',prioridad:ef<55?'ALTA':'MEDIA',
          accion:`Revisar nesting/formato de ${nombre}; eficiencia advisory ${ef}%.`,
          confianza:.9,ahorro_certificado:false,
        });
      }
      areaComprada+=n(opt.area_comprada_mm2)||0;
      areaNeta+=n(opt.area_piezas_mm2)||0;
    }

    const waste=n(d?.desperdicio);
    if(waste!=null&&waste>0) desperdicioCosto+=waste;
    const dp=pct(d?.pct);
    if(dp!=null&&dp>30){
      recomendaciones.push({
        tipo:'MERMA',prioridad:dp>45?'ALTA':'MEDIA',
        accion:`Revisar consumo/formato de ${nombre}; desperdicio calculado ${dp}%.`,
        confianza:.9,ahorro_certificado:false,
      });
    }
  }

  for (const o of desarrollo.oportunidades || []) {
    recomendaciones.push({
      tipo: o.tipo,
      prioridad: o.prioridad,
      accion: o.recomendacion,
      confianza: o.confianza,
      evidencia: o.evidencia,
      ahorro_certificado: false,
    });
  }

  const ignorados=Array.isArray(costing?.componentesIgnorados)?costing.componentesIgnorados:[];
  for(const x of ignorados){
    bloqueos.push({code:'COSTO_FALTANTE',titulo:'Componente sin costo',detalle:String(x)});
  }

  const eficienciaGlobal=areaComprada>0?pct((areaNeta/areaComprada)*100):null;
  const costo=n(costing?.costoUnitario);
  const costoValido=costo!=null&&costo>=0&&!ignorados.length&&!detalles.some(d=>d?.noCabe);

  // Dedup determinista.
  const dedup=(xs,key)=>xs.filter((x,i,a)=>a.findIndex(y=>key(y)===key(x))===i);
  const b=dedup(bloqueos,x=>`${x.code}|${x.detalle}`);
  const rec=dedup(recomendaciones,x=>`${x.tipo}|${x.accion}`);

  return {
    estado:b.length?'ATENCION':'OK',
    costo_emitible:costoValido,
    evidencia_bom:evidencia.estado,
    cobertura_bom:{
      total:componentes.length,
      certificable:evidencia.certificable,
      issues:(evidencia.issues||[]).length,
    },
    desarrollo_producto: desarrollo,
    eficiencia:{
      corte_2d_global_pct:eficienciaGlobal,
      desperdicio_costo_calculado:desperdicioCosto,
      // explícito: este número NO es ahorro.
      ahorro_certificado:null,
      optimizacion_advisory:true,
    },
    hallazgos,
    bloqueos:b,
    recomendaciones:rec,
    politica:'IA recomienda; motores deterministas validan; ahorro sólo CERTIFIED con evidencia de Producción.',
  };
}
