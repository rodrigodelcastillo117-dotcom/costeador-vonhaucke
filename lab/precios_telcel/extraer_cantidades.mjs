// Extrae el BOM CUANTIFICADO (con consumo físico) de explo_x_id.csv — los 4 módulos TELCEL.
// Col 18=articulo 19=desc 20=opcion 22=unidad 23=fecha_ult 24=costo_ultima 25=consumo 26=costo_total(=24*25).
// Bounding idéntico a reconstruir_bom_telcel.py: líneas entre marcador id_0X (col15) y "id_0X costo_total:".
import { readFileSync, writeFileSync } from 'node:fs';
const Q = String.fromCharCode(34);
function parse(txt){const rows=[];let row=[],f="",q=false;for(let i=0;i<txt.length;i++){const c=txt[i];if(q){if(c===Q){if(txt[i+1]===Q){f+=Q;i++;}else q=false;}else f+=c;}else{if(c===Q)q=true;else if(c===","){row.push(f);f="";}else if(c==="\n"){row.push(f);rows.push(row);row=[];f="";}else if(c==="\r"){}else f+=c;}}if(f.length||row.length){row.push(f);rows.push(row);}return rows;}
const num=(x)=>{const n=Number(String(x==null?"":x).replace(/,/g,"").replace(/\$/g,""));return Number.isFinite(n)?n:null;};
const MOD={id_01:["TELCEL-VH-HORIZONTAL",4483.13],id_02:["TELCEL-VH-TORRE",2966.15],id_03:["TELCEL-VH-ISLA",3297.84],id_04:["TELCEL-MOD-ALMACEN",3596.14]};
const rows=parse(readFileSync(process.argv[2],"utf8"));
function marker(r){const c15=(r[15]||"").trim();return /^id_0\d$/.test(c15)&&!r.some(c=>/costo_total/.test(c||""))?c15:null;}
function totalId(r){const txt=r.map(c=>c||"").join(" ");const m=txt.match(/(id_0\d)\s+costo_total:\s*([\d.,]+)/);return m?[m[1],num(m[2])]:[null,null];}
const out={};let cur=null,buf=[];
for(const r of rows){
  const mk=marker(r); const [tid,tot]=totalId(r);
  if(mk){cur=mk;buf=[];continue;}
  if(tid){if(MOD[tid]&&tot&&cur===tid)out[tid]={tot,lineas:buf.slice()};cur=null;buf=[];continue;}
  if(!cur)continue;
  const art=(r[18]||"").trim(); if(!art||art.toLowerCase()==="articulo")continue;
  const consumo=num(r[25]), costoUlt=num(r[24]), total=num(r[26]);
  if(consumo&&consumo>0){
    buf.push({articulo:art,opcion:((r[20]||"").trim()==="-"?"":(r[20]||"").trim()),unidad:(r[22]||"").trim(),
      consumo:+consumo.toFixed(4),costo_ultima:costoUlt,total:total!=null?+total.toFixed(2):null,
      desc:(r[19]||"").trim().slice(0,40)});
  }
}
const emit={};
for(const id of Object.keys(MOD)){
  const [clave,mat]=MOD[id]; const d=out[id];
  if(!d){console.log(clave,"SIN BLOQUE");continue;}
  const sumaTotal=+d.lineas.reduce((a,l)=>a+(l.total||0),0).toFixed(2);
  const sumaQtyHist=+d.lineas.reduce((a,l)=>a+(l.consumo*(l.costo_ultima||0)),0).toFixed(2);
  const reconcilia=Math.abs(sumaTotal-mat)<=1.0;
  console.log(`${clave.padEnd(20)} lineas=${String(d.lineas.length).padStart(2)} Σtotal=${sumaTotal.toFixed(2).padStart(9)} Σ(qty*hist)=${sumaQtyHist.toFixed(2).padStart(9)} hoja=${mat.toFixed(2).padStart(9)} ${reconcilia?"RECONCILIA":"NO!!"}`);
  emit[clave]={material_real:mat,reconcilia,lineas:d.lineas};
}
writeFileSync(process.argv[3],JSON.stringify(emit,null,1));
console.log("\nescrito:",process.argv[3]);
