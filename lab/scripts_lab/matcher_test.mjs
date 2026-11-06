// Prueba del MATCHER automático material_solicitado(texto) -> insumo ERP del catálogo.
// Mide precisión contra BOM reales donde el articulo verdadero es conocido.
import { readFileSync } from "node:fs";
const CAT = "/root/.claude/projects/-home-user-costeador-vonhaucke/4ebe1775-de26-5cdd-8f53-1edeaa08f67a/tool-results/mcp-Supabase-execute_sql-1793943419127.txt";

const norm = (s) => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase()
  .replace(/[^a-z0-9\s./x"-]/g," ").replace(/\s+/g," ").trim();
// familia primaria por palabra clave (ordenado: lo más específico primero)
const FAMILIAS = [
  ["superficie_solida",/superficie solida|corian|staron/],["mdf_melamina",/mdf melamina|melamina dos caras|melamina una cara/],
  ["aglomerado",/aglomerado/],["mdf",/\bmdf\b/],["melamina",/melamina/],["laminado",/laminado plastic|laminado/],
  ["chapa_madera",/chapa de madera|chapacinta|chapa /],["canto",/perfil de canto|canto|peabs/],
  ["lamina_inox",/lamina inoxidable|acero inoxidable|inox|inoxidable/],["lamina",/lamina negra|lamina /],
  ["tubular",/tubular|ptr|tubo /],["solera",/solera/],["pintura",/pintura en polvo|pintura/],
  ["acrilico",/acrilico/],["cristal",/cristal|vidrio|templado/],["espuma",/espuma/],["tela",/\btela\b/],["piel",/\bpiel\b/],
  ["jaladera",/jaladera/],["bisagra",/bisagra/],["corredera",/corredera/],["cerradura",/cerradura|cam lock/],
  ["nivelador",/nivelador/],["pija",/\bpija\b/],["tornillo",/tornillo/],["tuerca",/tuerca/],["rondana",/rondana/],
  ["perno",/\bperno\b|minifix/],["taquete",/taquete|taco /],["led",/kit de ilumin|tira led|\bled\b/],
];
const familiaDe = (t) => { for (const [f,re] of FAMILIAS) if (re.test(t)) return f; return "otros"; };
// números significativos (espesor/calibre/dim), sin unidad
const nums = (t) => (t.match(/\d+(?:\.\d+)?/g)||[]).filter(n=>n.length<=4);
const toks = (t) => new Set(norm(t).split(" ").filter(w=>w.length>=3));

// catálogo
let raw = readFileSync(CAT,"utf8");
let esc = raw.slice(raw.indexOf("[", raw.indexOf("<untrusted-data")), raw.lastIndexOf("]")+1);
if (esc.includes('\\"')) esc = JSON.parse('"'+esc+'"');
const cat = JSON.parse(esc).filter(r=>r.precio_compra && Number(r.precio_compra)>0).map(r=>({
  id:r.insumo_id, articulo:(r.articulo||"").toUpperCase(), nombre:r.nombre||"", precio:Number(r.precio_compra),
  nt:toks(r.nombre), nn:new Set(nums(norm(r.nombre))), fam:familiaDe(norm(r.nombre)),
}));
// índice por familia
const porFam = {}; for (const c of cat) (porFam[c.fam]=porFam[c.fam]||[]).push(c);

function match(texto){
  const t = norm(texto), f = familiaDe(t), tt = toks(t), tn = new Set(nums(t));
  const cands = porFam[f] || [];
  if (!cands.length) return null;
  let best=null, bestSc=0, second=0;
  for (const c of cands){
    let ov=0; for (const w of tt) if (c.nt.has(w)) ov++;
    let nov=0; for (const n of tn) if (c.nn.has(n)) nov++;
    // score: solape de tokens + fuerte bonus por calibre/espesor/dim coincidente
    const sc = ov + nov*3;
    if (sc>bestSc){ second=bestSc; bestSc=sc; best=c; } else if (sc>second) second=sc;
  }
  return { best, score:bestSc, margin:bestSc-second, familia:f };
}

// BOM reales (articulo verdadero conocido)
function leerBOM(path, layout){
  const out=[]; const rows=readFileSync(path,"utf8").split("\n").map(l=>l.split(","));
  // parse simple con comillas: usar regex por celdas es frágil; reusamos el patrón de recost
  return out;
}
// usar los CSV ya parseados de recost (articulo, desc) — más simple: releer con parser tolerante
import { createRequire } from "node:module";
function parseCSV(txt){const R=[];let r=[],f="",q=false;for(let i=0;i<txt.length;i++){const c=txt[i];if(q){if(c==='"'){if(txt[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"')q=true;else if(c===","){r.push(f);f="";}else if(c==="\n"){r.push(f);R.push(r);r=[];f="";}else if(c==="\r"){}else f+=c;}if(f.length||r.length){r.push(f);R.push(r);}return R;}
function bom(path, ci_art, ci_desc){
  const rows=parseCSV(readFileSync(path,"utf8")); const out=[];
  for(const r of rows){const ai=r.findIndex(c=>/^M[A-Z0-9]{6,}/.test((c||"").trim())); if(ai<0)continue;
    out.push({articulo:r[ai].trim().toUpperCase(), desc:(r[ai+1]||"").trim()});}
  return out;
}
const sets = [
  ["VENTO","/home/user/costeador-vonhaucke/lab/precios_vento/C-CO-526R__Explo_MP.csv"],
  ["TELCEL","/home/user/costeador-vonhaucke/lab/datos_reales_drive/costeos/CCO320R_DATS_TELCEL/explo_x_id_BOM.csv"],
];
let tot=0, ok=0, binfam=0, nofam=0; const misses=[];
for (const [n,p] of sets){
  for (const l of bom(p)){
    tot++;
    const m = match(l.desc);
    if (!m || !m.best){ nofam++; continue; }
    const correctoArt = m.best.articulo === l.articulo;
    // también "correcto" si el id resuelto tiene el mismo articulo (misma SKU)
    if (correctoArt) ok++; else { if(misses.length<15) misses.push(`${l.articulo} "${l.desc.slice(0,40)}" -> ${m.best.articulo} (${m.best.id}) sc=${m.score} m=${m.margin}`); }
    if (m.best) binfam++;
  }
}
console.log(`BOM renglones: ${tot}`);
console.log(`matcher amarró a MISMO articulo verdadero: ${ok} (${(ok/tot*100).toFixed(1)}%)`);
console.log(`amarró a ALGÚN insumo (misma familia): ${binfam} (${(binfam/tot*100).toFixed(1)}%)`);
console.log(`sin familia reconocida: ${nofam}`);
console.log(`\nMISSES (amarró a otro articulo de la misma familia):`);
for (const x of misses) console.log("  "+x);
