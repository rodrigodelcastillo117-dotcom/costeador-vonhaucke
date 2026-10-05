// Gate determinista: un render no se presenta como canonico si su spec no representa
// exactamente la revision/BOM/layout vigente. La imagen puede ser bonita; este gate decide fidelidad.
const stable = (v) => JSON.stringify(v, Object.keys(v||{}).sort());
export function firmaRender({revisionId=null,bomHash=null,geometryHash=null,layoutHash=null,renderSpec=null}={}){
  return [revisionId||'',bomHash||'',geometryHash||'',layoutHash||'',stable(renderSpec||{})].join('|');
}
export function validarFidelidadRender({esperada,actual,renderedCount=null,placedCount=null}={}){
  const issues=[];
  if(!esperada||!actual||esperada!==actual) issues.push('STALE_OR_DIFFERENT_SPEC');
  if(renderedCount!=null&&placedCount!=null&&Number(renderedCount)!==Number(placedCount)) issues.push('COUNT_MISMATCH');
  return {ok:issues.length===0,issues};
}
export function etiquetaFidelidad(v){ return v?.ok?'GEOMETRIA VERIFICADA':'RENDER DE REFERENCIA — NO CANONICO'; }
