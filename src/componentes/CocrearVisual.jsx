import React, { useMemo } from 'react';
import { colorMaterial, DIMS_DEFAULT, FAMILIA } from '../datos/cocrear.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

function OperativoPlano({intent,color}){
  const cap=clamp(Number(intent?.capacidad_personas)||6,2,24);
  const cols=Math.ceil(cap/2);
  const x0=80, yA=86, yB=150, deskW=Math.min(72,420/Math.max(cols,1));
  const features=new Set(intent?.caracteristicas||[]);
  const nodes=[];
  for(let i=0;i<cols;i++){
    const x=x0+i*deskW;
    if(i*2<cap) nodes.push(<g key={`a${i}`}><rect x={x} y={yA} width={deskW-6} height="42" rx="5" fill={color} stroke="#50545a"/><circle cx={x+(deskW-6)/2} cy={yA-12} r="8" fill="#6d7278"/></g>);
    if(i*2+1<cap) nodes.push(<g key={`b${i}`}><rect x={x} y={yB} width={deskW-6} height="42" rx="5" fill={color} stroke="#50545a"/><circle cx={x+(deskW-6)/2} cy={yB+54} r="8" fill="#6d7278"/></g>);
  }
  if(features.has('jardinera_integrada')) nodes.push(<g key="planter"><rect x="92" y="132" width="348" height="14" rx="7" fill="#555b60"/><g fill="#6f8f73">{[120,165,210,255,300,345,390,425].map((x,i)=><circle key={i} cx={x} cy="139" r={i%2?5:7}/>)}</g></g>);
  if(features.has('electrificacion_integrada')) nodes.push(<g key="power"><line x1="112" y1="139" x2="420" y2="139" stroke="#171717" strokeWidth="3" strokeDasharray="8 7"/><text x="354" y="128" fill="#8f98a8" fontSize="9">canal técnico oculto</text></g>);
  if(features.has('divisores')||features.has('acustica')) nodes.push(<g key="div"><line x1="266" y1="78" x2="266" y2="200" stroke="#9aa5b1" strokeWidth="4" opacity=".8"/><text x="274" y="94" fill="#8f98a8" fontSize="9">divisor</text></g>);
  return <g>{nodes}</g>;
}

function ProductoGenerico({intent,spec,color}){
  const fam=spec?.familia||intent?.familia||FAMILIA.DESCONOCIDA;
  if(fam===FAMILIA.RECEPCION) return <g><path d="M105 175 Q105 105 185 92 H392 V176 H318 V132 H188 Q156 132 156 175Z" fill={color} stroke="#50545a" strokeWidth="2"/></g>;
  if(fam===FAMILIA.LOCKER) return <g><rect x="160" y="54" width="220" height="150" rx="8" fill={color} stroke="#50545a"/>{[0,1,2,3].map(c=>[0,1,2].map(r=><rect key={`${c}-${r}`} x={170+c*50} y={64+r*44} width="42" height="36" rx="3" fill="none" stroke="#686d72"/>))}</g>;
  if(fam===FAMILIA.MESA) return <g><rect x="112" y="104" width="320" height="82" rx="38" fill={color} stroke="#50545a"/><rect x="145" y="137" width="254" height="16" rx="8" fill="#24272b" opacity=".7"/></g>;
  if(fam===FAMILIA.DISPLAY) return <g><rect x="170" y="58" width="210" height="148" rx="6" fill={color} stroke="#50545a"/>{[98,135,172].map(y=><line key={y} x1="184" y1={y} x2="366" y2={y} stroke="#5b6065" strokeWidth="3"/>)}</g>;
  if(fam===FAMILIA.GUARDADO) return <g><rect x="135" y="112" width="280" height="92" rx="6" fill={color} stroke="#50545a"/><line x1="275" y1="118" x2="275" y2="198" stroke="#5b6065"/><line x1="141" y1="157" x2="409" y2="157" stroke="#5b6065"/></g>;
  return <g><rect x="110" y="112" width="330" height="70" rx="8" fill={color} stroke="#50545a"/><rect x="140" y="181" width="18" height="32" rx="3" fill="#5e6469"/><rect x="392" y="181" width="18" height="32" rx="3" fill="#5e6469"/></g>;
}

export default function CocrearVisual({spec,intent}){
  const m=(intent?.materiales||spec?.materiales||[])[0]||{material:'laminado',tono:null};
  const color=useMemo(()=>colorMaterial(m.material,m.tono),[m.material,m.tono]);
  const d=intent?.dimensiones||spec?.dimensiones||DIMS_DEFAULT[FAMILIA.DESCONOCIDA];
  const operativo=intent?.tipologia_cocrear==='operativo_colaborativo';
  return <div style={{width:'100%',background:'#111315',border:'1px solid #2b2e32',borderRadius:12,overflow:'hidden'}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,padding:'10px 12px',borderBottom:'1px solid #272a2d',alignItems:'center'}}>
      <div><strong style={{fontSize:12,color:'#eef0f2'}}>Modelo conceptual</strong><div style={{fontSize:10,color:'#858d96',marginTop:2}}>Esquema paramétrico · NO es el render final</div></div>
      <div style={{fontFamily:'monospace',fontSize:10,color:'#8f98a8'}}>{d?.ancho_mm?`${Math.round(d.ancho_mm)} × ${Math.round(d.prof_mm||d.fondo_mm||0)} × ${Math.round(d.alto_mm||0)} mm`:'medidas por desarrollar'}</div>
    </div>
    <svg viewBox="0 0 540 235" role="img" aria-label="Modelo conceptual técnico del producto" style={{display:'block',width:'100%',height:'auto'}}>
      <defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e2226" strokeWidth="1"/></pattern></defs>
      <rect width="540" height="235" fill="#0f1113"/><rect width="540" height="235" fill="url(#grid)"/>
      {operativo?<OperativoPlano intent={intent} color={color}/>:<ProductoGenerico intent={intent} spec={spec} color={color}/>} 
      <line x1="70" y1="218" x2="470" y2="218" stroke="#4b5055"/><line x1="70" y1="213" x2="70" y2="223" stroke="#4b5055"/><line x1="470" y1="213" x2="470" y2="223" stroke="#4b5055"/>
      <text x="270" y="230" textAnchor="middle" fill="#77808a" fontSize="10">envolvente conceptual · validar ingeniería antes de fabricar</text>
    </svg>
  </div>;
}
