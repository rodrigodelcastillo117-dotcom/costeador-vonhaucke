import { propuestaPDF } from '../src/datos/pdfPropuesta.js';
import { resumenPorArea, especificacion } from '../src/datos/resumen.js';
import fs from 'fs';

const P = JSON.parse(fs.readFileSync(new URL('./partidas-audit.json', import.meta.url)));
const cot = { cliente: 'Corporativo de prueba, S.A. de C.V.', folio: '2608-001', fecha: '2026-08-16', partidas: P };
const precioLista = P.reduce((a,p)=>a+p.precioUnitario*p.cantidad,0);
const descuentoPct = Number(process.argv[2] ?? 0);
const descuento = precioLista*(descuentoPct/100);
const subtotal = precioLista-descuento;
const contingenciaPct = Number(process.argv[3] ?? 0);
const contingencia = subtotal*(contingenciaPct/100);
const base = subtotal+contingencia;
const iva = base*0.16, total = base+iva;
const nPzas = P.reduce((a,p)=>a+p.cantidad,0);
const doc = propuestaPDF({ cot, partidas:P, resumen: resumenPorArea(P, null), especificacion, nPzas, fotos:{},
  totales:{ precioLista, descuento, descuentoPct, subtotal, contingencia, contingenciaPct, iva, ivaPct:16, total } });
const out = process.argv[4] || 'propuesta-audit.pdf';
fs.writeFileSync(new URL('./'+out, import.meta.url), Buffer.from(doc.output('arraybuffer')));
console.log('OK', out, 'precioLista', precioLista, 'total', total);
