import React,{useEffect,useMemo,useState} from 'react';
import {
  cocrearDesdeIntent,construirProductSpec,extraerDNA,clasificarProducto,cocrearDeExpediente,cocrearPayload,
  hashEstable,DIMS_DEFAULT,MATERIALES_EDIT,FAMILIA,aplicarCambioTexto,
} from '../datos/cocrear.js';
import {prepararIntentCocrear,resumenIdeaCocrear,conceptosCocrear,aplicarConceptoCocrear,FEATURES_COCREAR} from '../datos/cocrearWow.js';
import {referenciasComercialesCocrear,formatearReferenciaCocrear} from '../datos/cocrearReferencias.js';
import {listarCocreaciones,guardarCocrearSeguro,cargarCocrearSeguro,registrarProductoDesdeExpediente,subirRenderCanonico,voniCouncil,generarRender} from '../nube.js';
import CocrearVisual from './CocrearVisual.jsx';
import {parametrosEfectivos} from './Costeador.jsx';
import {precioVenta} from '../motor/calculo.js';
import {compileRenderPrompt,renderStale} from '../datos/renderPrompt.js';

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
const money=(n,cur='MXN')=>Number.isFinite(Number(n))?new Intl.NumberFormat('es-MX',{style:'currency',currency:cur,maximumFractionDigits:0}).format(Number(n)):'—';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

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

async function capturarModeloPNG(){
 try{
  const svg=document.querySelector('#cocrear-modelo-canonico svg');if(!svg)return null;
  const xml=new XMLSerializer().serializeToString(svg),blob=new Blob([xml],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob);
  const img=new Image();await new Promise((ok,err)=>{img.onload=ok;img.onerror=err;img.src=url});
  const cv=document.createElement('canvas');cv.width=1200;cv.height=660;const ctx=cv.getContext('2d');ctx.fillStyle='#111315';ctx.fillRect(0,0,cv.width,cv.height);ctx.drawImage(img,0,0,cv.width,cv.height);URL.revokeObjectURL(url);
  return cv.toDataURL('image/png').split(',')[1]||null;
 }catch{return null}
}
function Card({children,style={}}){return <div style={{background:'#171717',border:'1px solid #303236',borderRadius:14,padding:14,...style}}>{children}</div>}
function Label({children}){return <div style={{fontSize:10,letterSpacing:1.25,textTransform:'uppercase',color:'#8992a2',fontWeight:800,marginBottom:7}}>{children}</div>}
function Btn({children,onClick,disabled=false,ghost=false,style={}}){return <button type="button" disabled={disabled} onClick={onClick} style={{borderRadius:10,padding:'9px 13px',fontSize:13,fontWeight:800,border:ghost?'1px solid #50545a':'1px solid #d13b30',background:ghost?'transparent':disabled?'#34211f':'#c93429',color:disabled?'#776b69':'#fff',cursor:disabled?'not-allowed':'pointer',...style}}>{children}</button>}

export default function Cocrear({estado,onAgregar}){
 const [fase,setFase]=useState('inicio'),[texto,setTexto]=useState(''),[intent,setIntent]=useState(null),[historia,setHistoria]=useState([]),[conceptos,setConceptos]=useState([]);
 const [analisis,setAnalisis]=useState(null),[aiError,setAiError]=useState(''),[pensando,setPensando]=useState(false),[nl,setNl]=useState(''),[mensaje,setMensaje]=useState('');
 const [guardando,setGuardando]=useState(false),[guardado,setGuardado]=useState(false),[expedienteId,setExpedienteId]=useState(null),[guardadas,setGuardadas]=useState([]);
 const [render,setRender]=useState(null),[renderCargando,setRenderCargando]=useState(false),[renderError,setRenderError]=useState(''),[comparA,setComparA]=useState(null),[cotizadoHash,setCotizadoHash]=useState(null);
 const [refs,setRefs]=useState(null),[refsCargando,setRefsCargando]=useState(false);

 const insumos=estado?.insumos||{};
 const par=useMemo(()=>parametrosEfectivos(estado,{componentes:[]}).par||estado?.parametros||{},[estado]);
 const rev=historia.length||1,bom=(intent&&intent._componentes)||[];
 const spec=useMemo(()=>intent?construirProductSpec(intent,extraerDNA(intent),clasificarProducto(intent,{}),{rev,componentes:bom}):null,[intent,rev,bom]);
 const pipeline=useMemo(()=>intent?cocrearDesdeIntent(intent,{insumos,par,rev,componentes:bom}):null,[intent,insumos,par,rev,bom]);
 const resumen=useMemo(()=>intent?resumenIdeaCocrear(intent,texto):null,[intent,texto]);
 const rStale=!!(render&&spec&&renderStale(render,spec));
 const refUI=useMemo(()=>formatearReferenciaCocrear(refs),[refs]);

 useEffect(()=>{if(fase!=='inicio')return;let live=true;listarCocreaciones(12).then(r=>{if(live&&r?.ok)setGuardadas(r.items||[])}).catch(()=>{});return()=>{live=false}},[fase]);
 useEffect(()=>{if(fase!=='studio'||!intent)return;let live=true;setRefsCargando(true);referenciasComercialesCocrear(intent).then(r=>{if(live)setRefs(r)}).finally(()=>{if(live)setRefsCargando(false)});return()=>{live=false}},[fase,intent?._concepto,intent?.capacidad_personas,intent?.familia]);

 const reset=()=>{setFase('inicio');setIntent(null);setHistoria([]);setConceptos([]);setAnalisis(null);setAiError('');setRender(null);setMensaje('');setExpedienteId(null);setComparA(null);setRefs(null)};
 const commit=(next,label)=>{setIntent(next);setHistoria(h=>[...h,{rev:h.length+1,intent:clone(next),label}]);setGuardado(false)};

 const generarPara=async(nextIntent,nextSpec)=>{
  if(!nextSpec)return;setRenderCargando(true);setRenderError('');
  try{
   const c=compileRenderPrompt(nextSpec,nextSpec.dna);
   const descripcion=`${c.descripcion}\nCLIENT BRIEF: ${nextIntent?._brief||texto}. SELECTED CONCEPT: ${nextIntent?._concepto||''} ${nextIntent?._concepto_nombre||''}. The image MUST preserve the exact current-revision geometry shown in the supplied technical reference. Do not redesign the product.`;
   const modelo=await capturarModeloPNG();
   const r=await generarRender(descripcion,{render_spec:c.render_spec,materiales:c.materiales,medidas:c.medidas,tipo:c.tipo,modo:c.modo,aspecto:'4:3',...(modelo?{imagen:modelo,mediaType:'image/png'}:{})});
   if(r?.ok&&r.dataUrl)setRender({dataUrl:r.dataUrl,specHash:nextSpec.hash,expected:c.expected,version:c.version,concepto:nextIntent?._concepto||null});else throw new Error(r?.error||'No se pudo generar el render');
  }catch(e){setRenderError(String(e?.message||e))}finally{setRenderCargando(false)}
 };
 const generar=()=>generarPara(intent,spec);

 const analizarIdea=async()=>{
  const brief=texto.trim();if(!brief||pensando)return;setPensando(true);setAiError('');setMensaje('');
  const base=prepararIntentCocrear(brief);setIntent(base);
  try{
   const ctx=resumenIdeaCocrear(base,brief);
   const r=await voniCouncil({task:'review_product',request:`COCREACIÓN. Interpreta esta idea completa sin convertirla en un mueble genérico: ${brief}`,context:{...ctx,intent:base},constraints:['No inventar costos','Conservar intención completa','Priorizar fabricabilidad Von Haucke','Distinguir claramente alternativas geométricas'],lenses:['diseño de producto','ingeniería/fabricación','uso','comercial']});
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
   const r=await voniCouncil({task:'interpret_change',request:frase,context:{brief:texto,intent:next,spec:nextSpec,resumen},constraints:['No inventar costos','No cambiar el concepto seleccionado silenciosamente','La instrucción debe afectar el ProductSpec canónico si es concreta','Proponer cambios explícitos y fabricables'],lenses:['diseño','fabricación','uso']});setAnalisis(r||{});
   const txt=councilText(r)||'VONI revisó la modificación.';
   setMensaje(cambio.aplico?`✓ Cambio aplicado a la revisión canónica. ${txt} El render anterior quedó vencido; regénéralo para ver exactamente esta revisión.`:txt);
   setNl('');
  }catch(e){setMensaje(cambio.aplico?`✓ Cambio aplicado al modelo. Council no pudo responder: ${String(e?.message||e)}`:`VONI no pudo responder: ${String(e?.message||e)}`)}
  setPensando(false)
 };

 const guardar=async()=>{if(!intent)return;setGuardando(true);setMensaje('');try{const r=await guardarCocrearSeguro(expedienteId,cocrearPayload({brief:texto,intent,historia,render,insumos,par}));if(!r?.ok)throw new Error(r?.error||'No se pudo guardar');if(r.expediente_id)setExpedienteId(r.expediente_id);setGuardado(true);setMensaje('✓ Co-creación guardada.');}catch(e){setMensaje(`No se pudo guardar: ${String(e?.message||e)}`)}setGuardando(false)};
 const reabrir=async id=>{try{const r=await cargarCocrearSeguro(id);const est=r?.ok?cocrearDeExpediente({cocrear:r.cocrear}):null;if(!est?.intent)throw new Error('Expediente sin intención válida');setIntent(est.intent);setHistoria(est.historia?.length?est.historia:[{rev:1,label:'Reabierta',intent:est.intent}]);setTexto(est.brief||est.intent?._brief||'');setExpedienteId(id);setRender(null);setFase('studio')}catch(e){setMensaje(String(e?.message||e))}};

 const costoOficial=Number(pipeline?.costo?.official_cost),costoConocido=Number.isFinite(costoOficial)&&costoOficial>0;
 const agregarCotizacion=async()=>{
  if(!costoConocido||!onAgregar){setMensaje('Todavía no puede convertirse en partida: falta BOM/economía certificada. Las referencias comerciales no sustituyen el costeo.');return}
  let id=expedienteId,prodId=null,versionId=null;
  try{if(!id){const s=await guardarCocrearSeguro(null,cocrearPayload({brief:texto,intent,historia,render,insumos,par}));if(s?.ok){id=s.expediente_id;setExpedienteId(id)}}if(id){const reg=await registrarProductoDesdeExpediente(id);if(reg?.ok){prodId=reg.producto_id;versionId=reg.version_id}}if(versionId&&render&&!rStale){const c=compileRenderPrompt(spec,spec.dna);const geometryHash=hashEstable({familia:spec.familia,dimensiones:spec.dimensiones||{},caracteristicas:spec.caracteristicas||[],componentes:spec.componentes||[]});await subirRenderCanonico({expedienteId:id,productoId:prodId,productoVersionId:versionId,dataUrl:render.dataUrl,promptVersion:render.version,modo:'render',specHash:spec.hash,geometryHash,inputs:c.expected||{}})}}catch{}
  const margen=Number.isFinite(par.margenObjetivo)?par.margenObjetivo:40,pv=precioVenta(costoOficial,par).precio;
  onAgregar({nombre:intent?._concepto_nombre||resumen?.tipologia||'Producto co-creado',componentes:spec.componentes,w:spec.dimensiones?.ancho_mm||null,d:spec.dimensiones?.prof_mm||spec.dimensiones?.fondo_mm||null,productoId:prodId,productVersionId:versionId,precioReal:false,config:null},1,pv,margen);setCotizadoHash(spec.hash);setMensaje('✓ Revisión actual agregada a cotización.');
 };

 const css=<style>{`.coc3{max-width:1240px;margin:0 auto;font-size:14px}.c3-title{font-size:clamp(30px,3vw,44px);line-height:1.06;margin:5px 0 9px}.c3-lead{font-size:16px;color:#b7b2af;max-width:850px;line-height:1.5}.c3-concepts{display:grid;grid-template-columns:320px minmax(0,1fr);gap:13px}.c3-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.c3-studio{display:grid;grid-template-columns:245px minmax(0,1fr) 300px;gap:11px;align-items:start}.c3-hero{min-height:330px;display:flex;align-items:center;justify-content:center;background:#111315;border-radius:11px;overflow:hidden}.c3-hero img{width:100%;height:auto;display:block}.c3-input{width:100%;box-sizing:border-box;background:#22201f;color:#fff;border:1px solid #444;border-radius:9px;padding:8px}.c3-small{font-size:11px;color:#9ca3ad}.c3-ref{background:#121b16;border:1px solid #28553b;border-radius:10px;padding:10px;margin-top:10px}.c3-refrow{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid #26352b;font-size:11px}.c3-history{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.c3-history button{background:#202225;color:#cfd3d7;border:1px solid #393d42;border-radius:999px;padding:5px 8px;font-size:10px}@media(max-width:1050px){.c3-studio{grid-template-columns:230px minmax(0,1fr)}.c3-right{grid-column:1/-1}.c3-concepts{grid-template-columns:1fr}}@media(max-width:760px){.c3-studio,.c3-concepts,.c3-cards{grid-template-columns:1fr}.c3-title{font-size:32px}}`}</style>;

 if(fase==='inicio')return <div className="contenido coc3">{css}<Label>VON HAUCKE · COCREAR</Label><h1 className="c3-title">¿Qué quieres crear?</h1><p className="c3-lead">Describe el problema o la idea. VONI propone direcciones de diseño; al elegir una, render, modelo técnico y referencias comerciales quedan amarrados al mismo concepto.</p><Card style={{marginTop:16}}><textarea value={texto} onChange={e=>setTexto(e.target.value)} rows={4} placeholder="Ej. Hub colaborativo para 8 personas, vegetación integrada, cableado oculto y escalable a 12…" className="c3-input" style={{fontSize:15,padding:13}}/><div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:9}}>{EJEMPLOS.map((e,i)=><button key={i} onClick={()=>setTexto(e)} style={{background:'#242220',color:'#ddd',border:'1px solid #414141',borderRadius:999,padding:'6px 9px',fontSize:10,cursor:'pointer'}}>{e.split(',')[0]}</button>)}</div><div style={{display:'flex',gap:8,marginTop:12}}><Btn onClick={analizarIdea} disabled={!texto.trim()||pensando}>{pensando?'VONI analizando…':'Crear conceptos con VONI →'}</Btn><Btn ghost onClick={desdeCero}>Empezar desde cero</Btn></div></Card>{guardadas.length>0&&<div style={{marginTop:18}}><Label>Guardadas</Label><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:7}}>{guardadas.map(x=><button key={x.id} onClick={()=>reabrir(x.id)} style={{textAlign:'left',background:'#171717',border:'1px solid #333',borderRadius:9,padding:10,color:'#fff',cursor:'pointer'}}><strong>{x.nombre||'Co-creación'}</strong><div className="c3-small">{x.producto_tipo||'Producto especial'} · reabrir</div></button>)}</div></div>}</div>;

 if(fase==='conceptos')return <div className="contenido coc3">{css}<div style={{display:'flex',justifyContent:'space-between',alignItems:'start'}}><div><Label>VONI · lectura de idea</Label><h1 style={{fontSize:29,margin:'2px 0'}}>Tres direcciones, una misma intención</h1></div><Btn ghost onClick={reset}>‹ Nueva idea</Btn></div><div className="c3-concepts" style={{marginTop:13}}><Card><Label>Lo que entendimos</Label><p style={{fontSize:14,lineHeight:1.45}}>{resumen?.necesidad}</p><div style={{display:'grid',gap:5,fontSize:12,color:'#c8c8c8'}}><div><b>Tipología:</b> {resumen?.tipologia}</div><div><b>Capacidad:</b> {resumen?.capacidad}</div><div><b>Envolvente:</b> {resumen?.envolvente}</div><div><b>Claves:</b> {resumen?.claves?.join(' · ')||'por definir'}</div></div><hr style={{borderColor:'#303236',margin:'13px 0'}}/><Label>Análisis VONI Council</Label>{aiError?<p style={{color:'#ffb4aa',fontSize:11}}>Council no disponible: {aiError}</p>:<p style={{fontSize:12,lineHeight:1.45,color:'#ddd'}}>{councilText(analisis)||'VONI revisó intención, uso y fabricabilidad.'}</p>}</Card><div><Label>Elige una dirección</Label><div className="c3-cards">{conceptos.map(c=><Card key={c.id} style={{display:'flex',flexDirection:'column',minHeight:215}}><div style={{color:'#d33b30',fontSize:22,fontWeight:900}}>{c.id}</div><h2 style={{fontSize:17,margin:'6px 0 3px'}}>{c.nombre}</h2><div style={{fontSize:9,color:'#999',fontWeight:800,textTransform:'uppercase'}}>{c.subtitulo}</div><p style={{fontSize:12,lineHeight:1.42,flex:1}}>{c.descripcion}</p><Btn onClick={()=>elegirConcepto(c)}>Desarrollar →</Btn></Card>)}</div></div></div></div>;

 const dims=intent?.dimensiones||{},feats=new Set(intent?.caracteristicas||[]),mat=intent?.materiales?.[0]?.material||'laminado',tone=intent?.materiales?.[0]?.tono||null;
 return <div className="contenido coc3">{css}<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:9}}><div><button onClick={()=>setFase('inicio')} style={{background:'none',border:0,color:'#aaa',cursor:'pointer'}}>‹ Nueva idea</button><strong style={{marginLeft:9,fontSize:17}}>{intent?._concepto?`Concepto ${intent._concepto} · `:''}{intent?._concepto_nombre||resumen?.tipologia||'Producto co-creado'}</strong><span style={{fontSize:9,color:'#8992a2',marginLeft:7}}>REV {rev}</span></div><div style={{display:'flex',gap:6}}><Btn ghost onClick={()=>setComparA(comparA?null:clone(intent))}>{comparA?'Salir A/B':'Comparar A/B'}</Btn><Btn ghost onClick={guardar} disabled={guardando}>{guardando?'Guardando…':guardado?'✓ Guardado':'Guardar'}</Btn></div></div>
 <div className="c3-studio">
  <Card><Label>Diseño</Label><div style={{marginBottom:9}}><small>Tipología</small><select value={intent?.familia||FAMILIA.DESCONOCIDA} onChange={e=>setFamilia(e.target.value)} className="c3-input" style={{marginTop:3}}>{FAMILY_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>{intent?.tipologia_cocrear==='operativo_colaborativo'&&<div style={{marginBottom:9}}><small>Personas / puestos</small><input type="number" min="2" max="24" value={intent.capacidad_personas||6} onChange={e=>setCap(e.target.value)} className="c3-input" style={{marginTop:3}}/></div>}<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4,marginBottom:10}}>{[['ancho_mm','Ancho'],['prof_mm','Fondo'],['alto_mm','Alto']].map(([k,l])=><label key={k} style={{fontSize:9,color:'#aaa'}}>{l}<input type="number" value={dims[k]||0} onChange={e=>setDim(k,e.target.value)} className="c3-input" style={{padding:5,marginTop:2}}/></label>)}</div><Label>Material</Label><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4}}>{MATERIALES_EDIT.map(m=><button key={m} onClick={()=>setMaterial(m)} style={{padding:'6px 2px',borderRadius:7,border:mat===m?'2px solid #d33b30':'1px solid #414141',background:'#22201f',color:'#fff',fontSize:9}}>{MAT_LABEL[m]||m}</button>)}</div><Label>Tono</Label><div style={{display:'flex',gap:4}}>{[['claro','Claro'],[null,'Natural'],['oscuro','Oscuro']].map(([v,l])=><button key={l} onClick={()=>setTone(v)} style={{flex:1,padding:6,borderRadius:7,border:tone===v?'2px solid #d33b30':'1px solid #414141',background:'#22201f',color:'#fff',fontSize:9}}>{l}</button>)}</div><Label>Funciones</Label><div style={{display:'flex',flexWrap:'wrap',gap:4}}>{FEATURES_COCREAR.map(([k,l])=><button key={k} onClick={()=>toggleFeature(k)} style={{padding:'5px 6px',borderRadius:999,border:feats.has(k)?'1px solid #d33b30':'1px solid #414141',background:feats.has(k)?'#3b211f':'transparent',color:'#fff',fontSize:9}}>{feats.has(k)?'✓ ':'+ '}{l}</button>)}</div></Card>

  <div>{comparA?<Card><Label>Comparación conceptual</Label><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}><CocrearVisual spec={construirProductSpec(comparA,extraerDNA(comparA),clasificarProducto(comparA,{}),{rev:'A'})} intent={comparA}/><CocrearVisual spec={spec} intent={intent}/></div></Card>:<Card style={{padding:8}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 5px 8px'}}><div><Label>Render IA · Concepto {intent?._concepto||'—'}</Label><strong style={{fontSize:13}}>{intent?._concepto_nombre||'Visualización principal'}</strong></div><Btn onClick={generar} disabled={renderCargando}>{renderCargando?'Generando…':render?'Regenerar':'Generar render'}</Btn></div><div className="c3-hero">{renderCargando?<div style={{textAlign:'center'}}><strong>VONI está construyendo el concepto {intent?._concepto}</strong><p className="c3-small">Usando el modelo canónico de esta revisión como referencia de geometría.</p></div>:render?<div style={{width:'100%'}}>{rStale&&<div style={{padding:8,background:'#4a2d16',color:'#ffd09c',fontSize:10}}>El diseño cambió. Este render está vencido; regenera para representar la revisión actual.</div>}<img src={render.dataUrl} alt={`Render del concepto ${intent?._concepto||''}`} style={{opacity:rStale?.62:1}}/></div>:<div style={{textAlign:'center'}}><strong>Sin render de esta revisión</strong><p className="c3-small">Genera la visualización usando el modelo 3D como referencia.</p><Btn onClick={generar}>Generar render</Btn></div>}</div>{renderError&&<p style={{color:'#ff9d93',fontSize:10}}>{renderError}</p>}</Card>}{!comparA&&<div id="cocrear-modelo-canonico" style={{marginTop:8}}><CocrearVisual spec={spec} intent={intent}/></div>}<div className="c3-history">{historia.map(h=><button key={h.rev} onClick={()=>{setIntent(clone(h.intent));setMensaje(`Viendo Rev ${h.rev}: ${h.label}`)}}>R{h.rev} · {h.label}</button>)}</div></div>

  <div className="c3-right" style={{display:'grid',gap:10}}><Card><Label>VONI · Co-diseñador</Label><p style={{fontSize:11,color:'#aaa',lineHeight:1.4}}>Pídele un cambio concreto. Si la instrucción es inequívoca, primero cambia el modelo canónico; el render viejo queda vencido hasta regenerarlo.</p><textarea value={nl} onChange={e=>setNl(e.target.value)} rows={3} placeholder="Ej. Haz la jardinera completa a todo el eje central y conserva el resto exactamente igual." className="c3-input"/><Btn onClick={pedirVoni} disabled={!nl.trim()||pensando} style={{width:'100%',marginTop:6}}>{pensando?'Analizando…':'Aplicar con VONI'}</Btn>{mensaje&&<p style={{fontSize:10,lineHeight:1.4}}>{mensaje}</p>}</Card>
  <Card><Label>Verdad industrial</Label><div style={{display:'grid',gap:5,fontSize:12}}><div>Costo certificado: <b>{costoConocido?money(costoOficial):'Pendiente de BOM'}</b></div><div>Estado motor: <b>{pipeline?.costo?.cost_status||'UNKNOWN'}</b></div><div>Componentes BOM: <b>{spec?.componentes?.length||0}</b></div></div>
   {refsCargando&&<p className="c3-small">Buscando referencias reales en la lista vigente…</p>}
   {refUI&&<div className="c3-ref"><Label>Referencia comercial real</Label>{refUI.rangoPrecio&&<div style={{fontSize:17,fontWeight:900,color:'#d7f0df'}}>{refUI.rangoPrecio}</div>}{refUI.rangoCosto&&<div style={{fontSize:11,marginTop:4}}>Costo comparable autorizado: <b>{refUI.rangoCosto}</b></div>}<p style={{fontSize:9,color:'#9fb0a5',lineHeight:1.35}}>No es el costo del especial. Son precios vigentes de productos comparables; extras especiales se certifican cuando existe BOM/precio de insumo suficiente.</p>{refUI.items.slice(0,4).map((x,i)=><div className="c3-refrow" key={`${x.producto_id}-${i}`}><span>{x.capacidad?`${x.capacidad}u · `:''}{x.nombre.replace('Módulo operativo App LT ','')}</span><b>{money(x.precio,x.moneda)}</b></div>)}</div>}
   {!costoConocido&&<p style={{color:'#d6a36d',fontSize:10,lineHeight:1.4}}>La referencia comercial es útil para presupuesto preliminar, pero no se presenta como costo certificado hasta bajar el concepto a BOM.</p>}
   <Btn onClick={agregarCotizacion} disabled={!costoConocido||!onAgregar} style={{width:'100%',marginTop:5}}>{cotizadoHash===spec?.hash?'✓ En cotización':'Convertir en partida'}</Btn>
  </Card></div>
 </div></div>;
}
