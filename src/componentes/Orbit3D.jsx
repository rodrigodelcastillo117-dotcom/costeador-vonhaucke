import React,{useMemo,useRef,useState} from 'react';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const hex=(s)=>/^#[0-9a-f]{6}$/i.test(String(s||''))?String(s):'#c9b89d';
const tint=(c,k)=>{
  const n=parseInt(hex(c).slice(1),16),rgb=[n>>16&255,n>>8&255,n&255];
  const out=rgb.map(v=>clamp(Math.round(v+(k>=0?(255-v):v)*k),0,255));
  return '#'+out.map(v=>v.toString(16).padStart(2,'0')).join('');
};

function vertices(s){
  const {x=0,y=0,z=0,w=1,d=1,h=1,rz=0}=s;
  const cx=x+w/2,cy=y+d/2,a=rz*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);
  const p=(lx,ly,lz)=>{
    const dx=lx-cx,dy=ly-cy;
    return [cx+dx*ca-dy*sa,cy+dx*sa+dy*ca,lz];
  };
  return [p(x,y,z),p(x+w,y,z),p(x+w,y+d,z),p(x,y+d,z),p(x,y,z+h),p(x+w,y,z+h),p(x+w,y+d,z+h),p(x,y+d,z+h)];
}
const FACES=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]];
const SHADE=[-0.16,0.10,-0.08,-0.02,-0.14,0.03];

export default function Orbit3D({solids=[],height=330,label='Modelo 3D interactivo',initialYaw=-35,initialPitch=28,showControls=true}){
  const [yaw,setYaw]=useState(initialYaw),[pitch,setPitch]=useState(initialPitch),[zoom,setZoom]=useState(1);
  const drag=useRef(null);
  const scene=useMemo(()=>{
    const ss=(Array.isArray(solids)?solids:[]).filter(s=>s&&Number(s.w)>0&&Number(s.d)>0&&Number(s.h)>0);
    if(!ss.length)return {faces:[],scale:1,ox:300,oy:180};
    const all=ss.flatMap(vertices),xs=all.map(p=>p[0]),ys=all.map(p=>p[1]),zs=all.map(p=>p[2]);
    const center=[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2,Math.min(...zs)];
    const yr=yaw*Math.PI/180,pr=pitch*Math.PI/180,cy=Math.cos(yr),sy=Math.sin(yr),cp=Math.cos(pr),sp=Math.sin(pr);
    const project=(p)=>{
      const dx=p[0]-center[0],dy=p[1]-center[1],dz=p[2]-center[2];
      const x1=dx*cy-dy*sy,y1=dx*sy+dy*cy;
      const y2=y1*cp-dz*sp,dep=y1*sp+dz*cp;
      return [x1,-y2,dep];
    };
    const faces=[];
    ss.forEach((s,si)=>{
      const vv=vertices(s),pp=vv.map(project);
      FACES.forEach((idx,fi)=>{
        const pts=idx.map(i=>pp[i]);
        faces.push({key:`${si}-${fi}`,pts,depth:pts.reduce((a,p)=>a+p[2],0)/pts.length,color:tint(s.color||'#c9b89d',SHADE[fi]),opacity:s.opacity??1,stroke:s.stroke||'#35383c'});
      });
    });
    faces.sort((a,b)=>a.depth-b.depth);
    const pts=faces.flatMap(f=>f.pts),px=pts.map(p=>p[0]),py=pts.map(p=>p[1]);
    const spanX=Math.max(...px)-Math.min(...px)||1,spanY=Math.max(...py)-Math.min(...py)||1;
    const scale=Math.min(520/spanX,270/spanY)*zoom;
    const cx=(Math.min(...px)+Math.max(...px))/2,cy2=(Math.min(...py)+Math.max(...py))/2;
    return {faces,scale,ox:300-cx*scale,oy:165-cy2*scale};
  },[solids,yaw,pitch,zoom]);

  const down=e=>{e.currentTarget.setPointerCapture?.(e.pointerId);drag.current={x:e.clientX,y:e.clientY,yaw,pitch};};
  const move=e=>{if(!drag.current)return;const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;setYaw(drag.current.yaw+dx*.42);setPitch(clamp(drag.current.pitch-dy*.32,-8,72));};
  const up=e=>{try{e.currentTarget.releasePointerCapture?.(e.pointerId)}catch{}drag.current=null;};
  const wheel=e=>{e.preventDefault?.();setZoom(z=>clamp(z*(e.deltaY>0?.92:1.08),.62,1.8));};
  const reset=()=>{setYaw(initialYaw);setPitch(initialPitch);setZoom(1)};
  const pts=f=>f.pts.map(p=>`${(scene.ox+p[0]*scene.scale).toFixed(1)},${(scene.oy+p[1]*scene.scale).toFixed(1)}`).join(' ');

  return <div style={{position:'relative',width:'100%',height,background:'radial-gradient(circle at 50% 35%,#1c1f22 0,#101214 72%)',borderRadius:12,overflow:'hidden',border:'1px solid #292d31',touchAction:'none',userSelect:'none'}}
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel}>
    <svg viewBox="0 0 600 330" width="100%" height="100%" role="img" aria-label={label} style={{display:'block',cursor:drag.current?'grabbing':'grab'}}>
      <defs><linearGradient id="orb-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#262a2e"/><stop offset="1" stopColor="#111315"/></linearGradient></defs>
      <ellipse cx="300" cy="288" rx="230" ry="28" fill="#000" opacity=".22"/>
      {scene.faces.map(f=><polygon key={f.key} points={pts(f)} fill={f.color} fillOpacity={f.opacity} stroke={f.stroke} strokeWidth=".7" strokeLinejoin="round"/>)}
    </svg>
    <div style={{position:'absolute',left:10,bottom:8,fontSize:10,color:'#8e969f',pointerEvents:'none'}}>Arrastra para girar · mouse o dedo</div>
    {showControls&&<div style={{position:'absolute',right:8,top:8,display:'flex',gap:5}}>
      <button type="button" aria-label="Alejar" onClick={e=>{e.stopPropagation();setZoom(z=>clamp(z*.88,.62,1.8))}} style={ctl}>−</button>
      <button type="button" aria-label="Acercar" onClick={e=>{e.stopPropagation();setZoom(z=>clamp(z*1.12,.62,1.8))}} style={ctl}>+</button>
      <button type="button" aria-label="Restablecer vista" onClick={e=>{e.stopPropagation();reset()}} style={ctl}>↺</button>
    </div>}
  </div>;
}
const ctl={width:30,height:30,borderRadius:8,border:'1px solid #4a4f55',background:'#171a1d',color:'#fff',fontWeight:800,cursor:'pointer'};
