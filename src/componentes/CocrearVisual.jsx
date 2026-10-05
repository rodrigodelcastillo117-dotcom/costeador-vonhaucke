import React, { useMemo } from 'react';
import { colorMaterial, DIMS_DEFAULT, FAMILIA } from '../datos/cocrear.js';

const clamp = (n,a,b) => Math.max(a, Math.min(b,n));
const shade = (hex, p=0.18) => {
  const n = parseInt(String(hex || '#888888').replace('#',''), 16);
  const c = (v) => Math.round(v*(1-p)).toString(16).padStart(2,'0');
  return `#${c((n>>16)&255)}${c((n>>8)&255)}${c(n&255)}`;
};

function IsoBox({x,y,w,d,h,fill='#c6c6c6', stroke='#555', opacity=1}) {
  const dx=d*.48, dy=d*.25;
  const top=`${x},${y-h} ${x+w},${y-h} ${x+w+dx},${y-h-dy} ${x+dx},${y-h-dy}`;
  const front=`${x},${y-h} ${x+w},${y-h} ${x+w},${y} ${x},${y}`;
  const side=`${x+w},${y-h} ${x+w+dx},${y-h-dy} ${x+w+dx},${y-dy} ${x+w},${y}`;
  return <g opacity={opacity}>
    <polygon points={front} fill={fill} stroke={stroke}/>
    <polygon points={side} fill={shade(fill,.28)} stroke={stroke}/>
    <polygon points={top} fill={shade(fill,.05)} stroke={stroke}/>
  </g>;
}

function Plant({x,y,s=1}) {
  return <g>
    <path d={`M${x} ${y} C${x-8*s} ${y-20*s},${x-23*s} ${y-20*s},${x-18*s} ${y-35*s}`} fill="none" stroke="#66846b" strokeWidth={3*s}/>
    <path d={`M${x} ${y} C${x+9*s} ${y-18*s},${x+22*s} ${y-18*s},${x+18*s} ${y-34*s}`} fill="none" stroke="#66846b" strokeWidth={3*s}/>
    <ellipse cx={x-18*s} cy={y-36*s} rx={9*s} ry={5*s} fill="#7d9a80"/>
    <ellipse cx={x+18*s} cy={y-35*s} rx={9*s} ry={5*s} fill="#7d9a80"/>
  </g>;
}

function Operativo({intent, color}) {
  const cap=clamp(Number(intent?.capacidad_personas)||6,2,16);
  const lado=Math.ceil(cap/2);
  const deskW=54, gap=4, total=lado*deskW + (lado-1)*gap;
  const x=230-total/2, y=275;
  const nodes=[];
  for(let i=0;i<lado;i++){
    const xx=x+i*(deskW+gap);
    nodes.push(<IsoBox key={`a${i}`} x={xx} y={y} w={deskW} d={55} h={10} fill={color}/>);
    nodes.push(<IsoBox key={`b${i}`} x={xx+28} y={y-49} w={deskW} d={55} h={10} fill={color}/>);
    nodes.push(<rect key={`sa${i}`} x={xx+14} y={y+8} width="24" height="7" rx="3" fill="#6d7278"/>);
    nodes.push(<rect key={`sb${i}`} x={xx+44} y={y-63} width="24" height="7" rx="3" fill="#6d7278"/>);
  }
  const features=intent?.caracteristicas||[];
  if(features.includes('jardinera_integrada')){
    nodes.push(<IsoBox key="planter" x={205} y={242} w={52} d={42} h={30} fill="#666b70"/>);
    nodes.push(<Plant key="p1" x={225} y={210} s={.9}/>);
    nodes.push(<Plant key="p2" x={250} y={202} s={.75}/>);
  }
  if(features.includes('electrificacion_integrada')) nodes.push(<rect key="power" x="197" y="252" width="72" height="5" rx="2" fill="#222"/>);
  if(features.includes('divisores')) nodes.push(<rect key="div" x="210" y="205" width="46" height="34" rx="3" fill="#aeb8c4" opacity=".72"/>);
  return <g>{nodes}</g>;
}

function GenericProduct({spec,intent,color}){
  const fam=spec?.familia||intent?.familia||FAMILIA.DESCONOCIDA;
  if(fam===FAMILIA.RECEPCION) return <g><IsoBox x={105} y={290} w={230} d={75} h={95} fill={color}/><IsoBox x={125} y={194} w={210} d={48} h={14} fill="#d8d2c6"/></g>;
  if(fam===FAMILIA.LOCKER) return <g><IsoBox x={140} y={302} w={180} d={45} h={205} fill={color}/>{[0,1,2].flatMap(r=>[0,1,2].map(c=><rect key={`${r}-${c}`} x={147+c*57} y={105+r*61} width="50" height="54" fill="none" stroke="#555"/>))}</g>;
  if(fam===FAMILIA.DISPLAY) return <g><IsoBox x={155} y={300} w={155} d={55} h={180} fill={color}/>{[0,1,2].map(i=><line key={i} x1="160" y1={165+i*45} x2="307" y2={165+i*45} stroke="#444" strokeWidth="4"/>)}</g>;
  if(fam===FAMILIA.GUARDADO) return <g><IsoBox x={135} y={300} w={190} d={65} h={105} fill={color}/><line x1="140" y1="238" x2="323" y2="238" stroke="#555"/><line x1="230" y1="200" x2="230" y2="297" stroke="#555"/></g>;
  return <g><IsoBox x={95} y={260} w={255} d={95} h={14} fill={color}/><IsoBox x={120} y={300} w={18} d={22} h={72} fill="#60666b"/><IsoBox x={308} y={300} w={18} d={22} h={72} fill="#60666b"/></g>;
}

export default function CocrearVisual({ spec, intent }) {
  const m=(intent?.materiales||spec?.materiales||[])[0]||{material:'laminado',tono:null};
  const color=useMemo(()=>colorMaterial(m.material,m.tono),[m.material,m.tono]);
  const d=intent?.dimensiones||spec?.dimensiones||DIMS_DEFAULT[FAMILIA.DESCONOCIDA];
  const operativo=intent?.tipologia_cocrear==='operativo_colaborativo';
  return <div style={{width:'100%'}}>
    <svg viewBox="0 0 460 350" className="cocrear-visual-svg" role="img" aria-label="Vista volumétrica conceptual del producto">
      <defs><linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="#e9e7e3"/></linearGradient></defs>
      <path d="M40 302 L280 332 L430 265 L188 235 Z" fill="url(#floor)" stroke="#d4d0ca"/>
      {operativo ? <Operativo intent={intent} color={color}/> : <GenericProduct spec={spec} intent={intent} color={color}/>} 
      <g fontFamily="ui-sans-serif,system-ui" fill="#667085" fontSize="11">
        <text x="24" y="22">VISTA VOLUMÉTRICA CONCEPTUAL</text>
        <text x="24" y="40">{d?.ancho_mm ? `${Math.round(d.ancho_mm)} × ${Math.round(d.prof_mm||d.fondo_mm||0)} × ${Math.round(d.alto_mm||0)} mm` : 'Dimensiones por desarrollar'}</text>
        <text x="24" y="337">Concepto de diseño · el render realista y la ficha técnica se validan por separado</text>
      </g>
    </svg>
  </div>;
}
