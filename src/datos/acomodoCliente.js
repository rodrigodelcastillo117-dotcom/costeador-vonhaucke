import { expandirPiezas, mapaPiezas } from './espacio.js';
import { auditarColocacion } from './acomodoAudit.js';
import { violacionesSemanticas } from './floorSpec.js';
import { esSugerida, construirPayloadAcomodo } from './acomodoPayload.js';

/**
 * FRESCURA (P0-05, lado cliente): ¿el plan COLOCADO ya no corresponde a estas partidas?
 * El status/ready/invariant_ok del spec se CONGELAN al acomodar. Si después se edita la
 * cotización (se borra/agrega/cambia un mueble) sin volver a acomodar, esos valores siguen
 * en 'true' pero el plano/3D ya no refleja la lista de muebles cotizada. Se revalidan los IDs
 * colocados contra las partidas REALES ACTUALES con la MISMA definición que sanea la pantalla
 * de Acomodo (`sanearAcomodoContraPartidas`): un ID colocado ajeno a las partidas (mueble
 * borrado) o un `requested` que ya no cuadra con el conteo real (mueble agregado) ⇒ desfasado.
 * Se filtran las sugeridas (sug-*) para que NO inflen el conteo (único origen de falso positivo).
 */
export function planDesfasadoContraPartidas(plan, partidas = []) {
  const coloc = Array.isArray(plan?.colocacion) ? plan.colocacion : [];
  if (!coloc.length) return false;
  const reales = (Array.isArray(partidas) ? partidas : []).filter((p) => !esSugerida(p));
  const ids = new Set((expandirPiezas(reales) || []).map((p) => String(p.id)));
  const tieneAjena = coloc.some((x) => !ids.has(String(x?.id || '')));
  const requested = Number(plan?.layoutSpec?.requested);
  const cuentaIncompatible = Number.isFinite(requested) && requested !== ids.size;
  return tieneAjena || cuentaIncompatible;
}

/**
 * F11 · GEOMETRÍA (frescura por dimensión). `planDesfasadoContraPartidas` solo ve id+conteo y es
 * CIEGO a dimensiones (los ids de pieza no dependen de w/d). Si el plan trae `program_hash` sellado,
 * se recomputa sobre las partidas/áreas ACTUALES — con la MISMA función canónica que lo selló
 * (`construirPayloadAcomodo` → `programHashCanonico`, que incluye w/d y zona) — y se compara: cambiar
 * la medida de un mueble (mismo id, misma cantidad) mueve el `program_hash` ⇒ desfasado, y el
 * plano/3D/render viejo ya no cuadra con el despiece confirmado.
 * FAIL-SAFE para un gate de CLIENTE: sin hash sellado, sin áreas, o sin recómputo `ok`, devuelve
 * false (NO marca desfasado). Así nunca produce un falso positivo que esconda un acomodo legítimo;
 * en el peor caso deja de cazar un cambio (sin regresión), que es el comportamiento previo.
 */
export function programaCambioGeometria(plan, partidas = [], areasM = []) {
  const sellado = plan && typeof plan.program_hash === 'string' ? plan.program_hash : '';
  if (!sellado) return false;
  let pay;
  try { pay = construirPayloadAcomodo({ partidas, areasM: Array.isArray(areasM) ? areasM : [] }); }
  catch { return false; }
  if (!pay || pay.ok !== true || typeof pay.program_hash !== 'string') return false;
  return pay.program_hash !== sellado;
}

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
    const invariant=spec?.validation?.invariant_ok === true;   // fail-closed: ausente (spec viejo sin el campo) NO cuenta como válido
    const fresco=!planDesfasadoContraPartidas(plan, partidas) && !programaCambioGeometria(plan, partidas, acomodo?.areasM);   // fail-closed: el spec validado se congeló; si cambiaron las partidas (id/conteo O dimensión, F11), NO se enseña plano viejo
    const ok=status==='PASS' && ready && invariant && fresco;
    return {
      existe:true, mostrar:ok, valido:ok,
      estado: ok ? 'VALIDADO_ESPACIAL' : (!fresco ? 'STALE_PROGRAM' : 'ESPACIAL_NO_APROBADO'),
      razones: ok ? [] : [
        !fresco ? 'el acomodo guardado es de otra lista de muebles: vuelve a acomodar con la cotización actual' : null,
        status && status!=='PASS' ? 'el acomodo aún no pasa la validación del motor espacial' : null,
        !ready ? 'falta terminar de generar la vista del acomodo' : null,
        !invariant ? 'las cantidades del acomodo no cuadran con lo cotizado' : null,
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
