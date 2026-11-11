const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, AlignmentType, HeightRule,
  PageOrientation, Header, Footer, PageNumber,
} = require('docx');
const fs = require('fs');

const INK = '1E1B1A', MUT = '6B645C', ACC = '2F4858', LINE = 'D8D3CC',
      HEADBG = '2F4858', HEADFG = 'FFFFFF', ZEBRA = 'F5F2EE', FILLBG = 'FFFFFF', EXBG = 'EEF4F1';
const FONT = 'Calibri';
const CONTENT_W = 9360; // US Letter, 1" margins

const cell = (children, { w, bg, align = AlignmentType.LEFT, pad = 90 } = {}) => new TableCell({
  width: { size: w, type: WidthType.DXA },
  shading: bg ? { type: ShadingType.CLEAR, color: 'auto', fill: bg } : undefined,
  margins: { top: pad, bottom: pad, left: 110, right: 110 },
  children: Array.isArray(children) ? children : [children],
  verticalAlign: 'center',
});

const P = (text, opt = {}) => new Paragraph({
  alignment: opt.align || AlignmentType.LEFT,
  spacing: { after: opt.after ?? 0, before: opt.before ?? 0, line: opt.line ?? 252 },
  children: (Array.isArray(text) ? text : [text]).map((t) =>
    typeof t === 'string'
      ? new TextRun({ text: t, font: FONT, size: opt.size || 19, bold: !!opt.bold, italics: !!opt.italics, color: opt.color || INK })
      : t),
});

const headRow = (labels, widths) => new TableRow({
  tableHeader: true,
  cantSplit: true,
  children: labels.map((l, i) => cell(
    P(l, { bold: true, color: HEADFG, size: 18, align: AlignmentType.LEFT }),
    { w: widths[i], bg: HEADBG })),
});

// Reference/spec table (with example column shaded)
function specTable(rows) {
  const W = [1700, 1000, 1550, 1450, 3660];
  const header = headRow(['Campo', 'Unidad', 'Fuente', 'Aprobador', 'Ejemplo (real)'], W);
  const body = rows.map((r, idx) => new TableRow({
    cantSplit: true,
    children: r.map((txt, i) => cell(
      P(txt, { size: 18, color: i === 0 ? INK : (i === 4 ? '236046' : MUT), bold: i === 0 }),
      { w: W[i], bg: i === 4 ? EXBG : (idx % 2 ? ZEBRA : FILLBG) })),
  }));
  return new Table({
    columnWidths: W, width: { size: CONTENT_W, type: WidthType.DXA },
    borders: allBorders(), rows: [header, ...body],
  });
}

// Capture table: header + optional pre-filled example row + N blank rows the auditor fills
function captureTable(labels, widths, blankRows, exampleRow) {
  const header = headRow(labels, widths);
  const rows = [header];
  if (exampleRow) {
    rows.push(new TableRow({
      cantSplit: true,
      height: { value: 420, rule: HeightRule.ATLEAST },
      children: exampleRow.map((txt, i) => cell(
        P(txt, { size: 18, italics: true, color: '8A8178' }),
        { w: widths[i], bg: 'FBF4E9' })),
    }));
  }
  for (let n = 0; n < blankRows; n++) {
    rows.push(new TableRow({
      cantSplit: true,
      height: { value: 420, rule: HeightRule.ATLEAST },
      children: widths.map((w, i) => cell(P('', { size: 19 }), { w, bg: n % 2 ? ZEBRA : FILLBG })),
    }));
  }
  return new Table({ columnWidths: widths, width: { size: CONTENT_W, type: WidthType.DXA }, borders: allBorders(), rows });
}

// "Comentarios del auditor" — labelled lined box
function commentsBox() {
  const out = [new Paragraph({ spacing: { before: 100, after: 50 },
    children: [new TextRun({ text: 'Comentarios del auditor:', font: FONT, size: 18, bold: true, color: ACC })] })];
  out.push(new Table({
    columnWidths: [CONTENT_W], width: { size: CONTENT_W, type: WidthType.DXA }, borders: allBorders(),
    rows: [new TableRow({ cantSplit: true, height: { value: 760, rule: HeightRule.ATLEAST },
      children: [cell(P('', { size: 19 }), { w: CONTENT_W, bg: FILLBG })] })],
  }));
  return out;
}

function allBorders() {
  const b = { style: BorderStyle.SINGLE, size: 4, color: LINE };
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
}

const spacer = (h = 120) => new Paragraph({ spacing: { after: h }, children: [new TextRun({ text: '', font: FONT, size: 8 })] });

function blockTitle(n, title, quien) {
  return new Paragraph({
    spacing: { before: 300, after: 60 },
    children: [
      new TextRun({ text: `${n}. `, font: FONT, size: 26, bold: true, color: ACC }),
      new TextRun({ text: title, font: FONT, size: 26, bold: true, color: INK }),
      new TextRun({ text: `   ·   ${quien}`, font: FONT, size: 18, bold: true, color: ACC }),
    ],
  });
}

// ---- document body ----
const kids = [];

// Title
kids.push(new Paragraph({
  spacing: { after: 40 },
  children: [new TextRun({ text: 'COSTEAR — Datos para calibración al 100%', font: FONT, size: 40, bold: true, color: INK })],
}));
kids.push(new Paragraph({
  spacing: { after: 40 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: ACC, space: 6 } },
  children: [new TextRun({ text: 'Von Haucke · Formulario de captura para auditoría', font: FONT, size: 20, color: MUT })],
}));
kids.push(spacer(160));

// Para / De / Fecha line
const metaW = [1400, 7960];
kids.push(new Table({
  columnWidths: metaW, width: { size: CONTENT_W, type: WidthType.DXA },
  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'FFFFFF' }, insideVertical: { style: BorderStyle.NONE } },
  rows: [
    ['Para:', 'Luis (auditor)'],
    ['De:', 'Equipo COSTEAR'],
    ['Fecha:', '____ / ____ / 2026'],
    ['Objetivo:', 'Capturar los 4 datos de fábrica que faltan para calibrar el motor y pasar de aceptación preliminar a aceptación industrial.'],
  ].map((r) => new TableRow({ children: [
    cell(P(r[0], { bold: true, size: 19 }), { w: metaW[0], pad: 30 }),
    cell(P(r[1], { size: 19, color: MUT }), { w: metaW[1], pad: 30 }),
  ]})),
}));
kids.push(spacer(120));

// Intro box
kids.push(new Table({
  columnWidths: [CONTENT_W], width: { size: CONTENT_W, type: WidthType.DXA },
  borders: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE }, bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE }, left: { style: BorderStyle.SINGLE, size: 24, color: ACC }, right: { style: BorderStyle.SINGLE, size: 4, color: LINE } },
  rows: [new TableRow({ children: [cell([
    P([
      new TextRun({ text: 'Cómo llenarlo. ', font: FONT, size: 19, bold: true, color: INK }),
      new TextRun({ text: 'Cada bloque tiene primero una tabla de referencia (qué es cada campo, con un ejemplo real) y debajo una tabla en blanco para capturar los datos. Llena solo lo que tengas; con el ', font: FONT, size: 19, color: INK }),
      new TextRun({ text: 'Bloque 1 de una sola familia', font: FONT, size: 19, bold: true, color: INK }),
      new TextRun({ text: ' y el ', font: FONT, size: 19, color: INK }),
      new TextRun({ text: 'Bloque 4', font: FONT, size: 19, bold: true, color: INK }),
      new TextRun({ text: ' ya se puede empezar. Lo que falte queda marcado como PRELIMINAR; el motor nunca inventa un dato.', font: FONT, size: 19, color: INK }),
    ], { after: 0, line: 264 }),
  ], { w: CONTENT_W, bg: 'F7F9F8', pad: 140 })] })],
}));

// ===== Block 1 =====
kids.push(blockTitle(1, 'Factores de fabricación por familia', 'Dirección / Contabilidad'));
kids.push(P('El dato que más mueve la aguja: hoy el motor sobrecostea ~33% sin calibrar. Captura 3–5 muebles por familia con su costo real; el sistema deriva los factores. Si ya tienen factor_mo y factor_gif, mejor.', { size: 18, color: MUT, after: 120, italics: true }));
kids.push(specTable([
  ['clave + familia', 'texto', 'catálogo de producto', '—', 'ENTCBCALP · "muebles ALPURA"'],
  ['material_real', '$ MXN', 'costeo cerrado / OC', 'Dirección', '12,315.65'],
  ['cos_fab_real (total)', '$ MXN', 'cierre de fabricación', 'Dirección', '18,749.37'],
  ['factor_mo (opcional)', 'fracción', 'hoja de estimación', 'Dirección', '0.1287'],
  ['factor_gif (opcional)', 'fracción', 'hoja de estimación', 'Dirección', '0.3937'],
]));
kids.push(P('Captura aquí (la primera fila es un ejemplo, bórrala al usar):', { bold: true, size: 18, before: 120, after: 60 }));
kids.push(captureTable(
  ['Clave', 'Familia', 'Material real $', 'Costo fab. real $', 'factor_mo', 'factor_gif'],
  [1560, 1800, 1500, 1600, 1450, 1450], 8,
  ['ENTCBCALP', 'muebles ALPURA', '12,315.65', '18,749.37', '0.1287', '0.3937']));
kids.push(...commentsBox());

// ===== Block 2 =====
kids.push(blockTitle(2, 'Estándares de tiempo (routing)', 'Ingeniería'));
kids.push(P('Opcional para el objetivo. Da el costo por operaciones como alternativa al factor. El código se niega a inventar tiempos.', { size: 18, color: MUT, after: 120, italics: true }));
kids.push(specTable([
  ['centro', 'texto', 'layout de planta', 'Ingeniería', 'Soldadura'],
  ['operacion', 'texto', 'ruta de fabricación', 'Ingeniería', 'Unir cuerpo'],
  ['preparacion_min', 'min / lote', 'estudio de tiempos', 'Dirección', '15'],
  ['tiempo_pieza_min', 'min / pieza', 'estudio de tiempos', 'Dirección', '2.5'],
  ['tarifa_mxn_min', '$ / min', 'nómina + overhead', 'Dirección', '8.00'],
]));
kids.push(P('Captura aquí:', { bold: true, size: 18, before: 120, after: 60 }));
kids.push(captureTable(
  ['Centro', 'Operación', 'Prep. (min/lote)', 'Tiempo pieza (min)', 'Tarifa ($/min)'],
  [1900, 2460, 1700, 1700, 1600], 8,
  ['Soldadura', 'Unir cuerpo', '15', '2.5', '8.00']));
kids.push(...commentsBox());

// ===== Block 3 =====
kids.push(blockTitle(3, 'Referencias de costo de fábrica', 'Contabilidad'));
kids.push(P('Solo para MEDIR la precisión (comparar lo reconstruido contra lo real). NO entra al cálculo.', { size: 18, color: MUT, after: 120, italics: true }));
kids.push(specTable([
  ['clave', 'texto', 'orden de producción', '—', 'TELCEL-VH-TORRE'],
  ['costo_fabricacion_real', '$ MXN', 'cierre OP / contabilidad', 'Contabilidad', '3,277.60'],
  ['mes / OC (trazabilidad)', 'fecha / folio', 'contabilidad', '—', 'OP-2026-0214'],
]));
kids.push(P('Captura aquí:', { bold: true, size: 18, before: 120, after: 60 }));
kids.push(captureTable(
  ['Clave', 'Costo fab. real $', 'Mes / OC (folio)'],
  [3360, 3000, 3000], 6,
  ['TELCEL-VH-TORRE', '3,277.60', 'OP-2026-0214']));
kids.push(...commentsBox());

// ===== Block 4 =====
kids.push(blockTitle(4, 'Clasificación de terceros', 'Compras'));
kids.push(P('Por categoría (patrón), no por insumo. Hoy lo ambiguo se bloquea en vez de inventar; con esto, fluye. ~1 hora de trabajo.', { size: 18, color: MUT, after: 120, italics: true }));
kids.push(specTable([
  ['categoria (patrón)', 'texto', 'catálogo ERP', 'Compras', '"cristal templado"'],
  ['clasificacion', 'compra_venta / fabricado', 'política VH', 'Compras', 'compra_venta (×1.06)'],
  ['nota (opcional)', 'texto', '—', '—', '"OC proveedor vidriería X"'],
]));
kids.push(P('Captura aquí  (escribe en "Clasificación": compra_venta  o  fabricado):', { bold: true, size: 18, before: 120, after: 60 }));
kids.push(captureTable(
  ['Categoría / patrón', 'Clasificación (compra_venta / fabricado)', 'Nota'],
  [3100, 3660, 2600], 10,
  ['cristal templado', 'compra_venta', 'OC proveedor vidriería X']));
kids.push(...commentsBox());

// ===== Sign-off =====
kids.push(new Paragraph({ spacing: { before: 360, after: 80 }, children: [new TextRun({ text: 'Validación', font: FONT, size: 24, bold: true, color: INK })] }));
const sgW = [2000, 7360];
kids.push(new Table({
  columnWidths: sgW, width: { size: CONTENT_W, type: WidthType.DXA }, borders: allBorders(),
  rows: [
    ['Nombre', ''],
    ['Puesto / área', ''],
    ['Fecha', ''],
    ['Firma', ''],
  ].map((r) => new TableRow({ height: { value: 460, rule: HeightRule.ATLEAST }, children: [
    cell(P(r[0], { bold: true, size: 19 }), { w: sgW[0], bg: ZEBRA }),
    cell(P('', { size: 19 }), { w: sgW[1] }),
  ]})),
}));
kids.push(spacer(120));
kids.push(P('Nota: este formulario pide datos reales de fábrica. Ningún precio, tiempo o factor debe inventarse; un campo sin dato se deja en blanco y el costeador lo trata como PRELIMINAR hasta que haya evidencia aprobada.', { size: 17, color: MUT, italics: true, line: 252 }));

const doc = new Document({
  creator: 'Equipo COSTEAR',
  title: 'COSTEAR — Datos para calibración al 100%',
  styles: {
    default: {
      document: { run: { font: FONT, size: 19, color: INK } },
    },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1300, bottom: 1200, left: 1440, right: 1440 },
      },
    },
    headers: {
      default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: 'Von Haucke · COSTEAR · confidencial', font: FONT, size: 15, color: MUT })],
      })] }),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Página ', font: FONT, size: 15, color: MUT }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 15, color: MUT })],
      })] }),
    },
    children: kids,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(process.argv[2], buf);
  console.log('WROTE', process.argv[2], buf.length, 'bytes');
});
