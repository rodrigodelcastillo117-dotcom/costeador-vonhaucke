const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, AlignmentType, HeightRule, Header, Footer, PageNumber,
} = require('docx');
const fs = require('fs');

const INK='1E1B1A', MUT='6B645C', ACC='2F4858', LINE='D8D3CC', ZEBRA='F5F2EE', FILLBG='FFFFFF', HEADBG='2F4858', HEADFG='FFFFFF', OKBG='EAF3EC', OK='236046', WARN='9A5B12', WARNBG='FBF1E2';
const FONT='Calibri';
const CONTENT_W=9360;

// Medición real (vitest contra fixtures + motor, 2026-11-11). NO editar a mano.
const DATA = [
  { m:'HORIZONTAL', fam:'TELCEL', mat:'4,483.13', real:'6,052.23', rec:'6,052.23', d:'0%', f:'mo 0.1 / gif 0.25', id:'100%', ok:true },
  { m:'TORRE',      fam:'TELCEL', mat:'2,966.15', real:'4,004.30', rec:'4,004.30', d:'0%', f:'mo 0.1 / gif 0.25', id:'100%', ok:true },
  { m:'ISLA',       fam:'TELCEL', mat:'3,297.84', real:'4,452.08', rec:'4,452.08', d:'0%', f:'mo 0.1 / gif 0.25', id:'100%', ok:true },
  { m:'ALMACÉN',    fam:'TELCEL', mat:'3,596.14', real:'4,854.79', rec:'4,854.79', d:'0%', f:'mo 0.1 / gif 0.25', id:'67.4%', ok:false },
  { m:'ENTCBCALP',  fam:'ALPURA', mat:'12,315.65', real:'18,749.37', rec:'18,749.37', d:'0%', f:'política ×1.8 / ×1.06', id:'100%', ok:true },
  { m:'COPETE 516R',fam:'ALPURA', mat:'460.57',  real:'829.01',   rec:'829.03',   d:'0%*', f:'política ×1.8 / ×1.06', id:'100%', ok:true },
];

const P = (runs, opt={}) => new Paragraph({
  alignment: opt.align||AlignmentType.LEFT, spacing:{ after:opt.after??0, before:opt.before??0, line:opt.line??252 },
  children:(Array.isArray(runs)?runs:[runs]).map(t => typeof t==='string'
    ? new TextRun({ text:t, font:FONT, size:opt.size||19, bold:!!opt.bold, italics:!!opt.italics, color:opt.color||INK }) : t),
});
const cell = (children,{w,bg,pad=80,align}={}) => new TableCell({
  width:{size:w,type:WidthType.DXA}, shading:bg?{type:ShadingType.CLEAR,color:'auto',fill:bg}:undefined,
  margins:{top:pad,bottom:pad,left:100,right:100}, verticalAlign:'center',
  children:(Array.isArray(children)?children:[children]).map(p=>align?new Paragraph({alignment:align,spacing:{line:240},children:p.options?.children||[]}):p),
});
function allBorders(){ const b={style:BorderStyle.SINGLE,size:4,color:LINE}; return {top:b,bottom:b,left:b,right:b,insideHorizontal:b,insideVertical:b}; }
const spacer=(h=120)=>new Paragraph({spacing:{after:h},children:[new TextRun({text:'',font:FONT,size:8})]});

const kids=[];
kids.push(new Paragraph({ spacing:{after:40}, children:[new TextRun({text:'COSTEAR — Evidencia de precisión',font:FONT,size:40,bold:true,color:INK})]}));
kids.push(new Paragraph({ spacing:{after:40}, border:{bottom:{style:BorderStyle.SINGLE,size:10,color:ACC,space:6}},
  children:[new TextRun({text:'Von Haucke · reconstrucción del motor vs. costo real de fábrica · 6 muebles reales',font:FONT,size:20,color:MUT})]}));
kids.push(spacer(150));

kids.push(new Table({
  columnWidths:[CONTENT_W], width:{size:CONTENT_W,type:WidthType.DXA},
  borders:{top:{style:BorderStyle.SINGLE,size:4,color:LINE},bottom:{style:BorderStyle.SINGLE,size:4,color:LINE},left:{style:BorderStyle.SINGLE,size:24,color:OK},right:{style:BorderStyle.SINGLE,size:4,color:LINE}},
  rows:[new TableRow({children:[cell([P([
    new TextRun({text:'Qué muestra. ',font:FONT,size:19,bold:true,color:INK}),
    new TextRun({text:'El motor de COSTEAR tomó 6 muebles con costo real de fábrica conocido y reconstruyó su costo. Con el factor real de cada familia, reconstruye ',font:FONT,size:19,color:INK}),
    new TextRun({text:'al centavo (Δ 0%)',font:FONT,size:19,bold:true,color:OK}),
    new TextRun({text:'. La precisión vive en el factor de la familia, no en el motor.',font:FONT,size:19,color:INK}),
  ],{line:264})],{w:CONTENT_W,bg:'F2F8F3',pad:140})]})],
}));
kids.push(spacer(140));

// Tabla de evidencia
const W=[1560,980,1300,1300,720,1900,1600];
const H=['Mueble','Material $','Costo fab real $','Reconstruido $','Δ%','Factor real usado','Identidad'];
const header=new TableRow({tableHeader:true,cantSplit:true,children:H.map((h,i)=>cell(P(h,{bold:true,color:HEADFG,size:17}),{w:W[i],bg:HEADBG}))});
const rows=[header];
DATA.forEach((r,idx)=>{
  const base=idx%2?ZEBRA:FILLBG;
  rows.push(new TableRow({cantSplit:true,height:{value:470,rule:HeightRule.ATLEAST},children:[
    cell([P(r.m,{bold:true,size:18}),P(r.fam,{size:14,color:MUT})],{w:W[0],bg:base}),
    cell(P(r.mat,{size:17,color:MUT}),{w:W[1],bg:base}),
    cell(P(r.real,{size:17,color:MUT}),{w:W[2],bg:base}),
    cell(P(r.rec,{size:17,bold:true}),{w:W[3],bg:base}),
    cell(P(r.d,{size:18,bold:true,color:OK}),{w:W[4],bg:OKBG}),
    cell(P(r.f,{size:16,color:MUT}),{w:W[5],bg:base}),
    cell(P(r.id,{size:17,bold:true,color:r.ok?OK:WARN}),{w:W[6],bg:r.ok?base:WARNBG}),
  ]}));
});
kids.push(new Table({columnWidths:W,width:{size:CONTENT_W,type:WidthType.DXA},borders:allBorders(),rows}));
kids.push(P('* COPETE: ±$0.02 por redondeo de la hoja. Δ% = (reconstruido − real) / real.',{size:15,color:MUT,before:80,italics:true}));
kids.push(spacer(140));

// Qué prueba / qué NO prueba
const colW=[4680,4680];
const listP=(t)=>P([new TextRun({text:'•  ',font:FONT,size:18,color:MUT}),new TextRun({text:t,font:FONT,size:18,color:INK})],{after:60,line:248});
kids.push(new Table({
  columnWidths:colW,width:{size:CONTENT_W,type:WidthType.DXA},
  borders:{top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE},insideHorizontal:{style:BorderStyle.NONE},insideVertical:{style:BorderStyle.NONE}},
  rows:[new TableRow({children:[
    cell([
      P('Qué prueba',{bold:true,size:20,color:OK,after:80}),
      listP('El modelo reconstruye el costo real al 0% con el factor real de la familia (6/6).'),
      listP('Es determinista: mismo número al reabrir y recostear (sin drift).'),
      listP('Las familias ALPURA (×1.8/×1.06) y TELCEL (×1.35) ya tienen su factor real.'),
    ],{w:colW[0],bg:FILLBG,pad:60}),
    cell([
      P('Qué NO prueba',{bold:true,size:20,color:WARN,after:80}),
      listP('Familias SIN factor real cargado: quedan PRELIMINAR, el motor no inventa.'),
      listP('No sustituye una demostración independiente con un mueble nuevo hecha por personal de Von Haucke.'),
      listP('Identidad <100% (ALMACÉN 67.4%): 2 líneas sin alta de Compras; el total reconcilia, pero esas líneas no se certifican.'),
    ],{w:colW[1],bg:FILLBG,pad:60}),
  ]})],
}));
kids.push(spacer(120));

// Fuentes
kids.push(new Table({
  columnWidths:[CONTENT_W],width:{size:CONTENT_W,type:WidthType.DXA},borders:allBorders(),
  rows:[new TableRow({children:[cell([
    P([new TextRun({text:'Fuentes de los datos reales.  ',font:FONT,size:16,bold:true,color:INK}),
       new TextRun({text:'TELCEL (Horizontal/Torre/Isla/Almacén): reconstruido de explo_x_id C-CO-320R. ',font:FONT,size:16,color:MUT}),
       new TextRun({text:'ALPURA (ENTCBCALP/Copete): hojas reales del depto. de estimaciones C-CO-517R y C-CO-516R. ',font:FONT,size:16,color:MUT}),
       new TextRun({text:'Motor v2026-10-14b. Medición: 2026-11-11.',font:FONT,size:16,color:MUT})],{line:240})
  ],{w:CONTENT_W,bg:ZEBRA,pad:110})]})],
}));
kids.push(spacer(140));

// Validación del auditor
kids.push(P('Validación del auditor',{bold:true,size:22,before:80,after:80}));
const sgW=[2000,7360];
kids.push(new Table({columnWidths:sgW,width:{size:CONTENT_W,type:WidthType.DXA},borders:allBorders(),
  rows:[['Nombre',''],['Observaciones',''],['Fecha',''],['Firma','']].map(r=>new TableRow({cantSplit:true,height:{value:460,rule:HeightRule.ATLEAST},children:[
    cell(P(r[0],{bold:true,size:18}),{w:sgW[0],bg:ZEBRA}), cell(P('',{size:18}),{w:sgW[1]}),
  ]}))}));

const doc=new Document({
  creator:'Equipo COSTEAR', title:'COSTEAR — Evidencia de precisión',
  styles:{default:{document:{run:{font:FONT,size:19,color:INK}}}},
  sections:[{
    properties:{page:{size:{width:12240,height:15840},margin:{top:1300,bottom:1200,left:1440,right:1440}}},
    headers:{default:new Header({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:'Von Haucke · COSTEAR · evidencia de precisión',font:FONT,size:15,color:MUT})]})]})},
    footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Página ',font:FONT,size:15,color:MUT}),new TextRun({children:[PageNumber.CURRENT],font:FONT,size:15,color:MUT})]})]})},
    children:kids,
  }],
});
Packer.toBuffer(doc).then(b=>{ fs.writeFileSync(process.argv[2],b); console.log('WROTE',process.argv[2],b.length); });
