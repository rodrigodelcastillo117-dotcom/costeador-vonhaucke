// Genera la propuesta con datos realistas y la escribe a disco, para MIRARLA.
// Una propuesta que "no truena" y se ve mal es una propuesta que no se manda.
import fs from 'node:fs';
import { propuestaPDF } from '../src/datos/pdfPropuesta.js';
import { resumenPorArea, especificacion } from '../src/datos/resumen.js';
import { expandirPiezas } from '../src/datos/espacio.js';

const partidas = [
  { id: 'p1', nombre: 'Banca doble APP LT 1.50 · 6 usuarios, biombos laterales', cantidad: 2, precioUnitario: 36260, w: 4500, d: 1200, ruta: 'applt' },
  { id: 'p2', nombre: 'Mesa de juntas APP LT 2.40 × 1.20', cantidad: 1, precioUnitario: 16408, w: 2400, d: 1200, ruta: 'applt' },
  { id: 'p3', nombre: 'Archivero Modulor 1.20 · 2 cajones', cantidad: 4, precioUnitario: 9460, w: 1200, d: 450, ruta: 'modulor' },
  { id: 'p4', nombre: 'Silla operativa WIN', cantidad: 12, precioUnitario: 5210, w: 600, d: 600 },
];
const piezas = expandirPiezas(partidas);
const areas = [{ nombre: 'Open space', ancho: 9000, largo: 6000 }, { nombre: 'Sala de juntas', ancho: 5000, largo: 4000 }];
const colocacion = piezas.map((p, i) => ({
  id: p.id, area: /juntas/i.test(p.nombre) ? 1 : 0,
  x: 700 + (i % 4) * 1950, y: 700 + Math.floor(i / 4) * 1450, rot: 0,
}));
const acomodo = { areas, plan: { colocacion } };

const precioLista = partidas.reduce((a, p) => a + p.precioUnitario * p.cantidad, 0);
const descuento = precioLista * 0.15, subtotal = precioLista - descuento;
const maniobras = subtotal * 0.03, flete = subtotal * 0.10;
const base = subtotal + maniobras + flete, iva = base * 0.16, total = base + iva;
const totales = { precioLista, descuento, descuentoPct: 15, subtotal, contingencia: 0, contingenciaPct: 0,
  maniobras, maniobrasPct: 3, flete, fletePct: 10, iva, ivaPct: 16, total, anticipoPct: 50, anticipo: total * 0.5 };
const cot = { cliente: 'DESARROLLOS INMOBILIARIOS Y CONSTRUCCIONES DEL BAJÍO, S.A. DE C.V.',
  folio: '2608-001', fecha: '16/08/2026', acomodo };

const doc = propuestaPDF({ cot, partidas, resumen: resumenPorArea(partidas, acomodo), especificacion, totales, nPzas: 19, fotos: {}, piezas });
const buf = Buffer.from(doc.output('arraybuffer'));
const salida = process.argv[2] || '/private/tmp/claude-501/-Users-rodrigodelcastillo-Documents/ced0a851-dc61-41f8-ba69-b069382fe449/scratchpad/propuesta.pdf';
fs.writeFileSync(salida, buf);
console.log(`✓ ${doc.getNumberOfPages()} hojas · ${Math.round(buf.length / 1024)} KB → ${salida}`);
console.log(`  la escalera cuadra: ${Math.abs((precioLista - descuento + maniobras + flete + iva) - total) < 0.01}`);
