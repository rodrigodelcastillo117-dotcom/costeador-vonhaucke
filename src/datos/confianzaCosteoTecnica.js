// ============================================================================
// CONFIANZA TÉCNICA DEL COSTEO · índice explicable de cobertura, NO probabilidad.
//
// El número no intenta adivinar si el costo "saldrá bien". Mide cuánto del
// costeo está respaldado por evidencia verificable: precios con fuente, BOM
// certificable, motor emitible y fórmula oficial. Cualquier bloqueo se muestra.
// ============================================================================
const n=(x)=>Number.isFinite(Number(x))?Number(x):0;
const clamp=(x)=>Math.max(0,Math.min(100,Math.round(x)));

export function confianzaTecnicaCosteo({resultado={},industrial={},insumos={}}={}){
  const det=Array.isArray(resultado?.detalleInsumos)?resultado.detalleInsumos:[];
  const conCosto=det.filter((d)=>n(d?.costo)>0);
  const materialTotal=conCosto.reduce((s,d)=>s+n(d.costo),0);
  const materialConFuente=conCosto
    .filter((d)=>!!insumos?.[d?.insumoId]?.fuente)
    .reduce((s,d)=>s+n(d.costo),0);
  const precios=materialTotal>0?clamp(materialConFuente/materialTotal*100):null;

  const cob=industrial?.cobertura_bom||{};
  const totalBom=n(cob.total);
  const bom=totalBom>0?clamp(n(cob.certificable)/totalBom*100):null;

  const motor=industrial?.costo_emitible===true?100:0;
  const formula=String(industrial?.matematica?.formula_oficial||resultado?.formulaCosteo||'').toUpperCase();
  const formulaOficial=/ALBA|INTELISIS/.test(formula);
  const matematicas=formulaOficial?100:(formula?60:0);

  const dimensiones=[
    {key:'precios',label:'Precios con fuente',valor:precios,peso:40},
    {key:'bom',label:'BOM con evidencia',valor:bom,peso:30},
    {key:'motor',label:'Motor emitible',valor:motor,peso:20},
    {key:'formula',label:'Fórmula oficial',valor:matematicas,peso:10},
  ];
  const aplicables=dimensiones.filter((d)=>d.valor!=null);
  const peso=aplicables.reduce((s,d)=>s+d.peso,0);
  const score=peso?clamp(aplicables.reduce((s,d)=>s+d.valor*d.peso,0)/peso):null;
  const bloqueos=Array.isArray(industrial?.bloqueos)?industrial.bloqueos:[];
  const estado=score==null?'NO_EVALUABLE':bloqueos.length||score<80?'BAJA':score<95?'MEDIA':'ALTA';

  return {
    score,estado,dimensiones,bloqueos,
    material_sin_fuente:conCosto.filter((d)=>!insumos?.[d?.insumoId]?.fuente).map((d)=>d?.nombre||d?.insumoId||'Material'),
    nota:'Índice de cobertura técnica; no es una probabilidad estadística ni modifica el costo oficial.',
  };
}
