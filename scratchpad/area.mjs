import { propuestaPDF } from '../src/datos/pdfPropuesta.js';
import { resumenPorArea, especificacion } from '../src/datos/resumen.js';
import fs from 'fs';
const P = JSON.parse(fs.readFileSync('./partidas-audit.json'));
// acomodo: coloca SOLO parte de las piezas -> aparece el bloque "Sin ubicar en el plano"
const acomodo = { areas:[{nombre:'Sala operativa',tipo:'operativo',ancho:8000,largo:6000},{nombre:'Dirección',tipo:'privado',ancho:5000,largo:4000}],
  plan:{ colocacion:[ {id:'p1-1',area:0},{id:'p1-2',area:0},{id:'p5-1',area:0},{id:'p5-2',area:0},
    {id:'p2-1',area:1},{id:'p3-1',area:1} ] } };
const resumen = resumenPorArea(P, acomodo);
console.log(JSON.stringify(resumen.map(b=>({n:b.nombre,m2:b.m2,total:b.total,esp:especificacion(b)})),null,1));
const precioLista=P.reduce((a,p)=>a+p.precioUnitario*p.cantidad,0), descuento=precioLista*0.4, subtotal=precioLista-descuento, iva=subtotal*.16;
const doc=propuestaPDF({cot:{cliente:'ACME',folio:'F',fecha:'2026-08-16',partidas:P},partidas:P,resumen,especificacion,nPzas:17,fotos:{},
 totales:{precioLista,descuento,descuentoPct:40,subtotal,contingencia:0,contingenciaPct:0,iva,ivaPct:16,total:subtotal+iva}});
fs.writeFileSync('area.pdf',Buffer.from(doc.output('arraybuffer')));
console.log('suma áreas', resumen.reduce((s,b)=>s+b.total,0), 'vs TOTAL', subtotal+iva);
