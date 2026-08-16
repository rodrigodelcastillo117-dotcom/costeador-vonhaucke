import { propuestaPDF } from '../src/datos/pdfPropuesta.js';
import { resumenPorArea, especificacion } from '../src/datos/resumen.js';
import fs from 'fs';
const base = JSON.parse(fs.readFileSync('./partidas-audit.json'));

function build(P, nombre, cliente='Cliente X') {
  const precioLista = P.reduce((a,p)=>a+p.precioUnitario*p.cantidad,0);
  const d=0.4, descuento=precioLista*d, subtotal=precioLista-descuento;
  const iva=subtotal*0.16, total=subtotal+iva;
  const doc = propuestaPDF({ cot:{cliente,folio:'F-1',fecha:'2026-08-16',partidas:P}, partidas:P,
    resumen: resumenPorArea(P,null), especificacion, nPzas:P.reduce((a,p)=>a+p.cantidad,0), fotos:{},
    totales:{precioLista,descuento,descuentoPct:40,subtotal,contingencia:0,contingenciaPct:0,iva,ivaPct:16,total}});
  fs.writeFileSync(nombre, Buffer.from(doc.output('arraybuffer')));
  console.log(nombre,'páginas', doc.getNumberOfPages());
}
// A) 40 partidas
const p40 = Array.from({length:40},(_,i)=>({...base[i%6], id:'x'+i, nombre: base[i%6].nombre+' — variante '+(i+1)}));
build(p40,'edge-40.pdf');
// B) nombre larguísimo
const largo=[{...base[0], id:'L', nombre:'MÓDULO OPERATIVO LÍNEA APP LT DE 3000 X 1200 mm 4 USUARIOS, CUBIERTAS EN MELAMINA CANTO ABS, SEMIMAMPARAS FRONTALES Y CENTRALES EN CRISTAL TRANSPARENTE TEMPLADO DE 6 mm, CONDUCTO DE ACOMETIDA Y ESTRUCTURA METÁLICA CON ACABADO ELECTROSTÁTICO'}];
build(largo,'edge-largo.pdf','Grupo Industrial Manufacturero del Bajío, S.A. de C.V.');
// C) cantidad 0 y 1 partida
build([{...base[0], id:'z', cantidad:0}],'edge-cero.pdf');
