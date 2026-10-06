// ============================================================================
// PRECEDENTES DE COSTEO · memoria técnica determinista de VONI.
//
// Compara el BOM vivo con revisiones históricas AUTORIZADAS ya recuperadas por
// el proveedor. No toca red, no recalcula costo y no convierte similitud en verdad.
// Un precedente económico sólo entra si trae costo oficial de ProductRevision
// o una revisión marcada COMPLETA con costo finito.
// ============================================================================
const norm=(s)=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const rawNum=(x)=>x==null||x===''?NaN:Number(x);
const mats=(xs)=>new Set((xs||[]).map((x)=>String(x?.insumoId||x?.material_id||x?.material||'')).filter(Boolean));
const tokens=(xs)=>new Set((xs||[]).flatMap((x)=>norm(x).match(/[a-z0-9]{3,}/g)||[])
  .filter((x)=>!['para','pieza','mueble','material','cubierta','estructura'].includes(x)));
const inter=(a,b)=>[...a].filter((x)=>b.has(x)).length;
const jacc=(a,b)=>a.size||b.size ? inter(a,b)/(new Set([...a,...b]).size||1) : 0;
const countSim=(a,b)=>1-Math.min(1,Math.abs(a-b)/Math.max(1,a,b));

export function construirPrecedentesCosteo(bomActual=[], revisiones=[], economias=[]) {
  const bom=Array.isArray(bomActual)?bomActual:[];
  if(!bom.length) return [];
  const ecoMap=new Map((economias||[]).map((e)=>[Number(e?.producto_version_id),e]));
  const t0=tokens(bom.map((x)=>x?.nombre)),m0=mats(bom);
  const out=[];

  for(const r of (revisiones||[])){
    const rb=Array.isArray(r?.bom)?r.bom:[];
    if(!rb.length) continue;
    const eco=ecoMap.get(Number(r?.producto_version_id));
    const c=r?.costo&&typeof r.costo==='object'?r.costo:{};
    const costoEco=rawNum(eco?.costo_oficial_referencia);
    const costoRev=rawNum(c.costoTotal ?? c.costoUnitario);
    const completo=String(c.estado_costo||'').toLowerCase()==='completo' && Number.isFinite(costoRev) && costoRev>=0;
    const tieneOficial=Number.isFinite(costoEco)&&costoEco>=0;
    if(!tieneOficial&&!completo) continue;

    const mt=mats(rb),tt=tokens(rb.map((x)=>x?.nombre));
    const materialSim=jacc(m0,mt),textoSim=jacc(t0,tt),cantidadSim=countSim(bom.length,rb.length);
    const score=0.55*materialSim+0.30*textoSim+0.15*cantidadSim;
    if(score<0.12) continue;

    out.push({
      revision_id:r.id,expediente_id:r.expediente_id,revision:r.rev,nombre:r.nombre||'Precedente',
      producto_id:r.producto_id||null,producto_version_id:r.producto_version_id||null,
      similitud:+score.toFixed(3),
      coincidencia_material:+materialSim.toFixed(3),
      coincidencia_texto:+textoSim.toFixed(3),
      bom_componentes:rb.length,
      costo_oficial:tieneOficial?costoEco:costoRev,
      formula:eco?.formula_version||c.formula_version||null,
      fuente:tieneOficial?(eco?.fuente||'producto_version_economia'):'expediente_revision_completa',
      fecha:eco?.actualizado||r.creado||null,
    });
  }
  return out.sort((a,b)=>b.similitud-a.similitud || String(b.fecha||'').localeCompare(String(a.fecha||''))).slice(0,6);
}
