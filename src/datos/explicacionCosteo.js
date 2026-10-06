// ============================================================================
// EXPLICACIÓN DE COSTEO · una sola narración determinista para Costear/Cocrear/VONI.
//
// No recalcula ni "interpreta" el costo. Lee el resultado CANÓNICO ya calculado y
// explica exactamente qué fórmulas, bases, desperdicios y supuestos participaron.
// Por eso sirve como auditoría humana sin crear un segundo motor.
// ============================================================================
const n=(x)=>Number.isFinite(Number(x))?Number(x):null;
const r2=(x)=>n(x)==null?null:Math.round(Number(x)*100)/100;
const pct=(x)=>n(x)==null?null:Math.round(Number(x)*10)/10;

export function explicarCosteo(resultado={}, {nombre='', cantidad=null}={}) {
  const d=Array.isArray(resultado.detalleInsumos)?resultado.detalleInsumos:[];
  const piezas=n(resultado.piezas) ?? n(cantidad) ?? 1;
  const formula=resultado.formulaCosteo || (resultado.modoManoObra==='horas'?'HORAS':'DESCONOCIDA');
  const merma=pct(resultado.mermaProcesoPct || 0);
  const materialDirecto=r2(resultado.materialDirecto)||0;
  const materialIndirecto=r2(resultado.materialIndirecto)||0;
  const manoObra=r2(resultado.manoObra)||0;
  const preparacion=r2(resultado.preparacion)||0;
  const empaque=r2(resultado.empaque)||0;
  const indirectos=r2(resultado.indirectosFabrica)||0;
  const gastosOperacion=r2(resultado.gastosOperacion)||0;
  const costoFabricacion=r2(resultado.costoFabricacion)||0;
  const costoLote=r2(resultado.costoLote)||0;
  const costoLoteConMerma=r2(resultado.costoLoteConMerma)||0;
  const costoUnitario=r2(resultado.costoUnitario);
  const bloqueos=[
    ...(resultado.componentesIgnorados||[]).map((x)=>`Componente/material pendiente: ${x}`),
    ...(resultado.tarifasFaltantes||[]).map((x)=>`Tarifa Intelisis pendiente: ${x}`),
    ...d.filter((x)=>x?.noCabe).map((x)=>`${x.nombre||x.insumoId}: pieza fuera del formato de compra`),
  ];

  const insumos=d.map((x)=>({
    id:x.insumoId,
    nombre:x.nombre||x.insumoId||'Material',
    seccion:x.seccion||'otros',
    metodo:x.metodoConsumo||null,
    tipo_alba:x.tipoAlbaAplicado||null,
    formato_fisico:x.formato ? {
      tipo:x.formato.tipo||null,nombre:x.formato.nombre||null,
      largo_mm:r2(x.formato.largoMM),ancho_mm:r2(x.formato.anchoMM),
      medida_compra:r2(x.formato.medida),
    } : null,
    formato_geometrico_verificable:!!(Number(x.formato?.largoMM)>0&&Number(x.formato?.anchoMM)>0),
    neto:r2(x.neto),
    comprado:r2(x.comprado),
    unidades:r2(x.unidades),
    costo:r2(x.costo),
    desperdicio_costo:r2(x.desperdicio),
    desperdicio_pct:pct(x.pct),
    corte_2d:x.optimizacionCorte?.disponible?{
      eficiencia_pct:pct(x.optimizacionCorte.eficiencia_pct),
      hojas:x.optimizacionCorte.hojas??null,
      completo:x.optimizacionCorte.completo===true,
      remanentes:(x.optimizacionCorte.remanentes||[]).slice(0,4),
      advisory:true,
    }:null,
    corte_1d:x.optimizacionCorte1D?.disponible?{
      eficiencia_pct:pct(x.optimizacionCorte1D.eficiencia_pct),
      tramos:x.optimizacionCorte1D.tramos??null,
      completo:x.optimizacionCorte1D.completo===true,
      remanentes:(x.optimizacionCorte1D.remanentes||[]).slice(0,4),
      advisory:true,
    }:null,
    usa_aprovechamiento_generico:!!x.usaAprovechamientoGenerico,
  }));

  const supuestos=[];
  if(insumos.some((x)=>x.usa_aprovechamiento_generico)) {
    supuestos.push(`Hay materiales sin geometría/fracción suficiente: usan aprovechamiento genérico ${resultado.parametrosCorte?.aprovechamientoCorte ?? 'N/D'}%.`);
  }
  const sinGeometria=insumos.filter((x)=>x.formato_fisico&&['tablero','lamina'].includes(x.formato_fisico.tipo)&&!x.formato_geometrico_verificable&&x.metodo!=='FRACCION_DIRECTA_RAFA');
  if(sinGeometria.length) supuestos.push(`Falta geometría física verificable de formato para: ${sinGeometria.map(x=>x.nombre).slice(0,5).join(', ')}; no se certifica nesting 2D exacto.`);
  if(merma>0) supuestos.push(`Merma de proceso global: ${merma}%; se aplica como rendimiento del lote completo.`);
  if(resultado.modoManoObra==='horas') supuestos.push('La mano de obra se calculó con horas por centro y sus tarifas vigentes.');
  if(formula==='ALBA_V1') supuestos.push('La mano de obra y GI siguen Alba V1 por tipo de material; no se sustituyeron por una heurística de IA.');

  const ecuacion=formula==='ALBA_V1'
    ? 'Material comprado + MO Alba por tipo + GI Alba + preparación + empaque; después se aplica merma de proceso si existe.'
    : resultado.modeloCosteo==='intelisis'
      ? 'Material + MO por horas + GIF por horas = fabricación; + gastos de operación = costo total.'
      : 'Material + mano de obra + preparación + empaque + indirectos de fábrica; después se aplica merma de proceso.';

  return {
    version:'COST_EXPLAIN_V1',
    nombre:nombre||null,
    piezas,
    formula,
    modelo:resultado.modeloCosteo||null,
    ecuacion,
    estado:bloqueos.length?'INCOMPLETO':'EXPLICABLE',
    costo_unitario:costoUnitario,
    matematicas:{
      material_directo:materialDirecto,
      material_indirecto:materialIndirecto,
      material_total:r2(resultado.materialTotal)||r2(materialDirecto+materialIndirecto),
      mano_obra:manoObra,
      preparacion,
      empaque,
      indirectos_fabrica:indirectos,
      gastos_operacion:gastosOperacion,
      costo_fabricacion:costoFabricacion,
      costo_lote:costoLote,
      costo_lote_con_merma:costoLoteConMerma,
      costo_unitario:costoUnitario,
      merma_proceso_pct:merma,
    },
    corte:resultado.parametrosCorte||null,
    insumos,
    supuestos,
    bloqueos,
    nota:'Explicación derivada del resultado canónico. No recalcula ni modifica un centavo.',
  };
}

export function resumenExplicacionCosteo(e={}) {
  const m=e.matematicas||{};
  const f=(x)=>Number.isFinite(Number(x))?Number(x).toFixed(2):'—';
  return [
    `${e.formula||'Fórmula'} · ${e.piezas||1} pieza(s)`,
    `Material $${f(m.material_total)} + MO $${f(m.mano_obra)} + GI $${f(m.indirectos_fabrica)}`,
    m.gastos_operacion ? `Gastos operación $${f(m.gastos_operacion)}` : null,
    m.merma_proceso_pct ? `Merma proceso ${m.merma_proceso_pct}%` : null,
    `Costo unitario $${f(m.costo_unitario)}`,
  ].filter(Boolean).join(' · ');
}
