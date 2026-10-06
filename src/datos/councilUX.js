// VONI Council -> contrato pequeño para UI.
// No interpreta negocio ni cambia decisiones: sólo compacta la salida estructurada.
export function resumenCouncilUI(r){
  const opinions=Array.isArray(r?.opinions)?r.opinions.filter(x=>x?.ok&&x?.output):[];
  const outputs=opinions.map(x=>x.output);
  const recommendations=[];
  const questions=[];
  const blockers=[];
  for(const o of outputs){
    for(const x of (o?.recommendations||[])){
      const key=[x.category,x.what,x.why].join('|');
      if(!recommendations.some(y=>y._key===key)) recommendations.push({...x,_key:key});
    }
    for(const x of (o?.questions||[])){
      const what=typeof x==='string'?x:x?.what;
      if(what&&!questions.includes(what)) questions.push(what);
    }
    for(const x of (o?.blockers||[])){
      const what=typeof x==='string'?x:x?.what||x?.detalle;
      if(what&&!blockers.includes(what)) blockers.push(what);
    }
  }
  const best=outputs[0]||null;
  return {
    ok:r?.ok===true,
    status:r?.council?.status||'NO_PROVIDER',
    decision:r?.council?.decision||best?.decision||'REQUIRES_VALIDATION',
    summary:best?.summary||null,
    recommendations:recommendations.slice(0,6).map(({_key,...x})=>x),
    questions:questions.slice(0,5),
    blockers:blockers.slice(0,6),
    providers:opinions.map(x=>({provider:x.provider,model:x.model||null,ms:x.ms||null})),
    latency_ms:Number(r?.latency_ms)||null,
    budget_ms:Number(r?.budget_ms)||null,
    deadline_hit:r?.deadline_hit===true,
    requires_confirmation:r?.council?.requires_confirmation===true,
  };
}
