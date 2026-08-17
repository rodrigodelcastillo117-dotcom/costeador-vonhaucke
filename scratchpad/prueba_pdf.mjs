// Genera la propuesta con datos realistas y la escribe a disco, para MIRARLA.
// Una propuesta que "no truena" y se ve mal es una propuesta que no se manda.
//
// ⚠️ EL FIXTURE TIENE QUE TRAER LO QUE ROMPE EL DOCUMENTO: gavetas (que no se
// dibujan y hay que decirlas), sillas (que se pierden entre los escritorios) y
// una razón social larga (que se comía el folio). Sin eso, el PDF "pasa" y
// luego falla en el proyecto de verdad.
import fs from 'node:fs';
import { propuestaPDF } from '../src/datos/pdfPropuesta.js';
import { resumenPorArea, especificacion } from '../src/datos/resumen.js';
import { listaPorCuarto } from '../src/datos/porCuarto.js';
import { expandirPiezas } from '../src/datos/espacio.js';
import { acomodarLocal } from '../src/datos/planner.js';

const partidas = [
  { id: 'p1', nombre: 'Banca doble APP LT 1.50 · 6 usuarios, biombos laterales', cantidad: 2, precioUnitario: 36260, w: 4500, d: 1200, ruta: 'applt' },
  { id: 'p2', nombre: 'Mesa de juntas APP LT 2.40 × 1.20', cantidad: 1, precioUnitario: 16408, w: 2400, d: 1200, ruta: 'applt' },
  { id: 'p3', nombre: 'Archivero Modulor 1.20 · 2 cajones', cantidad: 4, precioUnitario: 9460, w: 1200, d: 450, ruta: 'modulor' },
  { id: 'p4', nombre: 'Silla operativa WIN', cantidad: 12, precioUnitario: 5210, w: 600, d: 600 },
  { id: 'p5', nombre: 'Gaveta rodante Mox 3 cajones', cantidad: 12, precioUnitario: 4100, w: 400, d: 580, ruta: 'mox' },
  { id: 'p6', nombre: 'Silla de visita CONCERTO', cantidad: 2, precioUnitario: 1950, w: 550, d: 550 },
  { id: 'p7', nombre: 'Eclipse · Escritorio directivo 2.10 m mano derecha', cantidad: 1, precioUnitario: 31500, w: 2100, d: 900, ruta: 'eclipse' },
];
// Fotos de mentiras (un JPEG diminuto) sólo para comprobar que el documento las
// COLOCA sin deformarlas ni tumbarse. Las de verdad las trae `cargarFotos`.
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAAIAAgBAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAA/AKpAAAf/2Q==';
const piezas = expandirPiezas(partidas);
// El acomodo DE VERDAD, no uno inventado: así el plano y la lista por área
// dicen lo mismo que diría la app.
const areas = [
  { nombre: 'Open space', ancho: 12000, largo: 8000 },
  { nombre: 'Sala de juntas', ancho: 5000, largo: 4000 },
  { nombre: 'Dirección', ancho: 4200, largo: 3600 },
];
const plan = acomodarLocal(areas, piezas, {});
// Con FOTOS POR ÁREA: es el camino que hay que probar, porque es donde el PDF
// dibuja imágenes y donde se rompe (una imagen mal medida se lleva la hoja).
const acomodo = { areas, plan, escenas: areas.map((a) => ({ nombre: a.nombre, m2: 0, img: JPG })) };

const precioLista = partidas.reduce((a, p) => a + p.precioUnitario * p.cantidad, 0);
const descuento = precioLista * 0.15, subtotal = precioLista - descuento;
const maniobras = subtotal * 0.03, flete = subtotal * 0.10;
const base = subtotal + maniobras + flete, iva = base * 0.16, total = base + iva;
const totales = { precioLista, descuento, descuentoPct: 15, subtotal, contingencia: 0, contingenciaPct: 0,
  maniobras, maniobrasPct: 3, flete, fletePct: 10, iva, ivaPct: 16, total, anticipoPct: 50, anticipo: total * 0.5 };
const cot = { cliente: 'DESARROLLOS INMOBILIARIOS Y CONSTRUCCIONES DEL BAJÍO, S.A. DE C.V.',
  folio: '2608-001', fecha: '16/08/2026', acomodo };

const fotos = Object.fromEntries(partidas.map((p) => [p.id, JPG]));

const doc = propuestaPDF({
  cot, partidas, resumen: resumenPorArea(partidas, acomodo), especificacion,
  cuartos: listaPorCuarto(partidas, acomodo),
  totales, nPzas: partidas.reduce((s, p) => s + p.cantidad, 0), fotos, piezas,
  marca: { logo: null, portada: JPG },
});
const buf = Buffer.from(doc.output('arraybuffer'));
const salida = process.argv[2] || 'propuesta.pdf';
fs.writeFileSync(salida, buf);
console.log(`✓ ${doc.getNumberOfPages()} hojas · ${Math.round(buf.length / 1024)} KB → ${salida}`);
console.log(`  la escalera cuadra: ${Math.abs((precioLista - descuento + maniobras + flete + iva) - total) < 0.01}`);
const porArea = resumenPorArea(partidas, acomodo).reduce((s, b) => s + b.total, 0);
console.log(`  las áreas suman el total de lista: ${porArea === precioLista} (${porArea} vs ${precioLista})`);
