import React,{useMemo} from 'react';
import {colorMaterial,DIMS_DEFAULT,FAMILIA} from '../datos/cocrear.js';
import {LAYOUT_COCREAR} from '../datos/cocrearWow.js';
import Orbit3D from './Orbit3D.jsx';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const has=(intent,k)=>(intent?.caracteristicas||[]).includes(k);
const box=(x,y,z,w,d,h,color,extra={})=>({x,y,z,w,d,h,color,...extra});

function materialColor(intent,spec){
  const m=(intent?.materiales||spec?.materiales||[])[0]||{material:'laminado',tono:null};
  return colorMaterial(m.material,m.tono);
}

function silla(x,y,rz=0){
  return [
    box(x-210,y-185,0,420,370,440,'#666d75',{rz}),
    box(x-210,y+135,420,420,45,330,'#747b83',{rz}),
  ];
}
function divisor(x,y,w,rz=0){return box(x-w/2,y-25,760,w,50,360,'#a9adb0',{rz,opacity:.92})}
function jardinera(x,y,w,d,h=420,rz=0){
  return [box(x-w/2,y-d/2,0,w,d,h,'#59636a',{rz}),box(x-w*.42,y-d*.42,h,w*.84,d*.84,80,'#58795f',{rz})];
}

function isla(intent,c){
  const cap=clamp(Number(intent?.capacidad_personas||intent?.capacidad?.personas)||6,2,24),cols=Math.ceil(cap/2);
  const d=intent?.dimensiones||{},W=Math.max(Number(d.ancho_mm)||cols*1200,cols*1050),D=Math.max(Number(d.prof_mm||d.fondo_mm)||1400,1300);
  const solids=[];
  solids.push(box(-W/2,-D/2,720,W,D/2-110,30,c),box(-W/2,110,720,W,D/2-110,30,c));
  solids.push(box(-W/2+100,-D/2+120,0,55,D/2-220,720,'#74797e'),box(W/2-155,-D/2+120,0,55,D/2-220,720,'#74797e'));
  solids.push(box(-W/2+100,220,0,55,D/2-330,720,'#74797e'),box(W/2-155,220,0,55,D/2-330,720,'#74797e'));
  if(has(intent,'electrificacion_integrada'))solids.push(box(-W/2+160,-55,675,W-320,110,90,'#3f454a'));
  if(has(intent,'jardinera_integrada'))solids.push(...jardinera(0,0,Math.min(W*.58,2600),340,430));
  for(let i=0;i<cols;i++){
    const x=-W/2+(i+.5)*W/cols;
    if(i*2<cap)solids.push(...silla(x,-D/2-330,0));
    if(i*2+1<cap)solids.push(...silla(x,D/2+330,180));
    if((has(intent,'divisores')||has(intent,'acustica'))&&i<cols-1)solids.push(divisor(-W/2+(i+1)*W/cols,-D/4,Math.max(440,D/2-150),90),divisor(-W/2+(i+1)*W/cols,D/4,Math.max(440,D/2-150),90));
  }
  return solids;
}

function modulos(intent,c){
  const cap=clamp(Number(intent?.capacidad_personas||intent?.capacidad?.personas)||6,2,24),pairs=Math.ceil(cap/2);
  const d=intent?.dimensiones||{},W=Math.max(Number(d.ancho_mm)||pairs*1200,pairs*1050),D=Math.max(Number(d.prof_mm||d.fondo_mm)||1400,1350),gap=90;
  const solids=[];
  for(let i=0;i<pairs;i++){
    const cell=W/pairs,x=-W/2+i*cell+gap/2,ww=cell-gap;
    if(i*2<cap){solids.push(box(x,-D/2,720,ww,D/2-125,30,c));solids.push(...silla(x+ww/2,-D/2-330,0));}
    if(i*2+1<cap){solids.push(box(x,125,720,ww,D/2-125,30,c));solids.push(...silla(x+ww/2,D/2+330,180));}
    solids.push(box(x+80,-D/2+100,0,45,D/2-230,720,'#74797e'),box(x+ww-125,-D/2+100,0,45,D/2-230,720,'#74797e'));
    solids.push(box(x+80,225,0,45,D/2-325,720,'#74797e'),box(x+ww-125,225,0,45,D/2-325,720,'#74797e'));
    if((has(intent,'divisores')||has(intent,'acustica'))&&i<pairs-1)solids.push(divisor(x+ww+gap/2,0,D-180,90));
  }
  if(has(intent,'electrificacion_integrada'))solids.push(box(-W/2+110,-55,660,W-220,110,105,'#3f454a'));
  if(has(intent,'jardinera_integrada'))solids.push(...jardinera(0,0,Math.min(W*.45,2200),360,440));
  return solids;
}

function escultorico(intent,c){
  const cap=clamp(Number(intent?.capacidad_personas||intent?.capacidad?.personas)||8,4,16),d=intent?.dimensiones||{};
  const W=Math.max(Number(d.ancho_mm)||4800,3600),D=Math.max(Number(d.prof_mm||d.fondo_mm)||2200,2100),rx=W*.32,ry=D*.33;
  const solids=[];
  solids.push(box(-520,-520,0,1040,1040,700,'#4d555b',{rz:45}));
  if(has(intent,'jardinera_integrada'))solids.push(...jardinera(0,0,760,760,760,45));
  for(let i=0;i<cap;i++){
    const a=Math.PI*2*i/cap-Math.PI/2,x=Math.cos(a)*rx,y=Math.sin(a)*ry,deg=a*180/Math.PI+90;
    solids.push(box(x-470,y-330,720,940,660,32,c,{rz:deg}));
    solids.push(box(x-390,y-260,0,55,520,720,'#72787e',{rz:deg}),box(x+335,y-260,0,55,520,720,'#72787e',{rz:deg}));
    solids.push(...silla(x+Math.cos(a)*650,y+Math.sin(a)*650,deg+180));
    if(has(intent,'divisores')||has(intent,'acustica'))solids.push(box(x-350,y-20,755,700,40,300,'#a8adb2',{rz:deg,opacity:.9}));
  }
  if(has(intent,'electrificacion_integrada'))solids.push(box(-620,-620,620,1240,1240,70,'#353b40',{rz:45}));
  return solids;
}

function generico(intent,spec,c){
  const fam=spec?.familia||intent?.familia||FAMILIA.DESCONOCIDA,d=intent?.dimensiones||spec?.dimensiones||DIMS_DEFAULT[FAMILIA.DESCONOCIDA];
  const W=Math.max(Number(d.ancho_mm)||1500,400),D=Math.max(Number(d.prof_mm||d.fondo_mm)||600,300),H=Math.max(Number(d.alto_mm)||750,250),s=[];
  if(fam===FAMILIA.RECEPCION){s.push(box(-W/2,-D/2,0,W,D,H*.78,c),box(-W/2,-D/2,H*.78,W,D*.32,H*.22,'#dfd7cd'));return s;}
  if(fam===FAMILIA.LOCKER){const cols=Math.max(2,Math.round(W/450)),cw=W/cols;for(let i=0;i<cols;i++)for(let r=0;r<3;r++)s.push(box(-W/2+i*cw,-D/2,r*H/3,cw-12,D,H/3-12,c));return s;}
  if(fam===FAMILIA.GUARDADO||fam===FAMILIA.DISPLAY){s.push(box(-W/2,-D/2,0,W,D,H,c));if(fam===FAMILIA.DISPLAY)for(let r=1;r<4;r++)s.push(box(-W/2+40,-D/2-20,r*H/4,W-80,40,18,'#555c62'));return s;}
  if(fam===FAMILIA.MESA){s.push(box(-W/2,-D/2,H-35,W,D,35,c));for(const [x,y] of [[-W/2+100,-D/2+100],[W/2-155,-D/2+100],[-W/2+100,D/2-155],[W/2-155,D/2-155]])s.push(box(x,y,0,55,55,H-35,'#70767c'));return s;}
  s.push(box(-W/2,-D/2,H-35,W,D,35,c),box(-W/2+100,-D/2+80,0,55,D-160,H-35,'#70767c'),box(W/2-155,-D/2+80,0,55,D-160,H-35,'#70767c'));
  return s;
}

export default function CocrearVisual({spec,intent}){
  const c=materialColor(intent,spec),layout=intent?._concepto_layout||(intent?.caracteristicas||[]).find(x=>Object.values(LAYOUT_COCREAR).includes(x));
  const operativo=intent?.tipologia_cocrear==='operativo_colaborativo';
  const solids=useMemo(()=>{
    if(operativo){if(layout===LAYOUT_COCREAR.C)return escultorico(intent,c);if(layout===LAYOUT_COCREAR.B)return modulos(intent,c);return isla(intent,c);}
    return generico(intent,spec,c);
  },[intent,spec,c,layout,operativo]);
  const d=intent?.dimensiones||spec?.dimensiones||{},nombre=intent?._concepto_nombre||String(spec?.familia||intent?.familia||'Concepto');
  return <div style={{width:'100%',background:'#111315',border:'1px solid #2b2e32',borderRadius:12,overflow:'hidden'}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,padding:'10px 12px',borderBottom:'1px solid #272a2d',alignItems:'center',flexWrap:'wrap'}}>
      <div><strong style={{fontSize:12,color:'#eef0f2'}}>Modelo 3D interactivo · {nombre}</strong><div style={{fontSize:10,color:'#858d96',marginTop:2}}>Mismo concepto canónico que alimenta el render IA · gira con mouse o dedo</div></div>
      <div style={{fontFamily:'monospace',fontSize:10,color:'#8f98a8'}}>{d?.ancho_mm?`${Math.round(d.ancho_mm)} × ${Math.round(d.prof_mm||d.fondo_mm||0)} × ${Math.round(d.alto_mm||0)} mm`:'medidas por desarrollar'}</div>
    </div>
    <Orbit3D solids={solids} height={360} label={`Modelo 3D interactivo del concepto ${intent?._concepto||''} ${nombre}`}/>
    <div style={{padding:'7px 12px',fontSize:9,color:'#77808a'}}>MODELO CONCEPTUAL · orientación libre para revisar volumen. No sustituye plano/ficha de ingeniería.</div>
  </div>;
}
