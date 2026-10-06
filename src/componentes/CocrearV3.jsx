import React,{useEffect,useMemo,useState} from 'react';
import {
  cocrearDesdeIntent,construirProductSpec,extraerDNA,clasificarProducto,cocrearDeExpediente,cocrearPayload,
  hashEstable,DIMS_DEFAULT,MATERIALES_EDIT,FAMILIA,aplicarCambioTexto,
} from '../datos/cocrear.js';
import {prepararIntentCocrear,resumenIdeaCocrear,conceptosCocrear,aplicarConceptoCocrear,FEATURES_COCREAR,detectarAlcanceCocrear} from '../datos/cocrearWow.js';
import {referenciasComercialesCocrear,formatearReferenciaCocrear} from '../datos/cocrearReferencias.js';
import {estimadoDisenoCocrear} from '../datos/estimadoDiseno.js';
import {listarCocreaciones,guardarCocrearSeguro,cargarCocrearSeguro,registrarProductoDesdeExpediente,subirRenderCanonico,voniCouncil,generarRender,buscarProductosMaestroTexto} from '../nube.js';
import CocrearVisual from './CocrearVisual.jsx';
import MisionFlujo from './MisionFlujo.jsx';
import {parametrosEfectivos} from './Costeador.jsx';
import {precioVenta} from '../motor/calculo.js';
import {compileRenderPrompt,renderStale} from '../datos/renderPrompt.js';
import {visualRevisionHash,visualesSincronizados} from '../datos/visualRevision.js';
import {modeloTecnico3DDesdeSpec} from '../datos/productModel3D.js';
import {diagnosticoDesarrolloProducto,compararVariantesProducto} from '../datos/desarrolloProducto.js';
import {contextoCatalogoParaIA,recomendar as recomendarCatalogoVonHaucke} from '../voni/conocimiento.js';
import {explicarCosteo} from '../datos/explicacionCosteo.js';

const MAT_LABEL={nogal:'Nogal',roble:'Roble',encino:'Encino',maple:'Maple',laminado:'Laminado',solid_surface:'Solid surface',cristal:'Cristal',metal:'Metal',piedra:'Piedra'};
const FAMILY_OPTIONS=[[FAMILIA.DESCONOCIDA,'Producto libre'],[FAMILIA.ESCRITORIO,'Operativo / escritorio'],[FAMILIA.MESA,'Mesa'],[FAMILIA.RECEPCION,'Recepción'],[FAMILIA.LOCKER,'Locker'],[FAMILIA.DISPLAY,'Exhibidor'],[FAMILIA.GUARDADO,'Guardado']];
const EJEMPLOS=[
 'Hub colaborativo para 8 personas, vegetación viva, electrificación oculta, divisores acústicos desmontables y escalable a 12 puestos.',
 'Recepción escultórica para lobby corporativo, curva, cálida, con iluminación y guardado oculto.',
 'Mesa de consejo para 14 personas con electrificación, cableado invisible y presencia ejecutiva.',
 'Cabina acústica doble para videollamadas, cristal, ventilación, luz y mesa integrada.',
 'Módulo café corporativo premium con exhibición, barra, almacenamiento y luz integrada.',
];
const clone=x=>JSON.parse(JSON.stringify(x));
const money=(n,cur='MXN')=>Number.isFinite(Number(n))
 ? new Intl.NumberFormat('es-MX',{style:'currency',currency:cur,minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n))
 : '—';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

function entornoNatural(intent,brief=''){
 const t=norm(`${brief} ${intent?._brief||''}`);
 if(/aeropuerto|airport|check.?in|gate|terminal/.test(t)) return 'airport terminal / passenger processing environment';
 if(/supermerc|retail|tienda|exhibidor|display/.test(t)) return 'premium retail or supermarket environment appropriate to the product';
 if(/hotel|hospitality|hosped/.test(t)) return 'high-end hospitality interior';
 if(/hospital|clinica|salud|health/.test(t)) return 'clean healthcare interior';
 if(/cafeter|cafe|coffee/.test(t)) return 'corporate café / hospitality counter environment';
 switch(intent?.familia){
  case FAMILIA.RECEPCION:return 'real corporate lobby and reception environment';
  case FAMILIA.ESCRITORIO:return 'contemporary workplace with believable circulation and adjacent workstations';
  case FAMILIA.MESA:return 'executive boardroom / meeting room';
  case FAMILIA.GUARDADO:return 'executive office or workplace storage zone';
  case FAMILIA.LOCKER:return 'employee locker / operations support area';
  case FAMILIA.DISPLAY:return 'real commercial retail display environment';
  default:return 'premium contract-furniture interior matching the client brief';
 }
}

function councilText(r){
 if(!r)return '';
 const direct=[r.humano,r.summary,r.resumen,r.recommendation,r.recomendacion,r.synthesis?.summary,r.synthesis?.recommendation];
 const d=direct.find(x=>typeof x==='string'&&x.trim());if(d)return d.trim();
 const outs=(r.opinions||[]).filter(x=>x?.ok&&x?.output).map(x=>x.output);
 const ss=outs.map(x=>x?.summary).filter(Boolean);if(ss.length)return ss.join(' · ');
 const recs=outs.flatMap(x=>x?.recommendations||[]).map(x=>x?.what).filter(Boolean);return recs.slice(0,3).join(' · ');
}

function cambioCanonico(base,frase){
 const t=norm(frase);let next=clone(base),cambios=[];
 const local=aplicarCambioTexto(base,frase);
 if(local?.tipo==='aplicado'){next=local.intent;cambios=[...(local.cambios||[])];}
 const feats=new Set(next.caracteristicas||[]);
 const add=(f,label)=>{if(!feats.has(f)){feats.add(f);cambios.push({campo:'feature',a:f,tipo:'feature',label})}};
 const del=(f)=>{if(feats.delete(f))cambios.push({campo:'feature',a:`-${f}`,tipo:'feature'})};
 if(/jardiner|maceter|vegetacion|plantas/.test(t)) add('jardinera_integrada','jardinera integrada');
 if(/jardiner.*(complet|todo|larga|longitud|100%)|(complet|todo|100%).*jardiner|eje central completo/.test(t)) add('jardinera_longitud_completa','jardinera a todo el eje central');
 if(/jardiner.*(corta|parcial|solo centro|pequena)/.test(t)) del('jardinera_longitud_completa');
 if(/electrificacion|cableado|cables|contactos/.test(t)&&/ocult|invisible|integr/.test(t)) add('electrificacion_integrada','electrificación oculta');
 if(/divisor|mampara/.test(t)) add('divisores','divisores');
 if(/acustic/.test(t)) add('acustica','acústica');
 const cap=t.match(/(\d+)\s*(personas?|usuarios?|puestos?|lugares?)/);if(cap){const n=Number(cap[1]);if(n>=2&&n<=24&&n!==Number(next.capacidad_personas||next.capacidad?.personas)){next.capacidad_personas=n;next.capacidad={...(next.capacidad||{}),personas:n};cambios.push({campo:'capacidad',a:n,tipo:'dimension'});}}
 next.caracteristicas=[...feats];
 // Una instrucción de detalle nunca cambia a escondidas el concepto A/B/C.
 next._concepto=base._concepto;next._concepto_nombre=base._concepto_nombre;next._concepto_layout=base._concepto_layout;next.tipologia_cocrear=base.tipologia_cocrear;
 return {next,cambios,aplico:cambios.length>0};
}

async function capturarModeloPNG(expectedVisualHash){
 try{
  const host=document.querySelector('#cocrear-modelo-canonico [data-view="render-reference"]');
  if(!host)return null;
  if(expectedVisualHash && host.dataset.visualRevision!==expectedVisualHash) {
    throw new Error('La referencia 3D visible no corresponde a la revisión visual actual.');
  }
  const svg=host.querySelector('svg');if(!svg)return null;
  const xml=new XMLSerializer().serializeToString(svg),blob=new Blob([xml],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob);
  const img=new Image();await new Promise((ok,err)=>{img.onload=ok;img.onerror=err;img.src=url});
  const cv=document.createElement('canvas');cv.width=1200;cv.height=660;const ctx=cv.getContext('2d');ctx.fillStyle='#111315';ctx.fillRect(0,0,cv.width,cv.height);ctx.drawImage(img,0,0,cv.width,cv.height);URL.revokeObjectURL(url);
  return cv.toDataURL('image/png').split(',')[1]||null;
 }catch{return null}
}
function Card({children,style={}}){return <div style={{background:'#171717',border:'1px solid #303236',borderRadius:14,padding:14,...style}}>{children}</div>}
function Label({children}){return <div style={{fontSize:10,letterSpacing:1.25,textTransform:'uppercase',color:'#8992a2',fontWeight:800,marginBottom:7}}>{children}</div>}
function Btn({children,onClick,disabled=false,ghost=false,style={}}){return <button type="button" disabled={disabled} onClick={onClick} style={{borderRadius:10,padding:'9px 13px',fontSize:13,fontWeight:800,border:ghost?'1px solid #50545a':'1px solid #d13b30',background:ghost?'transparent':disabled?'#34211f':'#c93429',color:disabled?'#776b69':'#fff',cursor:disabled?'not-allowed':'pointer',...style}}>{children}</button>}

export default function Cocrear({estado,onAgregar,onIr,rol='ventas',usuarioEmail=null}){
 const [fase,setFase]=useState('inicio'),[texto,setTexto]=useState(''),[intent,setIntent]=useState(null),[historia,setHistoria]=useState([]),[conceptos,setConceptos]=useState([]);
 const [analisis,setAnalisis]=useState(null),[aiError,setAiError]=useState(''),[pensando,setPensando]=useState(false),[nl,setNl]=useState(''),[mensaje,setMensaje]=useState('');
 const [guardando,setGuardando]=useState(false),[guardado,setGuardado]=useState(false),[expedienteId,setExpedienteId]=useState(null),[guardadas,setGuardadas]=useState([]),[guardadasError,setGuardadasError]=useState(''),[guardadasReload,setGuardadasReload]=useState(0);
 const [render,setRender]=useState(null),[renderCargando,setRenderCargando]=useState(false),[renderError,setRenderError]=useState(''),[comparA,setComparA]=useState(null),[cotizadoHash,setCotizadoHash]=useState(null);
 const [refs,setRefs]=useState(null),[refsCargando,setRefsCargando]=useState(false);
 const [catalogoCandidatos,setCatalogoCandidatos]=useState([]);

 const insumos=estado?.insumos||{};
 const par=useMemo(()=>parametrosEfectivos(estado,{componentes:[]}).par||estado?.parametros||{},[estado]);
 const rev=historia.length||1,bom=(intent&&intent._componentes)||[];
 const engineeringValidation=intent?._engineering_validation||null;
 const engineeringValidated=!!(
   intent?._engineering_validated
   && engineeringValidation?.visual_hash
   && engineeringValidation.visual_hash===visualRevisionHash(
     construirProductSpec(intent,extraerDNA(intent),clasificarProducto(intent,{}),{rev,componentes:bom})
   )
 );
 const spec=useMemo(()=>intent?construirProductSpec(intent,extraerDNA(intent),clasificarProducto(intent,{}),{
   rev,componentes:bom,
   engineering_validated:engineeringValidated,
   engineering_validation:engineeringValidated?engineeringValidation:null,
 }):null,[intent,rev,bom,engineeringValidated,engineeringValidation]);
 const pipeline=useMemo(()=>intent?cocrearDesdeIntent(intent,{
   insumos,par,rev,componentes:bom,
   engineering_validated:engineeringValidated,
   engineering_validation:engineeringValidated?engineeringValidation:null,
 }):null,[intent,insumos,par,rev,bom,engineeringValidated,engineeringValidation]);
 const explicacionCosteo=useMemo(
   ()=>pipeline?.costo?.costeo?explicarCosteo(pipeline.costo.costeo,{nombre:intent?._concepto_nombre||intent?.familia||'Producto co-creado',cantidad:1}):null,
   [pipeline?.costo?.costeo,intent?._concepto_nombre,intent?.familia]
 );
 const resumen=useMemo(()=>intent?resumenIdeaCocrear(intent,texto):null,[intent,texto]);
 const modelo3d=useMemo(()=>spec?modeloTecnico3DDesdeSpec(spec):null,[spec]);
 const visualSync=useMemo(()=>spec?visualesSincronizados({spec,render,model3d:modelo3d}):{synchronized:true},[spec,render,modelo3d]);
 const rStale=!!(render&&spec&&(renderStale(render,spec)||!visualSync.render_ok));
 const refUI=useMemo(()=>formatearReferenciaCocrear(refs),[refs]);
 const estimado=useMemo(()=>estimadoDisenoCocrear(intent,insumos),[intent,insumos]);
 const desarrollo=useMemo(()=>spec?diagnosticoDesarrolloProducto(spec):null,[spec]);
 const comparSpecA=useMemo(()=>comparA?construirProductSpec(
   comparA,extraerDNA(comparA),clasificarProducto(comparA,{}),
   {rev:'A',componentes:comparA._componentes||[]}
 ):null,[comparA]);
 const comparPipelineA=useMemo(()=>comparA?cocrearDesdeIntent(comparA,{
   insumos,par,rev:'A',componentes:comparA._componentes||[]
 }):null,[comparA,insumos,par]);
 const comparativaAB=useMemo(()=>comparSpecA&&spec?compararVariantesProducto(
   comparSpecA,spec,
   comparPipelineA?.costo?.official_cost,
   pipeline?.costo?.official_cost,
 ):null,[comparSpecA,spec,comparPipelineA,pipeline]);
 const puedeAprobarRol=rol==='direccion'||rol==='diseno';
 const ingenieriaListaParaRevision=!!(
   spec?.componentes?.length
   && desarrollo?.estado==='ANALIZADO'
   && modelo3d?.status==='EXPLODED_READY'
 );
 const alcance=useMemo(()=>detectarAlcanceCocrear(texto||intent?._brief||''),[texto,intent]);

 useEffect(()=>{
  if(fase!=='inicio')return;
  let live=true;setGuardadasError('');setGuardadas([]);
  listarCocreaciones(12)
    .then(r=>{if(!live)return;if(r?.ok)setGuardadas(r.items||[]);else setGuardadasError(r?.error||'No se pudieron cargar las co-creaciones guardadas.');})
    .catch(e=>{if(live)setGuardadasError(String(e?.message||e||'No se pudieron cargar las co-creaciones guardadas.'))});
  return()=>{live=false}
 },[fase,guardadasReload]);
 useEffect(()=>{if(fase!=='studio'||!intent)return;let live=true;setRefsCargando(true);referenciasComercialesCocrear(intent).then(r=>{if(live)setRefs(r)}).finally(()=>{if(live)setRefsCargando(false)});return()=>{live=false}},[fase,intent?._concepto,intent?.capacidad_personas,intent?.familia]);

 const reset=()=>{setFase('inicio');setIntent(null);setHistoria([]);setConceptos([]);setAnalisis(null);setAiError('');setRender(null);setMensaje('');setExpedienteId(null);setComparA(null);setRefs(null)};
 const commit=(next,label)=>{
  // Cualquier cambio técnico/visual invalida la aprobación de ingeniería previa.
  const limpio={...next,_engineering_validated:false,_engineering_validation:null};
  setIntent(limpio);
  setHistoria(h=>[...h,{rev:h.length+1,intent:clone(limpio),label}]);
  setGuardado(false);
  // Una revisión visual nueva jamás comparte pantalla con un render viejo.
  // El 3D se deriva inmediatamente del spec; el fotográfico se regenera después.
  setRender(null);
  setRenderError('');
  setCotizadoHash(null);
 };

 const generarPara=async(nextIntent,nextSpec)=>{
  if(!nextSpec)return;setRenderCargando(true);setRenderError('');
  try{
   const c=compileRenderPrompt(nextSpec,nextSpec.dna);
   const descripcion=`${c.descripcion}\nCLIENT BRIEF: ${nextIntent?._brief||texto}. SELECTED CONCEPT: ${nextIntent?._concepto||''} ${nextIntent?._concepto_nombre||''}. The image MUST preserve the exact current-revision geometry shown in the supplied technical reference. Do not redesign the product.`;
   const modelo=await capturarModeloPNG(c.visualRevisionHash);
   if(!modelo) throw new Error('No existe una referencia 3D verificable de esta revisión. Render bloqueado para evitar divergencia visual.');
   const r=await generarRender(descripcion,{
     render_spec:c.render_spec,materiales:c.materiales,medidas:c.medidas,
     tipo:c.tipo,
     // El 3D canónico ya cubre la lectura técnica. El fotográfico debe enseñar
     // cómo vive el producto en un espacio real, sin perder la geometría.
     modo:'ambiente',entorno:entornoNatural(nextIntent,nextIntent?._brief||texto),aspecto:'3:2',calidad:'2K',
     imagen:modelo,mediaType:'image/png',
     visual_revision_hash:c.visualRevisionHash,
   });
   if(r?.ok&&r.dataUrl)setRender({
     dataUrl:r.dataUrl,
     specHash:nextSpec.hash,
     visualRevisionHash:c.visualRevisionHash,
     expected:c.expected,version:c.version,concepto:nextIntent?._concepto||null
   });else throw new Error(r?.error||'No se pudo generar el render');
  }catch(e){setRenderError(String(e?.message||e))}finally{setRenderCargando(false)}
 };
 const generar=()=>generarPara(intent,spec);

 const analizarIdea=async()=>{
  const brief=texto.trim();if(!brief||pensando)return;setPensando(true);setAiError('');setMensaje('');
  const base=prepararIntentCocrear(brief);setIntent(base);
  try{
   const ctx=resumenIdeaCocrear(base,brief);
   const vh=contextoCatalogoParaIA(brief);
   const master=await buscarProductosMaestroTexto(brief,30);
   const vhReal={...vh,producto_maestro:master?.items||[]};
   setCatalogoCandidatos(vh.candidatos||[]);
   const r=await voniCouncil({
     task:'review_product',
     request:`COCREACIÓN. Interpreta esta idea completa sin convertirla en un mueble genérico: ${brief}`,
     context:{...ctx,intent:base,von_haucke:vhReal},
     constraints:[
       'No inventar costos',
       'Conservar intención completa',
       'Priorizar fabricabilidad Von Haucke',
       'ANTES de proponer un especial, revisar TODAS las líneas/productos/configuraciones Von Haucke provistas en context.von_haucke',
       'Si una línea real resuelve el brief, identificar ruta + producto + variante; no rediseñarla',
       'Si sólo cambian opciones permitidas: CONFIGURED_LINE_PRODUCT',
       'Si existe padre real pero hay cambios fuera del set: DERIVED_SPECIAL y conservar linaje',
       'NEW_SPECIAL sólo cuando ninguna línea/producto real sea padre razonable',
       'Von Haucke sí fabrica a la medida; custom es válido, pero nunca debe ocultar que existe una solución de línea',
       'Distinguir claramente alternativas geométricas'
     ],
     lenses:['portafolio Von Haucke','diseño de producto','ingeniería/fabricación','uso','comercial']
   });
   if(r?.ok===false)throw new Error(r.error||'VONI Council no respondió');setAnalisis(r||{});
  }catch(e){setAiError(String(e?.message||e))}
  setConceptos(conceptosCocrear(base));setFase('conceptos');setPensando(false);
 };

 const elegirConcepto=async c=>{
  const next=aplicarConceptoCocrear(intent,c);
  setIntent(next);setHistoria([{rev:1,intent:clone(next),label:`Concepto ${c.id}: ${c.nombre}`}]);setFase('studio');setRender(null);setComparA(null);
  const nextSpec=construirProductSpec(next,extraerDNA(next),clasificarProducto(next,{}),{rev:1,componentes:next._componentes||[]});
  // Espera a que el modelo canónico de ESTA revisión esté montado: esa imagen se usa como referencia del render.
  await new Promise(r=>setTimeout(r,120));await generarPara(next,nextSpec);
 };
 const desdeCero=()=>{const b=prepararIntentCocrear('producto especial modular');b.familia=FAMILIA.DESCONOCIDA;b._brief='Producto especial desde cero';b.dimensiones={...DIMS_DEFAULT[FAMILIA.DESCONOCIDA]};setTexto('Producto especial desde cero');setIntent(b);setHistoria([{rev:1,intent:clone(b),label:'Base libre'}]);setFase('studio')};
 const setDim=(k,v)=>commit({...intent,dimensiones:{...(intent.dimensiones||{}),[k]:Number(v)}},`${k}: ${v} mm`);
 const setFamilia=f=>{const dd=DIMS_DEFAULT[f]||DIMS_DEFAULT[FAMILIA.DESCONOCIDA];commit({...intent,familia:f,dimensiones:{...dd,...(intent.dimensiones||{})}},`Tipología: ${FAMILY_OPTIONS.find(([x])=>x===f)?.[1]||f}`)};
 const setCap=n=>commit({...intent,capacidad_personas:Number(n),capacidad:{...(intent.capacidad||{}),personas:Number(n)}},`Capacidad: ${n}`);
 const setMaterial=m=>commit({...intent,materiales:[{material:m,tono:intent.materiales?.[0]?.tono||null},...(intent.materiales||[]).slice(1)]},`Material: ${MAT_LABEL[m]||m}`);
 const setTone=tono=>commit({...intent,materiales:[{material:intent.materiales?.[0]?.material||'laminado',tono},...(intent.materiales||[]).slice(1)]},`Tono: ${tono||'natural'}`);
 const toggleFeature=f=>{const s=new Set(intent.caracteristicas||[]);s.has(f)?s.delete(f):s.add(f);commit({...intent,caracteristicas:[...s]},`${s.has(f)?'Agregar':'Quitar'} ${FEATURES_COCREAR.find(([k])=>k===f)?.[1]||f}`)};

 const pedirVoni=async()=>{
  const frase=nl.trim();if(!frase||pensando)return;setPensando(true);setMensaje('');
  const cambio=cambioCanonico(intent,frase);const next=cambio.aplico?cambio.next:intent;
  if(cambio.aplico)commit(next,`VONI: ${frase.slice(0,58)}`);
  try{
   const nextRev=historia.length+(cambio.aplico?1:0)||1;
   const nextSpec=construirProductSpec(next,extraerDNA(next),clasificarProducto(next,{}),{rev:nextRev,componentes:next._componentes||[]});
   const vh=contextoCatalogoParaIA(`${texto} ${frase}`);
   const master=await buscarProductosMaestroTexto(`${texto} ${frase}`,30);
   const vhReal={...vh,producto_maestro:master?.items||[]};
   setCatalogoCandidatos(vh.candidatos||[]);
   const r=await voniCouncil({
     task:'interpret_change',request:frase,
     context:{brief:texto,intent:next,spec:nextSpec,resumen,von_haucke:vhReal},
     constraints:['No inventar costos','No cambiar el concepto seleccionado silenciosamente','Revisar compatibilidad con línea/variante/acabado Von Haucke antes de convertir el cambio en custom','La instrucción debe afectar el ProductSpec canónico si es concreta','Proponer cambios explícitos y fabricables'],
     lenses:['portafolio Von Haucke','diseño','fabricación','uso']
   });setAnalisis(r||{});
   const txt=councilText(r)||'VONI revisó la modificación.';
   setMensaje(cambio.aplico?`✓ Cambio aplicado a la revisión canónica. ${txt} El render anterior quedó vencido; regénéralo para ver exactamente esta revisión.`:txt);
   setNl('');
  }catch(e){setMensaje(cambio.aplico?`✓ Cambio aplicado al modelo. Council no pudo responder: ${String(e?.message||e)}`:`VONI no pudo responder: ${String(e?.message||e)}`)}
  setPensando(false)
 };

 const guardar=async()=>{if(!intent)return;setGuardando(true);setMensaje('');try{const r=await guardarCocrearSeguro(expedienteId,cocrearPayload({brief:texto,intent,historia,render,insumos,par}));if(!r?.ok)throw new Error(r?.error||'No se pudo guardar');if(r.expediente_id)setExpedienteId(r.expediente_id);setGuardado(true);setMensaje('✓ Co-creación guardada.');}catch(e){setMensaje(`No se pudo guardar: ${String(e?.message||e)}`)}setGuardando(false)};
 const reabrir=async id=>{try{const r=await cargarCocrearSeguro(id);const est=r?.ok?cocrearDeExpediente({cocrear:r.cocrear}):null;if(!est?.intent)throw new Error('Expediente sin intención válida');setIntent(est.intent);setHistoria(est.historia?.length?est.historia:[{rev:1,label:'Reabierta',intent:est.intent}]);setTexto(est.brief||est.intent?._brief||'');setExpedienteId(id);setRender(null);setFase('studio')}catch(e){setMensaje(String(e?.message||e))}};

 const validarIngenieria=()=>{
  if(!puedeAprobarRol){
    setMensaje('Sólo Diseño o Dirección pueden validar ingeniería.');
    return;
  }
  if(!ingenieriaListaParaRevision){
    setMensaje('Ingeniería todavía no puede validarse: completa materiales y geometría del BOM hasta tener un Despiece 3D completo.');
    return;
  }
  const visual_hash=visualRevisionHash(spec);
  const evidencia={
    validador:usuarioEmail||rol,
    rol,
    fecha:new Date().toISOString(),
    visual_hash,
    spec_hash_prevalidacion:spec.hash,
    motivo:'BOM, geometría, materiales y fabricabilidad revisados explícitamente en Cocrear.',
  };
  const next={...intent,_engineering_validated:true,_engineering_validation:evidencia};
  setIntent(next);
  setHistoria(h=>[...h,{rev:h.length+1,intent:clone(next),label:`Ingeniería validada · ${rol}`}]);
  setGuardado(false);
  setCotizadoHash(null);
  setMensaje(`✓ Ingeniería validada por ${usuarioEmail||rol}. Cualquier cambio posterior invalidará esta aprobación.`);
 };

 const costoRaw=pipeline?.costo?.official_cost;
 const costoOficial=Number(costoRaw),costoConocido=costoRaw!=null&&Number.isFinite(costoOficial)&&costoOficial>=0;
  const listaParaCotizar=pipeline?.lineaCotizacion?.listaParaCotizar===true;
  const bloqueosCocrear=pipeline?.blockers||[];
 const agregarCotizacion=async()=>{
  if(!listaParaCotizar||!onAgregar){
    const motivo=pipeline?.lineaCotizacion?.motivo||bloqueosCocrear[0]||'falta validación del producto';
    setMensaje(`Todavía no puede convertirse en partida: ${motivo}. El costo calculado no sustituye la validación de ingeniería.`);
    return
  }
  let id=expedienteId,prodId=null,versionId=null;
  let avisoRender='';
  try{
    if(!id){
      const s=await guardarCocrearSeguro(null,cocrearPayload({brief:texto,intent,historia,render,insumos,par}));
      if(!s?.ok||!s?.expediente_id)throw new Error(s?.error||'No se pudo crear el expediente canónico.');
      id=s.expediente_id;setExpedienteId(id);
    }
    const reg=await registrarProductoDesdeExpediente(id);
    if(!reg?.ok||!reg?.version_id)throw new Error(reg?.error||'No se pudo registrar la revisión canónica del producto.');
    prodId=reg.producto_id;versionId=reg.version_id;

    if(render&&!rStale){
      const rc=compileRenderPrompt(spec,spec.dna);
      const geometryHash=visualRevisionHash(spec);
      const up=await subirRenderCanonico({
        expedienteId:id,productoId:prodId,productoVersionId:versionId,
        dataUrl:render.dataUrl,promptVersion:render.version,modo:'render',
        specHash:spec.hash,geometryHash,inputs:rc.expected||{},
      });
      if(!up?.ok)avisoRender=` Render canónico pendiente: ${up?.error||'no se pudo registrar'}.`;
    }
  }catch(e){
    setMensaje(`No se agregó a la cotización: ${String(e?.message||e)}`);
    return;
  }
  const margen=Number.isFinite(Number(par.margenObjetivo))?Number(par.margenObjetivo):50;
  const pv=precioVenta(costoOficial,par).precio;
  onAgregar({
    nombre:intent?._concepto_nombre||resumen?.tipologia||'Producto co-creado',
    componentes:spec.componentes,
    w:spec.dimensiones?.ancho_mm||null,
    d:spec.dimensiones?.prof_mm||spec.dimensiones?.fondo_mm||null,
    productoId:prodId,productVersionId:versionId,precioReal:false,config:null
  },1,pv,margen);
  setCotizadoHash(spec.hash);
  setMensaje(`✓ Revisión canónica agregada a cotización.${avisoRender}`);
 };

 const misionCocrear=useMemo(()=>{
   const tieneIdea=!!String(texto||'').trim();
   const tieneConceptos=(conceptos||[]).length>0;
   const tieneSpec=!!spec?.componentes?.length;
   const costoOk=Number.isFinite(Number(pipeline?.costo?.official_cost));
   const renderOk=!!render&&!rStale;
   const paso=fase==='inicio'?1:fase==='conceptos'?2:engineeringValidated&&costoOk?4:3;
   return {
     paso,
     estado:(fase==='studio'&&engineeringValidated&&costoOk)?'ok':(fase==='studio'&&!tieneSpec?'blocked':'attention'),
     resumen:fase==='inicio'
       ?'Describe lo que necesitas; VONI buscará primero si Von Haucke ya lo resuelve.'
       :fase==='conceptos'
         ?'Compara direcciones antes de convertir una idea en BOM.'
         :!tieneSpec
           ?'El concepto todavía no está bajado a un BOM fabricable.'
           :!engineeringValidated
             ?'Ya hay producto y costo, pero Ingeniería todavía debe validar esta revisión.'
             :'Diseño, BOM y costo están trazados en la misma revisión.',
     siguiente:fase==='inicio'
       ?'Escribe la necesidad del cliente o usa un ejemplo.'
       :fase==='conceptos'
         ?'Elige la dirección que mejor conserva la intención.'
         :!tieneSpec
           ?'Completa materiales/componentes del BOM.'
           :!engineeringValidated
             ?'Revisa modelo técnico y valida Ingeniería.'
             :!renderOk
               ?'Genera o actualiza el render canónico de esta revisión.'
               :'Guarda y agrega la revisión canónica a la cotización.',
     items:[
       {key:'idea',label:'Brief',ok:tieneIdea},
       {key:'concepto',label:'Concepto',ok:!!intent||tieneConceptos},
       {key:'bom',label:'BOM fabricable',ok:tieneSpec},
       {key:'ing',label:'Ingeniería',ok:engineeringValidated},
       {key:'costo',label:'Costo trazado',ok:costoOk},
       {key:'render',label:'Render sincronizado',ok:renderOk},
     ],
   };
 },[fase,texto,conceptos,intent,spec,pipeline?.costo?.official_cost,engineeringValidated,render,rStale]);

 const css=<style>{`.coc3{max-width:1240px;margin:0 auto;font-size:14px}.c3-title{font-size:clamp(30px,3vw,44px);line-height:1.06;margin:5px 0 9px}.c3-lead{font-size:16px;color:#b7b2af;max-width:850px;line-height:1.5}.c3-concepts{display:grid;grid-template-columns:320px minmax(0,1fr);gap:13px}.c3-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.c3-studio{display:grid;grid-template-columns:245px minmax(0,1fr) 300px;gap:11px;align-items:start}.c3-hero{min-height:330px;display:flex;align-items:center;justify-content:center;background:#111315;border-radius:11px;overflow:hidden}.c3-hero img{width:100%;height:auto;display:block}.c3-input{width:100%;box-sizing:border-box;background:#22201f;color:#fff;border:1px solid #444;border-radius:9px;padding:8px}.c3-small{font-size:11px;color:#9ca3ad}.c3-ref{background:#121b16;border:1px solid #28553b;border-radius:10px;padding:10px;margin-top:10px}.c3-refrow{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid #26352b;font-size:11px}.c3-history{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.c3-history button{background:#202225;color:#cfd3d7;border:1px solid #393d42;border-radius:999px;padding:5px 8px;font-size:10px}@media(max-width:1050px){.c3-studio{grid-template-columns:230px minmax(0,1fr)}.c3-right{grid-column:1/-1}.c3-concepts{grid-template-columns:1fr}}@media(max-width:760px){.c3-studio,.c3-concepts,.c3-cards{grid-template-columns:1fr}.c3-title{font-size:32px}}`}</style>;

 if(fase==='inicio')return <div className="contenido coc3">{css}<MisionFlujo titulo="Misión · cocrear un producto" paso={misionCocrear.paso} total={4} estado={misionCocrear.estado} resumen={misionCocrear.resumen} siguiente={misionCocrear.siguiente} items={misionCocrear.items}/><Label>VON HAUCKE · COCREAR</Label><h1 className="c3-title">¿Qué quieres crear?</h1><p className="c3-lead">Describe el problema o la idea. VONI propone direcciones de diseño; al elegir una, render, modelo técnico y referencias comerciales quedan amarrados al mismo concepto.</p><Card style={{marginTop:16}}><textarea value={texto} onChange={e=>setTexto(e.target.value)} rows={4} placeholder="Ej. Hub colaborativo para 8 personas, vegetación integrada, cableado oculto y escalable a 12…" className="c3-input" style={{fontSize:15,padding:13}}/><div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:9}}>{EJEMPLOS.map((e,i)=><button key={i} onClick={()=>setTexto(e)} style={{background:'#242220',color:'#ddd',border:'1px solid #414141',borderRadius:999,padding:'6px 9px',fontSize:10,cursor:'pointer'}}>{e.split(',')[0]}</button>)}</div><div style={{display:'flex',gap:8,marginTop:12}}><Btn onClick={analizarIdea} disabled={!texto.trim()||pensando}>{pensando?'VONI analizando…':'Crear conceptos con VONI →'}</Btn><Btn ghost onClick={desdeCero}>Empezar desde cero</Btn></div></Card>{guardadasError&&<div style={{marginTop:14,padding:'8px 10px',border:'1px solid #70483e',borderRadius:9,color:'#ffb4aa',fontSize:11,display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}><span>No pude cargar tus co-creaciones guardadas: {guardadasError}</span><button type="button" onClick={()=>setGuardadasReload(x=>x+1)} style={{background:'transparent',border:'1px solid #8b5a4d',color:'#ffd0c6',borderRadius:7,padding:'5px 8px',cursor:'pointer'}}>Reintentar</button></div>}{guardadas.length>0&&<div style={{marginTop:18}}><Label>Guardadas</Label><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:7}}>{guardadas.map(x=><button key={x.id} onClick={()=>reabrir(x.id)} style={{textAlign:'left',background:'#171717',border:'1px solid #333',borderRadius:9,padding:10,color:'#fff',cursor:'pointer'}}><strong>{x.nombre||'Co-creación'}</strong><div className="c3-small">{x.producto_tipo||'Producto especial'} · reabrir</div></button>)}</div></div>}</div>;

 if(fase==='conceptos')return <div className="contenido coc3">{css}<MisionFlujo titulo="Misión · cocrear un producto" paso={misionCocrear.paso} total={4} estado={misionCocrear.estado} resumen={misionCocrear.resumen} siguiente={misionCocrear.siguiente} items={misionCocrear.items}/><div style={{display:'flex',justifyContent:'space-between',alignItems:'start'}}><div><Label>VONI · lectura de idea</Label><h1 style={{fontSize:29,margin:'2px 0'}}>Tres direcciones, una misma intención</h1></div><Btn ghost onClick={reset}>‹ Nueva idea</Btn></div>{alcance.scope==='project'&&<div style={{background:'#10233a',border:'1px solid #2b5f8f',borderRadius:12,padding:'12px 14px',margin:'12px 0'}}><strong style={{color:'#cfe6ff'}}>Esto es un PROYECTO completo{alcance.personas?` (~${alcance.personas} personas)`:''}, no un solo mueble.</strong><p style={{fontSize:13,color:'#b9c7d6',margin:'5px 0 9px',lineHeight:1.45}}>Cocrear desarrolla un sistema a la vez. Para el proyecto entero conviene el <b>Cotizador por plano</b>: sube tu plano y te arma el <b>programa por área</b> (recepción, operativos, salas, dirección…) → productos → acomodo. Cada sistema lo afinas aquí en Cocrear.</p>{onIr&&<Btn onClick={()=>onIr('cotizarIA')}>Ir al Cotizador por plano →</Btn>}</div>}<div className="c3-concepts" style={{marginTop:13}}><Card><Label>Lo que entendimos</Label><p style={{fontSize:14,lineHeight:1.45}}>{resumen?.necesidad}</p><div style={{display:'grid',gap:5,fontSize:12,color:'#c8c8c8'}}><div><b>Tipología:</b> {resumen?.tipologia}</div><div><b>Capacidad:</b> {resumen?.capacidad}</div><div><b>Envolvente:</b> {resumen?.envolvente}</div><div><b>Claves:</b> {resumen?.claves?.join(' · ')||'por definir'}</div></div><hr style={{borderColor:'#303236',margin:'13px 0'}}/><Label>Análisis VONI Council</Label>{aiError?<p style={{color:'#ffb4aa',fontSize:11}}>Council no disponible: {aiError}</p>:<p style={{fontSize:12,lineHeight:1.45,color:'#ddd'}}>{councilText(analisis)||'VONI revisó intención, uso y fabricabilidad.'}</p>}</Card><div>{catalogoCandidatos.length>0&&<Card style={{marginBottom:10,borderColor:'#3f5d49'}}><Label>Primero · ¿ya existe en Von Haucke?</Label><div style={{fontSize:11,color:'#bdd7c5',lineHeight:1.45,marginBottom:8}}>VONI encontró candidatos reales del portafolio. Son referencia, no linaje confirmado: si uno resuelve el brief, conviene configurarlo antes de inventar un especial.</div><div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{catalogoCandidatos.slice(0,8).map(l=><span key={l.ruta} style={{padding:'5px 8px',borderRadius:999,border:'1px solid #476650',fontSize:10,color:'#d9efe0'}}><b>{l.linea}</b>{l.productos?.length?` · ${l.productos.length} variantes`:''}</span>)}</div></Card>}<Label>Elige una dirección</Label><div className="c3-cards">{conceptos.map(c=><Card key={c.id} style={{display:'flex',flexDirection:'column',minHeight:215}}><div style={{color:'#d33b30',fontSize:22,fontWeight:900}}>{c.id}</div><h2 style={{fontSize:17,margin:'6px 0 3px'}}>{c.nombre}</h2><div style={{fontSize:9,color:'#999',fontWeight:800,textTransform:'uppercase'}}>{c.subtitulo}</div><p style={{fontSize:12,lineHeight:1.42,flex:1}}>{c.descripcion}</p><Btn onClick={()=>elegirConcepto(c)}>Desarrollar →</Btn></Card>)}</div></div></div></div>;

 const dims=intent?.dimensiones||{},feats=new Set(intent?.caracteristicas||[]),mat=intent?.materiales?.[0]?.material||'laminado',tone=intent?.materiales?.[0]?.tono||null;
 return <div className="contenido coc3">{css}<MisionFlujo titulo="Misión · cocrear un producto" paso={misionCocrear.paso} total={4} estado={misionCocrear.estado} resumen={misionCocrear.resumen} siguiente={misionCocrear.siguiente} items={misionCocrear.items}/><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:9}}><div><button onClick={()=>setFase('inicio')} style={{background:'none',border:0,color:'#aaa',cursor:'pointer'}}>‹ Nueva idea</button><strong style={{marginLeft:9,fontSize:17}}>{intent?._concepto?`Concepto ${intent._concepto} · `:''}{intent?._concepto_nombre||resumen?.tipologia||'Producto co-creado'}</strong><span style={{fontSize:9,color:'#8992a2',marginLeft:7}}>REV {rev}</span></div><div style={{display:'flex',gap:6}}><Btn ghost onClick={()=>setComparA(comparA?null:clone(intent))}>{comparA?'Salir A/B':'Comparar A/B'}</Btn><Btn ghost onClick={guardar} disabled={guardando}>{guardando?'Guardando…':guardado?'✓ Guardado':'Guardar'}</Btn></div></div>
 <div className="c3-studio">
  <Card><Label>Diseño</Label><div style={{marginBottom:9}}><small>Tipología</small><select value={intent?.familia||FAMILIA.DESCONOCIDA} onChange={e=>setFamilia(e.target.value)} className="c3-input" style={{marginTop:3}}>{FAMILY_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>{intent?.tipologia_cocrear==='operativo_colaborativo'&&<div style={{marginBottom:9}}><small>Personas / puestos</small><input type="number" min="2" max="24" value={intent.capacidad_personas||6} onChange={e=>setCap(e.target.value)} className="c3-input" style={{marginTop:3}}/></div>}<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4,marginBottom:10}}>{[['ancho_mm','Ancho'],['prof_mm','Fondo'],['alto_mm','Alto']].map(([k,l])=><label key={k} style={{fontSize:9,color:'#aaa'}}>{l}<input type="number" value={dims[k]||0} onChange={e=>setDim(k,e.target.value)} className="c3-input" style={{padding:5,marginTop:2}}/></label>)}</div><Label>Material</Label><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4}}>{MATERIALES_EDIT.map(m=><button key={m} onClick={()=>setMaterial(m)} style={{padding:'6px 2px',borderRadius:7,border:mat===m?'2px solid #d33b30':'1px solid #414141',background:'#22201f',color:'#fff',fontSize:9}}>{MAT_LABEL[m]||m}</button>)}</div><Label>Tono</Label><div style={{display:'flex',gap:4}}>{[['claro','Claro'],[null,'Natural'],['oscuro','Oscuro']].map(([v,l])=><button key={l} onClick={()=>setTone(v)} style={{flex:1,padding:6,borderRadius:7,border:tone===v?'2px solid #d33b30':'1px solid #414141',background:'#22201f',color:'#fff',fontSize:9}}>{l}</button>)}</div><Label>Funciones</Label><div style={{display:'flex',flexWrap:'wrap',gap:4}}>{FEATURES_COCREAR.map(([k,l])=><button key={k} onClick={()=>toggleFeature(k)} style={{padding:'5px 6px',borderRadius:999,border:feats.has(k)?'1px solid #d33b30':'1px solid #414141',background:feats.has(k)?'#3b211f':'transparent',color:'#fff',fontSize:9}}>{feats.has(k)?'✓ ':'+ '}{l}</button>)}</div></Card>

  <div>{comparA?<Card><Label>Comparación A/B · ingeniería</Label><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}><CocrearVisual spec={comparSpecA} intent={comparA}/><CocrearVisual spec={spec} intent={intent}/></div>
   {comparativaAB&&<div style={{marginTop:9,padding:9,border:'1px solid #363a3f',borderRadius:9}}>
     <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:6,fontSize:10}}>
       <div>Piezas Δ <b>{comparativaAB.delta.piezas_totales>0?'+':''}{comparativaAB.delta.piezas_totales}</b></div>
       <div>Materiales Δ <b>{comparativaAB.delta.familias_material>0?'+':''}{comparativaAB.delta.familias_material}</b></div>
       <div>Geometrías Δ <b>{comparativaAB.delta.geometrias_distintas>0?'+':''}{comparativaAB.delta.geometrias_distintas}</b></div>
       <div>Costo Δ <b>{comparativaAB.costo_comparable?money(comparativaAB.delta.costo):'No comparable'}</b></div>
     </div>
     <div style={{fontSize:9,color:'#8f98a8',marginTop:6}}>B − A · comparación determinista. Menos piezas, materiales o costo NO significa automáticamente mejor producto; VONI conserva función, desempeño e intención como restricciones.</div>
   </div>}
   <div style={{marginTop:6,fontSize:10,color:visualSync.synchronized?'#79c990':'#e0a36f'}}>
     {visualSync.synchronized?'✓ Render y modelo 3D comparten la misma revisión visual.':'⚠ La revisión cambió: el 3D ya está actualizado y el render fotográfico requiere regeneración.'}
   </div></Card>:<Card style={{padding:8}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 5px 8px'}}><div><Label>Render IA · Concepto {intent?._concepto||'—'}</Label><strong style={{fontSize:13}}>{intent?._concepto_nombre||'Visualización principal'}</strong></div><Btn onClick={generar} disabled={renderCargando}>{renderCargando?'Generando…':render?'Regenerar':'Generar render'}</Btn></div><div className="c3-hero">{renderCargando?<div style={{textAlign:'center'}}><strong>VONI está construyendo el concepto {intent?._concepto}</strong><p className="c3-small">Usando el modelo canónico de esta revisión como referencia de geometría.</p></div>:render?<div style={{width:'100%'}}>{rStale&&<div style={{padding:8,background:'#4a2d16',color:'#ffd09c',fontSize:10}}>El diseño cambió. Este render está vencido; regenera para representar la revisión actual.</div>}<img src={render.dataUrl} alt={`Render del concepto ${intent?._concepto||''}`} style={{opacity:rStale?.62:1}}/></div>:<div style={{textAlign:'center'}}><strong>Sin render de esta revisión</strong><p className="c3-small">Genera la visualización usando el modelo 3D como referencia.</p><Btn onClick={generar}>Generar render</Btn></div>}</div>{renderError&&<p style={{color:'#ff9d93',fontSize:10}}>{renderError}</p>}</Card>}{!comparA&&<div id="cocrear-modelo-canonico" style={{marginTop:8}}><CocrearVisual spec={spec} intent={intent}/></div>}<div className="c3-history">{historia.map(h=><button key={h.rev} onClick={()=>{setIntent(clone(h.intent));setRender(null);setRenderError('');setCotizadoHash(null);setMensaje(`Viendo Rev ${h.rev}: ${h.label}. El render fotográfico se invalidó para evitar mezclar revisiones.`)}}>R{h.rev} · {h.label}</button>)}</div></div>

  <div className="c3-right" style={{display:'grid',gap:10}}><Card><Label>VONI · Co-diseñador</Label><p style={{fontSize:11,color:'#aaa',lineHeight:1.4}}>Pídele un cambio concreto. Si la instrucción es inequívoca, primero cambia el modelo canónico; el render viejo queda vencido hasta regenerarlo.</p><textarea value={nl} onChange={e=>setNl(e.target.value)} rows={3} placeholder="Ej. Haz la jardinera completa a todo el eje central y conserva el resto exactamente igual." className="c3-input"/><Btn onClick={pedirVoni} disabled={!nl.trim()||pensando} style={{width:'100%',marginTop:6}}>{pensando?'Analizando…':'Aplicar con VONI'}</Btn>{mensaje&&<p style={{fontSize:10,lineHeight:1.4}}>{mensaje}</p>}</Card>
  <Card>
   <Label>VONI Industrial · desarrollo</Label>
   {desarrollo&&desarrollo.metricas.piezas_totales>0
    ? <><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,fontSize:11}}>
        <div>Piezas <b>{desarrollo.metricas.piezas_totales}</b></div>
        <div>Geometrías <b>{desarrollo.metricas.geometrias_distintas}</b></div>
        <div>Materiales <b>{desarrollo.metricas.familias_material}</b></div>
        <div>Grupos repetidos <b>{desarrollo.metricas.grupos_repetidos}</b></div>
      </div>
      <div style={{marginTop:8,display:'grid',gap:6}}>
       {(desarrollo.oportunidades||[]).slice(0,3).map((o,i)=><div key={i} style={{fontSize:10,lineHeight:1.35,padding:7,border:'1px solid #34383c',borderRadius:8}}>
         <b>{o.tipo.replaceAll('_',' ')}</b><div style={{color:'#aeb6bf',marginTop:2}}>{o.recomendacion}</div>
         <div style={{fontSize:9,color:'#7f8993',marginTop:3}}>Hipótesis de desarrollo · ahorro no certificado</div>
       </div>)}
       {!(desarrollo.oportunidades||[]).length&&<div className="c3-small">Sin oportunidad determinista evidente todavía. Completa el BOM para profundizar.</div>}
      </div></>
    : <div className="c3-small">Baja el concepto a BOM para que VONI revise repetibilidad, complejidad y estandarización.</div>}
  </Card>
  <Card><Label>Verdad industrial</Label><div style={{display:'grid',gap:5,fontSize:12}}><div>Costo calculado: <b>{costoConocido?money(costoOficial):'Pendiente de BOM'}</b></div><div>Estado motor: <b>{pipeline?.costo?.cost_status||'UNKNOWN'}</b></div><div>Componentes BOM: <b>{spec?.componentes?.length||0}</b></div><div>Ingeniería: <b style={{color:engineeringValidated?'#79c990':'#e0a36f'}}>{engineeringValidated?'VALIDADA':'REQUIERE VALIDACIÓN'}</b></div></div>
   {explicacionCosteo&&<details open style={{marginTop:9,border:'1px solid #3d352d',borderRadius:9,padding:9,background:'#171513'}}>
    <summary style={{cursor:'pointer',fontWeight:800,fontSize:11}}>Cómo llegó VONI a este costo</summary>
    <div className="c3-small" style={{marginTop:6,lineHeight:1.45}}>{explicacionCosteo.ecuacion}</div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginTop:7,fontSize:10}}>
     <div>Material <b>{money(explicacionCosteo.matematicas.material_total)}</b></div>
     <div>MO <b>{money(explicacionCosteo.matematicas.mano_obra)}</b></div>
     <div>GI fábrica <b>{money(explicacionCosteo.matematicas.indirectos_fabrica)}</b></div>
     <div>Preparación+empaque <b>{money((explicacionCosteo.matematicas.preparacion||0)+(explicacionCosteo.matematicas.empaque||0))}</b></div>
    </div>
    <div className="c3-small" style={{marginTop:6}}>Fórmula <b>{explicacionCosteo.formula}</b>{explicacionCosteo.matematicas.merma_proceso_pct?<><span> · merma </span><b>{explicacionCosteo.matematicas.merma_proceso_pct}%</b></>:null}</div>
    {explicacionCosteo.supuestos.slice(0,3).map((s,i)=><div key={i} style={{marginTop:5,fontSize:9,color:'#e0b478'}}>⚠ {s}</div>)}
    {explicacionCosteo.bloqueos.slice(0,3).map((s,i)=><div key={'b'+i} style={{marginTop:5,fontSize:9,color:'#ff9b91'}}>✕ {s}</div>)}
    {!!explicacionCosteo.insumos.length&&<div style={{marginTop:7}}>
      {explicacionCosteo.insumos.slice(0,6).map((x)=><div key={x.id||x.nombre} style={{borderTop:'1px solid #332f2b',padding:'5px 0',fontSize:9,display:'flex',justifyContent:'space-between',gap:8}}>
        <span>{x.nombre}<span style={{color:'#8f969e'}}> · {x.metodo?x.metodo.replaceAll('_',' ').toLowerCase():'método N/D'}{x.desperdicio_pct!=null?' · desperdicio '+x.desperdicio_pct+'%':''}</span></span><b>{money(x.costo||0)}</b>
      </div>)}
    </div>}
    <div className="c3-small" style={{marginTop:6}}>{explicacionCosteo.nota}</div>
   </details>}
   {engineeringValidated
    ? <div style={{marginTop:8,padding:8,border:'1px solid #28553b',borderRadius:8,fontSize:10,color:'#bfe8ca'}}>✓ Validada por {engineeringValidation?.validador||engineeringValidation?.rol||'ingeniería'} · {engineeringValidation?.fecha?new Date(engineeringValidation.fecha).toLocaleString('es-MX'):'fecha registrada'} · ligada a esta revisión visual.</div>
    : puedeAprobarRol
      ? <div style={{marginTop:8}}><Btn ghost onClick={validarIngenieria} disabled={!ingenieriaListaParaRevision} style={{width:'100%'}}>Validar ingeniería de esta revisión</Btn>{!ingenieriaListaParaRevision&&<div className="c3-small" style={{marginTop:5}}>Para validar: BOM con materiales + geometría completa + Despiece 3D técnico completo.</div>}</div>
      : <div className="c3-small" style={{marginTop:8}}>La liberación de ingeniería requiere Diseño o Dirección.</div>}
   {!costoConocido&&estimado.disponible&&<div style={{background:'#1c160f',border:'1px solid #4a3a1f',borderRadius:10,padding:10,marginTop:10}}><Label>Estimado de diseño · evidencia real</Label><div style={{fontSize:17,fontWeight:900,color:'#ffe0b0'}}>≈ {money(estimado.total)} <span style={{fontSize:10,fontWeight:600,color:'#c7a98a'}}>parcial</span></div><div style={{fontSize:10,color:'#9a9a9a',margin:'2px 0 6px'}}>Cobertura {estimado.coberturaPct}% del alcance (por partidas) · confianza {estimado.confianza}</div>{estimado.items.map((it,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',gap:8,padding:'4px 0',borderTop:'1px solid #33291a',fontSize:11}}><span>{it.concepto} · {it.detalle}</span><b>{money(it.subtotal)}</b></div>)}<div style={{fontSize:10,color:'#d6a36d',marginTop:6}}><b>Pendiente por estimar</b> (no es $0): {estimado.pendientes.join(' · ')}</div><p style={{fontSize:9,color:'#8a8a8a',lineHeight:1.35,marginTop:5}}>{estimado.nota}</p></div>}
   {refsCargando&&<p className="c3-small">Buscando referencias reales en la lista vigente…</p>}
   {refUI&&<div className="c3-ref"><Label>Referencia comercial real</Label>{refUI.rangoPrecio&&<div style={{fontSize:17,fontWeight:900,color:'#d7f0df'}}>{refUI.rangoPrecio}</div>}{refUI.rangoCosto&&<div style={{fontSize:11,marginTop:4}}>Costo comparable autorizado: <b>{refUI.rangoCosto}</b></div>}<p style={{fontSize:9,color:'#9fb0a5',lineHeight:1.35}}>No es el costo del especial. Son precios vigentes de productos comparables; extras especiales se certifican cuando existe BOM/precio de insumo suficiente.</p>{refUI.items.slice(0,4).map((x,i)=><div className="c3-refrow" key={`${x.producto_id}-${i}`}><span>{x.capacidad?`${x.capacidad}u · `:''}{x.nombre.replace('Módulo operativo App LT ','')}</span><b>{money(x.precio,x.moneda)}</b></div>)}</div>}
   {!costoConocido&&<p style={{color:'#d6a36d',fontSize:10,lineHeight:1.4}}>La referencia comercial es útil para presupuesto preliminar, pero no se presenta como costo certificado hasta bajar el concepto a BOM.</p>}
   <Btn onClick={agregarCotizacion} disabled={!listaParaCotizar||!onAgregar} style={{width:'100%',marginTop:5}}>{cotizadoHash===spec?.hash?'✓ En cotización':'Convertir en partida'}</Btn>
  </Card></div>
 </div></div>;
}
