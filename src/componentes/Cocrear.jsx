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

const MAT_LABEL = { nogal:'Nogal', roble:'Roble', encino:'Encino', maple:'Maple', laminado:'Laminado', solid_surface:'Solid surface', cristal:'Cristal', metal:'Metal', piedra:'Piedra' };
const FAMILY_OPTIONS = [
  [FAMILIA.DESCONOCIDA,'Producto libre'], [FAMILIA.ESCRITORIO,'Operativo / escritorio'], [FAMILIA.MESA,'Mesa'],
  [FAMILIA.RECEPCION,'Recepción'], [FAMILIA.LOCKER,'Locker'], [FAMILIA.DISPLAY,'Exhibidor'], [FAMILIA.GUARDADO,'Guardado'],
];
const EJEMPLOS = [
  'Operativo 6 lugares, con una jardinera intermedia de acero para plantas, electrificación oculta y look premium.',
  'Una recepción escultórica para lobby corporativo, curva, cálida, con iluminación y guardado oculto.',
  'Una mesa de consejo para 14 personas con electrificación, cableado invisible y presencia ejecutiva.',
  'Una cabina acústica doble para videollamadas, con cristal, ventilación, luz y mesa integrada.',
  'Un módulo café corporativo premium con exhibición, barra, almacenamiento y luz integrada.',
];
const clone = (x) => JSON.parse(JSON.stringify(x));
const money = (n) => Number.isFinite(Number(n)) ? '$'+Number(n).toLocaleString('es-MX',{maximumFractionDigits:2}) : '—';

function pickCouncilText(r){
  if(!r) return '';
  const candidates=[r.humano,r.summary,r.resumen,r.recommendation,r.recomendacion,r.consensus,r.synthesis?.recommendation,r.synthesis?.summary,r.response?.humano,r.response?.text];
  const v=candidates.find((x)=>typeof x==='string'&&x.trim());
  if(v) return v.trim();
  if(Array.isArray(r.proposals)&&r.proposals.length) return r.proposals.map((p)=>p.title||p.name||p.text).filter(Boolean).join(' · ');
  return '';
}

function Card({children,style={}}){return <div style={{background:'#171717',border:'1px solid #343434',borderRadius:18,padding:18,...style}}>{children}</div>}
function Label({children}){return <div style={{fontSize:11,letterSpacing:1.2,textTransform:'uppercase',color:'#8f98a8',fontWeight:800,marginBottom:8}}>{children}</div>}
function Btn({children,onClick,disabled=false,ghost=false,style={}}){return <button type="button" disabled={disabled} onClick={onClick} style={{borderRadius:12,padding:'11px 15px',fontWeight:800,border:ghost?'1px solid #555':'1px solid #d13b30',background:ghost?'transparent':(disabled?'#37211f':'#c93429'),color:disabled?'#776b69':'#fff',cursor:disabled?'not-allowed':'pointer',...style}}>{children}</button>}

export default function Cocrear({ estado, soloVentas=false, onIr, onAgregar }){
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
  const rev=historia.length || 1;
  const bom=(intent&&intent._componentes)||[];
  const spec=useMemo(()=>intent?construirProductSpec(intent,extraerDNA(intent),clasificarProducto(intent,{}),{rev,componentes:bom}):null,[intent,rev,bom]);
  const pipeline=useMemo(()=>intent?cocrearDesdeIntent(intent,{insumos,par,rev,componentes:bom}):null,[intent,insumos,par,rev,bom]);
  const resumen=useMemo(()=>intent?resumenIdeaCocrear(intent,texto):null,[intent,texto]);
  const rStale=!!(render&&spec&&renderStale(render,spec));

  useEffect(()=>{
    if(fase!=='inicio') return;
    let vivo=true;
    listarCocreaciones(12).then((r)=>{if(vivo&&r?.ok)setGuardadas(r.items||[])}).catch(()=>{});
    return()=>{vivo=false};
  },[fase]);

  const reset=()=>{setFase('inicio');setIntent(null);setHistoria([]);setConceptos([]);setAnalisis(null);setAiError('');setRender(null);setMensaje('');setExpedienteId(null);setComparA(null);};
  const commit=(next,label)=>{setIntent(next);setHistoria((h)=>[...h,{rev:h.length+1,intent:clone(next),label}]);setGuardado(false);};

  const analizarIdea=async()=>{
    const brief=texto.trim(); if(!brief||pensando)return;
    setPensando(true);setAiError('');setMensaje('');
    const base=prepararIntentCocrear(brief);
    setIntent(base);
    try{
      const ctx=resumenIdeaCocrear(base,brief);
      const r=await voniCouncil({
        task:'cocrear_concepto_producto', request:brief,
        context:{...ctx, intent:base},
        constraints:['No inventar costos ni materiales certificados','Priorizar fabricabilidad Von Haucke','Conservar la intención completa del cliente','Proponer alternativas realmente distintas'],
        lenses:['diseño de producto','ingeniería/fabricación','experiencia de usuario','comercial'],
      });
      if(r?.ok===false) throw new Error(r.error||'VONI Council no respondió');
      setAnalisis(r||{});
    }catch(e){setAiError(String(e?.message||e));}
    setConceptos(conceptosCocrear(base));
    setFase('conceptos');setPensando(false);
  };

  const elegirConcepto=(c)=>{
    const next=aplicarConceptoCocrear(intent,c);
    setIntent(next);setHistoria([{rev:1,intent:clone(next),label:`Concepto ${c.id}: ${c.nombre}`}]);
    setFase('studio');setRender(null);setComparA(null);
  };

  const desdeCero=()=>{
    const base=prepararIntentCocrear('producto especial modular');
    base.familia=FAMILIA.DESCONOCIDA;base._brief='Producto especial desde cero';
    base.dimensiones={...DIMS_DEFAULT[FAMILIA.DESCONOCIDA]};
    setTexto('Producto especial desde cero');setIntent(base);setHistoria([{rev:1,intent:clone(base),label:'Base libre'}]);setFase('studio');
  };

  const setDim=(key,val)=>commit({...intent,dimensiones:{...(intent.dimensiones||{}),[key]:Number(val)}},`${key}: ${val} mm`);
  const setFamilia=(fam)=>{
    const dd=DIMS_DEFAULT[fam]||DIMS_DEFAULT[FAMILIA.DESCONOCIDA];
    commit({...intent,familia:fam,dimensiones:{...dd,...(intent.dimensiones||{})}},`Tipología: ${FAMILY_OPTIONS.find(([x])=>x===fam)?.[1]||fam}`);
  };
  const setCap=(n)=>{
    let next={...intent,capacidad_personas:Number(n),capacidad:{...(intent.capacidad||{}),personas:Number(n)}};
    if(next.tipologia_cocrear==='operativo_colaborativo') next=prepararIntentCocrear(`${next._brief||texto} ${n} lugares`,next);
    commit(next,`Capacidad: ${n}`);
  };
  const setMaterial=(m)=>commit({...intent,materiales:[{material:m,tono:intent.materiales?.[0]?.tono||null},...(intent.materiales||[]).slice(1)]},`Material: ${MAT_LABEL[m]||m}`);
  const setTone=(tono)=>commit({...intent,materiales:[{material:intent.materiales?.[0]?.material||'laminado',tono},...(intent.materiales||[]).slice(1)]},`Tono: ${tono||'natural'}`);
  const toggleFeature=(f)=>{const s=new Set(intent.caracteristicas||[]);s.has(f)?s.delete(f):s.add(f);commit({...intent,caracteristicas:[...s]},`${s.has(f)?'Agregar':'Quitar'} ${FEATURES_COCREAR.find(([k])=>k===f)?.[1]||f}`)};

  const pedirVoni=async()=>{
    const frase=nl.trim(); if(!frase||pensando)return;
    setPensando(true);setMensaje('');
    try{
      const r=await voniCouncil({task:'cocrear_revision_producto',request:frase,context:{brief:texto,intent,spec,resumen},constraints:['No ejecutar cambios estructurales sin confirmación','No inventar costos'],lenses:['diseño','fabricación','uso']});
      setAnalisis(r||{});setMensaje(pickCouncilText(r)||'VONI analizó el cambio. Usa los controles para confirmar la revisión.');
      const next=prepararIntentCocrear(`${intent?._brief||texto}. Cambio solicitado: ${frase}`,intent);
      if(JSON.stringify(next)!==JSON.stringify(intent)) commit(next,frase);
      setNl('');
    }catch(e){setMensaje(`VONI no pudo responder: ${String(e?.message||e)}`)}
    setPensando(false);
  };

  const generar=async()=>{
    if(!spec)return;setRenderCargando(true);setRenderError('');
    try{
      const c=compileRenderPrompt(spec,spec.dna);
      const descripcion=`${c.descripcion}\nINTENCIÓN DE COCREACIÓN: ${intent?._brief||texto}. Concepto: ${intent?._concepto_nombre||'desarrollado con VONI'}.`;
      const r=await generarRender(descripcion,{render_spec:c.render_spec,materiales:c.materiales,medidas:c.medidas,tipo:c.tipo,modo:c.modo,aspecto:c.aspecto});
      if(r?.ok&&r.dataUrl)setRender({dataUrl:r.dataUrl,specHash:spec.hash,expected:c.expected,version:c.version});
      else throw new Error(r?.error||'No se pudo generar el render');
    }catch(e){setRenderError(String(e?.message||e))}setRenderCargando(false);
  };

  const guardar=async()=>{
    if(!intent)return;setGuardando(true);setMensaje('');
    try{
      const r=await guardarCocrearSeguro(expedienteId,cocrearPayload({brief:texto,intent,historia,render,insumos,par}));
      if(!r?.ok)throw new Error(r?.error||'No se pudo guardar');
      if(r.expediente_id)setExpedienteId(r.expediente_id);setGuardado(true);setMensaje('✓ Co-creación guardada con revisión e identidad trazable.');
    }catch(e){setMensaje(`No se pudo guardar en nube: ${String(e?.message||e)}`)}setGuardando(false);
  };

  const reabrir=async(id)=>{
    try{
      const r=await cargarCocrearSeguro(id);const est=r?.ok?cocrearDeExpediente({cocrear:r.cocrear}):null;
      if(!est?.intent)throw new Error('Expediente sin intención válida');
      setIntent(est.intent);setHistoria(est.historia?.length?est.historia:[{rev:1,label:'Reabierta',intent:est.intent}]);setTexto(est.brief||est.intent?._brief||'');setExpedienteId(id);setRender(null);setFase('studio');
    }catch(e){setMensaje(String(e?.message||e))}
  };

  const costoOficial=Number(pipeline?.costo?.official_cost);
  const costoConocido=Number.isFinite(costoOficial)&&costoOficial>0;
  const agregarCotizacion=async()=>{
    if(!costoConocido||!onAgregar){setMensaje('No se agrega: el costo oficial todavía no está certificado. Completa ingeniería/BOM primero.');return;}
    let id=expedienteId,prodId=null,versionId=null;
    try{
      if(!id){const s=await guardarCocrearSeguro(null,cocrearPayload({brief:texto,intent,historia,render,insumos,par}));if(s?.ok){id=s.expediente_id;setExpedienteId(id)}}
      if(id){const reg=await registrarProductoDesdeExpediente(id);if(reg?.ok){prodId=reg.producto_id;versionId=reg.version_id}}
      if(versionId&&render&&!rStale){try{const c=compileRenderPrompt(spec,spec.dna);const geometryHash=hashEstable({familia:spec.familia,dimensiones:spec.dimensiones||{},caracteristicas:spec.caracteristicas||[],componentes:spec.componentes||[]});await subirRenderCanonico({expedienteId:id,productoId:prodId,productoVersionId:versionId,dataUrl:render.dataUrl,promptVersion:render.version,modo:'render',specHash:spec.hash,geometryHash,inputs:c.expected||{}})}catch{/* optional */}}
    }catch{/* pricing truth remains local/server-derived */}
    const margen=Number.isFinite(par.margenObjetivo)?par.margenObjetivo:40;
    const pv=precioVenta(costoOficial,par).precio;
    onAgregar({nombre:intent?._concepto_nombre||resumen?.tipologia||'Producto co-creado',componentes:spec.componentes,w:spec.dimensiones?.ancho_mm||null,d:spec.dimensiones?.prof_mm||spec.dimensiones?.fondo_mm||null,productoId:prodId,productVersionId:versionId,precioReal:false,config:null},1,pv,margen);
    setCotizadoHash(spec.hash);setMensaje('✓ Revisión actual agregada a cotización.');
  };

  if(fase==='inicio') return <div className="contenido cocrear-wrap" style={{maxWidth:1450,margin:'0 auto'}}>
    <p style={{color:'#d33b30',letterSpacing:3,fontWeight:900}}>VON HAUCKE · COCREAR</p>
    <h1 style={{fontSize:'clamp(38px,5vw,70px)',margin:'10px 0'}}>¿Qué quieres inventar?</h1>
    <p style={{fontSize:20,color:'#b7b2af',maxWidth:950}}>No necesitas saber qué mueble es. Cuéntale a VONI el problema, uso o idea; la convierte en conceptos, la desarrollas y sólo después pasa a ingeniería, costeo y cotización.</p>
    <Card style={{marginTop:26}}>
      <textarea value={texto} onChange={(e)=>setTexto(e.target.value)} rows={4} placeholder="Ej. Necesito 6 lugares de trabajo enfrentados con una jardinera de acero al centro, cableado oculto y que se vea espectacular…" style={{width:'100%',boxSizing:'border-box',fontSize:20,padding:18,borderRadius:14,background:'#211e1d',color:'#fff',border:'1px solid #5a3330',resize:'vertical'}}/>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>{EJEMPLOS.map((e,i)=><button key={i} onClick={()=>setTexto(e)} style={{background:'#262220',color:'#eee',border:'1px solid #4a4440',borderRadius:999,padding:'8px 12px',cursor:'pointer'}}>{e.split(',')[0]}</button>)}</div>
      <div style={{display:'flex',gap:10,marginTop:18,flexWrap:'wrap'}}><Btn onClick={analizarIdea} disabled={!texto.trim()||pensando}>{pensando?'VONI + Council están diseñando…':'Analizar y crear conceptos con VONI →'}</Btn><Btn ghost onClick={desdeCero}>Explorar un producto desde cero</Btn></div>
    </Card>
    {guardadas.length>0&&<div style={{marginTop:26}}><Label>Mis co-creaciones guardadas</Label><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:10}}>{guardadas.map((x)=><button key={x.id} onClick={()=>reabrir(x.id)} style={{textAlign:'left',background:'#171717',border:'1px solid #333',borderRadius:14,padding:14,color:'#fff',cursor:'pointer'}}><strong>{x.nombre||'Co-creación'}</strong><div style={{fontSize:12,color:'#929292',marginTop:5}}>{x.producto_tipo||'Producto especial'} · reabrir</div></button>)}</div></div>}
  </div>;

  if(fase==='conceptos') return <div className="contenido" style={{maxWidth:1450,margin:'0 auto'}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div><Label>VONI · lectura de la idea</Label><h1 style={{margin:0}}>La idea completa, antes de convertirla en mueble</h1></div><Btn ghost onClick={reset}>‹ Nueva idea</Btn></div>
    <div style={{display:'grid',gridTemplateColumns:'minmax(280px,.8fr) minmax(500px,1.6fr)',gap:16,marginTop:18}}>
      <Card><Label>Lo que entendimos</Label><p style={{fontSize:17,lineHeight:1.5}}>{resumen?.necesidad}</p><div style={{display:'grid',gap:8,color:'#c7c7c7'}}><div><b>Tipología:</b> {resumen?.tipologia}</div><div><b>Capacidad:</b> {resumen?.capacidad}</div><div><b>Envolvente inicial:</b> {resumen?.envolvente}</div><div><b>Claves:</b> {resumen?.claves?.join(' · ')||'por definir'}</div></div><hr style={{borderColor:'#333',margin:'18px 0'}}/><Label>Análisis IA</Label>{aiError?<p style={{color:'#ffb4aa'}}>Council no disponible: {aiError}. El concepto base sigue siendo editable, sin fingir IA.</p>:<p style={{lineHeight:1.5,color:'#ddd'}}>{pickCouncilText(analisis)||'VONI Council procesó la idea; las alternativas de abajo preservan la intención y se validan después contra ingeniería.'}</p>}</Card>
      <div><Label>Tres caminos · elige uno para desarrollarlo</Label><div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:12}}>{conceptos.map((c)=><Card key={c.id} style={{display:'flex',flexDirection:'column',minHeight:260}}><div style={{color:'#d33b30',fontWeight:900,fontSize:28}}>{c.id}</div><h2 style={{margin:'8px 0'}}>{c.nombre}</h2><div style={{fontSize:12,color:'#999',textTransform:'uppercase',fontWeight:800}}>{c.subtitulo}</div><p style={{lineHeight:1.5,flex:1}}>{c.descripcion}</p><Btn onClick={()=>elegirConcepto(c)}>Desarrollar este concepto →</Btn></Card>)}</div></div>
    </div>
  </div>;

  const dims=intent?.dimensiones||{};const feats=new Set(intent?.caracteristicas||[]);const mat=intent?.materiales?.[0]?.material||'laminado';const tone=intent?.materiales?.[0]?.tono||null;
  return <div className="contenido" style={{maxWidth:1550,margin:'0 auto'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:14}}><div><button onClick={()=>setFase('inicio')} style={{background:'none',border:0,color:'#bbb',cursor:'pointer'}}>‹ Nueva idea</button><h2 style={{display:'inline',marginLeft:14}}>{intent?._concepto_nombre||resumen?.tipologia||'Producto co-creado'} <span style={{fontSize:12,color:'#aaa'}}>Rev {rev}</span></h2></div><div style={{display:'flex',gap:8}}><Btn ghost onClick={()=>setComparA(comparA?null:clone(intent))}>{comparA?'Cancelar A/B':'Guardar como A para comparar'}</Btn><Btn ghost onClick={guardar} disabled={guardando}>{guardando?'Guardando…':guardado?'✓ Guardado':'Guardar'}</Btn></div></div>

    <div style={{display:'grid',gridTemplateColumns:'330px minmax(520px,1fr) 340px',gap:14,alignItems:'start'}}>
      <Card><Label>Diseño · no sólo “ancho”</Label>
        <div style={{marginBottom:14}}><small>Tipología</small><select value={intent?.familia||FAMILIA.DESCONOCIDA} onChange={(e)=>setFamilia(e.target.value)} style={{width:'100%',marginTop:5,padding:9,borderRadius:8,background:'#24211f',color:'#fff',border:'1px solid #444'}}>{FAMILY_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
        {intent?.tipologia_cocrear==='operativo_colaborativo'&&<div style={{marginBottom:14}}><small>Personas / puestos</small><input type="number" min="2" max="24" value={intent.capacidad_personas||6} onChange={(e)=>setCap(e.target.value)} style={{width:'100%',boxSizing:'border-box',marginTop:5,padding:9,borderRadius:8,background:'#24211f',color:'#fff',border:'1px solid #444'}}/></div>}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:16}}>{[['ancho_mm','Ancho'],['prof_mm','Fondo'],['alto_mm','Alto']].map(([k,l])=><label key={k} style={{fontSize:11,color:'#aaa'}}>{l}<input type="number" value={dims[k]||0} onChange={(e)=>setDim(k,e.target.value)} style={{width:'100%',boxSizing:'border-box',marginTop:4,padding:8,borderRadius:7,background:'#24211f',color:'#fff',border:'1px solid #444'}}/><span>mm</span></label>)}</div>
        <Label>Material principal</Label><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>{MATERIALES_EDIT.map((m)=><button key={m} onClick={()=>setMaterial(m)} style={{padding:'9px 5px',borderRadius:9,border:mat===m?'2px solid #d33b30':'1px solid #444',background:'#24211f',color:'#fff',fontSize:11}}>{MAT_LABEL[m]||m}</button>)}</div>
        <Label>Tono</Label><div style={{display:'flex',gap:5}}>{[['claro','Claro'],[null,'Natural'],['oscuro','Oscuro']].map(([v,l])=><button key={l} onClick={()=>setTone(v)} style={{flex:1,padding:8,borderRadius:8,border:(tone===v)?'2px solid #d33b30':'1px solid #444',background:'#24211f',color:'#fff'}}>{l}</button>)}</div>
        <Label>Funciones</Label><div style={{display:'flex',flexWrap:'wrap',gap:6}}>{FEATURES_COCREAR.map(([k,l])=><button key={k} onClick={()=>toggleFeature(k)} style={{padding:'7px 9px',borderRadius:999,border:feats.has(k)?'1px solid #d33b30':'1px solid #444',background:feats.has(k)?'#3b211f':'transparent',color:'#fff',fontSize:11}}>{feats.has(k)?'✓ ':'+ '}{l}</button>)}</div>
      </Card>

      <div>
        <Card style={{padding:8,minHeight:430}}>{comparA?<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><div><Label>A · guardado</Label><CocrearVisual spec={construirProductSpec(comparA,extraerDNA(comparA),clasificarProducto(comparA,{}),{rev:'A'})} intent={comparA}/></div><div><Label>B · actual</Label><CocrearVisual spec={spec} intent={intent}/></div></div>:<CocrearVisual spec={spec} intent={intent}/>}</Card>
        <Card style={{marginTop:12}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}><div><Label>Momento WOW</Label><strong>Render realista del concepto actual</strong></div><Btn onClick={generar} disabled={renderCargando}>{renderCargando?'Generando…':render?'Regenerar render':'Generar render IA'}</Btn></div>{renderError&&<p style={{color:'#ff9d93'}}>{renderError}</p>}{render&&<div style={{marginTop:12}}>{rStale&&<div style={{padding:9,background:'#4a2d16',borderRadius:8,color:'#ffd09c'}}>El diseño cambió. Este render quedó STALE; regenéralo.</div>}<img src={render.dataUrl} alt="Render de la co-creación" style={{width:'100%',marginTop:8,borderRadius:12,opacity:rStale ? .65 : 1}}/><small style={{color:'#aaa'}}>Render conceptual pendiente de verificación visual de fidelidad. No sustituye ingeniería.</small></div>}</Card>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:10}}>{historia.map((h)=><button key={h.rev} onClick={()=>{setIntent(clone(h.intent));setMensaje(`Viendo Rev ${h.rev}: ${h.label}`)}} style={{background:'#222',color:'#ddd',border:'1px solid #444',borderRadius:999,padding:'6px 9px'}}>R{h.rev} · {h.label}</button>)}</div>
      </div>

      <Card><Label>VONI · Co-diseñador</Label><p style={{fontSize:13,color:'#bbb'}}>Pídele criterio de diseño, uso o fabricación. VONI analiza; los cambios quedan como revisiones, no magia escondida.</p><textarea value={nl} onChange={(e)=>setNl(e.target.value)} rows={4} placeholder='Ej. “Haz la jardinera más protagonista, oculta los cables y dame una alternativa más premium.”' style={{width:'100%',boxSizing:'border-box',padding:10,borderRadius:10,background:'#24211f',color:'#fff',border:'1px solid #444'}}/><Btn onClick={pedirVoni} disabled={!nl.trim()||pensando} style={{width:'100%',marginTop:8}}>{pensando?'VONI + Council pensando…':'Pedir a VONI'}</Btn>{mensaje&&<p style={{lineHeight:1.45,color:'#ddd'}}>{mensaje}</p>}
        <hr style={{borderColor:'#333',margin:'18px 0'}}/><Label>Verdad industrial</Label><div style={{display:'grid',gap:7,fontSize:13}}><div>Estado costo: <b>{pipeline?.costo?.cost_status||'UNKNOWN'}</b></div><div>Costo oficial: <b>{costoConocido?money(costoOficial):'No certificado'}</b></div><div>Componentes BOM: <b>{spec?.componentes?.length||0}</b></div></div>{!costoConocido&&<p style={{fontSize:12,color:'#e4ad6d'}}>No inventamos $0. El concepto puede diseñarse/renderizarse, pero no se cotiza como costo conocido hasta tener BOM/economía válida.</p>}<Btn onClick={agregarCotizacion} disabled={!costoConocido||!onAgregar} style={{width:'100%',marginTop:8}}>{cotizadoHash===spec?.hash?'✓ Revisión en cotización':'Convertir esta revisión en partida'}</Btn>
      </Card>
    </div>
  </div>;
}
