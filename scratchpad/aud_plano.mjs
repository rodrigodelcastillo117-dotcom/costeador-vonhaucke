import fs from 'node:fs';
const FN='https://mtuvnbgljwbsaizjjgzs.supabase.co/functions/v1/leer-plano';
const KEY='sb_publishable_lDPhCTatyJ2cap3FNEGs7A_uPapgg6y';
const b64 = fs.readFileSync(process.env.HOME+'/Downloads/Plano_Organico_Con_Medidas.pdf').toString('base64');
const t0=Date.now();
const r = await fetch(FN,{method:'POST',headers:{'content-type':'application/json',apikey:KEY,Authorization:'Bearer '+KEY},body:JSON.stringify({image:b64,mediaType:'application/pdf'})});
const t = await r.text();
console.log('http',r.status,((Date.now()-t0)/1000).toFixed(1)+'s');
fs.writeFileSync('aud_plano_out.json',t);
try{
 const j=JSON.parse(t);
 if(!j.ok){console.log('ERROR:',j.error);process.exit(0);}
 const L=j.lectura;
 console.log('envolvente:',L.envolvente, '=', (L.envolvente.ancho/1000).toFixed(2)+' x '+(L.envolvente.largo/1000).toFixed(2)+' m');
 console.log('tieneCotas:',L.tieneCotas,'| escala:',L.escala);
 console.log('puertas:',(L.puertas||[]).length);
 console.log('NOTAS:'); (L.notas||[]).forEach(n=>console.log('  ·',n));
 console.log('AREAS ('+L.areas.length+'):');
 for(const a of L.areas){
   const m2 = a.forma==='circulo' ? Math.PI*Math.pow(a.circulo.r/1000,2) : Math.abs(a.puntos.reduce((s,p,i,A)=>{const q=A[(i+1)%A.length];return s+(p.x*q.y-q.x*p.y);},0)/2)/1e6;
   console.log(`  ${a.nombre.padEnd(24)} ${a.tipo.padEnd(10)} ${a.forma.padEnd(9)} pts=${String(a.puntos.length).padStart(2)} ${m2.toFixed(1)} m2  conf=${a.confianza} dentroDe=${a.dentroDe||'-'}`);
 }
 const sum=L.areas.filter(a=>!a.dentroDe).reduce((s,a)=>s+(a.forma==='circulo'?Math.PI*Math.pow(a.circulo.r/1000,2):Math.abs(a.puntos.reduce((t,p,i,A)=>{const q=A[(i+1)%A.length];return t+(p.x*q.y-q.x*p.y);},0)/2)/1e6),0);
 console.log('suma areas raiz:',sum.toFixed(1),'m2 vs envolvente',((L.envolvente.ancho*L.envolvente.largo)/1e6).toFixed(1),'m2');
 console.log('uso:',JSON.stringify(j.uso));
}catch(e){console.log('RAW:',t.slice(0,800));}
