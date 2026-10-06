// Layout semántico de oficina para acomodar-espacio.
// La geometría valida; esta capa aporta intención: qué pertenece en cada zona y
// dónde deben sentarse las sillas respecto de escritorios/mesas.
import { planearDeterminista, validarColocacion, huellaConRot } from './acomodo-core.js';

const norm = (s='') => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

export function claseZona(nombre='') {
  const s=norm(nombre);
  if (/sanitar|bano|wc|toilet|site|\bit\b|rack|cuarto tecnico/.test(s)) return 'prohibida';
  if (/consejo|junta|reunion|board|meeting/.test(s)) return 'juntas';
  if (/recep|lobby|acceso|vestib/.test(s)) return 'recepcion';
  if (/ceo|direccion|director|gerenc|privad|oficina/.test(s)) return 'privado';
  if (/operativ|open|bench|estacion|trabajo|planta libre/.test(s)) return 'operativo';
  return 'general';
}

export function clasePieza(p={}) {
  const s=norm(`${p.tipo||''} ${p.nombre||''} ${p.semantic_role||''}`);
  if (/recep|mostrador/.test(s)) return 'recepcion';
  if (/mesa.*junta|mesa.*consejo|board.*table|meeting.*table/.test(s)) return 'mesa_juntas';
  if (/silla.*junta|silla.*consejo|meeting.*seat|board.*chair/.test(s)) return 'silla_juntas';
  if (/silla.*direct|executive.*seat|sillon.*direct/.test(s)) return 'silla_directiva';
  if (/silla|asiento|chair|seat/.test(s)) return 'silla_operativa';
  if (/bench|workstation|estacion|escritorio|desk/.test(s)) return 'puesto';
  if (/credenza|archiv|guarda|storage|pedestal|locker/.test(s)) return 'guarda';
  return 'otro';
}

const permitido = {
  recepcion: new Set(['recepcion','general']),
  mesa_juntas: new Set(['juntas','general']),
  silla_juntas: new Set(['juntas','general']),
  silla_directiva: new Set(['privado','general']),
  silla_operativa: new Set(['operativo','privado','general']),
  puesto: new Set(['operativo','privado','general']),
  guarda: new Set(['privado','operativo','general']),
  otro: new Set(['recepcion','juntas','privado','operativo','general']),
};

export function prepararPiezas(areas=[], piezas=[]) {
  const zonas=areas.map(a=>claseZona(a?.nombre||''));
  return piezas.map(p=>{
    const clase=clasePieza(p);
    const ok=permitido[clase]||permitido.otro;
    const allowedAreas=zonas.map((z,i)=>({z,i})).filter(x=>x.z!=='prohibida'&&ok.has(x.z)).map(x=>x.i);
    // Si el plano no trae nombres semánticos, general sigue siendo fallback honesto.
    return { ...p, _claseLayout:clase, allowedAreas:allowedAreas.length?allowedAreas:zonas.map((z,i)=>z!=='prohibida'?i:null).filter(i=>i!=null) };
  });
}

function candidatosAlrededor(anchor, anchorPiece, chair) {
  const ah=huellaConRot(anchorPiece, anchor.rot||0);
  const cw=Number(chair.w)||600, cd=Number(chair.d)||600;
  const gap=180, stepX=Math.max(cw+120,700), stepY=Math.max(cd+120,700);
  const out=[];
  const cx=anchor.x+ah.w/2, cy=anchor.y+ah.d/2;
  const spanX=Math.max(1,Math.floor(ah.w/stepX));
  const spanY=Math.max(1,Math.floor(ah.d/stepY));
  for(let k=0;k<spanX;k++){
    const x=Math.round(anchor.x+(ah.w*(k+0.5))/spanX-cw/2);
    out.push({x,y:Math.round(anchor.y-cd-gap),rot:0});
    out.push({x,y:Math.round(anchor.y+ah.d+gap),rot:180});
  }
  for(let k=0;k<spanY;k++){
    const y=Math.round(anchor.y+(ah.d*(k+0.5))/spanY-cd/2);
    out.push({x:Math.round(anchor.x-cw-gap),y,rot:90});
    out.push({x:Math.round(anchor.x+ah.w+gap),y,rot:90});
  }
  // candidato central posterior: útil para silla directiva frente a escritorio.
  out.unshift({x:Math.round(cx-cw/2),y:Math.round(anchor.y+ah.d+gap),rot:0});
  return out;
}

function esAsiento(c){ return c==='silla_operativa'||c==='silla_juntas'||c==='silla_directiva'; }
function claseAnchorPara(c){
  if(c==='silla_juntas') return new Set(['mesa_juntas']);
  if(c==='silla_directiva') return new Set(['puesto']);
  return new Set(['puesto']);
}

export function planearSemantico(areas=[], piezas=[], opts={}) {
  const ps=prepararPiezas(areas,piezas);
  const anchors=ps.filter(p=>!esAsiento(p._claseLayout));
  const seats=ps.filter(p=>esAsiento(p._claseLayout));

  const base=planearDeterminista(areas,anchors,opts);
  const colocacion=[...base.colocacion];
  const byId=new Map(ps.map(p=>[String(p.id),p]));

  for(const chair of seats){
    let placed=null;
    const clases=claseAnchorPara(chair._claseLayout);
    const anchorsCol=colocacion.filter(c=>{
      const p=byId.get(String(c.id));
      return p && clases.has(p._claseLayout) && chair.allowedAreas.includes(Number(c.area));
    });
    for(const ac of anchorsCol){
      const ap=byId.get(String(ac.id));
      for(const cand of candidatosAlrededor(ac,ap,chair)){
        const c={id:String(chair.id),area:Number(ac.area),x:cand.x,y:cand.y,rot:cand.rot===180?0:cand.rot};
        const currentIds=new Set([...colocacion.map(x=>String(x.id)),String(chair.id)]);
        const subset=ps.filter(p=>currentIds.has(String(p.id)));
        const val=validarColocacion(areas,subset,[...colocacion,c]);
        const row=val.porPieza.find(x=>String(x.id)===String(chair.id));
        if(row?.ok){ placed=c; break; }
      }
      if(placed) break;
    }
    if(placed){ colocacion.push(placed); continue; }

    // Fallback: solver geométrico, pero sólo dentro de allowedAreas.
    const fallback=planearDeterminista(areas,[...anchors,...seats.filter(s=>String(s.id)===String(chair.id))],{...opts,fijas:colocacion});
    const fc=fallback.colocacion.find(c=>String(c.id)===String(chair.id));
    if(fc) colocacion.push(fc);
  }
  return { colocacion, noColocadas: ps.filter(p=>!colocacion.some(c=>String(c.id)===String(p.id))).map(p=>({id:String(p.id),motivo:'sin ubicación semántica y geométricamente válida'})) };
}
