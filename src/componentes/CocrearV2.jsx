import React, { useEffect, useMemo, useState } from 'react';
import {
  cocrearDesdeIntent, construirProductSpec, extraerDNA, clasificarProducto,
  cocrearDeExpediente, cocrearPayload, hashEstable, DIMS_DEFAULT, MATERIALES_EDIT, FAMILIA,
} from '../datos/cocrear.js';
import {
  prepararIntentCocrear, resumenIdeaCocrear, conceptosCocrear, aplicarConceptoCocrear, FEATURES_COCREAR,
} from '../datos/cocrearWow.js';
import {
  listarCocreaciones, guardarCocrearSeguro, cargarCocrearSeguro, registrarProductoDesdeExpediente,
  subirRenderCanonico, voniCouncil, generarRender,
} from '../nube.js';
import CocrearVisual from './CocrearVisual.jsx';
import { parametrosEfectivos } from './Costeador.jsx';
import { precioVenta } from '../motor/calculo.js';
import { compileRenderPrompt, renderStale } from '../datos/renderPrompt.js';

const MAT_LABEL={nogal:'Nogal',roble:'Roble',encino:'Encino',maple:'Maple',laminado:'Laminado',solid_surface:'Solid surface',cristal:'Cristal',metal:'Metal',piedra:'Piedra'};
const FAMILY_OPTIONS=[[FAMILIA.DESCONOCIDA,'Producto libre'],[FAMILIA.ESCRITORIO,'Operativo / escritorio'],[FAMILIA.MESA,'Mesa'],[FAMILIA.RECEPCION,'Recepción'],[FAMILIA.LOCKER,'Locker'],[FAMILIA.DISPLAY,'Exhibidor'],[FAMILIA.GUARDADO,'Guardado']];
const EJEMPLOS=[
  'Operativo 6 lugares, con una jardinera intermedia de acero para plantas, electrificación oculta y look premium.',
  'Una recepción escultórica para lobby corporativo, curva, cálida, con iluminación y guardado oculto.',
  'Una mesa de consejo para 14 personas con electrificación, cableado invisible y presencia ejecutiva.',
  'Una cabina acústica doble para videollamadas, con cristal, ventilación, luz y mesa integrada.',
  'Un módulo café corporativo premium con exhibición, barra, almacenamiento y luz integrada.',
];
const clone=x=>JSON.parse(JSON.stringify(x));
const money=n=>Number.isFinite(Number(n))?'$'+Number(n).toLocaleString('es-MX',{maximumFractionDigits:2}):'—';

function councilText(r){
  if(!r)return '';
  const direct=[r.humano,r.summary,r.resumen,r.recommendation,r.recomendacion,r.synthesis?.summary,r.synthesis?.recommendation];
  const d=direct.find(x=>typeof x==='string'&&x.trim());if(d)return d.trim();
  const outs=(r.opinions||[]).filter(x=>x?.ok&&x?.output).map(x=>x.output);
  const summaries=outs.map(x=>x?.summary).filter(Boolean);if(summaries.length)return summaries.join(' · ');
  const recs=outs.flatMap(x=>x?.recommendations||[]).map(x=>x?.what).filter(Boolean);if(recs.length)return recs.slice(0,3).join(' · ');
  return '';
}
function Card({children,style={},className=''}){return <div className={className} style={{background:'#171717',border:'1px solid #303236',borderRadius:14,padding:14,...style}}>{children}</div>}
function Label({children}){return <div style={{fontSize:10,letterSpacing:1.25,textTransform:'uppercase',color:'#8992a2',fontWeight:800,marginBottom:7}}>{children}</div>}
function Btn({children,onClick,disabled=false,ghost=false,style={}}){return <button type="button" disabled={disabled} onClick={onClick} style={{borderRadius:10,padding:'9px 13px',fontSize:13,fontWeight:800,border:ghost?'1px solid #50545a':'1px solid #d13b30',background:ghost?'transparent':disabled?'#34211f':'#c93429',color:disabled?'#776b69':'#fff',cursor:disabled?'not-allowed':'pointer',...style}}>{children}</button>}

export default function CocrearV2({estado,onAgregar}){
  const [fase,setFase]=useState('inicio');
  const [texto,setTexto]=useState('');
  const [intent,setIntent]=useState(null);
  const [historia,setHistoria]=useState([]);
  const [conceptos,setConceptos]=useState([]);
  const [analisis,setAnalisis]=useState(null);
  const [aiError,setAiError]=useState('');
  const [pensando,setPensando]=useState(false);
  const [nl,setNl]=useState('');
  const [mensaje,setMensaje]=useState('');
  const [guardando,setGuardando]=useState(false);
  const [guardado,setGuardado]=useState(false);
  const [expedienteId,setExpedienteId]=useState(null);
  const [guardadas,setGuardadas]=useState([]);
  const [render,setRender]=useState(null);
  const [renderCargando,setRenderCargando]=useState(false);
  const [renderError,setRenderError]=useState('');
  const [comparA,setComparA]=useState(null);
  const [cotizadoHash,setCotizadoHash]=useState(null);

  const insumos=estado?.insumos||{};
  const par=useMemo(()=>parametrosEfectivos(estado,{componentes:[]}).par||estado?.parametros||{},[estado]);
  const rev=historia.length||1;
  const bom=(intent&&intent._componentes)||[];
  const spec=useMemo(()=>intent?construirProductSpec(intent,extraerDNA(intent),clasificarProducto(intent,{}),{rev,componentes:bom}):null,[intent,rev,bom]);
  const pipeline=useMemo(()=>intent?cocrearDesdeIntent(intent,{insumos,par,rev,componentes:bom}):null,[intent,insumos,par,rev,bom]);
  const resumen=useMemo(()=>intent?resumenIdeaCocrear(intent,texto):null,[intent,texto]);
  const rStale=!!(render&&spec&&renderStale(render,spec));

  useEffect(()=>{if(fase!=='inicio')return;let vivo=true;listarCocreaciones(12).then(r=>{if(vivo&&r?.ok)setGuardadas(r.items||[])}).catch(()=>{});return()=>{vivo=false}},[fase]);
  const reset=()=>{setFase('inicio');setIntent(null);setHistoria([]);setConceptos([]);setAnalisis(null);setAiError('');setRender(null);setMensaje('');setExpedienteId(null);setComparA(null)};
  const commit=(next,label)=>{setIntent(next);setHistoria(h=>[...h,{rev:h.length+1,intent:clone(next),label}]);setGuardado(false)};

  const renderPayload=(sp,it)=>{
    const c=compileRenderPrompt(sp,sp.dna);
    const feats=new Set(it?.caracteristicas||[]);
    const mandatory=[...(c.render_spec?.mandatory||[])];
    if(feats.has('jardinera_integrada'))mandatory.push('integrated linear planter with real green plants as a central design element');
    if(feats.has('electrificacion_integrada'))mandatory.push('fully concealed integrated power and cable management');
    if(feats.has('divisores'))mandatory.push('removable privacy dividers between work positions');
    if(feats.has('acustica'))mandatory.push('acoustic divider panels with premium textile finish');
    const collaborative=it?.tipologia_cocrear==='operativo_colaborativo';
    const rs={...c.render_spec,product_type:collaborative?'premium modular collaborative workstation hub':c.render_spec?.product_type,counts:{...(c.render_spec?.counts||{}),user_capacity:it?.capacidad_personas||sp?.capacidad?.personas||undefined},mandatory};
    const descripcion=[c.descripcion,`CLIENT DESIGN BRIEF: ${it?._brief||texto}.`,`SELECTED CONCEPT: ${it?._concepto_nombre||'custom concept'}.`,collaborative?`This is NOT a single desk. It is one integrated collaborative system for ${it?.capacidad_personas||6} people, with clearly visible individual work positions arranged around the shared central element.`:'',`Create a sophisticated photorealistic furniture product visualization on a neutral architectural studio background. Show believable thicknesses, structure, joinery and manufacturable proportions. Do not simplify the concept into a generic rectangular desk.`].filter(Boolean).join('\n');
    return {c,rs,descripcion};
  };

  const generarPara=async(nextIntent,nextSpec)=>{
    if(!nextSpec)return;setRenderCargando(true);setRenderError('');
    try{const {c,rs,descripcion}=renderPayload(nextSpec,nextIntent);const r=await generarRender(descripcion,{render_spec:rs,materiales:c.materiales,medidas:c.medidas,tipo:c.tipo,modo:c.modo,aspecto:'4:3'});if(r?.ok&&r.dataUrl)setRender({dataUrl:r.dataUrl,specHash:nextSpec.hash,expected:c.expected,version:c.version});else throw new Error(r?.error||'No se pudo generar el render');}
    catch(e){setRenderError(String(e?.message||e))}finally{setRenderCargando(false)}
  };
  const generar=()=>generarPara(intent,spec);

  const analizarIdea=async()=>{
    const brief=texto.trim();if(!brief||pensando)return;setPensando(true);setAiError('');setMensaje('');
    const base=prepararIntentCocrear(brief);setIntent(base);
    try{const ctx=resumenIdeaCocrear(base,brief);const r=await voniCouncil({task:'review_product',request:`COCREACIÓN. Interpreta esta idea de producto sin reducirla a un mueble genérico. ${brief}`,context:{...ctx,intent:base},constraints:['No inventar costos ni materiales certificados','Priorizar fabricabilidad Von Haucke','Conservar la intención completa del cliente','Proponer alternativas realmente distintas'],lenses:['diseño de producto','ingeniería/fabricación','experiencia de usuario','comercial']});if(r?.ok===false)throw new Error(r.error||'VONI Council no respondió');setAnalisis(r||{});}catch(e){setAiError(String(e?.message||e))}
    setConceptos(conceptosCocrear(base));setFase('conceptos');setPensando(false);
  };

  const elegirConcepto=async c=>{
    const next=aplicarConceptoCocrear(intent,c);setIntent(next);setHistoria([{rev:1,intent:clone(next),label:`Concepto ${c.id}: ${c.nombre}`}]);setFase('studio');setRender(null);setComparA(null);
    const nextSpec=construirProductSpec(next,extraerDNA(next),clasificarProducto(next,{}),{rev:1,componentes:next._componentes||[]});
    await generarPara(next,nextSpec);
  };
  const desdeCero=()=>{const base=prepararIntentCocrear('producto especial modular');base.familia=FAMILIA.DESCONOCIDA;base._brief='Producto especial desde cero';base.dimensiones={...DIMS_DEFAULT[FAMILIA.DESCONOCIDA]};setTexto('Producto especial desde cero');setIntent(base);setHistoria([{rev:1,intent:clone(base),label:'Base libre'}]);setFase('studio')};

  const setDim=(k,v)=>commit({...intent,dimensiones:{...(intent.dimensiones||{}),[k]:Number(v)}},`${k}: ${v} mm`);
  const setFamilia=f=>{const dd=DIMS_DEFAULT[f]||DIMS_DEFAULT[FAMILIA.DESCONOCIDA];commit({...intent,familia:f,dimensiones:{...dd,...(intent.dimensiones||{})}},`Tipología: ${FAMILY_OPTIONS.find(([x])=>x===f)?.[1]||f}`)};
  const setCap=n=>{let next={...intent,capacidad_personas:Number(n),capacidad:{...(intent.capacidad||{}),personas:Number(n)}};if(next.tipologia_cocrear==='operativo_colaborativo')next=prepararIntentCocrear(`${next._brief||texto} ${n} lugares`,next);commit(next,`Capacidad: ${n}`)};
  const setMaterial=m=>commit({...intent,materiales:[{material:m,tono:intent.materiales?.[0]?.tono||null},...(intent.materiales||[]).slice(1)]},`Material: ${MAT_LABEL[m]||m}`);
  const setTone=tono=>commit({...intent,materiales:[{material:intent.materiales?.[0]?.material||'laminado',tono},...(intent.materiales||[]).slice(1)]},`Tono: ${tono||'natural'}`);
  const toggleFeature=f=>{const s=new Set(intent.caracteristicas||[]);s.has(f)?s.delete(f):s.add(f);commit({...intent,caracteristicas:[...s]},`${s.has(f)?'Agregar':'Quitar'} ${FEATURES_COCREAR.find(([k])=>k===f)?.[1]||f}`)};

  const pedirVoni=async()=>{const frase=nl.trim();if(!frase||pensando)return;setPensando(true);setMensaje('');try{const r=await voniCouncil({task:'interpret_change',request:frase,context:{brief:texto,intent,spec,resumen},constraints:['No inventar costos','Proponer cambios explícitos y fabricables'],lenses:['diseño','fabricación','uso']});setAnalisis(r||{});setMensaje(councilText(r)||'VONI analizó el cambio. Confirma el resultado con los controles y regenera el render.');const next=prepararIntentCocrear(`${intent?._brief||texto}. Cambio solicitado: ${frase}`,intent);if(JSON.stringify(next)!==JSON.stringify(intent))commit(next,frase);setNl('');}catch(e){setMensaje(`VONI no pudo responder: ${String(e?.message||e)}`)}setPensando(false)};

  const guardar=async()=>{if(!intent)return;setGuardando(true);setMensaje('');try{const r=await guardarCocrearSeguro(expedienteId,cocrearPayload({brief:texto,intent,historia,render,insumos,par}));if(!r?.ok)throw new Error(r?.error||'No se pudo guardar');if(r.expediente_id)setExpedienteId(r.expediente_id);setGuardado(true);setMensaje('✓ Co-creación guardada.');}catch(e){setMensaje(`No se pudo guardar: ${String(e?.message||e)}`)}setGuardando(false)};
  const reabrir=async id=>{try{const r=await cargarCocrearSeguro(id);const est=r?.ok?cocrearDeExpediente({cocrear:r.cocrear}):null;if(!est?.intent)throw new Error('Expediente sin intención válida');setIntent(est.intent);setHistoria(est.historia?.length?est.historia:[{rev:1,label:'Reabierta',intent:est.intent}]);setTexto(est.brief||est.intent?._brief||'');setExpedienteId(id);setRender(null);setFase('studio');}catch(e){setMensaje(String(e?.message||e))}};

  const costoOficial=Number(pipeline?.costo?.official_cost),costoConocido=Number.isFinite(costoOficial)&&costoOficial>0;
  const listaParaCotizar=pipeline?.lineaCotizacion?.listaParaCotizar===true;
  const bloqueosCocrear=pipeline?.blockers||[];
  const agregarCotizacion=async()=>{if(!listaParaCotizar||!onAgregar){
    const motivo=pipeline?.lineaCotizacion?.motivo||bloqueosCocrear[0]||'falta validación del producto';
    setMensaje(`Todavía no puede convertirse en partida: ${motivo}. El costo calculado no sustituye la validación de ingeniería.`);
    return
  }let id=expedienteId,prodId=null,versionId=null;try{if(!id){const s=await guardarCocrearSeguro(null,cocrearPayload({brief:texto,intent,historia,render,insumos,par}));if(s?.ok){id=s.expediente_id;setExpedienteId(id)}}if(id){const reg=await registrarProductoDesdeExpediente(id);if(reg?.ok){prodId=reg.producto_id;versionId=reg.version_id}}if(versionId&&render&&!rStale){try{const c=compileRenderPrompt(spec,spec.dna);const geometryHash=hashEstable({familia:spec.familia,dimensiones:spec.dimensiones||{},caracteristicas:spec.caracteristicas||[],componentes:spec.componentes||[]});await subirRenderCanonico({expedienteId:id,productoId:prodId,productoVersionId:versionId,dataUrl:render.dataUrl,promptVersion:render.version,modo:'render',specHash:spec.hash,geometryHash,inputs:c.expected||{}})}catch{}}}catch{}const margen=Number.isFinite(par.margenObjetivo)?par.margenObjetivo:40;const pv=precioVenta(costoOficial,par).precio;onAgregar({nombre:intent?._concepto_nombre||resumen?.tipologia||'Producto co-creado',componentes:spec.componentes,w:spec.dimensiones?.ancho_mm||null,d:spec.dimensiones?.prof_mm||spec.dimensiones?.fondo_mm||null,productoId:prodId,productVersionId:versionId,precioReal:false,config:null},1,pv,margen);setCotizadoHash(spec.hash);setMensaje('✓ Revisión actual agregada a cotización.')};

  const css=<style>{`
    .coc-root{max-width:1240px;margin:0 auto;font-size:14px}.coc-title{font-size:clamp(30px,3.2vw,46px);line-height:1.05;margin:6px 0 10px}.coc-lead{font-size:17px;line-height:1.5;color:#b7b2af;max-width:900px}.coc-concepts{display:grid;grid-template-columns:330px minmax(0,1fr);gap:14px}.coc-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.coc-studio{display:grid;grid-template-columns:260px minmax(0,1fr) 290px;gap:12px;align-items:start}.coc-hero{min-height:360px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 40%,#24272b 0,#151719 58%,#101112 100%);border-radius:12px;overflow:hidden}.coc-hero img{width:100%;height:auto;display:block}.coc-placeholder{text-align:center;max-width:420px;padding:35px}.coc-small{font-size:12px;color:#9ca3ad}.coc-input{width:100%;box-sizing:border-box;background:#22201f;color:#fff;border:1px solid #444;border-radius:9px;padding:8px}.coc-features{display:flex;flex-wrap:wrap;gap:5px}.coc-history{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.coc-history button{background:#202225;color:#cfd3d7;border:1px solid #393d42;border-radius:999px;padding:5px 8px;font-size:10px}@media(max-width:1050px){.coc-studio{grid-template-columns:240px minmax(0,1fr)}.coc-right{grid-column:1/-1}.coc-concepts{grid-template-columns:1fr}.coc-cards{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.coc-studio,.coc-concepts,.coc-cards{grid-template-columns:1fr}.coc-title{font-size:34px}.coc-root{font-size:13px}.coc-hero{min-height:260px}}
  `}</style>;

  if(fase==='inicio')return <div className="contenido coc-root">{css}<Label>VON HAUCKE · COCREAR</Label><h1 className="coc-title">¿Qué quieres crear?</h1><p className="coc-lead">Describe la necesidad, el producto o incluso una idea incompleta. VONI la convierte en alternativas de diseño; tú eliges una y la desarrollas antes de ingeniería, costeo y cotización.</p><Card style={{marginTop:18}}><textarea value={texto} onChange={e=>setTexto(e.target.value)} rows={4} placeholder="Ej. Un hub de trabajo para 8 personas, vegetación integrada, cableado oculto y lenguaje premium…" className="coc-input" style={{fontSize:16,padding:14,resize:'vertical'}}/><div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:10}}>{EJEMPLOS.map((e,i)=><button key={i} onClick={()=>setTexto(e)} style={{background:'#242220',color:'#ddd',border:'1px solid #414141',borderRadius:999,padding:'6px 10px',fontSize:11,cursor:'pointer'}}>{e.split(',')[0]}</button>)}</div><div style={{display:'flex',gap:8,marginTop:14,flexWrap:'wrap'}}><Btn onClick={analizarIdea} disabled={!texto.trim()||pensando}>{pensando?'VONI está analizando…':'Crear conceptos con VONI →'}</Btn><Btn ghost onClick={desdeCero}>Empezar desde cero</Btn></div></Card>{guardadas.length>0&&<div style={{marginTop:20}}><Label>Guardadas</Label><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:8}}>{guardadas.map(x=><button key={x.id} onClick={()=>reabrir(x.id)} style={{textAlign:'left',background:'#171717',border:'1px solid #333',borderRadius:10,padding:11,color:'#fff',cursor:'pointer'}}><strong>{x.nombre||'Co-creación'}</strong><div className="coc-small">{x.producto_tipo||'Producto especial'} · reabrir</div></button>)}</div></div>}</div>;

  if(fase==='conceptos')return <div className="contenido coc-root">{css}<div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'start'}}><div><Label>VONI · lectura de idea</Label><h1 style={{fontSize:30,margin:'2px 0 4px'}}>Tres direcciones, una misma intención</h1></div><Btn ghost onClick={reset}>‹ Nueva idea</Btn></div><div className="coc-concepts" style={{marginTop:14}}><Card><Label>Lo que entendimos</Label><p style={{fontSize:15,lineHeight:1.45}}>{resumen?.necesidad}</p><div style={{display:'grid',gap:6,color:'#c8c8c8',fontSize:13}}><div><b>Tipología:</b> {resumen?.tipologia}</div><div><b>Capacidad:</b> {resumen?.capacidad}</div><div><b>Envolvente:</b> {resumen?.envolvente}</div><div><b>Claves:</b> {resumen?.claves?.join(' · ')||'por definir'}</div></div><hr style={{borderColor:'#303236',margin:'14px 0'}}/><Label>Análisis VONI Council</Label>{aiError?<p style={{color:'#ffb4aa',fontSize:12}}>No se pudo consultar el Council: {aiError}. Las alternativas deterministas siguen disponibles.</p>:<p style={{lineHeight:1.45,color:'#ddd',fontSize:13}}>{councilText(analisis)||'VONI revisó intención, uso y fabricabilidad. Elige una dirección para llevarla a visualización.'}</p>}</Card><div><Label>Elige una dirección</Label><div className="coc-cards">{conceptos.map(c=><Card key={c.id} style={{display:'flex',flexDirection:'column',minHeight:220}}><div style={{color:'#d33b30',fontWeight:900,fontSize:22}}>{c.id}</div><h2 style={{fontSize:18,margin:'7px 0 4px'}}>{c.nombre}</h2><div style={{fontSize:10,color:'#999',textTransform:'uppercase',fontWeight:800}}>{c.subtitulo}</div><p style={{lineHeight:1.42,flex:1,fontSize:13}}>{c.descripcion}</p><Btn onClick={()=>elegirConcepto(c)}>Desarrollar →</Btn></Card>)}</div></div></div></div>;

  const dims=intent?.dimensiones||{},feats=new Set(intent?.caracteristicas||[]),mat=intent?.materiales?.[0]?.material||'laminado',tone=intent?.materiales?.[0]?.tono||null;
  return <div className="contenido coc-root">{css}<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:10}}><div><button onClick={()=>setFase('inicio')} style={{background:'none',border:0,color:'#aaa',cursor:'pointer',fontSize:12}}>‹ Nueva idea</button><strong style={{marginLeft:10,fontSize:18}}>{intent?._concepto_nombre||resumen?.tipologia||'Producto co-creado'}</strong><span style={{fontSize:10,color:'#8e949b',marginLeft:8}}>REV {rev}</span></div><div style={{display:'flex',gap:6}}><Btn ghost onClick={()=>setComparA(comparA?null:clone(intent))}>{comparA?'Salir A/B':'Comparar A/B'}</Btn><Btn ghost onClick={guardar} disabled={guardando}>{guardando?'Guardando…':guardado?'✓ Guardado':'Guardar'}</Btn></div></div>
    <div className="coc-studio">
      <Card><Label>Diseño</Label><div style={{marginBottom:10}}><small>Tipología</small><select value={intent?.familia||FAMILIA.DESCONOCIDA} onChange={e=>setFamilia(e.target.value)} className="coc-input" style={{marginTop:4}}>{FAMILY_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>{intent?.tipologia_cocrear==='operativo_colaborativo'&&<div style={{marginBottom:10}}><small>Personas / puestos</small><input type="number" min="2" max="24" value={intent.capacidad_personas||6} onChange={e=>setCap(e.target.value)} className="coc-input" style={{marginTop:4}}/></div>}<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5,marginBottom:12}}>{[['ancho_mm','Ancho'],['prof_mm','Fondo'],['alto_mm','Alto']].map(([k,l])=><label key={k} style={{fontSize:10,color:'#aaa'}}>{l}<input type="number" value={dims[k]||0} onChange={e=>setDim(k,e.target.value)} className="coc-input" style={{marginTop:3,padding:6}}/></label>)}</div><Label>Material</Label><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>{MATERIALES_EDIT.map(m=><button key={m} onClick={()=>setMaterial(m)} style={{padding:'7px 3px',borderRadius:7,border:mat===m?'2px solid #d33b30':'1px solid #414141',background:'#22201f',color:'#fff',fontSize:10}}>{MAT_LABEL[m]||m}</button>)}</div><Label>Tono</Label><div style={{display:'flex',gap:4}}>{[['claro','Claro'],[null,'Natural'],['oscuro','Oscuro']].map(([v,l])=><button key={l} onClick={()=>setTone(v)} style={{flex:1,padding:6,borderRadius:7,border:tone===v?'2px solid #d33b30':'1px solid #414141',background:'#22201f',color:'#fff',fontSize:10}}>{l}</button>)}</div><Label>Funciones</Label><div className="coc-features">{FEATURES_COCREAR.map(([k,l])=><button key={k} onClick={()=>toggleFeature(k)} style={{padding:'5px 7px',borderRadius:999,border:feats.has(k)?'1px solid #d33b30':'1px solid #414141',background:feats.has(k)?'#3b211f':'transparent',color:'#fff',fontSize:10}}>{feats.has(k)?'✓ ':'+ '}{l}</button>)}</div></Card>

      <div>{comparA?<Card><Label>Comparación conceptual</Label><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><CocrearVisual spec={construirProductSpec(comparA,extraerDNA(comparA),clasificarProducto(comparA,{}),{rev:'A'})} intent={comparA}/><CocrearVisual spec={spec} intent={intent}/></div></Card>:<Card style={{padding:8}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 6px 9px'}}><div><Label>Render IA · vista principal</Label><strong style={{fontSize:14}}>Así se vería el concepto</strong></div><Btn onClick={generar} disabled={renderCargando}>{renderCargando?'Generando…':render?'Regenerar':'Generar render'}</Btn></div><div className="coc-hero">{renderCargando?<div className="coc-placeholder"><div style={{fontSize:28,marginBottom:10}}>✦</div><strong>VONI está construyendo la visualización</strong><p className="coc-small">Manteniendo capacidad, funciones, materiales y concepto seleccionado.</p></div>:render?<div style={{width:'100%'}}>{rStale&&<div style={{padding:8,background:'#4a2d16',color:'#ffd09c',fontSize:11}}>El diseño cambió: este render quedó obsoleto. Regenera antes de presentarlo.</div>}<img src={render.dataUrl} alt="Render realista de la co-creación" style={{opacity:rStale ? .62 : 1}}/></div>:<div className="coc-placeholder"><strong>No hay render todavía</strong><p className="coc-small">Genera una visualización fotorrealista basada en el concepto completo. El esquema técnico de abajo no se presenta como render.</p><Btn onClick={generar}>Generar visualización IA</Btn></div>}</div>{renderError&&<p style={{color:'#ff9d93',fontSize:11,padding:'0 8px'}}>{renderError}</p>}</Card>}
        {!comparA&&<div style={{marginTop:9}}><CocrearVisual spec={spec} intent={intent}/></div>}<div className="coc-history">{historia.map(h=><button key={h.rev} onClick={()=>{setIntent(clone(h.intent));setMensaje(`Viendo Rev ${h.rev}: ${h.label}`)}}>R{h.rev} · {h.label}</button>)}</div></div>

      <Card className="coc-right" style={{fontSize:12}}><Label>VONI · Co-diseñador</Label><p style={{color:'#aaa',lineHeight:1.4}}>Pídele criterio de diseño, ergonomía o fabricación. VONI propone; cada cambio queda trazable.</p><textarea value={nl} onChange={e=>setNl(e.target.value)} rows={3} placeholder="Ej. Haz la jardinera más protagonista y oculta totalmente el cableado." className="coc-input"/><Btn onClick={pedirVoni} disabled={!nl.trim()||pensando} style={{width:'100%',marginTop:7}}>{pensando?'Analizando…':'Pedir a VONI'}</Btn>{mensaje&&<p style={{lineHeight:1.4,color:'#ddd',fontSize:11}}>{mensaje}</p>}<hr style={{borderColor:'#303236',margin:'14px 0'}}/><Label>Verdad industrial</Label><div style={{display:'grid',gap:5}}><div>Estado costo: <b>{pipeline?.costo?.cost_status||'UNKNOWN'}</b></div><div>Costo calculado: <b>{costoConocido?money(costoOficial):'No certificado'}</b></div><div>Componentes BOM: <b>{spec?.componentes?.length||0}</b></div></div>{!costoConocido&&<p style={{color:'#d6a36d',fontSize:10,lineHeight:1.4}}>El concepto puede visualizarse sin inventar dinero. Para cotizar necesita BOM y economía válidos.</p>}<Btn onClick={agregarCotizacion} disabled={!listaParaCotizar||!onAgregar} style={{width:'100%',marginTop:6}}>{cotizadoHash===spec?.hash?'✓ En cotización':'Convertir en partida'}</Btn></Card>
    </div>
  </div>;
}
