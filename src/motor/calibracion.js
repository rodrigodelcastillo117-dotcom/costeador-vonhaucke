import { calcular, costeoEmitible, precioVenta } from './calculo.js';

// Comparador de calibración certificable.
// No calcula ni inventa costos: compara una salida de la app contra una fuente
// externa aprobada (Alba / Rafa / Intelisis / orden cerrada) a nivel de centavos.

export const CAMPOS_COSTEO = [
  'materialTotal',
  'manoObra',
  'indirectosFabrica',
  'costoFabricacion',
  'costoTotal',
  'precio',
  'precioLista',
];

export function aCentavos(v) {
  if (v === null || v === undefined || v === '') return null;
  const n=Number(v);
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) : null;
}

export function evaluarGoldenCosteo(actual={}, esperado={}, opts={}) {
  const campos=Array.isArray(opts.campos)&&opts.campos.length?opts.campos:CAMPOS_COSTEO;
  const tolerancia=Math.max(0, Number(opts.toleranciaCentavos ?? 1));
  const resultados=campos.map(c=>{
    const a=aCentavos(actual[c]), e=aCentavos(esperado[c]);
    if(e===null) return {campo:c,estado:'SIN_GOLDEN',actual_centavos:a,esperado_centavos:null,delta_centavos:null};
    if(a===null) return {campo:c,estado:'SIN_ACTUAL',actual_centavos:null,esperado_centavos:e,delta_centavos:null};
    const d=a-e;
    return {campo:c,estado:Math.abs(d)<=tolerancia?'PASS':'FAIL',actual_centavos:a,esperado_centavos:e,delta_centavos:d};
  });
  const comparables=resultados.filter(r=>r.estado==='PASS'||r.estado==='FAIL');
  const faltantes=resultados.filter(r=>r.estado==='SIN_GOLDEN'||r.estado==='SIN_ACTUAL');
  const fallas=resultados.filter(r=>r.estado==='FAIL');
  return {
    certificable: comparables.length===campos.length && faltantes.length===0 && fallas.length===0,
    tolerancia_centavos:tolerancia,
    resultados,
    fallas,
    faltantes,
    max_abs_delta_centavos: comparables.length?Math.max(...comparables.map(r=>Math.abs(r.delta_centavos))):null,
  };
}

export function fuenteGoldenValida(f={}) {
  const tipo=String(f.tipo||'').toUpperCase();
  const permitidas=new Set(['ALBA','RAFA','INTELISIS','ORDEN_CERRADA']);
  return permitidas.has(tipo) && !!String(f.id||f.folio||'').trim() && !!String(f.fecha||'').trim();
}


const AREAS_COSTEO = ['pm','carpinteria','pintura','acabados','tapiceria','otros'];

function horasConTarifa(pieza={}, par={}) {
  const usadas=AREAS_COSTEO.filter(a=>Number(pieza?.horas?.[a])>0);
  if(!usadas.length) return {ok:false,issues:['SIN_HORAS_INTELISIS']};
  const issues=[];
  for(const a of usadas){
    if(!(Number(par?.costoHoraArea?.[a])>=0) || !(Number(par?.costoHoraGIF?.[a])>=0)) issues.push(`FALTA_TARIFA_${a.toUpperCase()}`);
  }
  return {ok:issues.length===0,issues,areas:usadas};
}

/**
 * Reconciliación NO PROMEDIA: calcula los dos métodos sólo cuando sus entradas
 * existen. "Alba" = fórmula de estimación; "Intelisis" = horas/tarifas/GIF.
 * Dirección decide cuál es autoritativo para emisión.
 */
export function calcularReconciliacionCosteo({pieza={},piezas=1,insumos={},parametros={},intelisisPar={}}={}) {
  const piezaAlba={...pieza,modoManoObra:'porcentaje'};
  delete piezaAlba.factorDirecta; delete piezaAlba.factorIndirecta;
  piezaAlba.modeloCosteo='clasico';
  const albaCalc=calcular(piezaAlba,piezas,insumos,{...parametros,modeloCosteo:'clasico'});
  const albaGate=costeoEmitible(albaCalc);
  const alba=albaGate.emitible
    ? {disponible:true,costo:albaCalc.costoUnitario,precio:precioVenta(albaCalc.costoUnitario,{...parametros,modeloCosteo:'clasico'}).precioLista,detalle:albaCalc}
    : {disponible:false,issues:['COSTEO_ALBA_INCOMPLETO',...(albaGate.pendientes||[])],detalle:albaCalc};

  const parI={...parametros,...intelisisPar,modeloCosteo:'intelisis',usarCostoPorArea:true};
  const tarifas=horasConTarifa(pieza,parI);
  let intelisis;
  if(!tarifas.ok){
    intelisis={disponible:false,issues:tarifas.issues};
  }else{
    const piezaI={...pieza,modoManoObra:'horas',modeloCosteo:'intelisis'};
    const calcI=calcular(piezaI,piezas,insumos,parI);
    const gateI=costeoEmitible(calcI);
    intelisis=gateI.emitible
      ? {disponible:true,costo:calcI.costoUnitario,precio:precioVenta(calcI.costoUnitario,parI).precioLista,detalle:calcI}
      : {disponible:false,issues:['COSTEO_INTELISIS_INCOMPLETO',...(gateI.pendientes||[])],detalle:calcI};
  }

  const delta=(alba.disponible&&intelisis.disponible)
    ? {
        costo: intelisis.costo-alba.costo,
        costo_pct: alba.costo ? ((intelisis.costo-alba.costo)/alba.costo)*100 : null,
        precio: intelisis.precio-alba.precio,
      }
    : null;
  return {alba,intelisis,delta,regla:'NO_PROMEDIAR'};
}


/**
 * Certificación formal de un golden: además de cuadrar al centavo, exige
 * procedencia externa válida. evaluarGoldenCosteo sigue sirviendo para
 * diagnóstico interno; esta función es la compuerta para decir "certificado".
 */
export function evaluarGoldenCertificado(actual={}, esperado={}, {fuente=null, ...opts}={}) {
  const comparacion = evaluarGoldenCosteo(actual, esperado, opts);
  const fuente_valida = fuenteGoldenValida(fuente || {});
  return {
    ...comparacion,
    fuente_valida,
    fuente: fuente || null,
    certificable: comparacion.certificable && fuente_valida,
    issues_certificacion: [
      ...(!fuente_valida ? ['FUENTE_GOLDEN_INVALIDA'] : []),
      ...(!comparacion.certificable ? ['DELTA_O_CAMPOS_PENDIENTES'] : []),
    ],
  };
}
