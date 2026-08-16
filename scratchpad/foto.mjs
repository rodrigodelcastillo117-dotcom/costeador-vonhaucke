import { imagenProducto, heroLinea } from '../src/datos/imagenes.js';
import { propuestaPDF } from '../src/datos/pdfPropuesta.js';
import fs from 'fs';
const P = JSON.parse(fs.readFileSync('./partidas-audit.json'));
const urls = P.map(p=>({id:p.id, u: imagenProducto(p.ruta,p.productoId) || heroLinea(p.ruta) || null}));
console.log(urls.map(x=>x.id+' -> '+x.u).join('\n'));
const fotos={};
for (const {id,u} of urls){ if(!u) continue; const r=await fetch(u); if(!r.ok){console.log('HTTP',r.status,u);continue;}
  const b=Buffer.from(await r.arrayBuffer()); fotos[id]='data:'+r.headers.get('content-type')+';base64,'+b.toString('base64');
  console.log(id,'ok',r.headers.get('content-type'),b.length,'bytes'); }
const pl=P.reduce((a,p)=>a+p.precioUnitario*p.cantidad,0);
const doc=propuestaPDF({cot:{cliente:'ACME',folio:'F',fecha:'2026-08-16',partidas:P},partidas:P,resumen:[],especificacion:()=>'',nPzas:17,fotos,
 totales:{precioLista:pl,descuento:pl*.4,descuentoPct:40,subtotal:pl*.6,contingencia:0,contingenciaPct:0,iva:pl*.6*.16,ivaPct:16,total:pl*.6*1.16}});
fs.writeFileSync('confoto.pdf',Buffer.from(doc.output('arraybuffer')));
console.log('escrito confoto.pdf');
