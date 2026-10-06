// Optimizador 2D advisory para tableros/hojas rectangulares.
// NO altera el costo oficial: produce evidencia de rendimiento y una propuesta de
// nesting determinista para validar con Producción antes de promoverlo al motor.
//
// Heurística: MaxRects / best-short-side-fit simplificada. Respeta veta (sin giro),
// kerf conservador y recorte perimetral. Mismo input => mismo resultado.

const npos=(x)=>Number.isFinite(Number(x))&&Number(x)>0?Number(x):0;

function contiene(a,b){
  return b.x>=a.x && b.y>=a.y && b.x+b.w<=a.x+a.w && b.y+b.h<=a.y+a.h;
}
function intersecta(a,b){
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}
function podar(rects){
  return rects.filter((r,i)=>r.w>0&&r.h>0&&!rects.some((o,j)=>j!==i&&contiene(o,r)));
}
function dividirLibres(libres,u){
  const out=[];
  for(const f of libres){
    if(!intersecta(f,u)){out.push(f);continue;}
    if(u.x>f.x) out.push({x:f.x,y:f.y,w:u.x-f.x,h:f.h});
    if(u.x+u.w<f.x+f.w) out.push({x:u.x+u.w,y:f.y,w:(f.x+f.w)-(u.x+u.w),h:f.h});
    if(u.y>f.y) out.push({x:f.x,y:f.y,w:f.w,h:u.y-f.y});
    if(u.y+u.h<f.y+f.h) out.push({x:f.x,y:u.y+u.h,w:f.w,h:(f.y+f.h)-(u.y+u.h)});
  }
  return podar(out);
}
function candidatos(p,libres,allowRotate,kerf){
  const ori=[[p.w,p.h,0],...(allowRotate&&p.w!==p.h?[[p.h,p.w,90]]:[])];
  const c=[];
  for(const [w0,h0,rot] of ori){
    const w=w0+kerf,h=h0+kerf;
    for(let i=0;i<libres.length;i++){
      const f=libres[i];
      if(w<=f.w&&h<=f.h){
        const short=Math.min(f.w-w,f.h-h),long=Math.max(f.w-w,f.h-h);
        c.push({i,x:f.x,y:f.y,w,h,drawW:w0,drawH:h0,rot,short,long});
      }
    }
  }
  c.sort((a,b)=>a.short-b.short||a.long-b.long||a.y-b.y||a.x-b.x||a.rot-b.rot);
  return c;
}

export function piezasRectangulares(componentes=[],lote=1){
  const out=[];
  for(const c of componentes||[]){
    const w=npos(c.largoMM),h=npos(c.anchoMM);
    const q=Math.max(0,Math.round((npos(c.piezas)||1)*(npos(lote)||1)));
    if(!w||!h||!q||c.hojas>0) continue;
    for(let i=0;i<q;i++) out.push({id:`${c.nombre||c.insumoId||'pieza'}#${i+1}`,nombre:c.nombre||'',w,h});
  }
  return out.sort((a,b)=>(b.w*b.h)-(a.w*a.h)||b.w-a.w||a.id.localeCompare(b.id));
}

export function optimizarCorte2D({componentes=[],formato={},veta=false,kerfMM=6,recorteOrillaMM=10,lote=1}={}){
  const W=npos(formato.largoMM),H=npos(formato.anchoMM),edge=Math.max(0,Number(recorteOrillaMM)||0),kerf=Math.max(0,Number(kerfMM)||0);
  const usableW=W-2*edge,usableH=H-2*edge;
  if(!(usableW>0&&usableH>0)) return {disponible:false,issues:['FORMATO_SIN_GEOMETRIA']};
  const piezas=piezasRectangulares(componentes,lote);
  if(!piezas.length) return {disponible:false,issues:['SIN_PIEZAS_RECTANGULARES']};

  const hojas=[]; const issues=[];
  for(const p of piezas){
    let best=null,bestSheet=-1;
    for(let si=0;si<hojas.length;si++){
      const cs=candidatos(p,hojas[si].libres,!veta,kerf);
      if(cs.length && (!best || cs[0].short<best.short || (cs[0].short===best.short&&cs[0].long<best.long))){
        best=cs[0];bestSheet=si;
      }
    }
    if(!best){
      const libres=[{x:edge,y:edge,w:usableW,h:usableH}];
      const cs=candidatos(p,libres,!veta,kerf);
      if(!cs.length){issues.push({code:'PIEZA_NO_CABE',id:p.id,w:p.w,h:p.h});continue;}
      hojas.push({libres,placements:[]});best=cs[0];bestSheet=hojas.length-1;
    }
    const sh=hojas[bestSheet];
    const usado={x:best.x,y:best.y,w:best.w,h:best.h};
    sh.placements.push({id:p.id,nombre:p.nombre,x:best.x,y:best.y,w:best.drawW,h:best.drawH,rot:best.rot});
    sh.libres=dividirLibres(sh.libres,usado);
  }
  const placed=hojas.flatMap((s,si)=>s.placements.map(p=>({...p,hoja:si+1})));
  const areaPiezas=placed.reduce((s,p)=>s+p.w*p.h,0);
  const areaComprada=hojas.length*W*H;
  const areaUtil=hojas.length*usableW*usableH;
  return {
    disponible:true,
    hojas:hojas.length,
    piezas_solicitadas:piezas.length,
    piezas_colocadas:placed.length,
    placements:placed,
    issues,
    area_piezas_mm2:areaPiezas,
    area_comprada_mm2:areaComprada,
    desperdicio_mm2:Math.max(0,areaComprada-areaPiezas),
    eficiencia_pct:areaUtil>0?(areaPiezas/areaUtil)*100:0,
    parametros:{veta:!!veta,kerfMM:kerf,recorteOrillaMM:edge,formato:{largoMM:W,anchoMM:H}},
    advisory:true,
  };
}
