// ============================================================================
// ANALISIS INDUSTRIAL · revisión determinista de BOM/costeo para VONI.
//
// NO inventa costos ni geometría. Convierte señales de los motores ya existentes
// en hallazgos accionables: evidencia, fabricabilidad, merma, corte y eficiencia.
// Los ahorros del nesting son POTENCIALES/ADVISORY hasta validación de Producción.
// ============================================================================
import { auditarEvidenciaBOM } from './evidencia.js';
import { diagnosticoDesarrolloProducto } from './desarrolloProducto.js';
import { costeoEmitible } from '../motor/calculo.js';
import { optimizarCorte2D } from '../motor/optimizacionCorte.js';

const n=(x)=>x!=null&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
const pct=(x)=>n(x)==null?null:Math.round(n(x)*10)/10;

function microAjustesNesting(bom, d, lote=1){
  const base=d?.optimizacionCorte;
  const fmt=d?.formato||{};
  if(!base?.disponible||!base?.completo||!(base.hojas>1)||!(fmt.largoMM>0&&fmt.anchoMM>0)) return [];
  const comps=(bom||[]).filter((x)=>x?.insumoId===d.insumoId && Number(x?.largoMM)>100 && Number(x?.anchoMM)>100 && !(Number(x?.hojas)>0));
  if(!comps.length) return [];
  const out=[];
  for(let ci=0;ci<comps.length;ci++){
    for(const campo of ['largoMM','anchoMM']){
      const original=Number(comps[ci][campo]);
      for(const delta of [5,10,15,20,25]){
        if(original-delta<100) continue;
        const variante=comps.map((x,i)=>i===ci?{...x,[campo]:original-delta}:{...x});
        const r=optimizarCorte2D({
          componentes:variante,formato:fmt,veta:!!d?.veta,
          kerfMM:Number(costingParametros(d)?.kerfMM)||6,
          recorteOrillaMM:Number(costingParametros(d)?.recorteOrillaMM)||10,
          lote,
        });
        if(r?.completo&&r.hojas<base.hojas){
          out.push({
            componente:comps[ci].nombre||d.nombre,
            campo,de_mm:original,a_mm:original-delta,delta_mm:-delta,
            hojas_antes:base.hojas,hojas_despues:r.hojas,
            hojas_evitadas:base.hojas-r.hojas,
            valor_compra_referencia:Number.isFinite(Number(d.precio))?+(Number(d.precio)*(base.hojas-r.hojas)).toFixed(2):null,
            requiere_validacion_diseno:true,
          });
          break;
        }
      }
    }
  }
  return out.sort((a,b)=>b.hojas_evitadas-a.hojas_evitadas||Math.abs(a.delta_mm)-Math.abs(b.delta_mm)).slice(0,3);
}
function costingParametros(d){ return d?._parametrosCorte || {}; }

export function analizarProductoIndustrial({bom=[],costing=null}={}){
  const componentes=Array.isArray(bom)?bom:[];
  const evidencia=auditarEvidenciaBOM(componentes);
  const desarrollo=diagnosticoDesarrolloProducto({ componentes });
  const detalles=Array.isArray(costing?.detalleInsumos)?costing.detalleInsumos:[];
  const emision = costing ? costeoEmitible(costing) : null;
  const hallazgos=[];
  const bloqueos=[];
  const recomendaciones=[];

  if(!componentes.length){
    bloqueos.push({code:'SIN_BOM',titulo:'Sin BOM',detalle:'No existe un despiece técnico que permita revisar fabricación.'});
  }
  if(!costing){
    bloqueos.push({code:'SIN_COSTEO',titulo:'Sin costeo calculado',detalle:'Puedo revisar el BOM, pero no confirmar costo/margen hasta ejecutar el motor canónico.'});
  } else if(!emision?.emitible){
    if(emision?.bloqueos?.costo_invalido){
      bloqueos.push({code:'COSTO_INVALIDO',titulo:'Costo no emitible',detalle:'El motor canónico reporta un costo inválido/no finito.'});
    }
    for(const x of emision?.bloqueos?.formato_incompatible || []){
      bloqueos.push({code:'FORMATO_INCOMPATIBLE',titulo:'Formato incompatible',detalle:String(x)});
    }
  }

  for(const issue of evidencia.issues||[]){
    if(issue.code==='MATERIAL_NO_CONFIRMADO'){
      bloqueos.push({code:issue.code,titulo:'Material no confirmado',detalle:`${issue.nombre}: falta insumo/material canónico.`});
    }else{
      bloqueos.push({code:issue.code,titulo:'Evidencia técnica pendiente',detalle:`${issue.nombre}: ${issue.procedencia||'UNKNOWN'} no sostiene certificación.`});
    }
  }

  let areaComprada=0,areaNeta=0,desperdicioCosto=0;
  for(const d0 of detalles){
    const d={...d0,_parametrosCorte:costing?.parametrosCorte||{}};
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
      const rem=(opt.remanentes||[]).filter((r)=>Number(r.area_mm2)>=80000).slice(0,3);
      if(rem.length){
        recomendaciones.push({
          tipo:'RETASO_REUTILIZABLE',prioridad:'BAJA',
          accion:`Registrar/usar retazos de ${nombre}: ${rem.map((r)=>`${r.w}×${r.h} mm`).join(', ')} antes de abrir material nuevo.`,
          confianza:.9,ahorro_certificado:false,
          evidencia:{remanentes:rem},
        });
      }
      const micros=microAjustesNesting(componentes,d,Number(costing?.piezas)||1);
      for(const m of micros){
        recomendaciones.push({
          tipo:'MICROAJUSTE_NESTING',prioridad:'MEDIA',
          accion:`Explorar ${m.componente}: ${m.campo==='largoMM'?'largo':'ancho'} ${m.de_mm}→${m.a_mm} mm; el nesting advisory baja de ${m.hojas_antes} a ${m.hojas_despues} hoja(s).`,
          confianza:.85,ahorro_certificado:false,
          evidencia:m,
        });
      }
      areaComprada+=n(opt.area_comprada_mm2)||0;
      areaNeta+=n(opt.area_piezas_mm2)||0;
    }

    const opt1=d?.optimizacionCorte1D;
    if(opt1){
      if(opt1.disponible){
        const ef1=pct(opt1.eficiencia_pct);
        hallazgos.push({
          tipo:'CORTE_1D',material:nombre,eficiencia_pct:ef1,
          tramos:opt1.tramos??null,piezas:opt1.piezas_colocadas??null,
          advisory:true,
        });
        for(const issue of opt1.issues||[]){
          if(issue?.code==='PIEZA_NO_CABE'){
            bloqueos.push({
              code:'PIEZA_LINEAL_NO_CABE',
              titulo:'Corte lineal imposible',
              detalle:`${nombre}: ${issue.id||'una pieza'} mide ${issue.largo||'?'} mm y excede el tramo útil de ${issue.util_mm||'?'} mm.`,
            });
          }
        }
        if(ef1!=null&&ef1<80){
          recomendaciones.push({
            tipo:'EFICIENCIA_CORTE_1D',
            prioridad:ef1<65?'ALTA':'MEDIA',
            accion:`Revisar secuencia de corte/tramos de ${nombre}; eficiencia 1D advisory ${ef1}%.`,
            confianza:.95,ahorro_certificado:false,
          });
        }
      }else if((opt1.issues||[]).includes('SIN_PIEZAS_LINEALES')){
        recomendaciones.push({
          tipo:'DESPIECE_LINEAL',
          prioridad:'ALTA',
          accion:`Desglosar ${nombre} en largos por pieza; hoy sólo hay consumo agregado y no se puede optimizar el tramo de forma verificable.`,
          confianza:1,ahorro_certificado:false,
        });
      }
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

  const supuestos=[];
  for(const d of detalles){
    if(d?.usaAprovechamientoGenerico) supuestos.push({
      code:'APROVECHAMIENTO_GENERICO',material:d.nombre||d.insumoId,
      detalle:`Usa aprovechamiento genérico de ${costing?.parametrosCorte?.aprovechamientoCorte ?? 'N/D'}% porque falta geometría/fracción verificable.`,
    });
  }
  if(Number(costing?.mermaProcesoPct)>0) supuestos.push({
    code:'MERMA_GLOBAL',
    detalle:`La merma de proceso ${pct(costing.mermaProcesoPct)}% se aplica al costo completo como rendimiento global; es correcta sólo si representa pérdida equivalente de unidad completa.`,
  });
  if(Number(costing?.preparacion)>0 && costing?.formulaCosteo==='ALBA_V1') supuestos.push({
    code:'PREPARACION_COSTO_HORA',
    detalle:'Hay preparación por horas encima de Alba; validar que la tarifa/hora usada sea la autorizada de planta.',
  });

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
  const costoValido=!!(costing && emision?.emitible);

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
    matematica:{
      formula_oficial:costing?.formulaCosteo||null,
      modelo_costeo:costing?.modeloCosteo||null,
      merma_proceso_pct:n(costing?.mermaProcesoPct),
      parametros_corte:costing?.parametrosCorte||null,
      supuestos,
      lectura:'Alba/Rafa permanecen como costo oficial; nesting, retazos y microajustes son ingeniería advisory hasta validación de Producción.',
    },
    eficiencia:{
      corte_2d_global_pct:eficienciaGlobal,
      desperdicio_costo_calculado:desperdicioCosto,
      ahorro_certificado:null,
      optimizacion_advisory:true,
    },
    hallazgos,
    bloqueos:b,
    recomendaciones:rec,
    politica:'IA recomienda; motores deterministas validan; ahorro sólo CERTIFIED con evidencia de Producción.',
  };
}
