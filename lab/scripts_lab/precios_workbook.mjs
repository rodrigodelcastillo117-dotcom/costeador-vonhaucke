// Extrae de los workbooks VENTO/TELCEL la ÚLTIMA compra por (articulo, opcion):
// fecha_ultima_compra + costo_ultima_compra + unidad. Imprime JSON para comparar
// contra el catálogo y cargar sólo las que sean MÁS NUEVAS que las nuestras.
import { readFileSync } from 'node:fs';
const norm = (s) => (s == null ? "" : String(s).trim().toUpperCase());
const num = (s) => { const n = Number(String(s ?? "").replace(/,/g, "").trim()); return Number.isFinite(n) ? n : null; };
const fecha = (s) => { const d = String(s ?? "").trim().split(" ")[0].split("T")[0]; return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null; };
function parseCSV(txt){const R=[];let r=[],f="",q=false;for(let i=0;i<txt.length;i++){const c=txt[i];if(q){if(c==='"'){if(txt[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"')q=true;else if(c===","){r.push(f);f="";}else if(c==="\n"){r.push(f);R.push(r);r=[];f="";}else if(c==="\r"){}else f+=c;}if(f.length||r.length){r.push(f);R.push(r);}return R;}

function leer(path, layout){
  const out = [];
  for (const r of parseCSV(readFileSync(path,"utf8"))){
    const ai = r.findIndex((c)=>/^M[A-Z]{2}[A-Z0-9]{6,}/.test((c||"").trim()));
    if (ai<0) continue;
    const g=(o)=>r[ai+o];
    let op, f, costo, uni;
    if (layout==="vento"){ op=g(2); uni=g(4); f=fecha(g(5)); costo=num(g(6)); }
    else { op=""; uni=g(2); f=fecha(g(3)); costo=num(g(4)); }
    if (costo==null || costo<=0) continue;
    out.push({ articulo:norm(g(0)), opcion:norm(op==='-'?'':op), fecha:f, costo, unidad:(uni||'').trim() });
  }
  return out;
}

const rows = [
  ...leer("/home/user/costeador-vonhaucke/lab/precios_vento/C-CO-526R__Explo_MP.csv","vento"),
  ...leer("/home/user/costeador-vonhaucke/lab/datos_reales_drive/costeos/CCO320R_DATS_TELCEL/explo_x_id_BOM.csv","telcel"),
];
// última por (articulo|opcion): la de mayor fecha
const m = new Map();
for (const x of rows){
  const k = x.articulo+"|"+x.opcion;
  const p = m.get(k);
  if (!p || (x.fecha||'') > (p.fecha||'')) m.set(k, x);
}
const uniq = [...m.values()].sort((a,b)=>a.articulo.localeCompare(b.articulo));
console.log(JSON.stringify(uniq));
console.error(`articulos únicos: ${uniq.length}, con fecha: ${uniq.filter(x=>x.fecha).length}`);
