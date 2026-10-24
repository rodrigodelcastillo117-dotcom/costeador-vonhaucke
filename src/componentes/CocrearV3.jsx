import React,{useEffect,useMemo,useRef,useState} from 'react';
import {
  cocrearDesdeIntent,construirProductSpec,extraerDNA,clasificarProducto,cocrearDeExpediente,cocrearPayload,partidaDesdeCocrear,
  hashEstable,DIMS_DEFAULT,MATERIALES_EDIT,FAMILIA,aplicarCambioTexto,specDeCocreacion,
} from '../datos/cocrear.js';
import {prepararIntentCocrear,resumenIdeaCocrear,conceptosCocrear,aplicarConceptoCocrear,FEATURES_COCREAR,detectarAlcanceCocrear} from '../datos/cocrearWow.js';
import {referenciasComercialesCocrear,formatearReferenciaCocrear} from '../datos/cocrearReferencias.js';
import {estimadoDisenoCocrear} from '../datos/estimadoDiseno.js';
import {listarCocreaciones,guardarCocrearSeguro,cargarCocrearSeguro,registrarProductoDesdeExpediente,subirRenderCanonico,voniCouncil,generarRender,buscarProductosMaestroTexto,costearCocreacionServidor,imagenCocrearAStorage} from '../nube.js';
// COCREAR 10 (D-01): puente Cocrear → Costeo (mueble de línea escalado o mueble nuevo vía Costear).
import {lineasEscalables,bajarLineaABom,reescalarSiAplica,sincronizarFuncionesPendientes,semillaCostearDesdeCocrear,aplicarRetornoCosteo,despieceVigente} from '../datos/cocrearPuente.js';
import {costearConfig} from '../datos/lineas.js';
import {mensajeEscritura,errorDeEscritura} from '../datos/conflictoGuardado.js';
// COCREAR 10 (D-02/D-03): la verdad de dinero y de ingeniería es la del servidor.
import {validacionDesdeFila} from '../datos/cocrearServidor.js';
// N-04: el MISMO flujo de carga de imagen que Costear.
import {reducirImagen,validarArchivoImagen} from '../datos/cargaImagen.js';
import {NIVELES_DIFICULTAD} from '../datos/dificultadNiveles.js';
import {DIFICULTAD} from '../motor/dificultad.js';
import CocrearVisual from './CocrearVisual.jsx';
import {parametrosEfectivos} from './Costeador.jsx';
import {precioSugeridoCocreado} from '../datos/precio.js';
import {compileRenderPrompt,renderStale} from '../datos/renderPrompt.js';
import {visualRevisionHash,visualesSincronizados} from '../datos/visualRevision.js';
import {modeloTecnico3DDesdeSpec} from '../datos/productModel3D.js';
import {diagnosticoDesarrolloProducto,compararVariantesProducto} from '../datos/desarrolloProducto.js';
import {contextoCatalogoParaIA,recomendar as recomendarCatalogoVonHaucke} from '../voni/conocimiento.js';
import {explicarCosteo} from '../datos/explicacionCosteo.js';
import {estadoValidacionIngenieria,puedeAprobarIngenieria,piezasPendientesIngenieria,ingenieriaListaParaRevision as listaParaRevisionIngenieria,bloqueoValidacionIngenieria,sinValidacionIngenieria} from '../datos/validacionIngenieriaCocrear.js';

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
// N-04: imagen de referencia del cliente (foto, boceto, render). Misma carga que Costear (cargaImagen.js).
function ReferenciaImagen({referencia,onCargar,onQuitar,error}){
 const src=referencia?.dataUrl||referencia?.url||null;
 return <div style={{marginTop:10,display:'flex',gap:9,alignItems:'center',flexWrap:'wrap'}}>
  {src&&<img src={src} alt="Imagen de referencia" data-testid="cocrear-referencia-preview" style={{width:84,height:62,objectFit:'cover',borderRadius:8,border:'1px solid #444'}}/>}
  <label style={{borderRadius:10,padding:'8px 12px',fontSize:12,fontWeight:800,border:'1px solid #50545a',color:'#fff',cursor:'pointer'}}>{src?'Cambiar imagen de referencia':'Subir imagen de referencia'}<input data-testid="cocrear-referencia" type="file" accept="image/*" hidden onChange={onCargar}/></label>
  {src&&<button type="button" onClick={onQuitar} style={{background:'none',border:0,color:'#aaa',cursor:'pointer',fontSize:11}}>Quitar</button>}
  <span className="c3-small">Foto, boceto o render del cliente: viaja a Costear para el análisis IA y se guarda con la co-creación.</span>
  {error&&<span style={{color:'#ffb4aa',fontSize:11}}>{error}</span>}
 </div>;
}
function Btn({children,onClick,disabled=false,ghost=false,style={}}){return <button type="button" disabled={disabled} onClick={onClick} style={{borderRadius:10,padding:'9px 13px',fontSize:13,fontWeight:800,border:ghost?'1px solid #50545a':'1px solid #d13b30',background:ghost?'transparent':disabled?'#34211f':'#c93429',color:disabled?'#776b69':'#fff',cursor:disabled?'not-allowed':'pointer',...style}}>{children}</button>}

export default function Cocrear({estado,onAgregar,onIr,rol='ventas',usuarioEmail=null,puente=null,onPasarACostear=null,onPuenteConsumido=null}){
 const [fase,setFase]=useState('inicio'),[texto,setTexto]=useState(''),[intent,setIntent]=useState(null),[historia,setHistoria]=useState([]),[conceptos,setConceptos]=useState([]);
 const [analisis,setAnalisis]=useState(null),[aiError,setAiError]=useState(''),[pensando,setPensando]=useState(false),[nl,setNl]=useState(''),[mensaje,setMensaje]=useState('');
 const [guardando,setGuardando]=useState(false),[guardado,setGuardado]=useState(false),[expedienteId,setExpedienteId]=useState(null),[guardadas,setGuardadas]=useState([]),[guardadasError,setGuardadasError]=useState(''),[guardadasReload,setGuardadasReload]=useState(0);
 const [render,setRender]=useState(null),[renderCargando,setRenderCargando]=useState(false),[renderError,setRenderError]=useState(''),[comparA,setComparA]=useState(null),[cotizadoHash,setCotizadoHash]=useState(null);
 const [refs,setRefs]=useState(null),[refsCargando,setRefsCargando]=useState(false);
 const [catalogoCandidatos,setCatalogoCandidatos]=useState([]);
 // COCREAR 10: imagen de referencia (N-04), mueble de línea a escalar (D-01) y verdad del servidor (D-02/D-03).
 const [referencia,setReferencia]=useState(null),[refError,setRefError]=useState('');
 const [lineaSel,setLineaSel]=useState({ruta:'',productoId:''});
 const [servidor,setServidor]=useState(null),[costeandoSrv,setCosteandoSrv]=useState(false);

 const insumos=estado?.insumos||{};
 const par=useMemo(()=>parametrosEfectivos(estado,{componentes:[]}).par||estado?.parametros||{},[estado]);
 const rev=historia.length||1,bom=(intent&&intent._componentes)||[];
 // Seller-safe: el vendedor jamás ve costo ni margen (ni el cálculo local).
 const veCostos=rol==='direccion'||rol==='diseno';
 // El spec tal como lo reconstruye el SERVIDOR (sin validación en el JSON): contra él se compara la
 // respuesta de costear-servidor. Cualquier cambio (medida, BOM, revisión) la deja sin vigencia.
 const specBase=useMemo(()=>intent?specDeCocreacion(intent,historia):null,[intent,historia]);
 // D-03: "VALIDADA" sólo si el SERVIDOR la validó para ESTA revisión y la misma revisión visual (la evidencia
 // del JSON del cliente ya no cuenta, D-05). Lógica pura en datos/validacionIngenieriaCocrear.js.
 const {servidorVigente,engineeringValidation,engineeringValidated}=estadoValidacionIngenieria({
   servidor,specBase,
   visualHashActual:()=>visualRevisionHash(construirProductSpec(intent,extraerDNA(intent),clasificarProducto(intent,{}),{rev,componentes:bom})),
 });
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
 // El render se firma contra el spec BASE (el que reconstruye el servidor, sin la validación de ingeniería):
 // validar la ingeniería no cambia el producto, así que no debe vencer el render ni su firma guardada (D-06).
 const rStale=!!(render&&specBase&&(renderStale(render,specBase)||!visualSync.render_ok));
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
 const puedeAprobarRol=puedeAprobarIngenieria(rol);
 // Despiece 3D completo (largo × ancho × espesor en TODAS las piezas): diagnóstico visible. No bloquea:
 // un BOM real lleva PTR por metro y herrajes por pieza, que nunca tienen las tres medidas, y eso
 // dejaba "Validar ingeniería" inalcanzable (D-01/D-03). La compuerta autoritativa la corre el
 // SERVIDOR: rol, costo emitible, validador estructural y misma revisión.
 const despiece3DCompleto=!!(desarrollo?.estado==='ANALIZADO'&&modelo3d?.status==='EXPLODED_READY');
 const piezasPendientes=piezasPendientesIngenieria(spec?.componentes);
 const ingenieriaListaParaRevision=listaParaRevisionIngenieria(spec?.componentes);
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

 const reset=()=>{setFase('inicio');setIntent(null);setHistoria([]);setConceptos([]);setAnalisis(null);setAiError('');setRender(null);setMensaje('');setExpedienteId(null);setComparA(null);setRefs(null);setReferencia(null);setServidor(null);setLineaSel({ruta:'',productoId:''})};
 // D-01: el BOM sigue a la revisión. Un BOM de LÍNEA se re-escala desde su padre al cambiar medidas; uno de
 // COSTEAR deja de valer si cambian (no se estira en silencio); las funciones sin despiece quedan pendientes.
 const avisoBom=useRef('');
 const prepararRevision=(next)=>{
  avisoBom.current='';
  if(next?._puente?.tipo==='linea_escalada'){const r=reescalarSiAplica(next,{insumos});if(r.motivo)avisoBom.current=r.motivo;return r.intent;}
  if(next?._puente?.tipo==='costear'&&!despieceVigente(next)){const {_componentes,_puente,...resto}=next;avisoBom.current='Cambiaste medidas: el despiece de Costear era para las anteriores y se quitó. Vuelve a pasarlo a Costear.';return resto;}
  return sincronizarFuncionesPendientes(next);
 };
 const commit=(next,label)=>{
  // Cualquier cambio técnico/visual invalida la aprobación de ingeniería previa.
  const limpio=sinValidacionIngenieria(prepararRevision(next));
  setIntent(limpio);
  setHistoria(h=>[...h,{rev:h.length+1,intent:clone(limpio),label}]);
  setGuardado(false);
  // Una revisión visual nueva jamás comparte pantalla con un render viejo.
  // El 3D se deriva inmediatamente del spec; el fotográfico se regenera después.
  setRender(null);
  setRenderError('');
  setCotizadoHash(null);
  if(avisoBom.current)setMensaje(avisoBom.current);
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
   const imgR=r?.imagen||r?.dataUrl; // VH-072: URL de Storage o dataUrl de respaldo
   if(r?.ok&&imgR)setRender({
     dataUrl:imgR,
     specHash:nextSpec.hash,
     visualRevisionHash:c.visualRevisionHash,
     expected:c.expected,version:c.version,concepto:nextIntent?._concepto||null
   });else throw new Error(r?.error||'No se pudo generar el render');
  }catch(e){setRenderError(String(e?.message||e))}finally{setRenderCargando(false)}
 };
 const generar=()=>generarPara(intent,specBase);

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

 // ---------------------------------------------------------------------------
 //  D-01 · BAJAR A BOM
 // ---------------------------------------------------------------------------
 const lineas=useMemo(()=>lineasEscalables(),[]);
 const productosLinea=lineas.find(l=>l.ruta===lineaSel.ruta)?.productos||[];
 // Sugerencia: la primera línea escalable que VONI propuso como candidata para este brief.
 useEffect(()=>{
  if(lineaSel.ruta||!catalogoCandidatos.length)return;
  const l=catalogoCandidatos.map(c=>lineas.find(x=>x.ruta===c.ruta)).find(Boolean);
  if(l)setLineaSel({ruta:l.ruta,productoId:l.productos[0]?.id||''});
 },[catalogoCandidatos,lineas,lineaSel.ruta]);
 const bajarDesdeLinea=()=>{
  if(!intent||!lineaSel.ruta||!lineaSel.productoId){setMensaje('Elige la línea y el producto de catálogo del que parte el cambio de medidas.');return}
  const r=bajarLineaABom(intent,{ruta:lineaSel.ruta,productoId:lineaSel.productoId,dificultad:intent._dificultad},{insumos});
  if(!r.ok){setMensaje(r.motivo);return}
  commit(r.intent,`BOM desde ${r.padre.nombre} (escalado a ${intent.dimensiones?.ancho_mm||'?'} mm)`);
  setMensaje(`✓ Despiece de ${r.padre.nombre} escalado a las medidas del concepto (${r.escalado.trazas.length} pieza(s) ajustada(s)). El tablero se cobra por acomodo en hoja.${r.escalado.avisos.length?' Revisa los avisos.':''}`);
 };
 const quitarBom=()=>{if(!intent)return;const {_componentes,_puente,_linaje,...resto}=intent;commit(resto,'Quitar BOM');setMensaje('BOM quitado: el concepto vuelve a "Pendiente de BOM".')};
 const setDificultad=d=>commit({...intent,_dificultad:d==='normal'?undefined:d},`Dificultad: ${NIVELES_DIFICULTAD.find(([k])=>k===d)?.[1]||d}`);
 // Mueble nuevo: la MISMA vía que Costear (análisis IA → BOM). Se lleva la sesión para volver aquí.
 const pasarACostear=()=>{
  if(!intent)return;
  if(!onPasarACostear||!veCostos){setMensaje('Costear desde cero es de Diseño y Dirección: guarda la co-creación y pídeles que la bajen a BOM.');return}
  const semilla=semillaCostearDesdeCocrear(intent,{brief:texto,nombre:intent._concepto_nombre||resumen?.tipologia||'Producto co-creado',expedienteId,imagen:referencia});
  onPasarACostear({semilla,sesion:{texto,intent:clone(intent),historia:clone(historia),expedienteId,render,referencia,servidor}});
 };
 // Regreso de Costear (o de cualquier otra pantalla): se recupera la sesión y, si trae BOM, entra como revisión nueva.
 const puenteAplicado=useRef(null);
 useEffect(()=>{
  if(!puente?.sesion||puenteAplicado.current===puente)return;
  puenteAplicado.current=puente;
  const s=puente.sesion;
  setTexto(s.texto||'');setHistoria(s.historia?.length?s.historia:[{rev:1,intent:s.intent,label:'Sesión recuperada'}]);setIntent(s.intent);
  setExpedienteId(s.expedienteId??null);setRender(s.render||null);setReferencia(s.referencia||null);setServidor(s.servidor||null);setFase('studio');
  if(puente.retorno){
   const r=aplicarRetornoCosteo(s.intent,puente.retorno);
   if(r.ok){
    const limpio=sinValidacionIngenieria(sincronizarFuncionesPendientes(r.intent));
    setIntent(limpio);setHistoria(h=>[...(s.historia||[]),{rev:(s.historia?.length||0)+1,intent:clone(limpio),label:`BOM desde Costear (${r.intent._componentes.length} piezas)`}]);
    setRender(null);setGuardado(false);setCotizadoHash(null);
    setMensaje(`✓ Regresó de Costear con ${r.intent._componentes.length} pieza(s). Es una revisión nueva: costéala en el servidor y valida ingeniería.`);
   }else setMensaje(r.motivo);
  }else setMensaje('Sesión de Cocrear recuperada (no regresó despiece de Costear).');
  onPuenteConsumido?.();
 },[puente]);

 // ---------------------------------------------------------------------------
 //  N-04 · IMAGEN DE REFERENCIA (mismo flujo de carga que Costear)
 // ---------------------------------------------------------------------------
 const onReferencia=async e=>{
  const file=e.target.files?.[0];e.target.value='';setRefError('');
  if(!file)return;
  const invalido=validarArchivoImagen(file,{aceptaPdf:false});
  if(invalido){setRefError(invalido);return}
  try{
   const r=await reducirImagen(file);
   setReferencia({base64:r.base64,mediaType:r.mediaType,dataUrl:`data:${r.mediaType};base64,${r.base64}`,url:null,nombre:file.name||'referencia.jpg'});
   setGuardado(false);
  }catch(err){setRefError(String(err?.message||err))}
 };

 // ---------------------------------------------------------------------------
 //  D-06 · antes de guardar, render y referencia van a Storage (nunca base64 en el expediente)
 // ---------------------------------------------------------------------------
 const asegurarImagenes=async(id)=>{
  let r=render,ref=referencia;const avisos=[];
  if(r&&!r.url&&/^data:/.test(String(r.dataUrl||''))){
   const up=await imagenCocrearAStorage(r.dataUrl,{id:id||'tmp',tipo:'render'});
   if(up.ok){r={...r,url:up.url,dataUrl:up.url};setRender(r)}else avisos.push(`El render no se pudo conservar (${up.error}).`);
  }
  if(ref&&!ref.url&&ref.dataUrl){
   const up=await imagenCocrearAStorage(ref.dataUrl,{id:id||'tmp',tipo:'referencia'});
   if(up.ok){ref={...ref,url:up.url};setReferencia(ref)}else avisos.push(`La imagen de referencia no se pudo conservar (${up.error}).`);
  }
  return {render:r,referencia:ref,avisos};
 };
 const guardarActual=async()=>{
  const img=await asegurarImagenes(expedienteId);
  const r=await guardarCocrearSeguro(expedienteId,cocrearPayload({brief:texto,intent,historia,render:img.render,referencia:img.referencia,insumos,par}));
  if(!r?.ok)throw errorDeEscritura(r,'No se pudo guardar');
  const id=r.expediente_id||expedienteId;
  if(id)setExpedienteId(id);
  setGuardado(true);
  return {id,avisos:img.avisos};
 };

 // ---------------------------------------------------------------------------
 //  D-02 / D-03 · el servidor costea (y, si se pide, valida ingeniería) la revisión GUARDADA
 // ---------------------------------------------------------------------------
 const costearEnServidor=async({validar=false}={})=>{
  if(!intent||costeandoSrv)return null;
  if(!bom.length){setMensaje('Primero baja el concepto a BOM: sin despiece el servidor no tiene qué costear.');return null}
  setCosteandoSrv(true);setMensaje('');
  try{
   const g=await guardarActual();
   if(!g.id)throw new Error('La co-creación no quedó guardada.');
   const r=await costearCocreacionServidor(g.id,validar?{validarIngenieria:true,visualHash:visualRevisionHash(spec)}:{});
   if(!r?.ok){setMensaje(`El servidor no costeó: ${r?.error||'sin respuesta'}`);return null}
   setServidor(r);
   const avisos=g.avisos.length?` ${g.avisos.join(' ')}`:'';
   if(validar)setMensaje(r.ingenieria_validada?`✓ Ingeniería validada por el servidor (${r.validada_por||usuarioEmail||rol}). Cualquier cambio posterior la invalida.${avisos}`:`No se validó: ${r.validacion?.motivo||'el servidor no la aprobó'}${avisos}`);
   else setMensaje(`✓ Costeado en el servidor: ${r.estado}.${r.precioPorConfirmar?' Precio por confirmar.':''}${avisos}`);
   return r;
  }catch(e){setMensaje(mensajeEscritura(e,'No se pudo costear en el servidor'));return null}
  finally{setCosteandoSrv(false)}
 };

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
   // LAB COCREAR 10 (COC-05): sin cambio determinista, el texto del Council ("Se actualiza la especificación…")
   // se leía como si el modelo hubiera cambiado. Se dice explícitamente que la revisión canónica NO cambió.
   setMensaje(cambio.aplico?`✓ Cambio aplicado a la revisión canónica. ${txt} El render anterior quedó vencido; regénéralo para ver exactamente esta revisión.`:`Sin cambio en el modelo canónico (Rev ${historia.length||1} sigue igual): la instrucción no se pudo aplicar de forma determinista. Opinión de VONI Council, no aplicada: ${txt}`);
   setNl('');
  }catch(e){setMensaje(cambio.aplico?`✓ Cambio aplicado al modelo. Council no pudo responder: ${String(e?.message||e)}`:`VONI no pudo responder: ${String(e?.message||e)}`)}
  setPensando(false)
 };

 const guardar=async()=>{if(!intent)return;setGuardando(true);setMensaje('');try{const g=await guardarActual();setMensaje(`✓ Co-creación guardada.${g.avisos.length?' '+g.avisos.join(' '):''}`);}catch(e){setMensaje(mensajeEscritura(e,'No se pudo guardar'))}setGuardando(false)};
 const reabrir=async id=>{try{const r=await cargarCocrearSeguro(id);const est=r?.ok?cocrearDeExpediente({cocrear:r.cocrear}):null;if(!est?.intent)throw new Error('Expediente sin intención válida');setIntent(est.intent);setHistoria(est.historia?.length?est.historia:[{rev:1,label:'Reabierta',intent:est.intent}]);setTexto(est.brief||est.intent?._brief||'');setExpedienteId(id);
  // N-04 y D-02/D-03: la referencia y la verdad del servidor (costo/validación de esa revisión) vuelven con el expediente.
  setReferencia(est.referencia?{...est.referencia,base64:null,dataUrl:est.referencia.url}:null);
  setServidor(validacionDesdeFila(r.validacion_servidor));setCotizadoHash(null);setMensaje('');
  // VH-105: el render fotográfico NO se guarda en el payload cocrear (sólo specHash/expected); el
  // canónico vive en Storage y el expediente trae su URL (render_aislado_url). Se RECUPERA en vez de
  // perderse; si sus firmas no coinciden con la revisión reabierta, `renderStale` lo marca VENCIDO
  // (fail-closed) y se ofrece regenerar. Nunca se presenta como fiel a otra revisión.
  // D-06: primero la URL que guardó Cocrear junto con su firma; si no, la canónica del expediente.
  const urlCanonica=[est.render?.url,r?.render_aislado_url].find(u=>typeof u==='string'&&/^https?:\/\//.test(u))||null;
  if(urlCanonica)setRender({dataUrl:urlCanonica,specHash:est.render?.specHash||null,visualRevisionHash:est.render?.visualRevisionHash||null,expected:est.render?.expected||null,version:est.render?.version||null,concepto:est.intent?._concepto||null,recuperado:true});
  else setRender(null);
  setFase('studio')}catch(e){setMensaje(String(e?.message||e))}};

 // D-03: "Validar ingeniería" ya no es un sello en el JSON del cliente. Guarda la revisión y le pide al
 // SERVIDOR que la valide (rol, costo emitible, validador estructural, misma revisión visual); lo que
 // responde el servidor es lo que se muestra y lo que lee el registro del producto.
 const validarIngenieria=async()=>{
  // Rol Diseño/Dirección y BOM sin piezas pendientes (datos/validacionIngenieriaCocrear.js).
  const bloqueo=bloqueoValidacionIngenieria({rol,componentes:spec?.componentes});
  if(bloqueo){setMensaje(bloqueo);return;}
  const visual_hash=visualRevisionHash(spec);
  const evidencia={validador:usuarioEmail||rol,rol,visual_hash,spec_hash_prevalidacion:spec.hash};
  setCotizadoHash(null);
  const r=await costearEnServidor({validar:true});
  if(r&&r.ingenieria_validada&&r.visual_hash!==evidencia.visual_hash)setMensaje('El servidor validó otra revisión visual: vuelve a validar.');
 };

 // Cálculo LOCAL (vista previa para Diseño/Dirección): mismo motor, pero NO es el costo que se guarda ni se emite.
 const costoRaw=pipeline?.costo?.official_cost;
 const costoOficial=Number(costoRaw),costoConocido=costoRaw!=null&&Number.isFinite(costoOficial)&&costoOficial>=0;
 const precioLocal=useMemo(()=>veCostos?precioSugeridoCocreado(costoConocido?costoOficial:null,{par}):null,[veCostos,costoConocido,costoOficial,par]);
 // Lo oficial: la respuesta del servidor para ESTA revisión.
 const costoServidor=servidorVigente&&Number.isFinite(Number(servidor?.costo?.costoUnitario))?Number(servidor.costo.costoUnitario):null;
 const precioServidor=servidorVigente&&Number(servidor?.precioSugerido)>0?Number(servidor.precioSugerido):null;
  const listaParaCotizar=pipeline?.lineaCotizacion?.listaParaCotizar===true;
  const bloqueosCocrear=pipeline?.blockers||[];
 // Referencia comercial: el precio de LISTA del mueble de catálogo del que parte el cambio de medidas
 // (no se toca; sólo se compara). Al vendedor sólo se le muestra si es un artículo real del catálogo.
 const referenciaPadre=useMemo(()=>{
  const pz=intent?._puente;
  if(pz?.tipo!=='linea_escalada'||!pz.base)return null;
  try{
   const r=costearConfig(estado,pz.ruta,pz.producto,{largoMM:pz.base.ancho_mm,fondoMM:pz.base.prof_mm,diametroMM:pz.base.ancho_mm},1);
   const precio=Number(r?.precioUnitario);
   if(!(precio>0)||(!veCostos&&!r?.precioReal))return null;
   return {precio,nombre:pz.padre,real:!!r?.precioReal};
  }catch{return null}
 },[intent?._puente,estado,veCostos]);
 const precioComparable=precioServidor??precioLocal?.precio??null;
 const debajoDelPadre=!!(referenciaPadre&&precioComparable!=null&&precioComparable<referenciaPadre.precio);
 const MOTIVO_REGISTRO={
   costo_servidor_pendiente:'el servidor todavía no costeó esta revisión guardada',
   expediente_incompleto_no_publicable:'el costo del servidor está incompleto',
   costo_estado_con_valor_invalido:'el servidor aún usa el registro anterior (falta aplicar PROPUESTA_cocrear_costo_servidor.sql); no se registra con un costo del navegador',
 };
 const agregarCotizacion=async()=>{
  if(!listaParaCotizar||!onAgregar){
    const motivo=pipeline?.lineaCotizacion?.motivo||bloqueosCocrear[0]||'falta validación del producto';
    setMensaje(`Todavía no puede convertirse en partida: ${motivo}. El costo calculado no sustituye la validación de ingeniería.`);
    return
  }
  // D-02: el precio de la partida es el que sugirió el SERVIDOR para esta revisión (costo de
  // costear-servidor + margen de política con piso). Sin él: "Por confirmar", nunca $0.
  if(precioServidor==null){
    setMensaje('Sin precio del servidor para esta revisión: costéala en el servidor (si el costo está incompleto, el precio queda "Por confirmar").');
    return
  }
  let id=expedienteId,prodId=null,versionId=null;
  let avisoRender='';let renderUrl=null;
  try{
    const g=await guardarActual();
    id=g.id;
    if(!id)throw new Error('No se pudo crear el expediente canónico.');
    const reg=await registrarProductoDesdeExpediente(id);
    if(!reg?.ok||!reg?.version_id)throw new Error(reg?.error||(reg?.motivo?`No se pudo registrar la revisión canónica: ${MOTIVO_REGISTRO[reg.motivo]||reg.motivo}.`:'No se pudo registrar la revisión canónica del producto.'));
    prodId=reg.producto_id;versionId=reg.version_id;

    if(render&&!rStale){
      const rc=compileRenderPrompt(spec,spec.dna);
      const geometryHash=visualRevisionHash(spec);
      const up=await subirRenderCanonico({
        expedienteId:id,productoId:prodId,productoVersionId:versionId,
        dataUrl:render.dataUrl,promptVersion:render.version,modo:'render',
        specHash:specBase.hash,geometryHash,inputs:rc.expected||{},
      });
      if(!up?.ok)avisoRender=` Render canónico pendiente: ${up?.error||'no se pudo registrar'}.`;else if(up?.storage_url)renderUrl=up.storage_url;
    }
  }catch(e){
    setMensaje(mensajeEscritura(e,'No se agregó a la cotización'));
    return;
  }
  const pv=precioServidor;
  // El margen sólo viaja para quien ve economía (seller-safe: App lo descarta para el vendedor).
  const margen=veCostos?(servidor?.margen??precioSugeridoCocreado(costoServidor,{par}).margen):null;
  // VH-058: la partida nace con identidad y procedencia (expediente, Producto Maestro, render canónico).
  onAgregar({...partidaDesdeCocrear({nombre:intent?._concepto_nombre||resumen?.tipologia||'Producto co-creado',spec,prodId,versionId,expedienteId:id,renderUrl})},1,pv,margen);
  setCotizadoHash(spec.hash);
  setMensaje(`✓ Revisión canónica agregada a cotización.${avisoRender}`);
 };

 const css=<style>{`.coc3{max-width:1240px;margin:0 auto;font-size:14px}.c3-title{font-size:clamp(30px,3vw,44px);line-height:1.06;margin:5px 0 9px}.c3-lead{font-size:16px;color:#b7b2af;max-width:850px;line-height:1.5}.c3-concepts{display:grid;grid-template-columns:320px minmax(0,1fr);gap:13px}.c3-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.c3-studio{display:grid;grid-template-columns:245px minmax(0,1fr) 300px;gap:11px;align-items:start}.c3-hero{min-height:330px;display:flex;align-items:center;justify-content:center;background:#111315;border-radius:11px;overflow:hidden}.c3-hero img{width:100%;height:auto;display:block}.c3-input{width:100%;box-sizing:border-box;background:#22201f;color:#fff;border:1px solid #444;border-radius:9px;padding:8px}.c3-small{font-size:11px;color:#9ca3ad}.c3-ref{background:#121b16;border:1px solid #28553b;border-radius:10px;padding:10px;margin-top:10px}.c3-refrow{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid #26352b;font-size:11px}.c3-history{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.c3-history button{background:#202225;color:#cfd3d7;border:1px solid #393d42;border-radius:999px;padding:5px 8px;font-size:10px}@media(max-width:1050px){.c3-studio{grid-template-columns:230px minmax(0,1fr)}.c3-right{grid-column:1/-1}.c3-concepts{grid-template-columns:1fr}}@media(max-width:760px){.c3-studio,.c3-concepts,.c3-cards{grid-template-columns:1fr}.c3-title{font-size:32px}}`}</style>;

 if(fase==='inicio')return <div className="contenido coc3">{css}<Label>VON HAUCKE · COCREAR</Label><h1 className="c3-title">¿Qué quieres crear?</h1><p className="c3-lead">Describe el problema o la idea. VONI propone direcciones de diseño; al elegir una, render, modelo técnico y referencias comerciales quedan amarrados al mismo concepto.</p><Card style={{marginTop:16}}><textarea value={texto} onChange={e=>setTexto(e.target.value)} rows={4} placeholder="Ej. Hub colaborativo para 8 personas, vegetación integrada, cableado oculto y escalable a 12…" className="c3-input" style={{fontSize:15,padding:13}}/><div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:9}}>{EJEMPLOS.map((e,i)=><button key={i} onClick={()=>setTexto(e)} style={{background:'#242220',color:'#ddd',border:'1px solid #414141',borderRadius:999,padding:'6px 9px',fontSize:10,cursor:'pointer'}}>{e.split(',')[0]}</button>)}</div><div style={{display:'flex',gap:8,marginTop:12}}><Btn onClick={analizarIdea} disabled={!texto.trim()||pensando}>{pensando?'VONI analizando…':'Crear conceptos con VONI →'}</Btn><Btn ghost onClick={desdeCero}>Empezar desde cero</Btn></div><ReferenciaImagen referencia={referencia} onCargar={onReferencia} onQuitar={()=>setReferencia(null)} error={refError}/></Card>{guardadasError&&<div style={{marginTop:14,padding:'8px 10px',border:'1px solid #70483e',borderRadius:9,color:'#ffb4aa',fontSize:11,display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}><span>No pude cargar tus co-creaciones guardadas: {guardadasError}</span><button type="button" onClick={()=>setGuardadasReload(x=>x+1)} style={{background:'transparent',border:'1px solid #8b5a4d',color:'#ffd0c6',borderRadius:7,padding:'5px 8px',cursor:'pointer'}}>Reintentar</button></div>}{guardadas.length>0&&<div style={{marginTop:18}}><Label>Guardadas</Label><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:7}}>{guardadas.map(x=><button key={x.id} onClick={()=>reabrir(x.id)} style={{textAlign:'left',background:'#171717',border:'1px solid #333',borderRadius:9,padding:10,color:'#fff',cursor:'pointer'}}><strong>{x.nombre||'Co-creación'}</strong><div className="c3-small">{x.producto_tipo||'Producto especial'} · reabrir</div></button>)}</div></div>}</div>;

 if(fase==='conceptos')return <div className="contenido coc3">{css}<div style={{display:'flex',justifyContent:'space-between',alignItems:'start'}}><div><Label>VONI · lectura de idea</Label><h1 style={{fontSize:29,margin:'2px 0'}}>Tres direcciones, una misma intención</h1></div><Btn ghost onClick={reset}>‹ Nueva idea</Btn></div>{alcance.scope==='project'&&<div style={{background:'#10233a',border:'1px solid #2b5f8f',borderRadius:12,padding:'12px 14px',margin:'12px 0'}}><strong style={{color:'#cfe6ff'}}>Esto es un PROYECTO completo{alcance.personas?` (~${alcance.personas} personas)`:''}, no un solo mueble.</strong><p style={{fontSize:13,color:'#b9c7d6',margin:'5px 0 9px',lineHeight:1.45}}>Cocrear desarrolla un sistema a la vez. Para el proyecto entero conviene el <b>Cotizador por plano</b>: sube tu plano y te arma el <b>programa por área</b> (recepción, operativos, salas, dirección…) → productos → acomodo. Cada sistema lo afinas aquí en Cocrear.</p>{onIr&&<Btn onClick={()=>onIr('cotizarIA')}>Ir al Cotizador por plano →</Btn>}</div>}<div className="c3-concepts" style={{marginTop:13}}><Card><Label>Lo que entendimos</Label><p style={{fontSize:14,lineHeight:1.45}}>{resumen?.necesidad}</p><div style={{display:'grid',gap:5,fontSize:12,color:'#c8c8c8'}}><div><b>Tipología:</b> {resumen?.tipologia}</div><div><b>Capacidad:</b> {resumen?.capacidad}</div><div><b>Envolvente:</b> {resumen?.envolvente}</div><div><b>Claves:</b> {resumen?.claves?.join(' · ')||'por definir'}</div></div><hr style={{borderColor:'#303236',margin:'13px 0'}}/><Label>Análisis VONI Council</Label>{aiError?<p style={{color:'#ffb4aa',fontSize:11}}>Council no disponible: {aiError}</p>:<p style={{fontSize:12,lineHeight:1.45,color:'#ddd'}}>{councilText(analisis)||'VONI revisó intención, uso y fabricabilidad.'}</p>}</Card><div>{catalogoCandidatos.length>0&&<Card style={{marginBottom:10,borderColor:'#3f5d49'}}><Label>Primero · ¿ya existe en Von Haucke?</Label><div style={{fontSize:11,color:'#bdd7c5',lineHeight:1.45,marginBottom:8}}>VONI encontró candidatos reales del portafolio. Son referencia, no linaje confirmado: si uno resuelve el brief, conviene configurarlo antes de inventar un especial.</div><div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{catalogoCandidatos.slice(0,8).map(l=><span key={l.ruta} style={{padding:'5px 8px',borderRadius:999,border:'1px solid #476650',fontSize:10,color:'#d9efe0'}}><b>{l.linea}</b>{l.productos?.length?` · ${l.productos.length} variantes`:''}</span>)}</div></Card>}<Label>Elige una dirección</Label><div className="c3-cards">{conceptos.map(c=><Card key={c.id} style={{display:'flex',flexDirection:'column',minHeight:215}}><div style={{color:'#d33b30',fontSize:22,fontWeight:900}}>{c.id}</div><h2 style={{fontSize:17,margin:'6px 0 3px'}}>{c.nombre}</h2><div style={{fontSize:9,color:'#999',fontWeight:800,textTransform:'uppercase'}}>{c.subtitulo}</div><p style={{fontSize:12,lineHeight:1.42,flex:1}}>{c.descripcion}</p><Btn onClick={()=>elegirConcepto(c)}>Desarrollar →</Btn></Card>)}</div></div></div></div>;

 const dims=intent?.dimensiones||{},feats=new Set(intent?.caracteristicas||[]),mat=intent?.materiales?.[0]?.material||'laminado',tone=intent?.materiales?.[0]?.tono||null;
 return <div className="contenido coc3">{css}<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:9}}><div><button onClick={()=>setFase('inicio')} style={{background:'none',border:0,color:'#aaa',cursor:'pointer'}}>‹ Nueva idea</button><strong style={{marginLeft:9,fontSize:17}}>{intent?._concepto?`Concepto ${intent._concepto} · `:''}{intent?._concepto_nombre||resumen?.tipologia||'Producto co-creado'}</strong><span style={{fontSize:9,color:'#8992a2',marginLeft:7}}>REV {rev}</span></div><div style={{display:'flex',gap:6}}><Btn ghost onClick={()=>setComparA(comparA?null:clone(intent))}>{comparA?'Salir A/B':'Comparar A/B'}</Btn><Btn ghost onClick={guardar} disabled={guardando}>{guardando?'Guardando…':guardado?'✓ Guardado':'Guardar'}</Btn></div></div>
 <div className="c3-studio">
  <Card><Label>Diseño</Label><div style={{marginBottom:9}}><small>Tipología</small><select value={intent?.familia||FAMILIA.DESCONOCIDA} onChange={e=>setFamilia(e.target.value)} className="c3-input" style={{marginTop:3}}>{FAMILY_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>{(intent?.familia||FAMILIA.DESCONOCIDA)===FAMILIA.DESCONOCIDA&&<div className="c3-small" data-testid="cocrear-libre-aviso" style={{marginTop:4,color:'#c9a23f',lineHeight:1.35}}>Producto libre: VONI interpretó tu idea sin molde de catálogo. Revisa que el concepto corresponda a lo que pediste; si no es lo que querías, cambia la tipología o reescribe la idea.</div>}</div>{intent?.tipologia_cocrear==='operativo_colaborativo'&&<div style={{marginBottom:9}}><small>Personas / puestos</small><input type="number" min="2" max="24" value={intent.capacidad_personas||6} onChange={e=>setCap(e.target.value)} className="c3-input" style={{marginTop:3}}/></div>}<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4,marginBottom:10}}>{[['ancho_mm','Ancho'],['prof_mm','Fondo'],['alto_mm','Alto']].map(([k,l])=><label key={k} style={{fontSize:9,color:'#aaa'}}>{l}<input type="number" value={dims[k]||0} onChange={e=>setDim(k,e.target.value)} className="c3-input" style={{padding:5,marginTop:2}}/></label>)}</div><Label>Material</Label><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4}}>{MATERIALES_EDIT.map(m=><button key={m} onClick={()=>setMaterial(m)} style={{padding:'6px 2px',borderRadius:7,border:mat===m?'2px solid #d33b30':'1px solid #414141',background:'#22201f',color:'#fff',fontSize:9}}>{MAT_LABEL[m]||m}</button>)}</div><Label>Tono</Label><div style={{display:'flex',gap:4}}>{[['claro','Claro'],[null,'Natural'],['oscuro','Oscuro']].map(([v,l])=><button key={l} onClick={()=>setTone(v)} style={{flex:1,padding:6,borderRadius:7,border:tone===v?'2px solid #d33b30':'1px solid #414141',background:'#22201f',color:'#fff',fontSize:9}}>{l}</button>)}</div><Label>Funciones</Label><div style={{display:'flex',flexWrap:'wrap',gap:4}}>{FEATURES_COCREAR.map(([k,l])=><button key={k} onClick={()=>toggleFeature(k)} style={{padding:'5px 6px',borderRadius:999,border:feats.has(k)?'1px solid #d33b30':'1px solid #414141',background:feats.has(k)?'#3b211f':'transparent',color:'#fff',fontSize:9}}>{feats.has(k)?'✓ ':'+ '}{l}</button>)}</div><Label>Imagen de referencia</Label><ReferenciaImagen referencia={referencia} onCargar={onReferencia} onQuitar={()=>{setReferencia(null);setGuardado(false)}} error={refError}/></Card>

  <div>{comparA?<Card><Label>Comparación A/B · ingeniería</Label><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}><CocrearVisual spec={comparSpecA} intent={comparA}/><CocrearVisual spec={spec} intent={intent}/></div>
   {comparativaAB&&<div style={{marginTop:9,padding:9,border:'1px solid #363a3f',borderRadius:9}}>
     <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:6,fontSize:10}}>
       <div>Piezas Δ <b>{comparativaAB.delta.piezas_totales>0?'+':''}{comparativaAB.delta.piezas_totales}</b></div>
       <div>Materiales Δ <b>{comparativaAB.delta.familias_material>0?'+':''}{comparativaAB.delta.familias_material}</b></div>
       <div>Geometrías Δ <b>{comparativaAB.delta.geometrias_distintas>0?'+':''}{comparativaAB.delta.geometrias_distintas}</b></div>
       <div>Costo Δ <b>{!veCostos?'—':comparativaAB.costo_comparable?money(comparativaAB.delta.costo):'No comparable'}</b></div>
     </div>
     <div style={{fontSize:9,color:'#8f98a8',marginTop:6}}>B − A · comparación determinista. Menos piezas, materiales o costo NO significa automáticamente mejor producto; VONI conserva función, desempeño e intención como restricciones.</div>
   </div>}
   <div style={{marginTop:6,fontSize:10,color:visualSync.synchronized?'#79c990':'#e0a36f'}}>
     {visualSync.synchronized?'✓ Render y modelo 3D comparten la misma revisión visual.':'⚠ La revisión cambió: el 3D ya está actualizado y el render fotográfico requiere regeneración.'}
   </div></Card>:<Card style={{padding:8}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 5px 8px'}}><div><Label>Render IA · Concepto {intent?._concepto||'—'}</Label><strong style={{fontSize:13}}>{intent?._concepto_nombre||'Visualización principal'}</strong></div><Btn onClick={generar} disabled={renderCargando}>{renderCargando?'Generando…':render?'Regenerar':'Generar render'}</Btn></div><div className="c3-hero">{renderCargando?<div style={{textAlign:'center'}}><strong>VONI está construyendo el concepto {intent?._concepto}</strong><p className="c3-small">Usando el modelo canónico de esta revisión como referencia de geometría.</p></div>:render?<div style={{width:'100%'}}>{rStale&&<div style={{padding:8,background:'#4a2d16',color:'#ffd09c',fontSize:10}}>El diseño cambió. Este render está vencido; regenera para representar la revisión actual.</div>}<img src={render.dataUrl} alt={`Render del concepto ${intent?._concepto||''}`} style={{opacity:rStale?.62:1}}/></div>:<div style={{textAlign:'center'}}><strong>Sin render de esta revisión</strong><p className="c3-small">Genera la visualización usando el modelo 3D como referencia.</p><Btn onClick={generar}>Generar render</Btn></div>}</div><p className="c3-small" data-testid="cocrear-render-aviso" style={{marginTop:6,color:'#c9a23f',lineHeight:1.35}}>⚠ Imagen de IA para ideación: puede no coincidir con el modelo 3D, las medidas reales ni exactamente lo que pediste. El modelo técnico y el BOM son la verdad, no el render.</p>{renderError&&<p style={{color:'#ff9d93',fontSize:10}}>{renderError}</p>}</Card>}{!comparA&&<div id="cocrear-modelo-canonico" style={{marginTop:8}}><CocrearVisual spec={spec} intent={intent}/></div>}<div className="c3-history">{historia.map(h=><button key={h.rev} onClick={()=>{setIntent(clone(h.intent));setRender(null);setRenderError('');setCotizadoHash(null);setMensaje(`Viendo Rev ${h.rev}: ${h.label}. El render fotográfico se invalidó para evitar mezclar revisiones.`)}}>R{h.rev} · {h.label}</button>)}</div></div>

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
  <Card>
   <Label>Bajar a BOM · costeo real</Label>
   {bom.length
    ? <div style={{fontSize:11,lineHeight:1.45}} data-testid="cocrear-bom">
       <div><b>{intent?._puente?.tipo==='linea_escalada'?`Escalado de ${intent._puente.padre}`:intent?._puente?.tipo==='costear'?'Despiece de Costear':'Despiece'}</b> · {bom.length} pieza(s){piezasPendientes.length?<span style={{color:'#ffb4aa'}}> · {piezasPendientes.length} pendiente(s)</span>:null}</div>
       {intent?._puente?.metodo&&<div className="c3-small" style={{marginTop:3}}>{intent._puente.metodo}</div>}
       {(intent?._puente?.trazas||[]).slice(0,5).map((t,i)=><div key={i} className="c3-small" style={{marginTop:3}}>↔ {t.pieza}: {t.de} → {t.a} <span style={{color:'#7f8993'}}>({t.regla})</span></div>)}
       {(intent?._puente?.avisos||[]).map((a,i)=><div key={'a'+i} style={{marginTop:4,fontSize:10,color:'#e0b478'}}>⚠ {a}</div>)}
       {piezasPendientes.map((c,i)=><div key={'p'+i} style={{marginTop:4,fontSize:10,color:'#ff9b91'}}>✕ {c.nombre}: sin material, el costo queda incompleto (no se inventa).</div>)}
       {referenciaPadre&&<div style={{marginTop:6,fontSize:10,color:debajoDelPadre?'#ffb4aa':'#bdd7c5'}}>{debajoDelPadre?'⚠ ':''}Precio de lista de {referenciaPadre.nombre}{referenciaPadre.real?' (catálogo)':' (modelo de la línea)'}: <b>{money(referenciaPadre.precio)}</b>.{debajoDelPadre?' El precio sugerido del especial queda por DEBAJO: revisa la dificultad o que Dirección decida el precio (no se ajusta solo).':' Referencia: no se toca.'}</div>}
       {!despiece3DCompleto&&<div className="c3-small" style={{marginTop:4}}>Despiece 3D parcial: hay piezas sin largo × ancho × espesor (PTR por metro, herrajes). Es informativo; la validación la hace el servidor.</div>}
       <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}><Btn ghost onClick={quitarBom}>Quitar BOM</Btn>{veCostos&&onPasarACostear&&<Btn ghost onClick={pasarACostear}>Afinar en Costear</Btn>}</div>
      </div>
    : <div style={{display:'grid',gap:8}}>
       <div className="c3-small">Para costear de verdad, el concepto necesita despiece. Dos caminos:</div>
       <div style={{border:'1px solid #34383c',borderRadius:9,padding:8}}>
        <b style={{fontSize:11}}>A · Cambiar medidas de un mueble de línea</b>
        <select data-testid="cocrear-linea" value={lineaSel.ruta} onChange={e=>{const l=lineas.find(x=>x.ruta===e.target.value);setLineaSel({ruta:e.target.value,productoId:l?.productos[0]?.id||''})}} className="c3-input" style={{marginTop:5}}><option value="">Línea…</option>{lineas.map(l=><option key={l.ruta} value={l.ruta}>{l.titulo}</option>)}</select>
        <select data-testid="cocrear-producto-linea" value={lineaSel.productoId} onChange={e=>setLineaSel(x=>({...x,productoId:e.target.value}))} disabled={!lineaSel.ruta} className="c3-input" style={{marginTop:4}}><option value="">Producto…</option>{productosLinea.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
        <Btn onClick={bajarDesdeLinea} disabled={!lineaSel.ruta||!lineaSel.productoId} style={{width:'100%',marginTop:6}}>Partir de este mueble →</Btn>
        <div className="c3-small" style={{marginTop:4}}>Usa su despiece real y lo escala a {dims.ancho_mm||'?'} × {dims.prof_mm||dims.fondo_mm||'?'} mm. El tablero se cobra por acomodo en hoja, no por regla de tres. Su precio de catálogo no se toca.</div>
       </div>
       <div style={{border:'1px solid #34383c',borderRadius:9,padding:8}}>
        <b style={{fontSize:11}}>B · Mueble nuevo</b>
        <div className="c3-small" style={{marginTop:3}}>Pasa nombre, medidas, materiales, funciones y descripción{referencia?' (con la imagen de referencia)':''} al asistente de Costear (análisis IA → BOM) y regresa con el despiece.</div>
        <Btn onClick={pasarACostear} disabled={!veCostos||!onPasarACostear} style={{width:'100%',marginTop:6}}>Pasar a Costear →</Btn>
        {!veCostos&&<div className="c3-small" style={{marginTop:4}}>Costear desde cero es de Diseño y Dirección: guarda la co-creación y pídeles que la bajen a BOM.</div>}
       </div>
      </div>}
   <Label>Dificultad de fabricación (Alba V1)</Label>
   <div role="radiogroup" aria-label="Dificultad de fabricación" style={{display:'flex',gap:4,flexWrap:'wrap'}}>{NIVELES_DIFICULTAD.map(([k,l])=>{const activo=(intent?._dificultad||'normal')===k;return <button key={k} type="button" role="radio" aria-checked={activo} data-testid={`cocrear-dificultad-${k}`} onClick={()=>setDificultad(k)} style={{padding:'5px 7px',borderRadius:999,border:activo?'1px solid #d33b30':'1px solid #414141',background:activo?'#3b211f':'transparent',color:'#fff',fontSize:9}}>{l} ×{DIFICULTAD[k]}</button>})}</div>
   <div className="c3-small" style={{marginTop:4}}>{(NIVELES_DIFICULTAD.find(([k])=>k===(intent?._dificultad||'normal'))||[])[2]}</div>
  </Card>
  <Card><Label>Verdad industrial</Label><div style={{display:'grid',gap:5,fontSize:12}}>{veCostos&&<div>Costo calculado (local, vista previa): <b>{costoConocido?money(costoOficial):'Pendiente de BOM'}</b></div>}{veCostos&&<div>Estado motor: <b>{pipeline?.costo?.cost_status||'UNKNOWN'}</b></div>}<div>Componentes BOM: <b>{spec?.componentes?.length||0}</b></div><div>Servidor: <b data-testid="cocrear-estado-servidor">{servidorVigente?servidor.estado:(servidor?'vencido: la revisión cambió':'sin costear')}</b></div>{veCostos&&servidorVigente&&<div>Costo del servidor: <b>{costoServidor!=null?money(costoServidor):'incompleto'}</b></div>}<div>Precio sugerido: <b data-testid="cocrear-precio">{precioServidor!=null?money(precioServidor):(servidorVigente?'Por confirmar':'—')}</b></div>{veCostos&&!servidorVigente&&precioLocal?.precio!=null&&<div className="c3-small">Vista previa local: {money(precioLocal.precio)} (margen {precioLocal.margen} %, piso {precioLocal.piso} %). No se guarda ni se emite: el precio oficial lo da el servidor.</div>}{veCostos&&!servidorVigente&&costoConocido===false&&bom.length>0&&<div className="c3-small">Precio: Por confirmar (costo incompleto).</div>}<div>Ingeniería: <b style={{color:engineeringValidated?'#79c990':'#e0a36f'}}>{engineeringValidated?'VALIDADA':'REQUIERE VALIDACIÓN'}</b></div></div>
   <Btn ghost onClick={()=>costearEnServidor()} disabled={!bom.length||costeandoSrv} style={{width:'100%',marginTop:8}}>{costeandoSrv?'Costeando en el servidor…':'Costear en el servidor'}</Btn>
   {servidorVigente&&!servidor.ingenieria_validada&&servidor.validacion?.motivo&&<div style={{marginTop:6,fontSize:10,color:'#ff9b91'}}>✕ {servidor.validacion.motivo}</div>}
   {veCostos&&explicacionCosteo&&<details open style={{marginTop:9,border:'1px solid #3d352d',borderRadius:9,padding:9,background:'#171513'}}>
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
    ? <div style={{marginTop:8,padding:8,border:'1px solid #28553b',borderRadius:8,fontSize:10,color:'#bfe8ca'}}>✓ Validada en el servidor por {engineeringValidation?.validador||'ingeniería'} · {engineeringValidation?.fecha?new Date(engineeringValidation.fecha).toLocaleString('es-MX'):'fecha registrada'} · ligada a esta revisión visual.</div>
    : puedeAprobarRol
      ? <div style={{marginTop:8}}><Btn ghost onClick={validarIngenieria} disabled={!ingenieriaListaParaRevision||costeandoSrv} style={{width:'100%'}}>Validar ingeniería de esta revisión</Btn><div className="c3-small" style={{marginTop:5}}>{ingenieriaListaParaRevision?'La valida el servidor: guarda esta revisión, la costea y revisa rol, costo emitible, estructura y que sea la misma revisión visual.':'Para validar: BOM con materiales y sin piezas pendientes.'}</div></div>
      : <div className="c3-small" style={{marginTop:8}}>La liberación de ingeniería requiere Diseño o Dirección.</div>}
   {veCostos&&!costoConocido&&estimado.disponible&&<div style={{background:'#1c160f',border:'1px solid #4a3a1f',borderRadius:10,padding:10,marginTop:10}}><Label>Estimado de diseño · evidencia real</Label><div style={{fontSize:17,fontWeight:900,color:'#ffe0b0'}}>≈ {money(estimado.total)} <span style={{fontSize:10,fontWeight:600,color:'#c7a98a'}}>parcial</span></div><div style={{fontSize:10,color:'#9a9a9a',margin:'2px 0 6px'}}>Cobertura {estimado.coberturaPct}% del alcance (por partidas) · confianza {estimado.confianza}</div>{estimado.items.map((it,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',gap:8,padding:'4px 0',borderTop:'1px solid #33291a',fontSize:11}}><span>{it.concepto} · {it.detalle}</span><b>{money(it.subtotal)}</b></div>)}<div style={{fontSize:10,color:'#d6a36d',marginTop:6}}><b>Pendiente por estimar</b> (no es $0): {estimado.pendientes.join(' · ')}</div><p style={{fontSize:9,color:'#8a8a8a',lineHeight:1.35,marginTop:5}}>{estimado.nota}</p></div>}
   {refsCargando&&<p className="c3-small">Buscando referencias reales en la lista vigente…</p>}
   {refUI&&<div className="c3-ref"><Label>Referencia comercial real</Label>{refUI.rangoPrecio&&<div style={{fontSize:17,fontWeight:900,color:'#d7f0df'}}>{refUI.rangoPrecio}</div>}{refUI.rangoCosto&&<div style={{fontSize:11,marginTop:4}}>Costo comparable autorizado: <b>{refUI.rangoCosto}</b></div>}<p style={{fontSize:9,color:'#9fb0a5',lineHeight:1.35}}>No es el costo del especial. Son precios vigentes de productos comparables; extras especiales se certifican cuando existe BOM/precio de insumo suficiente.</p>{refUI.items.slice(0,4).map((x,i)=><div className="c3-refrow" key={`${x.producto_id}-${i}`}><span>{x.capacidad?`${x.capacidad}u · `:''}{x.nombre.replace('Módulo operativo App LT ','')}</span><b>{money(x.precio,x.moneda)}</b></div>)}</div>}
   {!costoConocido&&<p style={{color:'#d6a36d',fontSize:10,lineHeight:1.4}}>La referencia comercial es útil para presupuesto preliminar, pero no se presenta como costo certificado hasta bajar el concepto a BOM.</p>}
   <Btn onClick={agregarCotizacion} disabled={!listaParaCotizar||!onAgregar} style={{width:'100%',marginTop:5}}>{cotizadoHash===spec?.hash?'✓ En cotización':'Convertir en partida'}</Btn>
  </Card></div>
 </div></div>;
}
