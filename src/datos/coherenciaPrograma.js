// ============================================================================
// COHERENCIA DEL PROGRAMA ANTES DE ACOMODAR
// No intenta diseñar ni inventar mobiliario. Detecta dependientes evidentes
// (sillas/gavetas) cuyo ancla comercial no existe todavía en la cotización.
// ============================================================================
const norm=(s='')=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const txt=(p)=>norm(`${p?.nombre||''} ${p?.nota||''} ${p?.ruta||''}`);
const cant=(p)=>Math.max(1,Math.round(Number(p?.cantidad)||1));

const esOperativa=(p)=>/silla|asiento/.test(txt(p)) && /operativ|puesto|banca|bench|open/.test(txt(p));
const esDirectivaOVisita=(p)=>/silla|asiento/.test(txt(p)) && /directiv|ejecutiv|visita|confidente|privad/.test(txt(p));
const esJuntasSeat=(p)=>/silla|asiento/.test(txt(p)) && /junta|consejo|meeting|board/.test(txt(p));
const esMesaJuntas=(p)=>/mesa|table/.test(txt(p)) && /junta|consejo|meeting|board/.test(txt(p));
const esWorkAnchor=(p)=>/escritorio|bench|banca|estacion|puesto de trabajo|workstation/.test(txt(p)) && !/silla|asiento/.test(txt(p));
const esPrivateAnchor=(p)=>esWorkAnchor(p) && /privad|direccion|directiv|ejecutiv|gerenc/.test(txt(p));
const esPedestal=(p)=>/gaveta|pedestal|cajonera/.test(txt(p));

export function validarCoherenciaPrograma(partidas=[]){
  const ps=(Array.isArray(partidas)?partidas:[]).filter(p=>!p?.sugeridoPlano&&!String(p?.id||'').startsWith('sug-'));
  const bloqueos=[];
  const nOp=ps.filter(esOperativa).reduce((s,p)=>s+cant(p),0);
  const nPriv=ps.filter(esDirectivaOVisita).reduce((s,p)=>s+cant(p),0);
  const nJuntas=ps.filter(esJuntasSeat).reduce((s,p)=>s+cant(p),0);
  const nPed=ps.filter(esPedestal).reduce((s,p)=>s+cant(p),0);
  const work=ps.filter(esWorkAnchor).reduce((s,p)=>s+cant(p),0);
  const priv=ps.filter(esPrivateAnchor).reduce((s,p)=>s+cant(p),0);
  const mesas=ps.filter(esMesaJuntas).reduce((s,p)=>s+cant(p),0);

  if(nOp>0 && work===0) bloqueos.push({
    code:'MISSING_WORK_ANCHOR',
    mensaje:`Hay ${nOp} silla(s) operativa(s), pero no hay ningún bench/escritorio/estación real en la cotización.`,
    accion:'Agrega las estaciones reales antes de acomodar.'
  });
  if(nPed>0 && work===0) bloqueos.push({
    code:'MISSING_PEDESTAL_ANCHOR',
    mensaje:`Hay ${nPed} pedestal(es)/gaveta(s) que dependen de un escritorio, pero no existe ese escritorio en la cotización.`,
    accion:'Agrega el escritorio/bench al que pertenecen.'
  });
  if(nPriv>0 && priv===0 && work===0) bloqueos.push({
    code:'MISSING_PRIVATE_DESK',
    mensaje:`Hay ${nPriv} silla(s) de privado/dirección/visita, pero no hay escritorio privado real.`,
    accion:'Agrega el escritorio privado antes de acomodar.'
  });
  if(nJuntas>0 && mesas===0) bloqueos.push({
    code:'MISSING_MEETING_TABLE',
    mensaje:`Hay ${nJuntas} silla(s) de juntas, pero no hay mesa de juntas real.`,
    accion:'Agrega la mesa de juntas antes de acomodar.'
  });
  return {ok:bloqueos.length===0,bloqueos};
}
