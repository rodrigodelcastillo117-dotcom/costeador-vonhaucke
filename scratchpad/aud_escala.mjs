import { LINEAS_REG, costearItem } from '../src/datos/lineas.js';
import { BANCO } from '../src/datos/banco.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';
const E={insumos:mapaInsumos(INSUMOS_SEMILLA),parametros:PARAMETROS_DEFAULT,piezas:{}};
const q=(ruta,producto,sel)=>{try{return costearItem(E,{ruta,producto,cantidad:1,seleccion:Object.entries(sel).map(([clave,valor])=>({clave,valor:String(valor)}))});}catch(e){return null;}};
const mx=(n)=>'$'+Math.round(n).toLocaleString('es-MX');
console.log('### ¿EL PRECIO SUBE CON LOS USUARIOS? (por producto con param usuarios)');
for(const [ruta,L] of Object.entries(LINEAS_REG)) for(const p of L.productos){
  if(!p.usuarios || p.usuarios.length<2) continue;
  const base={}; if(p.largos)base.largoMM=p.largos[0]; if(p.fondos?.length>1)base.fondoMM=p.fondos[0];
  for(const s of p.selects||[]) base[s.key]=s.opciones[0].id;
  if(p.finishes) base.finish=p.finishes[0].id;
  const fila=p.usuarios.map(u=>{const r=q(ruta,p.id,{...base,usuarios:u});return r?{u,pu:r.precioUnitario,pp:r.precioUnitario/u,f:r.precioReal}:null;}).filter(Boolean);
  if(fila.length<2)continue;
  const plano = new Set(fila.map(f=>Math.round(f.pu))).size===1;
  const baja = fila.some((f,i)=>i>0 && f.pu < fila[i-1].pu);
  const tag = plano?'  <<<< PRECIO PLANO: los usuarios NO cuestan':(baja?'  <<<< NO MONOTONO: baja al subir usuarios':'');
  console.log(`${ruta}/${p.id}`.padEnd(30), fila.map(f=>`${f.u}u=${mx(f.pu)}${f.f?'*':''}`).join('  '), tag);
}
console.log('\n### PIEZAS DE BANCO SOSPECHOSAS');
for(const id of ['p9-cabina-telefonica-68900','silla-etivtui','p9-banco-re571c-2012','p9-silla-de-visita-esp-ohv-368-2532','mj-consejo-4800x1200-eclipse','gaveta-mox','p9-wand-cancel-wand-244620']){
  const b=BANCO.find(x=>x.id===id);
  console.log(' ',id.padEnd(40), b?JSON.stringify(b):'NO EXISTE');
}
console.log('\n### BANCO: ids cuyo numero final NO coincide con el precio');
let n=0; for(const b of BANCO){const m=/-(\d+)$/.exec(b.id); if(m && Number(m[1])!==b.precio){n++; if(n<=15)console.log('  ',b.id.padEnd(45),'id dice',m[1],'| precio real',b.precio,'|',b.nombre);}}
console.log('  total desalineados:',n,'de',BANCO.length);
console.log('\n### BANCO: piezas sin precio o con precio raro');
for(const b of BANCO) if(!(b.precio>0)) console.log('  SIN PRECIO:',b.id,b.nombre,b.precio);
const caros=BANCO.filter(b=>b.precio>60000).sort((a,b)=>b.precio-a.precio);
console.log('  piezas > $60,000:'); for(const b of caros) console.log('   ',mx(b.precio).padStart(12),b.id,'|',b.nombre,'|',b.categoria,'|',b.medidas||'');
