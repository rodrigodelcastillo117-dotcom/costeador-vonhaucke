const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, AlignmentType, HeightRule, Header, Footer, PageNumber,
} = require('docx');
const fs = require('fs');

const INK='1E1B1A', MUT='6B645C', LINE='D8D3CC', ZEBRA='F5F2EE', FILLBG='FFFFFF', HEADFG='FFFFFF', EXBG='EEF4F1', EX='236046';
const FONT='Calibri';
const CONTENT_W=9360;

const AREAS = [
  { area:'Dirección / Contabilidad', color:'2F4858', items:[
    ['Nómina semanal real de planta', 'Calcula el costo-hora real. Hoy está en CERO por seguridad (no puede vivir en el código).', '$ MXN / semana', '—'],
    ['Personal total en planta', 'Base del costo-hora.', '# personas', '—'],
    ['Personal operativo (directo)', 'Separa directo/indirecto para el GIF.', '# personas', '—'],
    ['Lista maestra de familias + su factor real (mo/gif)', 'Saber QUÉ familias faltan calibrar. El formulario de Luis captura una; esto es el universo completo.', 'fracción', 'ALPURA ×1.8 · TELCEL ×1.35'],
  ]},
  { area:'Compras', color:'5A3E2B', items:[
    ['Precios de catálogo Intelisis VIGENTES (refrescar vencidos >24 meses)', 'Pasa un costo de "orientativo/histórico" a certificable (semáforo ámbar→verde).', '$ MXN + fecha', '—'],
    ['Alta en catálogo de insumos que hoy usan precio de estimaciones', 'Que el insumo exista en Intelisis (semáforo gris→verde).', 'Artículo ERP', '—'],
    ['Alta de artículos SIN identidad', 'Cierra la identidad <100%. Ej. las 2 líneas de ALMACÉN hoy marcadas NECESITA_HUMANO.', 'Artículo ERP', 'lámina sin Artículo · cubierta MDF/PVC'],
    ['Clasificación compra_venta / fabricado por categoría', 'Lo ambiguo hoy se bloquea. (También está en el formulario de Luis, Bloque 4.)', 'texto', 'cristal templado → compra_venta'],
  ]},
  { area:'Ingeniería / Producción', color:'33503A', items:[
    ['Desarrollos CAD (largo × ancho real) de piezas fabricadas sin geometría', 'El motor costea la pieza sin inventar dimensiones; sin esto queda PENDIENTE.', 'mm × mm', '700 × 400'],
    ['Merma / aprovechamiento real de lámina por calibre y formato', 'Hoy se usa una merma política (6.94% en tubular D2); falta la real por material.', '%', '6.94% (D2, política)'],
    ['Estándares de tiempo (prep + por pieza) y tarifa $/min', 'Costo por operaciones. Ya está pedido en el formulario de Luis (Bloque 2) — referencia aquí.', 'min · $/min', 'ver formulario Luis'],
  ]},
];

const P = (runs,opt={}) => new Paragraph({
  alignment:opt.align||AlignmentType.LEFT, spacing:{after:opt.after??0,before:opt.before??0,line:opt.line??248},
  children:(Array.isArray(runs)?runs:[runs]).map(t=>typeof t==='string'
    ? new TextRun({text:t,font:FONT,size:opt.size||19,bold:!!opt.bold,italics:!!opt.italics,color:opt.color||INK}):t),
});
const cell=(children,{w,bg,pad=80}={})=>new TableCell({
  width:{size:w,type:WidthType.DXA}, shading:bg?{type:ShadingType.CLEAR,color:'auto',fill:bg}:undefined,
  margins:{top:pad,bottom:pad,left:100,right:100}, verticalAlign:'center',
  children:Array.isArray(children)?children:[children],
});
function allBorders(){const b={style:BorderStyle.SINGLE,size:4,color:LINE};return{top:b,bottom:b,left:b,right:b,insideHorizontal:b,insideVertical:b};}
const spacer=(h=120)=>new Paragraph({spacing:{after:h},children:[new TextRun({text:'',font:FONT,size:8})]});

const kids=[];
kids.push(new Paragraph({spacing:{after:40},children:[new TextRun({text:'COSTEAR — Datos adicionales por área',font:FONT,size:38,bold:true,color:INK})]}));
kids.push(new Paragraph({spacing:{after:40},border:{bottom:{style:BorderStyle.SINGLE,size:10,color:'2F4858',space:6}},
  children:[new TextRun({text:'Von Haucke · datos de planta y catálogo · complemento al formulario de Luis',font:FONT,size:20,color:MUT})]}));
kids.push(spacer(140));
kids.push(new Table({
  columnWidths:[CONTENT_W],width:{size:CONTENT_W,type:WidthType.DXA},
  borders:{top:{style:BorderStyle.SINGLE,size:4,color:LINE},bottom:{style:BorderStyle.SINGLE,size:4,color:LINE},left:{style:BorderStyle.SINGLE,size:24,color:'2F4858'},right:{style:BorderStyle.SINGLE,size:4,color:LINE}},
  rows:[new TableRow({children:[cell([P([
    new TextRun({text:'Qué es esto. ',font:FONT,size:19,bold:true,color:INK}),
    new TextRun({text:'Datos que el costeador necesita ADEMÁS de los 4 bloques del formulario que ya tiene Luis. Cada renglón dice qué dato, por qué, en qué unidad y un ejemplo. Agrupados por el área que lo tiene que llenar. Lo que falte queda PRELIMINAR; el motor no inventa.',font:FONT,size:19,color:INK}),
  ],{line:264})],{w:CONTENT_W,bg:'F7F9F8',pad:140})]})],
}));

const W=[2000,2900,1060,1600]; // Dato, Por qué, Unidad, Ejemplo
const colLabels=['Dato','Por qué se necesita','Unidad','Ejemplo'];
const captureW=[CONTENT_W];

for(const a of AREAS){
  // banda de área
  kids.push(new Table({columnWidths:[CONTENT_W],width:{size:CONTENT_W,type:WidthType.DXA},
    borders:{top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE}},
    rows:[new TableRow({cantSplit:true,children:[cell(P([
      new TextRun({text:'Área responsable:  ',font:FONT,size:17,bold:true,color:HEADFG}),
      new TextRun({text:a.area,font:FONT,size:20,bold:true,color:HEADFG}),
    ]),{w:CONTENT_W,bg:a.color,pad:110})]})]}));
  // tabla de items (referencia) con fila de captura por item
  const header=new TableRow({tableHeader:true,cantSplit:true,children:colLabels.map((l,i)=>cell(P(l,{bold:true,size:16,color:MUT}),{w:W[i],bg:ZEBRA}))});
  const rows=[header];
  a.items.forEach((it,idx)=>{
    const base=idx%2?FILLBG:'FBFAF8';
    rows.push(new TableRow({cantSplit:true,children:[
      cell(P(it[0],{size:17,bold:true}),{w:W[0],bg:base}),
      cell(P(it[1],{size:16,color:MUT}),{w:W[1],bg:base}),
      cell(P(it[2],{size:16,color:MUT}),{w:W[2],bg:base}),
      cell(P(it[3],{size:16,color:EX,italics:true}),{w:W[3],bg:EXBG}),
    ]}));
  });
  kids.push(new Table({columnWidths:W,width:{size:CONTENT_W,type:WidthType.DXA},borders:allBorders(),rows}));
  // espacio de captura del área
  kids.push(P('Captura / estatus del área:',{bold:true,size:16,before:80,after:50,color:a.color}));
  kids.push(new Table({columnWidths:captureW,width:{size:CONTENT_W,type:WidthType.DXA},borders:allBorders(),
    rows:[new TableRow({cantSplit:true,height:{value:900,rule:HeightRule.ATLEAST},children:[cell(P('',{size:18}),{w:CONTENT_W,bg:FILLBG})]})]}));
  // responsable/firma del área
  const sgW=[1700,2980,1700,2980];
  kids.push(new Table({columnWidths:sgW,width:{size:CONTENT_W,type:WidthType.DXA},borders:allBorders(),
    rows:[new TableRow({cantSplit:true,height:{value:420,rule:HeightRule.ATLEAST},children:[
      cell(P('Responsable',{bold:true,size:15}),{w:sgW[0],bg:ZEBRA}), cell(P('',{size:16}),{w:sgW[1]}),
      cell(P('Fecha',{bold:true,size:15}),{w:sgW[2],bg:ZEBRA}), cell(P('',{size:16}),{w:sgW[3]}),
    ]})]}));
  kids.push(spacer(170));
}

kids.push(P('Nota: ningún dato se inventa. Un dato sin capturar deja ese costo en PRELIMINAR hasta que el área responsable lo entregue y Dirección/Contabilidad lo apruebe.',{size:16,color:MUT,italics:true,before:40,line:252}));

const doc=new Document({
  creator:'Equipo COSTEAR', title:'COSTEAR — Datos adicionales por área',
  styles:{default:{document:{run:{font:FONT,size:19,color:INK}}}},
  sections:[{
    properties:{page:{size:{width:12240,height:15840},margin:{top:1300,bottom:1200,left:1440,right:1440}}},
    headers:{default:new Header({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:'Von Haucke · COSTEAR · datos por área',font:FONT,size:15,color:MUT})]})]})},
    footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Página ',font:FONT,size:15,color:MUT}),new TextRun({children:[PageNumber.CURRENT],font:FONT,size:15,color:MUT})]})]})},
    children:kids,
  }],
});
Packer.toBuffer(doc).then(b=>{fs.writeFileSync(process.argv[2],b);console.log('WROTE',process.argv[2],b.length);});
