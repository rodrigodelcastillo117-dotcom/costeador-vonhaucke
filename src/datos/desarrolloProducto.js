// ============================================================================
// DESARROLLO DE PRODUCTO · diagnóstico determinista de complejidad/repetibilidad.
// No cambia el diseño ni calcula ahorros. Identifica oportunidades medibles para
// que VONI/ingeniería decidan qué vale la pena explorar.
// ============================================================================
const npos=(x)=>Number.isFinite(Number(x))&&Number(x)>0?Number(x):null;
const norm=(s)=>String(s||'').trim().toLowerCase();

function qty(c){ return Math.max(1,Math.round(Number(c?.piezas ?? c?.cantidad) || 1)); }
function mat(c){ return String(c?.insumoId || c?.material || c?.material_id || 'UNKNOWN'); }
function esp(c){ return npos(c?.espesorMM ?? c?.thicknessMM ?? c?.thickness_mm); }
function dims(c){
  const a=npos(c?.largoMM ?? c?.length_mm),b=npos(c?.anchoMM ?? c?.width_mm);
  return a&&b ? [Math.round(a),Math.round(b)].sort((x,y)=>x-y) : null;
}
function geomKey(c){
  const d=dims(c); if(!d)return null;
  return `${mat(c)}|${esp(c)||'?'}|${d[0]}x${d[1]}`;
}

export function diagnosticoDesarrolloProducto(spec={}){
  const comps=(Array.isArray(spec.componentes)?spec.componentes:[]).filter(c=>c&&!c.excluida);
  const expanded=[];
  for(const c of comps) for(let i=0;i<qty(c);i++) expanded.push(c);
  const mats=new Map(),geoms=new Map(),roles=new Map();
  let sinGeometria=0,sinMaterial=0;
  for(const c of expanded){
    const m=mat(c);
    mats.set(m,(mats.get(m)||0)+1);
    if(m==='UNKNOWN')sinMaterial++;
    const g=geomKey(c);
    if(g)geoms.set(g,(geoms.get(g)||0)+1); else sinGeometria++;
    const r=norm(c.semantic_role||c.rol||c.nombre||'sin_rol');
    roles.set(r,(roles.get(r)||0)+1);
  }

  const total=expanded.length;
  const unicas=[...geoms.values()].filter(x=>x===1).length;
  const repetidas=[...geoms.entries()]
    .filter(([,q])=>q>=2)
    .map(([firma,q])=>({firma,cantidad:q}))
    .sort((a,b)=>b.cantidad-a.cantidad||a.firma.localeCompare(b.firma));
  const materiales=[...mats.entries()].map(([id,cantidad])=>({id,cantidad})).sort((a,b)=>b.cantidad-a.cantidad||a.id.localeCompare(b.id));
  const oportunidades=[];

  if(total>=8 && geoms.size>=6 && geoms.size/Math.max(1,total)>=0.7){
    oportunidades.push({
      tipo:'ESTANDARIZACION_GEOMETRIA',
      prioridad:'MEDIA',
      evidencia:{piezas:total,geometrias_unicas:geoms.size,proporcion_unica:+(geoms.size/total).toFixed(2)},
      recomendacion:'Revisar si algunas medidas únicas pueden converger a módulos repetibles sin perder función.',
      confianza:0.75,
      ahorro_certificado:false,
    });
  }
  if(materiales.filter(x=>x.id!=='UNKNOWN').length>=5 && total<=24){
    oportunidades.push({
      tipo:'CONSOLIDACION_MATERIALES',
      prioridad:'MEDIA',
      evidencia:{familias_material:materiales.filter(x=>x.id!=='UNKNOWN').length,piezas:total},
      recomendacion:'Evaluar si se puede reducir la variedad de materiales/insumos sin alterar desempeño, acabado o intención.',
      confianza:0.7,
      ahorro_certificado:false,
    });
  }
  if(repetidas.length){
    oportunidades.push({
      tipo:'REPETIBILIDAD',
      prioridad:'BAJA',
      evidencia:{grupos_repetidos:repetidas.length,max_repeticion:repetidas[0].cantidad},
      recomendacion:'Aprovechar piezas repetidas para lotificación, corte por familias y control de calidad por plantilla.',
      confianza:0.9,
      ahorro_certificado:false,
    });
  }
  if(sinGeometria){
    oportunidades.push({
      tipo:'COMPLETAR_GEOMETRIA',
      prioridad:'ALTA',
      evidencia:{piezas_sin_geometria:sinGeometria},
      recomendacion:'Completar largo/ancho/espesor antes de aprobar despiece 3D, nesting o ruta de fabricación.',
      confianza:1,
      ahorro_certificado:false,
    });
  }

  return {
    estado: sinMaterial||sinGeometria ? 'INCOMPLETO' : 'ANALIZADO',
    metricas:{
      piezas_totales:total,
      componentes_bom:comps.length,
      familias_material:materiales.filter(x=>x.id!=='UNKNOWN').length,
      geometrias_distintas:geoms.size,
      piezas_geometria_unica:unicas,
      grupos_repetidos:repetidas.length,
      piezas_sin_geometria:sinGeometria,
      piezas_sin_material:sinMaterial,
    },
    repetibilidad:repetidas,
    materiales,
    oportunidades,
    politica:'Las oportunidades son hipótesis de desarrollo. No sustituyen validación de ingeniería ni certifican ahorro.',
  };
}

export function compararVariantesProducto(a={},b={},costA=null,costB=null){
  const A=diagnosticoDesarrolloProducto(a),B=diagnosticoDesarrolloProducto(b);
  const ca=Number.isFinite(Number(costA))?Number(costA):null;
  const cb=Number.isFinite(Number(costB))?Number(costB):null;
  return {
    a:A.metricas,b:B.metricas,
    delta:{
      piezas_totales:B.metricas.piezas_totales-A.metricas.piezas_totales,
      familias_material:B.metricas.familias_material-A.metricas.familias_material,
      geometrias_distintas:B.metricas.geometrias_distintas-A.metricas.geometrias_distintas,
      costo:ca!=null&&cb!=null ? +(cb-ca).toFixed(2) : null,
    },
    costo_comparable:ca!=null&&cb!=null,
    nota:'Delta descriptivo; menor complejidad/costo no implica automáticamente mejor producto.',
  };
}
