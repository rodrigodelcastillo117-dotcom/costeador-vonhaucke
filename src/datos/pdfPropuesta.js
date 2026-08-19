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
/**
 * Acortar el nombre de un mueble PARA EL CLIENTE, sin partir palabras.
 *
 * ⚠️ Los nombres se arman en lenguaje de taller y crecen POR LA COLA:
 *     "Banca doble APP LT 1.50 · 6 usuarios, biombos laterales"
 *     "Eclipse · Escritorio directivo 2.10 m mano derecha"
 * Cortarlos a la brava dejaba «Banca doble APP LT 1.50 · 6 usuarios, bio...» y
 * «Eclipse · Escritorio directivo 2.10 m mano...» en la leyenda del plano —en el
 * documento que recibe el cliente—, que se lee como un error del sistema.
 * Se quita en dos tiempos:
 *   1. Lo que va tras una COMA: eso es lista de accesorios ("…, biombos
 *      laterales"), la parte que de verdad sobra.
 *   2. Palabras ENTERAS desde el final, con puntos suspensivos.
 *
 * ⚠️ NO se corta por el "·". Se intentó y salió peor: el "·" separa la LÍNEA
 * del producto ("Eclipse · Escritorio directivo 2.10 m mano derecha"), así que
 * quitar la cola dejaba **"Eclipse"** a secas — el cliente ya no sabe qué
 * mueble es. Vale más "Eclipse · Escritorio directivo 2.10 m…" que un nombre
 * corto y vacío.
 *
 * @param cabe (texto) => bool — si el texto YA con su cola entra en la columna
 */
export function acortarNombre(nombre, cabe) {
  const entero = String(nombre ?? '').trim();
  if (cabe(entero)) return entero;
  // 1) La lista de accesorios que va tras la coma.
  let s = entero;
  while (s.includes(',')) {
    const corto = s.slice(0, s.lastIndexOf(',')).trim();
    if (corto.split(/\s+/).length < 3) break;   // no dejarlo en un muñón
    s = corto;
    if (cabe(s)) return s;
  }
  // 2) Palabras enteras desde el final. Nunca se parte una palabra a la mitad.
  const pal = s.split(/\s+/);
  while (pal.length > 2) {
    pal.pop();
    const t = pal.join(' ').replace(/[·,\s]+$/, '');
    if (cabe(t + '…')) return t + '…';
  }
  return s;
}

//  HOJA DE MARCA — el intro tipo Von Haucke
//  Una propuesta de mobiliario no compite sólo por precio: compite por quién la
//  manda. Los textos son los de la presentación oficial de la casa.
// ============================================================================
function hojaMarca(doc, A4, M, ANCHO, ROJO, TINTA, GRIS, LINEA, { nueva = true, marca = null } = {}) {
  // Como PORTADA no abre hoja (ya está la primera del documento); a la mitad sí.
  if (nueva) doc.addPage();

  // ⚠️ ESTA HOJA ERA PURO TEXTO Y RODRIGO LA MANDÓ REHACER (2026-08-17):
  // *"es pura letra, no me motiva, se ve cero profesional, ni moderno, ni factor
  // wow"*. Y luego mandó su material oficial —"Ventajas vonhaucke", con foto de
  // fondo y bloques de color— diciendo *"esto podría estar en la portada"*.
  // Así que esta hoja es ESA: los cinco argumentos de la casa, con sus textos
  // tal como él los tiene, sobre la foto. No es decoración: es lo que sostiene
  // el precio cuando el cliente compara.
  const VENT = [
    ['Diseño de clase mundial', 'Empresas de clase mundial con diseño de clase mundial', [138, 160, 205]],
    ['Innovativo · Planeado para el futuro', 'Para atraer y retener personal de talento', [240, 214, 122]],
    ['Imagen corporativa', 'Refleja la solidez e importancia de la empresa', [238, 176, 128]],
    ['Wellness', 'El bienestar de las personas es la parte central del proyecto', [150, 190, 225]],
    ['Sustentable', 'Libre de emisiones · Materiales reciclables · Iluminación eficiente', [166, 206, 143]],
  ];

  // Foto de fondo a sangre, aclarada con un velo blanco para que el texto se lea.
  const foto = marca?.portada || null;
  if (foto) {
    try {
      doc.addImage(foto, 'JPEG', 0, 0, A4.w, A4.h);
      doc.setFillColor(255, 255, 255);
      doc.setGState(new doc.GState({ opacity: 0.82 }));
      doc.rect(0, 0, A4.w, A4.h, 'F');
      doc.setGState(new doc.GState({ opacity: 1 }));
    } catch (e) { /* sin foto, la hoja sigue igual de legible */ }
  }

  // Banda roja con el título, como en su material.
  doc.setFillColor(...ROJO); doc.rect(0, 14, A4.w, 20, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(255, 255, 255);
  doc.text('Ventajas Vonhaucke', M.izq, 27.5);

  let y = 46;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...GRIS);
  const sub = doc.splitTextToSize(
    'Más de 68 años fabricando en México. La colección Vonhaucke es lo último en diseño, '
    + 'funcionalidad y sustentabilidad a nivel internacional, y detrás de cada proyecto hay una '
    + 'planta propia: nosotros diseñamos, fabricamos, entregamos e instalamos.', ANCHO);
  doc.text(sub, M.izq, y);
  y += sub.length * 5.6 + 8;

  // Los cinco bloques de color, en dos hileras (3 + 2) como su lámina.
  const dibujaBloque = (v, x, yy, w, h) => {
    doc.setFillColor(...v[2]);
    doc.setGState(new doc.GState({ opacity: 0.55 }));
    doc.rect(x, yy, w, h, 'F');
    doc.setGState(new doc.GState({ opacity: 1 }));
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...TINTA);
    const tit = doc.splitTextToSize(v[0], w - 10);
    doc.text(tit, x + w / 2, yy + 10, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8); doc.setTextColor(60, 55, 52);
    doc.text(doc.splitTextToSize(v[1], w - 12), x + w / 2, yy + 12 + tit.length * 5, { align: 'center' });
  };
  const hueco = 7;
  const w3 = (ANCHO - hueco * 2) / 3, alto = 44;
  for (let i = 0; i < 3; i++) dibujaBloque(VENT[i], M.izq + i * (w3 + hueco), y, w3, alto);
  const w2 = (ANCHO - hueco) / 2;
  for (let i = 3; i < 5; i++) dibujaBloque(VENT[i], M.izq + (i - 3) * (w2 + hueco), y + alto + hueco, w2, alto);
  y += alto * 2 + hueco * 2 + 12;

  doc.setDrawColor(...LINEA); doc.setLineWidth(0.2);
  doc.line(M.izq, y, A4.w - M.der, y); y += 8;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
  doc.text('ADEMÁS DEL MOBILIARIO', M.izq, y); y += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...TINTA);
  doc.text(doc.splitTextToSize(
    'Acabados arquitectónicos  ·  Cancelería y muros  ·  Almacenamiento  ·  Reconfiguraciones  ·  '
    + 'Mudanzas estratégicas  ·  Asesoría en planeación de espacios  ·  Servicio post-venta  ·  '
    + 'Soluciones financieras vh-renting', ANCHO), M.izq, y);
}

// ============================================================================
//  EL PLANO, CON UN CÍRCULO NUMERADO POR MUEBLE
//  Rodrigo: "señala en qué área va cada cosa con un círculo".
//  Se dibuja en VECTOR desde el mismo acomodo que hizo el proyectista, no como
//  captura de pantalla: se ve nítido impreso y a cualquier zoom. Cada círculo
//  lleva el número de partida, y ese número es el que aparece en el detalle —
//  así el cliente cruza plano y precio sin preguntarle a nadie.
// ============================================================================
function hojaPlano(doc, { acomodo, partidas, piezas }, A4, M, ANCHO, ROJO, TINTA, GRIS, LINEA, pie) {
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

  // ⚠️ EL PLANO SE SALÍA DE LA HOJA. `totalW`/`totalH` se medían sólo con
  // `ancho`/`largo`, pero un cuarto puede empezar en un `x` NEGATIVO respecto al
  // mínimo, y sobre todo los MUEBLES sobresalen del rectángulo de su cuarto. En
  // el PDF de Rodrigo el Área Operativa, la Sala de Juntas y la Recepción
  // quedaban fuera del papel por la izquierda. Ahora la caja se mide con TODO lo
  // que se va a dibujar —cuartos y muebles— y se escala contra eso.
  let bx0 = 0, by0 = 0, bx1 = totalW, by1 = totalH;
  for (const c of coloc) {
    const pz = (piezas || []).find((q) => q.id === c.id); const o = offs[c.area ?? 0];
    if (!pz || !o) continue;
    const girado = (c.rot || 0) % 180 !== 0;
    const pw = girado ? pz.d : pz.w, ph = girado ? pz.w : pz.d;
    bx0 = Math.min(bx0, o.x + c.x); by0 = Math.min(by0, o.y + c.y);
    bx1 = Math.max(bx1, o.x + c.x + pw); by1 = Math.max(by1, o.y + c.y + ph);
  }
  const cajaW = Math.max(1, bx1 - bx0), cajaH = Math.max(1, by1 - by0);

  // Escala para que el plano quepa en el ancho útil y en el alto disponible.
  const altoDisp = A4.h - M.abajo - y - 62;   // se reserva sitio para la leyenda
  const esc = Math.min(ANCHO / cajaW, altoDisp / cajaH);
  const X0 = M.izq + (ANCHO - cajaW * esc) / 2 - bx0 * esc;
  const Y0 = y - by0 * esc;
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
    // ⚠️ NADA SE CAE EN SILENCIO (auditoría 2026-08-19). Antes, si la leyenda
    // no cabía, simplemente dejaba de imprimir renglones (`break`) — el plano
    // seguía mostrando círculos numerados sin su explicación. Mismo criterio
    // que ya usa `hojaCuartos` tres funciones abajo: si no cabe, se abre hoja
    // y se sigue, nunca se corta.
    if (ly > A4.h - M.abajo - 4) {
      pie?.(); doc.addPage(); ly = M.arriba;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GRIS);
      doc.text('QUÉ ES CADA NÚMERO (continuación)', M.izq, ly); ly += 6;
      col = 0;
    }
    const cx = M.izq + col * (colW + 8);
    doc.setFillColor(...ROJO); doc.circle(cx + 2.4, ly - 1.2, 2.4, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.6); doc.setTextColor(255, 255, 255);
    doc.text(String(n), cx + 2.4, ly - 0.3, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...TINTA);
    // Antes se tomaba splitTextToSize(...)[0] y la leyenda quedaba cortada a la
    // mitad de la palabra: «... (2». Se recorta el NOMBRE y el conteo va entero.
    const cola = `  (${veces} en el plano)`;
    const nom = acortarNombre(T(pt.nombre), (t) => doc.getTextWidth(t + cola) <= colW - 12);
    doc.text(nom + cola, cx + 7, ly);
    col = 1 - col;
    if (col === 0) ly += 5.4;
  }
  return true;
}

// ============================================================================
//  QUÉ VA EN CADA CUARTO — la hoja que se lee sin saber leer un plano
//  Rodrigo: "que diga por escrito qué va en cada cuarto (con gavetas y sillas)".
//  El plano de la hoja anterior enseña DÓNDE; ésta dice QUÉ, en español, e
//  incluye lo que el dibujo no puede enseñar: las gavetas viven debajo de la
//  cubierta y no se dibujan nunca.
//  Si el proyectista generó las fotos por área, cada cuarto sale con la suya:
//  es la diferencia entre una lista y una propuesta.
// ============================================================================
function hojaCuartos(doc, { cuartos, escenas, pie }, A4, M, ANCHO, ROJO, TINTA, GRIS, LINEA) {
  const bloques = (cuartos || []).filter((c) => c.renglones?.length);
  // ⚠️ SIN ACOMODO NO HAY ÁREAS QUE CONTAR. El vendedor que toca "no necesito
  // acomodo, ir directo a la propuesta" tiene UN bloque, "Sin ubicar en el
  // plano", con todo adentro: una hoja entera titulada "Qué va en cada área"
  // para decirle al cliente que nada tiene área. Mejor no imprimirla.
  if (!bloques.length || (bloques.length === 1 && bloques[0].sinUbicar)) return false;
  // Y cuando SÍ hay áreas, lo que quedó fuera se dice con un nombre que un
  // cliente entienda, no con lenguaje de plano.
  const titulo = (c) => (c.sinUbicar ? 'Sin área asignada' : c.nombre);
  const imgDe = (nombre) => (escenas || []).find((e) => e.nombre === nombre && e.img)?.img || null;

  doc.addPage();
  let y = M.arriba;
  doc.setFillColor(...ROJO); doc.rect(M.izq, y, ANCHO, 2.4, 'F');
  y += 14;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...TINTA);
  doc.text('Qué va en cada área', M.izq, y); y += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...GRIS);
  doc.text('Lo mismo del plano, en palabras.', M.izq, y);
  y += 10;

  const FOTO = 62;                       // ancho de la foto del área, si la hay
  for (const c of bloques) {
    const img = imgDe(c.nombre);
    const anchoTexto = img ? ANCHO - FOTO - 8 : ANCHO;
    const altoFoto = img ? FOTO * (2 / 3) : 0;         // las escenas salen 3:2
    const alto = Math.max(14 + c.renglones.length * 5, altoFoto + 6);
    // ⚠️ `pie()` ANTES de cada hoja nueva: sin esto, las hojas de en medio de
    // esta sección salían SIN el pie y SIN número de página. Sólo la última lo
    // recibía, del que llama.
    if (y + alto > A4.h - M.abajo) { pie(); doc.addPage(); y = M.arriba; }

    if (img) {
      try {
        doc.addImage(img, 'JPEG', M.izq + anchoTexto + 8, y, FOTO, altoFoto);
        doc.setDrawColor(...LINEA); doc.setLineWidth(0.25);
        doc.rect(M.izq + anchoTexto + 8, y, FOTO, altoFoto);
      } catch (e) { /* sin foto, con su lista completa igual */ }
    }

    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...TINTA);
    doc.text(T(titulo(c)), M.izq, y + 4);
    // ⚠️ El ancho se mide con la fuente del TÍTULO, no con la del metraje: si se
    // mide después de cambiar a 9 pt, sale más corto y los metros se imprimen
    // ENCIMA del nombre del cuarto ("Open space96 m²").
    const anchoNom = doc.getTextWidth(T(titulo(c)));
    if (c.m2 > 0 && !/m²|m2/.test(c.nombre)) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
      doc.text(`${c.m2} m²`, M.izq + anchoNom + 4, y + 4);
    }
    let ly = y + 9;
    if (c.titular) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
      const t = doc.splitTextToSize(T(c.titular), anchoTexto);
      doc.text(t.slice(0, 2), M.izq, ly);
      ly += Math.min(t.length, 2) * 4 + 1;
    }
    for (const r of c.renglones) {
      // ⚠️ NADA SE CAE EN SILENCIO. Aquí había un `break`: un cuarto con muchos
      // renglones perdía los últimos y el cliente recibía su lista incompleta
      // sin que nada lo dijera. Si ya no cabe, se abre hoja y se sigue.
      if (ly > A4.h - M.abajo - 6) { pie(); doc.addPage(); y = M.arriba; ly = y + 4; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...TINTA);
      doc.text(String(r.cantidad), M.izq + 6, ly, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...(r.bajoCubierta ? GRIS : TINTA));
      // El nombre entero no cabe: se recorta el NOMBRE, nunca la nota — que es
      // justo lo que explica por qué esa pieza no aparece en el dibujo.
      // Con la foto al lado, la columna se angosta y la nota larga se comía el
      // nombre ("Gaveta rodante M..."). Primero se acorta la NOTA, que se puede
      // decir en tres palabras; el nombre del producto es lo que el cliente
      // necesita para pedirlo.
      let nota = r.nota ? `  (${r.nota})` : '';
      if (r.nota && doc.getTextWidth(T(r.nombre) + nota) > anchoTexto - 12) nota = '  (bajo la cubierta)';
      const nom = acortarNombre(T(r.nombre), (t) => doc.getTextWidth(t + nota) <= anchoTexto - 12);
      doc.text(nom + T(nota), M.izq + 10, ly);
      ly += 5;
    }
    y = Math.max(ly, y + altoFoto) + 5;
    doc.setDrawColor(...LINEA); doc.setLineWidth(0.2);
    doc.line(M.izq, y - 2.5, A4.w - M.der, y - 2.5);
    y += 3;
  }
  return true;
}

export function propuestaPDF({ cot, partidas, resumen, especificacion, totales, nPzas, fotos = {}, piezas = [], cuartos = [], marca = null }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = M.arriba;

  // ---- utilidades de página ------------------------------------------------
  const pie = () => {
    const p = doc.getNumberOfPages();
    doc.setPage(p);
    doc.setDrawColor(...LINEA); doc.setLineWidth(0.2);
    doc.line(M.izq, A4.h - M.abajo + 6, A4.w - M.der, A4.h - M.abajo + 6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIS);
    doc.text('Vonhaucke · mobiliario de oficina hecho en México', M.izq, A4.h - M.abajo + 11);
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

  // El hero se decide ANTES de dibujar: manda la vista del acomodo de ESTE
  // proyecto, luego la foto de un área suya, y si no hay ninguna la foto de la
  // casa. Va A SANGRE arriba de todo — es la portada, no un encabezado.
  const escenas = (cot?.acomodo?.escenas || []).filter((e) => e?.img);
  const hero = cot?.acomodo?.render3d || escenas[0]?.img || marca?.portada || null;

  // ---- HOJA 1: LA PORTADA ---------------------------------------------------
  // ⚠️ EL ORDEN CAMBIÓ (2026-08-17). "Quiénes somos" era la hoja 1 y es PURO
  // TEXTO: Rodrigo abrió el PDF y dijo *"no viene ninguna imagen, ningún logo,
  // es pura letra, no me motiva, se ve cero profesional… el cierre es
  // importante"*. La primera hoja es lo primero que ve el cliente: va la
  // PORTADA, con el logo, una foto y su nombre. "Quiénes somos" pasa a la 2, que
  // sigue siendo ANTES del precio —que es lo que se cuidaba cuando se subió—.
  // ⚠️ LA FOTO VA A SANGRE (2026-08-17). Rodrigo abrió el PDF: *"es pura letra,
  // no me motiva, se ve cero profesional, ni moderno, ni factor wow. El cierre
  // es importante"*. Una imagen metida en la caja de texto se lee como un
  // documento; una que toca los cuatro bordes se lee como una PORTADA. Si no
  // hay ninguna imagen, la banda va en tinta con el nombre encima: sigue
  // pareciendo portada y no media hoja en blanco.
  const ALTO_BANDA = 118;
  if (hero) {
    try {
      doc.addImage(hero, 'JPEG', 0, 0, A4.w, ALTO_BANDA);
    } catch (e) {
      doc.setFillColor(...TINTA); doc.rect(0, 0, A4.w, ALTO_BANDA, 'F');
    }
  } else {
    doc.setFillColor(...TINTA); doc.rect(0, 0, A4.w, ALTO_BANDA, 'F');
  }
  // Filo rojo de la casa cerrando la banda.
  doc.setFillColor(...ROJO); doc.rect(0, ALTO_BANDA - 3, A4.w, 3, 'F');
  // ⚠️ LA LEYENDA DE LA FOTO VA AQUÍ, PEGADA A SU FOTO (2026-08-17). Se quedó
  // al final de la hoja cuando la foto se subió a sangre, y ahí chocaba con el
  // PIE DE PÁGINA: los dos textos se imprimían encimados en el mismo renglón.
  if (hero) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRIS);
    doc.text(T(cot?.acomodo?.render3d
      ? 'Imagen de referencia del acomodo propuesto.'
      : escenas[0]?.img
        ? `Así se vería ${escenas[0]?.nombre || 'el área'}, con el mobiliario de esta propuesta.`
        : 'Mobiliario Vonhaucke, fabricado en México.'), M.izq, ALTO_BANDA + 6);
  }
  y = ALTO_BANDA + 18;

  doc.setFillColor(...ROJO);
  doc.rect(M.izq, y, ANCHO, 2.4, 'F');
  y += 12;
  // El logo de verdad si se pudo bajar; si no, el wordmark tipográfico.
  if (marca?.logo) {
    try {
      const props = doc.getImageProperties(marca.logo);
      const altoLogo = 11;
      const anchoLogo = Math.min(62, (props.width / props.height) * altoLogo);
      doc.addImage(marca.logo, 'PNG', M.izq, y - 8.5, anchoLogo, altoLogo);
    } catch (e) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.setTextColor(...ROJO);
      doc.text('Vonhaucke', M.izq, y);
    }
  } else {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.setTextColor(...ROJO);
    doc.text('Vonhaucke', M.izq, y);
  }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...ROJO);
  doc.text('MÁS DE 68 AÑOS DE OFICIO', A4.w - M.der, y - 3, { align: 'right' });
  y += 8; regla(0.6, ROJO); y += 10;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
  doc.text('PROPUESTA DE MOBILIARIO', M.izq, y);
  y += 9;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(21); doc.setTextColor(...TINTA);
  // OJO: se mide cuántos renglones ocupa de verdad. Antes se avanzaban 9 mm
  // fijos y con una razón social larga el nombre caía encima del folio.
  const tituloCliente = cot.cliente ? `Preparada para ${T(cot.cliente)}` : 'Propuesta para su proyecto';
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
  // ⚠️ LA FOTO GRANDE YA SE DIBUJÓ A SANGRE ARRIBA, CON SU LEYENDA. Aquí se
  // volvía a dibujar dentro de la caja de texto: la portada salía con la MISMA
  // imagen dos veces y la segunda leyenda chocaba con el pie de página.
  y += 6;

  // La tira de abajo: las áreas si las hay, si no los muebles del proyecto.
  const tira = escenas.length > (hero === escenas[0]?.img ? 1 : 0)
    ? escenas.slice(hero === escenas[0]?.img ? 1 : 0, 4).map((e) => ({ img: e.img, pie: e.nombre, prop: 2 / 3 }))
    : [...new Set(partidas.map((p) => fotos?.[p.id]).filter(Boolean))]
      .slice(0, 4)
      .map((img, i) => ({ img, pie: partidas.find((p) => fotos?.[p.id] === img)?.nombre || '', prop: 0.75 }));
  if (tira.length) {
    y += 6;
    // ⚠️ ALTURA FIJA, ANCHO SEGÚN LA PROPORCIÓN. Repartiendo el ancho entre las
    // que haya, UNA sola foto se dibujaba como un bloque gris de media hoja: dos
    // muebles pueden compartir render y el `Set` deja una. Una tira es una tira
    // aunque traiga una sola imagen.
    const hueco = 6;
    const altoU = 30;
    const anchos = tira.map((t) => altoU / t.prop);
    const total = anchos.reduce((s, w) => s + w, 0) + hueco * (tira.length - 1);
    const k = total > ANCHO ? ANCHO / total : 1;
    if (y + altoU * k + 10 < A4.h - M.abajo) {
      let x = M.izq;
      tira.forEach((t, i) => {
        const w = anchos[i] * k, h = altoU * k;
        try {
          doc.addImage(t.img, 'JPEG', x, y, w, h);
          doc.setDrawColor(...LINEA); doc.setLineWidth(0.25);
          doc.rect(x, y, w, h);
        } catch (e) { /* una foto que no entra no tumba la portada */ }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...GRIS);
        let pie = T(t.pie);
        while (pie.length > 6 && doc.getTextWidth(pie) > w) pie = pie.slice(0, -2);
        if (pie !== T(t.pie)) pie = pie.trimEnd() + '...';
        doc.text(pie, x, y + h + 3.4);
        x += w + hueco * k;
      });
      y += altoU * k + 8;
    }
  }
  // ---- HOJA 2: QUIÉNES SOMOS ------------------------------------------------
  // Baja de la 1 a la 2 —la 1 ahora es la portada, con logo y foto— pero sigue
  // yendo ANTES del precio, que es lo que se cuidaba cuando se subió: quién
  // manda la propuesta se dice antes de cuánto cuesta.
  pie();
  hojaMarca(doc, A4, M, ANCHO, ROJO, TINTA, GRIS, LINEA, { nueva: true, marca });

  // ---- RESUMEN POR ÁREA ----------------------------------------------------
  // Igual que en pantalla: un resumen que sólo dice "Sin ubicar en el plano"
  // no es un resumen por área, es ruido. Se omite.
  const hayAreas = resumen?.length && !(resumen.length === 1 && resumen[0].sinUbicar);
  if (hayAreas) {
    // ⚠️ LA HOJA SE ABRE AQUÍ ADENTRO, NO ANTES (2026-08-19). Antes el
    // `doc.addPage()` estaba pegado a `hojaMarca()`, sin importar si `hayAreas`
    // iba a ser cierto: un proyecto sin acomodo (sin áreas) abría esta hoja
    // igual y no dibujaba NADA en ella — "hoja 3 del PDF viene en blanco
    // completamente" (Rodrigo). Misma lección que ya aplican `hojaPlano` y
    // `hojaCuartos` más abajo: la hoja se abre pegada a su contenido, no antes.
    pie(); doc.addPage(); y = M.arriba;
    // ⚠️ EL TÍTULO NO SE QUEDA SOLO. Cabía justo al final de la portada y el
    // primer bloque se iba a la hoja siguiente: quedaba "Resumen del proyecto"
    // rotulando media hoja en blanco. Es la misma enfermedad que Rodrigo cazó
    // con el TOTAL ("se corta en otra hoja, está siniestro"): un encabezado
    // sólo se imprime si abajo de él va a caber algo.
    sitio(26 + (resumen[0]?.renglones?.length || 0) * 5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...TINTA);
    doc.text('Resumen del proyecto', M.izq, y);
    y += 3; regla(); y += 7;

    for (const b of resumen) {
      sitio(16 + b.renglones.length * 5);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TINTA);
      doc.text(T(b.nombre), M.izq, y);
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
        doc.text(doc.splitTextToSize(T(r.nombre), ANCHO - 46)[0], M.izq + 10, y);
        doc.text(pesos(r.importe), A4.w - M.der, y, { align: 'right' });
        y += 5;
      }
      y += 2; regla(); y += 6;
    }
  }

  // ⚠️ AQUÍ HABÍA UN SEGUNDO JUEGO DE TOTALES (2026-08-17).
  // El documento imprimía Subtotal · Maniobras · Flete · IVA · TOTAL **dos
  // veces**: aquí y otra vez en la hoja de condiciones. Rodrigo: "se corta el
  // total en otra hoja, está siniestro". Y era peor que feo: el resumen se
  // desbordaba y el TOTAL caía SOLO en una hoja con 80% en blanco.
  // Los totales van UNA vez, al final, junto a las condiciones de pago — que es
  // donde un cliente los busca y donde tienen que estar para firmarse.
  y += 4;

  // ---- HOJA DEL PLANO ------------------------------------------------------
  // La hoja de marca YA NO va aquí: se movió al principio. Rodrigo: "la página
  // 3 está ahí de la nada, debería ser la 1". Tenía razón — quién eres se dice
  // ANTES de dar precios, no a la mitad del documento.
  pie();
  const hayPlano = hojaPlano(doc, { acomodo: cot.acomodo, partidas, piezas }, A4, M, ANCHO, ROJO, TINTA, GRIS, LINEA, pie);
  if (hayPlano) pie();
  // Y luego, en palabras: qué va en cada área (con las gavetas, que el plano no
  // puede enseñar porque viven debajo de la cubierta).
  if (hojaCuartos(doc, { cuartos, escenas, pie }, A4, M, ANCHO, ROJO, TINTA, GRIS, LINEA)) pie();
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
    const nombre = doc.splitTextToSize(T(pt.nombre || ''), COL.desc - 8);
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
    // ⚠️ Math.round(-x) NO ES -Math.round(x) (auditoría 2026-08-19). JS
    // redondea los .5 hacia +Infinito: Math.round(-27388.5) da -27388, pero
    // -Math.round(27388.5) da -27389 — un peso de diferencia contra la
    // pantalla (Cotizacion.jsx:222, que SÍ hace -Math.round(descuento)) cada
    // vez que el descuento cae justo en .50 (pasa seguido con 10%/15% redondos).
    // Se pre-redondea aquí, en positivo, ANTES de negar — igual que pantalla.
    totales.descuento > 0 ? [`Descuento de proyecto ${totales.descuentoPct}%`, -Math.round(totales.descuento), false] : null,
    totales.descuento > 0 ? ['Subtotal', totales.subtotal, false] : null,
    totales.contingencia > 0 ? [`Imprevistos de obra ${totales.contingenciaPct}%`, totales.contingencia, false] : null,
    totales.maniobras > 0 ? [`Maniobras e instalación ${totales.maniobrasPct}%`, totales.maniobras, false] : null,
    totales.flete > 0 ? [`Flete ${totales.fletePct}%`, totales.flete, false] : null,
    [`IVA ${totales.ivaPct}%`, totales.iva, false],
  ].filter(Boolean);
  // ⚠️ EL TOTAL SE ARMA CON LOS RENGLONES QUE SE IMPRIMEN, NO CON EL FLOTANTE
  // (2026-08-17). Cada renglón se redondea al pintarlo y el TOTAL venía sin
  // redondear: en la hoja de la FIRMA los renglones sumaban $305,160 y el total
  // decía $305,161. **Un peso, en el documento que el cliente firma.** Un
  // cliente que suma con la calculadora encuentra eso en diez segundos y ya no
  // te cree ningún otro número. Se suman los MISMOS pesos que se ven, así que
  // el papel cuadra siempre; la diferencia contra el flotante nunca pasa de un
  // peso por renglón y va donde tiene que ir: en el total impreso.
  const totalImpreso = escalera
    .filter(([et]) => et !== 'Subtotal')       // el subtotal es un parcial, no suma
    .reduce((a, [, monto]) => a + Math.round(monto), 0);
  escalera.push(['TOTAL', totalImpreso, true]);
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
    // Del total IMPRESO, no del flotante: si no, anticipo + saldo no dan el total
    // que está tres renglones arriba, y es el renglón que decide la firma.
    const antImpreso = Math.round(totalImpreso * (totales.anticipoPct / 100));
    doc.text(`Anticipo ${totales.anticipoPct}%: ${pesos(antImpreso)}  ·  Saldo contra entrega: ${pesos(totalImpreso - antImpreso)}`,
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
    // ⚠️ ESTA NOTA ERA FALSA (2026-08-17). Decía que los importes por área
    // "suman el total", y no: suman la SUMA DE LOS RENGLONES ($273,888), que es
    // antes del descuento, maniobras, flete e IVA. El total es $305,160. Decirle
    // al cliente que sume algo que no da es regalarle una razón para desconfiar.
    'Empaque según proyecto. Los importes por área suman la lista de renglones, antes de descuento, maniobras, flete e IVA.',
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
    .filter(Boolean).join(' ').replace(/[\\/:*?"<>|]/g, '').trim() || 'Propuesta Vonhaucke';
  doc.save(`${nombre}.pdf`);
  return `${nombre}.pdf`;
}

// ⚠️ LA PRIMERA HOJA ES EL CIERRE (Rodrigo, 2026-08-17): *"en la primera página
// no viene ninguna imagen, ningún logo de Vonhaucke. Es pura letra, no me
// motiva, se ve cero profesional, ni moderno, ni factor wow. El cierre es
// importante"*. El logo y una foto de marca viven en el bucket `app/marca`;
// aquí se bajan a base64 para poder meterlos en el PDF. Si la red falla, la
// portada sale sin ellos pero NO se cae: una propuesta sin logo es fea, una
// propuesta que truena no se manda.
const MARCA = 'https://mtuvnbgljwbsaizjjgzs.supabase.co/storage/v1/object/public/app/marca';
const aDataURL = async (url) => {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const b = await r.blob();
    return await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.onerror = () => res(null);
      fr.readAsDataURL(b);
    });
  } catch (e) { return null; }
};

/** Logo y foto de portada de la casa, listos para el PDF. */
export async function cargarMarca() {
  // ⚠️ `showroom.jpg` es el maqueteado de SketchUp de antes de tener fotos: un
  // cuarto gris con muebles de bloques de colores, cero "factor wow". La foto
  // REAL del lounge/showroom VH (la misma que ya usa la ficha de una pieza,
  // `PORTADA_VH` en FichaPDF.jsx) vive en `lounge-vh.jpg`. La portada de la
  // propuesta seguía cayendo en la vieja porque esta ruta nunca se actualizó
  // cuando se subió la foto real.
  const [logo, portada] = await Promise.all([
    aDataURL(`${MARCA}/logo.png`),
    aDataURL(`${MARCA}/lounge-vh.jpg`),
  ]);
  return { logo, portada };
}
