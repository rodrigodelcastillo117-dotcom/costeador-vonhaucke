import { expandirPiezas, mapaPiezas } from './espacio.js';
import { auditarColocacion } from './acomodoAudit.js';
import { violacionesSemanticas } from './floorSpec.js';

function areasMM(acomodo={}) {
  if (Array.isArray(acomodo.areas) && acomodo.areas.length) return acomodo.areas;
  if (Array.isArray(acomodo.areasM)) {
    return acomodo.areasM.map(a=>({
      ...a,
      ancho: Math.round((Number(a.ancho)||0)*1000),
      largo: Math.round((Number(a.largo)||0)*1000),
      poly: Array.isArray(a.poly) ? a.poly.map(([x,y])=>[Math.round(x*1000),Math.round(y*1000)]) : a.poly,
    }));
  }
  return [];
}

/**
 * Gate de presentación, separado del gate financiero.
 * Sin acomodo = válido omitirlo. Con acomodo = sólo se enseña al cliente si
 * tenemos evidencia espacial suficiente.
 */
export function evaluarAcomodoCliente(acomodo, partidas=[]) {
  if (!acomodo?.plan) return { existe:false, mostrar:false, valido:true, estado:'SIN_ACOMODO', razones:[] };

  const plan=acomodo.plan;
  const colocInicial=Array.isArray(plan?.colocacion)?plan.colocacion:[];
  const sugeridasEnPlan=colocInicial.filter((x)=>String(x?.id||'').startsWith('sug-'));
  if (sugeridasEnPlan.length) {
    return {
      existe:true, mostrar:false, valido:false, estado:'PLAN_CONTAMINADO_SUGERIDOS',
      razones:[`${sugeridasEnPlan.length} pieza(s) sugerida(s) quedaron dentro del plan legacy; debe recalcularse sólo con partidas reales`],
      source:'LEGACY_PROGRAM_CONTAMINATION',
    };
  }

  const programaIncompleto=String(acomodo?.layoutEstado||'')==='PROGRAM_INCOMPLETE';
  if (programaIncompleto) {
    return {
      existe:true, mostrar:false, valido:false, estado:'PROGRAM_INCOMPLETE',
      razones:[acomodo?.layoutMotivo || 'faltan piezas funcionales reales antes de validar el acomodo'],
      source:'PROGRAM_GATE_V2',
    };
  }

  // Las sugerencias pendientes son advisory. No bloquean por sí solas un
  // PlacementSpec real ya validado; sólo viajan como metadata para VONI.
  const floorState=String(acomodo?.floorSpec?.validation?.state || '');
  if (floorState && floorState !== 'PASS') {
    return {
      existe:true, mostrar:false, valido:false, estado:'FLOOR_SPEC_' + floorState,
      razones:[
        floorState === 'REVIEW_REQUIRED' ? 'la lectura del plano requiere revisión' : 'la lectura del plano no pasó validación',
        ...(acomodo?.floorSpec?.validation?.warnings || []).slice(0,3).map(w=>w?.message || w?.code).filter(Boolean),
        ...(acomodo?.floorSpec?.validation?.issues || []).slice(0,3).map(w=>w?.msg || w?.message || w?.code).filter(Boolean),
      ],
      source:'FLOOR_SPEC_V2',
    };
  }
  const areas=areasMM(acomodo);
  const piezas=expandirPiezas(partidas);
  const byId=mapaPiezas(piezas);
  const coloc=Array.isArray(plan.colocacion)?plan.colocacion:[];

  // Evidencia del edge avanzado: ésta es la ruta preferida y autoritativa.
  const spec=plan.layoutSpec;
  if (plan.strictPlacement === true && spec) {
    const status=String(spec.status||'');
    const ready=plan.render_ready === true || spec?.validation?.render_ready === true;
    const invariant=spec?.validation?.invariant_ok !== false;
    const ok=status==='PASS' && ready && invariant;
    return {
      existe:true, mostrar:ok, valido:ok,
      estado: ok ? 'VALIDADO_ESPACIAL' : 'ESPACIAL_NO_APROBADO',
      razones: ok ? [] : [
        status && status!=='PASS' ? `estado espacial ${status}` : null,
        !ready ? 'render_ready=false' : null,
        !invariant ? 'invariante de cantidades inválida' : null,
      ].filter(Boolean),
      source:'PLACEMENT_SPEC_V2',
    };
  }

  // Legacy/local: medimos lo que sí podemos demostrar, pero NO lo promovemos a
  // "validado espacial" porque no prueba clearances/barridos/ProductRevision.
  if (!areas.length || !piezas.length) {
    return { existe:true, mostrar:false, valido:false, estado:'LEGACY_SIN_EVIDENCIA', razones:['faltan áreas o piezas para auditar'], source:'LOCAL' };
  }
  const audit=auditarColocacion({areas,colocacion:coloc,byId},{tol:20});
  const ids=new Set(coloc.map(c=>String(c.id)));
  const sinColocar=piezas.filter(p=>!ids.has(String(p.id))).length;
  const sem=violacionesSemanticas(coloc,areas,byId);
  const fisicamenteSano=!audit.fuera.length && !audit.overlaps.length && sinColocar===0 && sem.length===0;

  return {
    existe:true,
    mostrar:false,
    valido:false,
    estado: fisicamenteSano ? 'LEGACY_REQUIERE_VALIDACION_ESPACIAL' : 'LAYOUT_INVALIDO',
    razones:[
      audit.fuera.length ? `${audit.fuera.length} fuera del área` : null,
      audit.overlaps.length ? `${audit.overlaps.length} traslape(s)` : null,
      sinColocar ? `${sinColocar} sin colocar` : null,
      sem.length ? `${sem.length} en zona incorrecta` : null,
      fisicamenteSano ? 'falta validar clearances/puertas/ProductRevision con el motor espacial' : null,
    ].filter(Boolean),
    source:'LOCAL',
  };
}

export function cotizacionSinAcomodoNoValidado(cot={}, partidas=[]) {
  const gate=evaluarAcomodoCliente(cot?.acomodo,partidas);
  if (!gate.existe || gate.mostrar) return { cot, gate };
  return { cot:{...cot,acomodo:null}, gate };
}
