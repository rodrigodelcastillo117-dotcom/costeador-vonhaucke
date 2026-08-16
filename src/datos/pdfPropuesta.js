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

// ⚠️ jsPDF dibuja con las 14 fuentes base de PDF (Helvetica), que NO tienen el
// menos tipográfico "−", ni las comillas curvas, ni la raya larga. Cuando se
// cuela uno, el visor imprime basura: en la propuesta salía «" $28,393» donde
// debía decir «-$28,393», y eso lo ve el cliente. Todo texto pasa por aquí.
const T = (v) => String(v ?? '')
  .replace(/[\u2212\u2013\u2014]/g, '-')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201C\u201D]/g, '"')
  .replace(/\u2026/g, '...');


// ============================================================================
//  HOJA DE MARCA — el intro tipo Von Haucke
//  Una propuesta de mobiliario no compite sólo por precio: compite por quién la
//  manda. Los textos son los de la presentación oficial de la casa.
// ============================================================================
function hojaMarca(doc, A4, M, ANCHO, ROJO, TINTA, GRIS, LINEA) {
  doc.addPage();
  let y = M.arriba;
  doc.setFillColor(...ROJO); doc.rect(M.izq, y, ANCHO, 2.4, 'F');
  y += 16;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
  doc.text('QUIÉNES SOMOS', M.izq, y);
  y += 12;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor(...TINTA);
  const lead = doc.splitTextToSize(
    'Somos los pioneros en el diseño y la producción de sistemas modulares para oficina en México.',
    ANCHO - 20);
  doc.text(lead, M.izq, y);
  y += lead.length * 8 + 6;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...GRIS);
  const sub = doc.splitTextToSize(
    'Más de 68 años fabricando en México. La colección vonhaucke es lo último en diseño, ' +
    'funcionalidad y sustentabilidad a nivel internacional, y detrás de cada proyecto hay una ' +
    'planta propia: nosotros diseñamos, fabricamos, entregamos e instalamos.', ANCHO - 14);
  doc.text(sub, M.izq, y);
  y += sub.length * 5.6 + 12;

  // Cuatro ventajas en cuadrícula 2×2.
  const VENT = [
    ['Diseño de clase mundial', 'Empresas de clase mundial merecen espacios a su altura.'],
    ['Bienestar de las personas', 'Ergonomía, acústica y luz pensadas para quien pasa ahí el día.'],
    ['Sustentable', 'Materiales reciclables, libre de emisiones, iluminación eficiente.'],
    ['Imagen corporativa', 'El espacio comunica la solidez de la empresa antes que nadie hable.'],
  ];
  const colW = (ANCHO - 10) / 2;
  for (let i = 0; i < VENT.length; i++) {
    const cx = M.izq + (i % 2) * (colW + 10);
    const cy = y + Math.floor(i / 2) * 34;
    doc.setDrawColor(...ROJO); doc.setLineWidth(1.4);
    doc.line(cx, cy, cx, cy + 20);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TINTA);
    doc.text(VENT[i][0], cx + 5, cy + 5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
    doc.text(doc.splitTextToSize(VENT[i][1], colW - 8), cx + 5, cy + 12);
  }
  y += 34 * 2 + 8;

  doc.setDrawColor(...LINEA); doc.setLineWidth(0.2);
  doc.line(M.izq, y, A4.w - M.der, y); y += 8;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
  doc.text('ADEMÁS DEL MOBILIARIO', M.izq, y); y += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...TINTA);
  doc.text(doc.splitTextToSize(
    'Acabados arquitectónicos  ·  Cancelería y muros  ·  Almacenamiento  ·  Reconfiguraciones  ·  ' +
    'Mudanzas estratégicas  ·  Asesoría en planeación de espacios  ·  Servicio post-venta  ·  ' +
    'Soluciones financieras vh-renting', ANCHO), M.izq, y);
}

// ============================================================================
//  EL PLANO, CON UN CÍRCULO NUMERADO POR MUEBLE
//  Rodrigo: "señala en qué área va cada cosa con un círculo".
//  Se dibuja en VECTOR desde el mismo acomodo que hizo el proyectista, no como
//  captura de pantalla: se ve nítido impreso y a cualquier zoom. Cada círculo
//  lleva el número de partida, y ese número es el que aparece en el detalle —
//  así el cliente cruza plano y precio sin preguntarle a nadie.
// ============================================================================
function hojaPlano(doc, { acomodo, partidas, piezas }, A4, M, ANCHO, ROJO, TINTA, GRIS, LINEA) {
  const areas = acomodo?.areas || [];
  const coloc = acomodo?.plan?.colocacion || [];
  if (!areas.length || !coloc.length) return false;

  // Mismo acomodo de áreas que usa la pantalla: si traen x/y reales se respetan,
  // si no se acomodan en renglones. Todo en mm.
  const MURO = 300;
  let offs, totalW, totalH;
  const reales = areas.every((a) => Number.isFinite(a.x) && Number.isFinite(a.y));
  if (reales) {
    const minX = Math.min(...areas.map((a) => a.x)), minY = Math.min(...areas.map((a) => a.y));
    offs = areas.map((a) => ({ x: a.x - minX, y: a.y - minY }));
    totalW = Math.max(...areas.map((a, i) => offs[i].x + a.ancho));
    totalH = Math.max(...areas.map((a, i) => offs[i].y + a.largo));
  } else {
    const objetivo = Math.max(...areas.map((a) => a.ancho), Math.sqrt(areas.reduce((s, a) => s + a.ancho * a.largo, 0) * 1.7));
    offs = []; let x = 0, yy = 0, rowH = 0; totalW = 0;
    areas.forEach((a, i) => {
      if (x > 0 && x + a.ancho > objetivo + 1) { x = 0; yy += rowH + MURO; rowH = 0; }
      offs[i] = { x, y: yy }; x += a.ancho + MURO; rowH = Math.max(rowH, a.largo);
      totalW = Math.max(totalW, x - MURO);
    });
    totalH = yy + rowH;
  }

  doc.addPage();
  let y = M.arriba;
  doc.setFillColor(...ROJO); doc.rect(M.izq, y, ANCHO, 2.4, 'F');
  y += 14;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...TINTA);
  doc.text('Dónde va cada cosa', M.izq, y); y += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...GRIS);
  doc.text('El número de cada círculo es el mismo del detalle de la página siguiente.', M.izq, y);
  y += 8;

  // Escala para que el plano quepa en el ancho útil y en el alto disponible.
  const altoDisp = A4.h - M.abajo - y - 62;   // se reserva sitio para la leyenda
  const esc = Math.min(ANCHO / totalW, altoDisp / totalH);
  const X0 = M.izq + (ANCHO - totalW * esc) / 2;
  const Y0 = y;
  const px = (mm) => X0 + mm * esc;
  const py = (mm) => Y0 + mm * esc;

  // Los cuartos.
  for (let i = 0; i < areas.length; i++) {
    const a = areas[i], o = offs[i];
    doc.setFillColor(250, 249, 247); doc.setDrawColor(...TINTA); doc.setLineWidth(0.5);
    doc.rect(px(o.x), py(o.y), a.ancho * esc, a.largo * esc, 'FD');
  }

  // Cada mueble, con su círculo. El número sale del ORDEN de la partida, que es
  // el mismo del detalle.
  const numDe = Object.fromEntries((partidas || []).map((p, i) => [p.id, i + 1]));
  const byId = Object.fromEntries((piezas || []).map((p) => [p.id, p]));
  const partidaDe = (idPieza) => String(idPieza).split('-').slice(0, -1).join('-');
  const usados = new Map();
  for (const c of coloc) {
    const pieza = byId[c.id]; const o = offs[c.area ?? 0];
    if (!pieza || !o) continue;
    const girado = (c.rot || 0) % 180 !== 0;
    const pw = (girado ? pieza.d : pieza.w) * esc;
    const ph = (girado ? pieza.w : pieza.d) * esc;
    const n = numDe[partidaDe(c.id)];
    if (n) usados.set(n, (usados.get(n) || 0) + 1);
    // Recorte al cuarto: si el acomodo dejó una pieza sobresaliendo, se dibuja
    // sólo la parte de adentro. Una propuesta con muebles atravesando el muro se
    // ve mal hecha aunque el precio esté bien.
    const a = areas[c.area ?? 0]; if (!a) continue;
    const x0 = Math.max(o.x + c.x, o.x), y0 = Math.max(o.y + c.y, o.y);
    const x1 = Math.min(o.x + c.x + (girado ? pieza.d : pieza.w), o.x + a.ancho);
    const y1 = Math.min(o.y + c.y + (girado ? pieza.w : pieza.d), o.y + a.largo);
    if (x1 - x0 < 60 || y1 - y0 < 60) continue;   // quedó fuera: no se dibuja
    const x = px(x0), yy = py(y0), pwv = (x1 - x0) * esc, phv = (y1 - y0) * esc;
    doc.setFillColor(226, 221, 214); doc.setDrawColor(...GRIS); doc.setLineWidth(0.2);
    doc.rect(x, yy, pwv, phv, 'FD');
    if (!n) continue;
    // El círculo, en el centro del mueble.
    const r = Math.max(1.9, Math.min(3.1, Math.min(pwv, phv) / 2.4));
    doc.setFillColor(...ROJO); doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.35);
    doc.circle(x + pwv / 2, yy + phv / 2, r, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(Math.max(4.8, r * 2.1)); doc.setTextColor(255, 255, 255);
    doc.text(String(n), x + pwv / 2, yy + phv / 2 + r * 0.36, { align: 'center' });
  }

  // LOS RÓTULOS VAN AL FINAL, encima de todo y sobre una cajita blanca. Antes se
  // dibujaban primero y un mueble los tapaba: "SALA DE JUNTAS" quedaba ilegible.
  for (let i = 0; i < areas.length; i++) {
    const a = areas[i], o = offs[i];
    const rot = T(String(a.nombre || `Area ${i + 1}`).toUpperCase());
    const med = `${(a.ancho / 1000).toFixed(2)} x ${(a.largo / 1000).toFixed(2)} m`;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    const anchoRot = Math.max(doc.getTextWidth(rot), doc.getTextWidth(med) * 0.87) + 4;
    doc.setFillColor(255, 255, 255); doc.setDrawColor(...LINEA); doc.setLineWidth(0.2);
    doc.rect(px(o.x) + 1.2, py(o.y) + 1.2, anchoRot, 9.4, 'FD');
    doc.setTextColor(...TINTA);
    doc.text(rot, px(o.x) + 3.2, py(o.y) + 5.2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...GRIS);
    doc.text(med, px(o.x) + 3.2, py(o.y) + 9);
  }

  // La leyenda: número → qué es → cuántos hay en el plano.
  let ly = Y0 + totalH * esc + 10;
  doc.setDrawColor(...LINEA); doc.setLineWidth(0.2);
  doc.line(M.izq, ly - 5, A4.w - M.der, ly - 5);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GRIS);
  doc.text('QUÉ ES CADA NÚMERO', M.izq, ly); ly += 6;
  const colW = ANCHO / 2 - 4;
  let col = 0;
  for (const [n, veces] of [...usados.entries()].sort((a, b) => a[0] - b[0])) {
    const pt = (partidas || [])[n - 1]; if (!pt) continue;
    const cx = M.izq + col * (colW + 8);
    doc.setFillColor(...ROJO); doc.circle(cx + 2.4, ly - 1.2, 2.4, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.6); doc.setTextColor(255, 255, 255);
    doc.text(String(n), cx + 2.4, ly - 0.3, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...TINTA);
    // Antes se tomaba splitTextToSize(...)[0] y la leyenda quedaba cortada a la
    // mitad de la palabra: «... (2». Se recorta el NOMBRE y el conteo va entero.
    const cola = `  (${veces} en el plano)`;
    let nom = T(pt.nombre);
    while (nom.length > 8 && doc.getTextWidth(nom + cola) > colW - 12) nom = nom.slice(0, -2);
    if (nom !== T(pt.nombre)) nom = nom.trimEnd() + '...';
    doc.text(nom + cola, cx + 7, ly);
    col = 1 - col;
    if (col === 0) ly += 5.4;
    if (ly > A4.h - M.abajo - 4) break;
  }
  return true;
}

export function propuestaPDF({ cot, partidas, resumen, especificacion, totales, nPzas, fotos = {}, piezas = [] }) {
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
  // OJO: se mide cuántos renglones ocupa de verdad. Antes se avanzaban 9 mm
  // fijos y con una razón social larga el nombre caía encima del folio.
  const tituloCliente = cot.cliente ? `Preparada para ${cot.cliente}` : 'Propuesta para su proyecto';
  const renglonesTitulo = doc.splitTextToSize(tituloCliente, ANCHO);
  doc.text(renglonesTitulo, M.izq, y);
  y += 9 + (renglonesTitulo.length - 1) * 8.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...GRIS);
  const meta = [
    cot.folio ? `Folio ${cot.folio}` : null,
    cot.fecha ? `Fecha ${cot.fecha}` : null,
    `${partidas.length} líneas · ${nPzas} piezas`,
    'Vigencia 15 días hábiles',
  ].filter(Boolean).join('   ·   ');
  doc.text(T(meta), M.izq, y);
  const hero = cot?.acomodo?.render3d || null;
  if (hero) {
    y += 8;
    try {
      // 16:9 a todo el ancho útil. Marco fino para que no flote.
      const altoHero = ANCHO * 0.5;
      doc.addImage(hero, 'JPEG', M.izq, y, ANCHO, altoHero);
      doc.setDrawColor(...LINEA); doc.setLineWidth(0.3);
      doc.rect(M.izq, y, ANCHO, altoHero);
      y += altoHero + 3;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRIS);
      doc.text('Imagen de referencia del acomodo propuesto.', M.izq, y);
      y += 6;
    } catch (e) { /* si la imagen no se pudo dibujar, la hoja sigue igual */ }
  }
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
  // ⚠️ Aquí vivía el mismo error que en la hoja de detalle: se imprimían
  // Subtotal e IVA y se saltaban maniobras y flete, así que la cuenta a la vista
  // NO daba el TOTAL de abajo. Quien recibe una propuesta suma con calculadora.
  if (totales.descuento > 0) { fila('Precio de lista', totales.precioLista); fila(`Descuento ${totales.descuentoPct}%`, -totales.descuento); }
  fila('Subtotal', totales.subtotal);
  if (totales.contingencia > 0) fila(`Imprevistos de obra ${totales.contingenciaPct}%`, totales.contingencia);
  if (totales.maniobras > 0) fila(`Maniobras e instalación ${totales.maniobrasPct}%`, totales.maniobras);
  if (totales.flete > 0) fila(`Flete ${totales.fletePct}%`, totales.flete);
  fila(`IVA ${totales.ivaPct}%`, totales.iva);
  y += 1; regla(); y += 8;
  fila('TOTAL', totales.total, true);

  // ---- HOJA DE MARCA + HOJA DEL PLANO --------------------------------------
  // Van entre el resumen y el detalle: primero quién manda la propuesta, luego
  // dónde va cada cosa, y sólo después el precio pieza por pieza. Es el orden en
  // que un cliente lee una propuesta, no el orden en que la armamos nosotros.
  pie();
  hojaMarca(doc, A4, M, ANCHO, ROJO, TINTA, GRIS, LINEA);
  pie();
  const hayPlano = hojaPlano(doc, { acomodo: cot.acomodo, partidas, piezas }, A4, M, ANCHO, ROJO, TINTA, GRIS, LINEA);
  if (hayPlano) pie();
  // El detalle abre su propia hoja más abajo: aquí NO se agrega una, o sale en blanco.

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

  // La hoja tiene que SOSTENERSE SOLA: quien la recibe suma la columna con una
  // calculadora, y si el total de abajo no es esa suma, la propuesta pierde
  // credibilidad antes de que nadie discuta un precio. Por eso va la escalera
  // completa —suma, descuento, subtotal, maniobras, flete, IVA— y no un TOTAL
  // suelto que venía de otra cuenta.
  y += 2;
  const escalera = [
    ['Suma de los renglones', totales.precioLista, false],
    totales.descuento > 0 ? [`Descuento de proyecto ${totales.descuentoPct}%`, -totales.descuento, false] : null,
    totales.descuento > 0 ? ['Subtotal', totales.subtotal, false] : null,
    totales.contingencia > 0 ? [`Imprevistos de obra ${totales.contingenciaPct}%`, totales.contingencia, false] : null,
    totales.maniobras > 0 ? [`Maniobras e instalación ${totales.maniobrasPct}%`, totales.maniobras, false] : null,
    totales.flete > 0 ? [`Flete ${totales.fletePct}%`, totales.flete, false] : null,
    [`IVA ${totales.ivaPct}%`, totales.iva, false],
    ['TOTAL', totales.total, true],
  ].filter(Boolean);
  if (y + 8 * escalera.length + 12 > A4.h - M.abajo) { pie(); doc.addPage(); y = M.arriba; }
  regla(0.5, TINTA); y += 7;
  for (const [etiqueta, monto, fuerte] of escalera) {
    if (fuerte) { doc.setDrawColor(...TINTA); doc.setLineWidth(0.4); doc.line(X.uni - 44, y - 3.5, A4.w - M.der, y - 3.5); y += 3; }
    doc.setFont('helvetica', fuerte ? 'bold' : 'normal');
    doc.setFontSize(fuerte ? 12 : 9.5);
    doc.setTextColor(...(fuerte ? TINTA : GRIS));
    doc.text(etiqueta, X.uni, y, { align: 'right' });
    doc.setTextColor(...TINTA);
    doc.text(T((monto < 0 ? '-' : '') + pesos(Math.abs(monto))), X.imp, y, { align: 'right' });
    y += fuerte ? 9 : 6;
  }
  // El anticipo va aquí porque es la condición que decide si se firma o no.
  if (totales.anticipoPct) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
    doc.text(`Anticipo ${totales.anticipoPct}%: ${pesos(totales.anticipo)}  ·  Saldo contra entrega: ${pesos(totales.total - totales.anticipo)}`,
      A4.w - M.der, y, { align: 'right' });
    y += 8;
  }

  // ---- CONDICIONES ---------------------------------------------------------
  y += 4;
  sitio(30);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
  // El PDF que se DESCARGA era más pobre que el de pantalla: le faltaban el
  // bloque de firma, la razón social y el 50/50. El cliente recibía un documento
  // que no podía aceptar aunque quisiera, y tenía que pedir otro.
  const cond = [
    `Precios en pesos mexicanos. El total YA incluye IVA del ${totales.ivaPct}%.`,
    'Vigencia de esta propuesta: 15 días hábiles.',
    totales.anticipoPct
      ? `Condiciones de pago: ${totales.anticipoPct}% de anticipo y ${100 - totales.anticipoPct}% contra entrega.`
      : null,
    totales.maniobras > 0
      ? 'Las maniobras e instalación ya están incluidas en el total. Maniobras foráneas se cotizan por evento.'
      : 'Instalación y maniobras se cotizan por separado.',
    'Tiempo de entrega a convenir según disponibilidad de materiales.',
    'Empaque según proyecto. Los importes por área son informativos y suman el total.',
    'En maderas y mármoles puede haber variación de color y veta por naturaleza del material.',
  ].filter(Boolean);
  for (const c of cond) { sitio(5); doc.text('· ' + c, M.izq, y); y += 5; }

  // ---- ACEPTACIÓN — sin esto la propuesta no se puede firmar ----------------
  y += 8;
  sitio(34);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
  doc.text('ACEPTACIÓN DE CONFORMIDAD', M.izq, y);
  y += 16;
  const anchoFirma = (ANCHO - 14) / 2;
  doc.setDrawColor(...TINTA); doc.setLineWidth(0.3);
  doc.line(M.izq, y, M.izq + anchoFirma, y);
  doc.line(M.izq + anchoFirma + 14, y, A4.w - M.der, y);
  y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIS);
  const quienFirma = doc.splitTextToSize(T(cot.cliente ? `${cot.cliente} - nombre y firma` : 'Nombre y firma'), anchoFirma - 2);
  doc.text(quienFirma.slice(0, 2), M.izq, y);
  doc.text('Fecha', M.izq + anchoFirma + 14, y);
  y += (quienFirma.length > 1 ? 4 : 0);
  y += 10;
  doc.setFontSize(7.5);
  doc.text('APARATOS ELECTROMECÁNICOS VON HAUCKE, S.A. DE C.V.  ·  RFC AEH841221234  ·  Paseo de la Reforma 284, Piso 24, Col. Juárez, CDMX, C.P. 06600  ·  Tel. (55) 5999 9200  ·  www.vonhaucke.mx',
    M.izq, y, { maxWidth: ANCHO });

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
