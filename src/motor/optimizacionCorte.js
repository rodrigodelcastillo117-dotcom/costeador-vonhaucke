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
  const completo = issues.length === 0 && placed.length === piezas.length;
  return {
    disponible:true,
    completo,
    certificable:false,
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


// ---------------------------------------------------------------------------
// CUTTING STOCK 1D · perfiles / PTR / tubos / molduras.
// Advisory: NO cambia costo oficial hasta validación de Producción.
// Heurística deterministic best-fit-decreasing. Respeta kerf por corte y recorte
// de punta en cada tramo comprado. Mismo input => mismo resultado.
// ---------------------------------------------------------------------------
export function piezasLineales(componentes = [], lote = 1) {
  const out = [];
  for (const c of componentes || []) {
    // Una pieza lineal usa largoMM. Si también tiene anchoMM > 0 se considera
    // panel y pertenece al nesting 2D, salvo que forma='lineal' explícita.
    const largo = npos(c.largoMM ?? c.longitudMM ?? c.length_mm);
    const esLineal = c.forma === 'lineal' || (!npos(c.anchoMM) && largo > 0);
    if (!esLineal || !largo) continue;
    const qBase = npos(c.piezas ?? c.cantidad) || 1;
    const q = Math.max(0, Math.round(qBase * (npos(lote) || 1)));
    for (let i = 0; i < q; i++) {
      out.push({
        id: `${c.nombre || c.insumoId || 'perfil'}#${i + 1}`,
        nombre: c.nombre || '',
        largo,
      });
    }
  }
  return out.sort((a, b) => b.largo - a.largo || a.id.localeCompare(b.id));
}

export function optimizarCorte1D({
  componentes = [],
  largoTramoMM = 0,
  kerfMM = 3,
  recortePuntaMM = 0,
  lote = 1,
} = {}) {
  const stock = npos(largoTramoMM);
  const kerf = Math.max(0, Number(kerfMM) || 0);
  const edge = Math.max(0, Number(recortePuntaMM) || 0);
  const usable = stock - 2 * edge;
  if (!(usable > 0)) return { disponible: false, issues: ['TRAMO_SIN_GEOMETRIA'], advisory: true };

  const piezas = piezasLineales(componentes, lote);
  if (!piezas.length) return { disponible: false, issues: ['SIN_PIEZAS_LINEALES'], advisory: true };

  const tramos = [];
  const issues = [];
  for (const p of piezas) {
    if (p.largo > usable) {
      issues.push({ code: 'PIEZA_NO_CABE', id: p.id, largo: p.largo, util_mm: usable });
      continue;
    }

    // Best fit: tramo donde después del corte queda el menor remanente >= 0.
    let elegido = -1;
    let mejorResto = Infinity;
    for (let i = 0; i < tramos.length; i++) {
      const t = tramos[i];
      const gasto = p.largo + (t.piezas.length ? kerf : 0);
      const resto = t.restante - gasto;
      if (resto >= -1e-9 && resto < mejorResto) {
        elegido = i;
        mejorResto = resto;
      }
    }
    if (elegido < 0) {
      tramos.push({ restante: usable, piezas: [], usado: 0, cortes: 0 });
      elegido = tramos.length - 1;
    }

    const t = tramos[elegido];
    const gastoKerf = t.piezas.length ? kerf : 0;
    t.restante -= p.largo + gastoKerf;
    t.usado += p.largo;
    if (gastoKerf) t.cortes += 1;
    t.piezas.push({ id: p.id, nombre: p.nombre, largo: p.largo });
  }

  const colocadas = tramos.flatMap((t, i) => t.piezas.map((p) => ({ ...p, tramo: i + 1 })));
  const comprado = tramos.length * stock;
  const neto = colocadas.reduce((s, p) => s + p.largo, 0);
  const kerfTotal = tramos.reduce((s, t) => s + t.cortes * kerf, 0);
  const recorteTotal = tramos.length * 2 * edge;
  const sobrante = Math.max(0, comprado - neto - kerfTotal - recorteTotal);

  const completo = issues.length === 0 && colocadas.length === piezas.length;
  return {
    disponible: true,
    completo,
    certificable: false,
    tramos: tramos.length,
    piezas_solicitadas: piezas.length,
    piezas_colocadas: colocadas.length,
    placements: colocadas,
    issues,
    largo_comprado_mm: comprado,
    largo_neto_mm: neto,
    kerf_total_mm: kerfTotal,
    recorte_total_mm: recorteTotal,
    sobrante_reutilizable_mm: sobrante,
    desperdicio_pct: comprado > 0 ? ((comprado - neto) / comprado) * 100 : 0,
    eficiencia_pct: comprado > 0 ? (neto / comprado) * 100 : 0,
    parametros: { largoTramoMM: stock, kerfMM: kerf, recortePuntaMM: edge },
    advisory: true,
  };
}
