import React, { useMemo } from 'react';
import { colorMaterial, DIMS_DEFAULT, FAMILIA } from '../datos/cocrear.js';
import { LAYOUT_COCREAR } from '../datos/cocrearWow.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const has=(intent,k)=>(intent?.caracteristicas||[]).includes(k);

function Planta({x,y,w=42,h=14}){
  return <g><rect x={x} y={y} width={w} height={h} rx="6" fill="#59635f"/>{[0,1,2,3].map(i=><circle key={i} cx={x+7+i*(w-14)/3} cy={y+4-(i%2)*3} r={4+(i%2)} fill="#75977a"/>)}</g>;
}
function Silla({x,y}){return <circle cx={x} cy={y} r="7" fill="#6d7278"/>}
function Desk({x,y,w,h,color}){return <rect x={x} y={y} width={w} height={h} rx="5" fill={color} stroke="#555c62" strokeWidth="1.2"/>}

function IslaContinua({intent,color}){
  const cap=clamp(Number(intent?.capacidad_personas)||6,2,24),cols=Math.ceil(cap/2);
  const x=62,w=416,y1=76,y2=151;
  const seats=[];
  for(let i=0;i<cols;i++){
    const px=x+(i+.5)*(w/cols);
    if(i*2<cap) seats.push(<Silla key={`t${i}`} x={px} y={57}/>);
    if(i*2+1<cap) seats.push(<Silla key={`b${i}`} x={px} y={213}/>);
  }
  return <g>
    <Desk x={x} y={y1} w={w} h={50} color={color}/><Desk x={x} y={y2} w={w} h={50} color={color}/>
    <rect x="78" y="129" width="384" height="18" rx="9" fill="#4f565b"/>
    {has(intent,'jardinera_integrada')&&<Planta x={130} y={131} w={280} h={14}/>} 
    {has(intent,'electrificacion_integrada')&&<line x1="92" y1="140" x2="448" y2="140" stroke="#141719" strokeWidth="3" strokeDasharray="9 7"/>}
    {seats}<text x="270" y="28" textAnchor="middle" fill="#9199a3" fontSize="10">A · ISLA CONTINUA · SUPERFICIE VISUAL ÚNICA</text>
  </g>;
}

function ModulosDobles({intent,color}){
  const cap=clamp(Number(intent?.capacidad_personas)||6,2,24),pairs=Math.ceil(cap/2);
  const maxCols=Math.min(6,pairs),start=270-(maxCols*65)/2;
  const nodes=[];
  for(let i=0;i<maxCols;i++){
    const x=start+i*65;
    if(i*2<cap){nodes.push(<Desk key={`a${i}`} x={x} y={76} w={56} h={46} color={color}/>);nodes.push(<Silla key={`sa${i}`} x={x+28} y={58}/>)}
    if(i*2+1<cap){nodes.push(<Desk key={`b${i}`} x={x} y={158} w={56} h={46} color={color}/>);nodes.push(<Silla key={`sb${i}`} x={x+28} y={221}/>)}
  }
  return <g>{nodes}
    <rect x="86" y="129" width="368" height="18" rx="9" fill="#52595f"/>
    {has(intent,'jardinera_integrada')&&<Planta x={150} y={131} w={240} h={14}/>} 
    {has(intent,'electrificacion_integrada')&&<line x1="105" y1="140" x2="435" y2="140" stroke="#141719" strokeWidth="3" strokeDasharray="8 7"/>}
    {(has(intent,'divisores')||has(intent,'acustica'))&&[1,2,3].map(i=><line key={i} x1={start+i*65-5} y1="72" x2={start+i*65-5} y2="207" stroke="#a4adb5" strokeWidth="3" opacity=".75"/>)}
    <text x="270" y="28" textAnchor="middle" fill="#9199a3" fontSize="10">B · MÓDULOS DOBLES · UNIDADES INDEPENDIENTES + ESPINA TÉCNICA</text>
  </g>;
}

function HubEscultorico({intent,color}){
  const cap=clamp(Number(intent?.capacidad_personas)||8,4,16),cx=270,cy=137,rx=128,ry=82;
  const nodes=[];
  for(let i=0;i<cap;i++){
    const a=(Math.PI*2*i/cap)-Math.PI/2;
    const x=cx+Math.cos(a)*rx,y=cy+Math.sin(a)*ry;
    const deg=a*180/Math.PI+90;
    nodes.push(<g key={i} transform={`translate(${x} ${y}) rotate(${deg})`}><rect x="-28" y="-21" width="56" height="42" rx="7" fill={color} stroke="#555c62"/><circle cx="0" cy="-35" r="7" fill="#6d7278"/></g>);
  }
  return <g>{nodes}
    <polygon points="270,90 309,112 309,160 270,183 231,160 231,112" fill="#4e555b" stroke="#707980" strokeWidth="2"/>
    {has(intent,'jardinera_integrada')&&<g><circle cx="270" cy="137" r="31" fill="#607066"/><Planta x={242} y={132} w={56} h={17}/></g>}
    {has(intent,'electrificacion_integrada')&&<circle cx="270" cy="137" r="49" fill="none" stroke="#171a1d" strokeWidth="4" strokeDasharray="8 6"/>}
    <text x="270" y="28" textAnchor="middle" fill="#9199a3" fontSize="10">C · HUB ESCULTÓRICO · NÚCLEO CENTRAL + PUESTOS RADIALES</text>
  </g>;
}

function OperativoPlano({intent,color}){
  const layout=intent?._concepto_layout || (intent?.caracteristicas||[]).find(x=>Object.values(LAYOUT_COCREAR).includes(x));
  if(layout===LAYOUT_COCREAR.C) return <HubEscultorico intent={intent} color={color}/>;
  if(layout===LAYOUT_COCREAR.B) return <ModulosDobles intent={intent} color={color}/>;
  return <IslaContinua intent={intent} color={color}/>;
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
      <div><strong style={{fontSize:12,color:'#eef0f2'}}>Modelo técnico del concepto {intent?._concepto?`· ${intent._concepto}`:''}</strong><div style={{fontSize:10,color:'#858d96',marginTop:2}}>Deriva del mismo concepto que el render · NO sustituye ingeniería</div></div>
      <div style={{fontFamily:'monospace',fontSize:10,color:'#8f98a8'}}>{d?.ancho_mm?`${Math.round(d.ancho_mm)} × ${Math.round(d.prof_mm||d.fondo_mm||0)} × ${Math.round(d.alto_mm||0)} mm`:'medidas por desarrollar'}</div>
    </div>
    <svg viewBox="0 0 540 245" role="img" aria-label={`Modelo técnico del concepto ${intent?._concepto||''}`} style={{display:'block',width:'100%',height:'auto'}}>
      <defs><pattern id="grid-cocrear" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e2226" strokeWidth="1"/></pattern></defs>
      <rect width="540" height="245" fill="#0f1113"/><rect width="540" height="245" fill="url(#grid-cocrear)"/>
      {operativo?<OperativoPlano intent={intent} color={color}/>:<ProductoGenerico intent={intent} spec={spec} color={color}/>} 
      <line x1="70" y1="232" x2="470" y2="232" stroke="#4b5055"/><line x1="70" y1="227" x2="70" y2="237" stroke="#4b5055"/><line x1="470" y1="227" x2="470" y2="237" stroke="#4b5055"/>
      <text x="270" y="242" textAnchor="middle" fill="#77808a" fontSize="9">envolvente conceptual · validar ingeniería antes de fabricar</text>
    </svg>
  </div>;
}
