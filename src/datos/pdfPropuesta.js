// ============================================================================
//  PROPUESTA EN PDF  ·  descarga de verdad, no el diálogo de impresión.
//
//  Rodrigo (2026-08-16): "cuando pongo DESCARGAR PDF, me manda a imprimir, no
//  lo descarga."  Tenía razón: el botón hacía `window.print()`, que abre el
//  diálogo del navegador y deja al vendedor buscando "Guardar como PDF" en un
//  menú. Aquí el archivo se GENERA y se baja, con su nombre.
//
//  Se dibuja con jsPDF en TEXTO VECTORIAL, no rasterizando la pantalla: pesa
//  poco, se puede seleccionar y copiar el texto, y los números salen nítidos a
//  cualquier zoom. A cambio, el documento se arma aquí a mano — por eso este
//  archivo es la fuente de la verdad de cómo se ve la propuesta impresa.
//
//  Todo en milímetros sobre A4 (210 × 297).
// ============================================================================
// Se importa la compilación MINIFICADA a propósito: la app es un solo HTML
// que los vendedores abren en el celular, y el paquete completo de jsPDF le
// sumaba ~800 KB al archivo. Aquí se paga sólo lo que se usa.
import { jsPDF } from 'jspdf/dist/jspdf.es.min.js';

const A4 = { w: 210, h: 297 };
const M = { izq: 16, der: 16, arriba: 16, abajo: 18 };
const ANCHO = A4.w - M.izq - M.der;
const ROJO = [178, 42, 34];
const TINTA = [30, 27, 26];
const GRIS = [116, 110, 104];
const LINEA = [222, 216, 208];

// El signo va ANTES del peso: '-$22,612', no '$-22,612'.
const pesos = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n || 0)).toLocaleString('es-MX');

export function propuestaPDF({ cot, partidas, resumen, especificacion, totales, nPzas, fotos = {} }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = M.arriba;

  // ---- utilidades de página ------------------------------------------------
  const pie = () => {
    const p = doc.getNumberOfPages();
    doc.setPage(p);
    doc.setDrawColor(...LINEA); doc.setLineWidth(0.2);
    doc.line(M.izq, A4.h - M.abajo + 6, A4.w - M.der, A4.h - M.abajo + 6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIS);
    doc.text('Von Haucke · mobiliario de oficina hecho en México', M.izq, A4.h - M.abajo + 11);
    doc.text(`${p}`, A4.w - M.der, A4.h - M.abajo + 11, { align: 'right' });
  };
  // Salto de página cuando lo que sigue ya no cabe. Sin esto los renglones se
  // parten a la mitad o se salen de la hoja.
  const sitio = (alto) => {
    if (y + alto <= A4.h - M.abajo) return;
    pie(); doc.addPage(); y = M.arriba;
  };
  const regla = (grueso = 0.2, color = LINEA) => {
    doc.setDrawColor(...color); doc.setLineWidth(grueso);
    doc.line(M.izq, y, A4.w - M.der, y);
  };

  // ---- PORTADA -------------------------------------------------------------
  doc.setFillColor(...ROJO);
  doc.rect(M.izq, y, ANCHO, 2.4, 'F');
  y += 12;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.setTextColor(...ROJO);
  doc.text('vonhaucke', M.izq, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...ROJO);
  doc.text('MÁS DE 68 AÑOS DE OFICIO', A4.w - M.der, y - 3, { align: 'right' });
  y += 8; regla(0.6, ROJO); y += 10;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
  doc.text('PROPUESTA DE MOBILIARIO', M.izq, y);
  y += 9;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(21); doc.setTextColor(...TINTA);
  doc.text(cot.cliente ? `Preparada para ${cot.cliente}` : 'Propuesta para su proyecto', M.izq, y, { maxWidth: ANCHO });
  y += 9;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...GRIS);
  const meta = [
    cot.folio ? `Folio ${cot.folio}` : null,
    cot.fecha ? `Fecha ${cot.fecha}` : null,
    `${partidas.length} líneas · ${nPzas} piezas`,
    'Vigencia 15 días hábiles',
  ].filter(Boolean).join('   ·   ');
  doc.text(meta, M.izq, y);
  y += 12;

  // ---- RESUMEN POR ÁREA ----------------------------------------------------
  // Igual que en pantalla: un resumen que sólo dice "Sin ubicar en el plano"
  // no es un resumen por área, es ruido. Se omite.
  const hayAreas = resumen?.length && !(resumen.length === 1 && resumen[0].sinUbicar);
  if (hayAreas) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...TINTA);
    doc.text('Resumen del proyecto', M.izq, y);
    y += 3; regla(); y += 7;

    for (const b of resumen) {
      sitio(16 + b.renglones.length * 5);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TINTA);
      doc.text(b.nombre, M.izq, y);
      doc.setFontSize(12);
      doc.text(pesos(b.total), A4.w - M.der, y, { align: 'right' });
      y += 5;
      const esp = [b.m2 > 0 ? `${b.m2} m²` : null, especificacion(b)].filter(Boolean).join(' · ');
      if (esp) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
        const lineas = doc.splitTextToSize(esp, ANCHO - 30);
        doc.text(lineas, M.izq, y);
        y += lineas.length * 4;
      }
      y += 1;
      doc.setFontSize(9); doc.setTextColor(...GRIS);
      for (const r of b.renglones) {
        sitio(6);
        doc.setFont('helvetica', 'normal');
        doc.text(String(r.cantidad), M.izq + 2, y);
        doc.text(doc.splitTextToSize(r.nombre, ANCHO - 46)[0], M.izq + 10, y);
        doc.text(pesos(r.importe), A4.w - M.der, y, { align: 'right' });
        y += 5;
      }
      y += 2; regla(); y += 6;
    }
  }

  // ---- TOTALES (cierran la HOJA 1, junto al resumen) -----------------------
  // Rodrigo: "resumen con precios y final + poner la suma que da más IVA".
  // El cliente ve en una sola hoja qué se le propone por área y cuánto es en
  // total; el desglose pieza por pieza va después.
  y += 4;
  sitio(46);
  regla(); y += 7;
  const fila = (et, val, fuerte = false) => {
    doc.setFont('helvetica', fuerte ? 'bold' : 'normal');
    doc.setFontSize(fuerte ? 12 : 10);
    doc.setTextColor(...(fuerte ? TINTA : GRIS));
    doc.text(et, A4.w - M.der - 46, y, { align: 'right' });
    doc.setTextColor(...TINTA);
    doc.text(pesos(val), A4.w - M.der, y, { align: 'right' });
    y += fuerte ? 8 : 6;
  };
  if (totales.descuento > 0) { fila('Precio de lista', totales.precioLista); fila(`Descuento ${totales.descuentoPct}%`, -totales.descuento); }
  fila('Subtotal', totales.subtotal);
  if (totales.contingencia > 0) fila(`Contingencia ${totales.contingenciaPct}%`, totales.contingencia);
  fila(`IVA ${totales.ivaPct}%`, totales.iva);
  y += 1; regla(); y += 8;
  fila('TOTAL', totales.total, true);

  // ---- DETALLE, EN HOJA APARTE --------------------------------------------
  //  Rodrigo: "en la siguiente: descripción, render, cantidad, precio unitario
  //  y al lado precio final, precio unitario × cantidad."
  //  Las columnas suman los 178 mm útiles del A4.
  // El render tiene que LEERSE: es una propuesta de mobiliario, la foto vende
  // tanto como el precio. 30 mm de columna con la imagen a 28 (4:3 = 21 de
  // alto) y la fila con altura mínima pareja, para que no se vea de escalones.
  const COL = { desc: 70, foto: 30, cant: 14, uni: 30, imp: 34 };
  const X = {};
  X.desc = M.izq;
  X.foto = X.desc + COL.desc;
  X.cant = X.foto + COL.foto + COL.cant;      // derecha de la columna
  X.uni = X.cant + COL.uni;
  X.imp = X.uni + COL.imp;

  const encabezado = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
    doc.text('DESCRIPCIÓN', X.desc, y);
    doc.text('IMAGEN', X.foto, y);
    doc.text('CANT.', X.cant, y, { align: 'right' });
    doc.text('P. UNITARIO', X.uni, y, { align: 'right' });
    doc.text('IMPORTE', X.imp, y, { align: 'right' });
    y += 2.5; regla(); y += 5;
  };

  pie(); doc.addPage(); y = M.arriba;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...TINTA);
  doc.text('Detalle de la propuesta', M.izq, y);
  y += 6;
  encabezado();

  for (const pt of partidas) {
    // 8 mm de aire contra la columna del render: a 4 mm el texto se veía pegado.
    const nombre = doc.splitTextToSize(pt.nombre || '', COL.desc - 8);
    const img = fotos?.[pt.id] || null;
    const altoFila = Math.max(nombre.length * 4.4 + 4, img ? 25 : 11);
    if (y + altoFila > A4.h - M.abajo) { pie(); doc.addPage(); y = M.arriba; encabezado(); }
    const yTexto = y + 3.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...TINTA);
    doc.text(nombre, X.desc, yTexto);
    if (img) {
      // El render se dibuja en su recuadro, sin deformarlo (4:3 del catálogo).
      try { doc.addImage(img, 'JPEG', X.foto, y, COL.foto - 2, (COL.foto - 2) * 0.75); } catch (e) { /* si no se pudo, va sin foto */ }
    }
    doc.text(String(pt.cantidad), X.cant, yTexto, { align: 'right' });
    doc.text(pesos(pt.precioUnitario || 0), X.uni, yTexto, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(pesos((pt.precioUnitario || 0) * pt.cantidad), X.imp, yTexto, { align: 'right' });
    y += altoFila;
    doc.setDrawColor(...LINEA); doc.setLineWidth(0.15);
    doc.line(M.izq, y - 1.5, A4.w - M.der, y - 1.5);
    y += 2;
  }

  // El total se repite al pie del detalle: la hoja tiene que sostenerse sola.
  y += 2;
  if (y + 14 > A4.h - M.abajo) { pie(); doc.addPage(); y = M.arriba; }
  regla(0.5, TINTA); y += 7;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...TINTA);
  doc.text('TOTAL', X.uni, y, { align: 'right' });
  doc.text(pesos(totales.total), X.imp, y, { align: 'right' });
  y += 10;

  // ---- CONDICIONES ---------------------------------------------------------
  y += 4;
  sitio(30);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
  const cond = [
    'Precios en pesos mexicanos. Vigencia de 15 días hábiles.',
    'Tiempo de entrega a convenir según disponibilidad de materiales.',
    'Los importes por área son informativos y suman el total de la propuesta.',
  ];
  for (const c of cond) { sitio(5); doc.text('· ' + c, M.izq, y); y += 5; }

  pie();
  return doc;
}

// Baja los renders del catálogo y los deja en base64 para meterlos al PDF.
// Si alguno no se puede traer, ese renglón sale SIN foto en vez de tumbar la
// descarga entera: el vendedor necesita su PDF aunque falte una imagen.
export async function cargarFotos(partidas, urlDe) {
  const fotos = {};
  await Promise.all((partidas || []).map(async (pt) => {
    const url = urlDe?.(pt);
    if (!url) return;
    try {
      if (url.startsWith('data:')) { fotos[pt.id] = url; return; }
      const r = await fetch(url);
      if (!r.ok) return;
      const b = await r.blob();
      fotos[pt.id] = await new Promise((res) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = () => res(null);
        fr.readAsDataURL(b);
      });
    } catch (e) { /* sin foto, con su renglón completo igual */ }
  }));
  return fotos;
}

// Genera y DESCARGA el archivo. Devuelve el nombre por si hay que decirlo.
export function descargarPropuesta(datos) {
  const doc = propuestaPDF(datos);
  const nombre = ['Propuesta', datos.cot.folio, datos.cot.cliente]
    .filter(Boolean).join(' ').replace(/[\\/:*?"<>|]/g, '').trim() || 'Propuesta Von Haucke';
  doc.save(`${nombre}.pdf`);
  return `${nombre}.pdf`;
}
