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
