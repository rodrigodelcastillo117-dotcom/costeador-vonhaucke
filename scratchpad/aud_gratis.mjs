// ¿Qué opciones puede encender Voni que NO mueven el precio? = mueble regalado.
import { LINEAS_REG, costearItem } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';
const E={insumos:mapaInsumos(INSUMOS_SEMILLA),parametros:PARAMETROS_DEFAULT,piezas:{}};
const q=(ruta,producto,sel)=>{try{return costearItem(E,{ruta,producto,cantidad:1,seleccion:Object.entries(sel).map(([clave,valor])=>({clave,valor:String(valor)}))});}catch(e){return null;}};
const mx=(n)=>'$'+Math.round(n).toLocaleString('es-MX');
const gratis=[], mueve=[];
for(const [ruta,L] of Object.entries(LINEAS_REG)){
  for(const p of L.productos){
    const base={};
    if(p.largos) base.largoMM=p.largos[Math.floor(p.largos.length/2)];
    if(p.fondos?.length>1) base.fondoMM=p.fondos[0];
    if(p.usuarios) base.usuarios=p.usuarios[Math.floor(p.usuarios.length/2)];
    if(p.diametros) base.diametroMM=p.diametros[0];
    if(p.largosLateral) base.largoLateralMM=p.largosLateral[0];
    for(const s of p.selects||[]) base[s.key]=s.opciones[0].id;
    if(p.finishes) base.finish=p.finishes[0].id;
    const b=q(ruta,p.id,base);
    if(!b) continue;
    for(const c of p.checks||[]){
      const r=q(ruta,p.id,{...base,[c.key]:'si'});
      if(!r) continue;
      const d=r.precioUnitario-b.precioUnitario;
      const rec={ruta,prod:p.id,opcion:c.key,label:c.label,base:b.precioUnitario,con:r.precioUnitario,delta:d,pct:b.precioUnitario?d/b.precioUnitario*100:0,tipo:'check',firme:b.precioReal};
      (Math.abs(d)<1?gratis:mueve).push(rec);
    }
    // selects: comparar 1a opcion vs las demas
    for(const s of p.selects||[]){
      for(const o of s.opciones.slice(1)){
        const r=q(ruta,p.id,{...base,[s.key]:o.id});
        if(!r) continue;
        const d=r.precioUnitario-b.precioUnitario;
        const rec={ruta,prod:p.id,opcion:`${s.key}=${o.id}`,label:s.label,base:b.precioUnitario,con:r.precioUnitario,delta:d,pct:b.precioUnitario?d/b.precioUnitario*100:0,tipo:'select',firme:b.precioReal};
        (Math.abs(d)<1?gratis:mueve).push(rec);
      }
    }
    if(p.biombo){
      for(const v of ['cristal','melamina']){
        const r=q(ruta,p.id,{...base,biombo:v});
        if(!r)continue; const d=r.precioUnitario-b.precioUnitario;
        const rec={ruta,prod:p.id,opcion:'biombo='+v,label:'Biombo',base:b.precioUnitario,con:r.precioUnitario,delta:d,pct:b.precioUnitario?d/b.precioUnitario*100:0,tipo:'biombo',firme:b.precioReal};
        (Math.abs(d)<1?gratis:mueve).push(rec);
      }
    }
  }
}
console.log('OPCIONES QUE NO MUEVEN EL PRECIO (se entregan GRATIS):',gratis.length,'de',gratis.length+mueve.length);
console.log('--- las de checkbox (las que Voni enciende sola) ---');
for(const g of gratis.filter(x=>x.tipo==='check')) console.log(`  ${g.ruta}/${g.prod}`.padEnd(34),g.opcion.padEnd(16),mx(g.base).padStart(10),' -> +$0   ',g.label);
console.log('--- biombo/select gratis (muestra 30) ---');
for(const g of gratis.filter(x=>x.tipo!=='check').slice(0,30)) console.log(`  ${g.ruta}/${g.prod}`.padEnd(34),g.opcion.padEnd(26),mx(g.base).padStart(10),' -> +$0');
console.log('\nTOP opciones que SI mueven mucho (para contraste):');
for(const m of mueve.sort((a,b)=>Math.abs(b.pct)-Math.abs(a.pct)).slice(0,10)) console.log(`  ${(m.pct>0?'+':'')+m.pct.toFixed(0)+'%'} ${m.ruta}/${m.prod} ${m.opcion} ${mx(m.base)}->${mx(m.con)}`);
