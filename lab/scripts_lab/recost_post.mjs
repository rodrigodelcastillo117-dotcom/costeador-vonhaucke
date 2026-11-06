// Re-costeo por el MOTOR de productos reales completos (BOM real: materiales,
// cantidades, piezas), con el catálogo vigente ACTUAL (ya con octubre), y
// comparación contra el resultado real del workbook. Solo lectura + cómputo.
import { calcular, PARAMETROS_DEFAULT } from '../../src/motor/calculo.js';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const CAT = "/root/.claude/projects/-home-user-costeador-vonhaucke/4ebe1775-de26-5cdd-8f53-1edeaa08f67a/tool-results/mcp-Supabase-execute_sql-1793950073915.txt";
const OUT = "/home/user/costeador-vonhaucke/lab/datos_reales_drive/recost_post";
mkdirSync(OUT, { recursive: true });

const norm = (s) => (s == null ? "" : String(s).trim().toUpperCase());
const num = (s) => { const n = Number(String(s ?? "").replace(/,/g, "").trim()); return Number.isFinite(n) ? n : null; };

function parseCSV(txt) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < txt.length; i++) { const c = txt[i];
    if (q) { if (c === '"') { if (txt[i+1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else if (c === "\r") {} else f += c; }
  if (f.length || row.length) { row.push(f); rows.push(row); } return rows;
}

// catálogo vigente actual: (articulo,opcion) -> {insumo_id, unidad_costeo, seccion, nombre, precio, vigente, cert}
const raw = readFileSync(CAT, "utf8");
let esc = raw.slice(raw.indexOf("[", raw.indexOf("<untrusted-data")), raw.lastIndexOf("]") + 1);
if (esc.includes('\\"')) esc = JSON.parse('"' + esc + '"');
const cat = new Map();
for (const r of JSON.parse(esc)) cat.set(norm(r.articulo) + "|" + norm(r.opcion), r);

// lee un BOM; devuelve filas {articulo, opcion, desc, consumo, wb_price, wb_line}
function leerBOM(path, layout) {
  const out = [];
  for (const r of parseCSV(readFileSync(path, "utf8"))) {
    const ai = r.findIndex((c) => /^M[A-Z0-9]{6,}/.test((c || "").trim()));
    if (ai < 0) continue;
    const g = (off) => r[ai + off];
    let price, cons, line, op;
    if (layout === "vento") { op = g(2); price = num(g(6)); cons = num(g(7)); line = num(g(8)); }
    else { op = ""; price = num(g(4)); cons = num(g(5)); line = num(g(6)); } // telcel
    if (price == null || cons == null) continue;
    out.push({ articulo: norm(g(0)), opcion: norm(op), desc: (g(1) || "").slice(0, 45), consumo: cons, wb_price: price, wb_line: line ?? price * cons });
  }
  return out;
}

function recost(nombre, bom) {
  const componentes = [], insumos = {}, lineas = [];
  let sinMatch = 0, octLineas = 0, octDeltaMoney = 0;
  bom.forEach((l, i) => {
    const c = cat.get(l.articulo + "|" + l.opcion) || cat.get(l.articulo + "|");
    const id = `${l.articulo}#${i}`;
    if (!c || (num(c.precio) ?? num(c.precio_compra)) == null || (num(c.precio) ?? num(c.precio_compra)) <= 0) {
      sinMatch++; lineas.push({ ...l, our_price: "", our_line: "", vigente: "", nota: "sin precio en catálogo" }); return;
    }
    const our = num(c.precio) ?? num(c.precio_compra);
    insumos[id] = { id, nombre: c.nombre || l.desc, seccion: (c.seccion || "otros"), clase: "directa",
                    unidad: c.unidad_costeo, formato: { tipo: "hoja", medida: 1 }, fraccion: true, precio: our };
    componentes.push({ nombre: c.nombre || l.desc, insumoId: id, hojas: l.consumo, piezas: 1 });
    const ourLine = our * l.consumo;
    const esOct = String(c.vigente_desde || "").startsWith("2026-10");
    if (esOct) { octLineas++; octDeltaMoney += (our - l.wb_price) * l.consumo; }
    lineas.push({ ...l, our_price: our, our_line: Math.round(ourLine * 100) / 100, vigente: c.vigente_desde,
                  price_delta_pct: l.wb_price > 0 ? Math.round((our - l.wb_price) / l.wb_price * 1000) / 10 : "", oct: esOct ? "OCT" : "" });
  });
  const r = calcular({ componentes }, 1, insumos, PARAMETROS_DEFAULT);
  const wbMat = bom.reduce((a, l) => a + l.wb_line, 0);
  return { nombre, nLineas: bom.length, matched: bom.length - sinMatch, sinMatch, octLineas, octDeltaMoney,
           wbMat, engMat: r.materialTotal, mo: r.manoObra, gi: r.indirectosFabrica ?? 0,
           fab: r.costoFabricacion ?? r.materialTotal, lineas };
}

const productos = [
  recost("VENTO C-CO-526R (3 exhibidores)", leerBOM("/home/user/costeador-vonhaucke/lab/precios_vento/C-CO-526R__Explo_MP.csv", "vento")),
  recost("TELCEL C-CO-320R DAT'S R5", leerBOM("/home/user/costeador-vonhaucke/lab/datos_reales_drive/costeos/CCO320R_DATS_TELCEL/explo_x_id_BOM.csv", "telcel")),
];

const L = [];
L.push("# Re-costeo por el MOTOR vs resultado real — BOM completo, pieza por pieza, catálogo con octubre");
for (const p of productos) {
  // per-line CSV
  const cols = ["articulo","opcion","desc","consumo","wb_price","our_price","oct","price_delta_pct","wb_line","our_line","vigente","nota"];
  const csv = [cols.join(",")];
  for (const ln of p.lineas) csv.push(cols.map(k => { const v = ln[k] ?? ""; return /[",]/.test(String(v)) ? `"${String(v).replace(/"/g,'""')}"` : v; }).join(","));
  writeFileSync(`${OUT}/recost_${p.nombre.split(" ")[0]}.csv`, csv.join("\n"));
  // separar: huecos (sin precio), outliers (|delta|>500% = error de unidad en catálogo), limpio
  const priced = p.lineas.filter(l=>typeof l.our_price==='number');
  const holes = p.lineas.filter(l=>l.nota);
  const holesWb = holes.reduce((a,l)=>a+l.wb_line,0);
  const outliers = priced.filter(l=>l.wb_price>0 && Math.abs(l.our_price/l.wb_price-1)>5);
  const outImpact = outliers.reduce((a,l)=>a+(l.our_line-l.wb_line),0);
  const clean = priced.filter(l=>!(l.wb_price>0 && Math.abs(l.our_price/l.wb_price-1)>5));
  const cleanWb = clean.reduce((a,l)=>a+l.wb_line,0), cleanEng = clean.reduce((a,l)=>a+l.our_line,0);
  const outArts = [...new Set(outliers.map(l=>l.articulo))];
  L.push(`\n## ${p.nombre}`);
  L.push(`  renglones BOM: ${p.nLineas}  ·  con precio en catálogo: ${p.matched}  ·  SIN precio (huecos): ${p.sinMatch} (= ${holesWb.toFixed(2)} del total real)`);
  L.push(`  renglones cuyo precio ya es de OCTUBRE: ${p.octLineas}`);
  L.push(`  --- crudo (catálogo tal cual) ---`);
  L.push(`  MATERIAL real workbook: ${p.wbMat.toFixed(2)}   motor: ${p.engMat.toFixed(2)}   delta ${(p.engMat-p.wbMat>=0?'+':'')}${(p.engMat-p.wbMat).toFixed(2)} (${((p.engMat-p.wbMat)/p.wbMat*100).toFixed(1)}%)`);
  L.push(`  --- defectos de datos que distorsionan ---`);
  L.push(`  OUTLIERS de catálogo (|Δ|>500%, casi seguro error de unidad): ${outliers.length} renglones, ${outArts.length} artículos (${outArts.join(', ')}) · impacto +${outImpact.toFixed(2)}`);
  L.push(`  HUECOS (BOM sin precio en catálogo): ${holes.length} renglones = ${holesWb.toFixed(2)} que el motor NO cuenta`);
  L.push(`  --- limpio (solo renglones con precio y sin outlier) ---`);
  L.push(`  MATERIAL workbook: ${cleanWb.toFixed(2)}   motor: ${cleanEng.toFixed(2)}   delta ${(cleanEng-cleanWb>=0?'+':'')}${(cleanEng-cleanWb).toFixed(2)} (${cleanWb>0?((cleanEng-cleanWb)/cleanWb*100).toFixed(1):'—'}%)  ← acuerdo real motor vs real`);
  L.push(`  MOTOR costeo completo (crudo): material ${p.engMat.toFixed(2)} + MO(Alba) ${p.mo.toFixed(2)} + indirecto ${Number(p.gi).toFixed(2)} = fabricación ${Number(p.fab).toFixed(2)}`);
  // top divergencias de precio (nuestro vs workbook)
  const div = p.lineas.filter(l=>typeof l.price_delta_pct==='number' && Math.abs(l.price_delta_pct)>=5)
                      .sort((a,b)=>Math.abs(b.price_delta_pct)-Math.abs(a.price_delta_pct)).slice(0,12);
  if (div.length) { L.push(`  mayores diferencias precio catálogo vs workbook:`);
    for (const d of div) L.push(`    ${d.price_delta_pct>0?'+':''}${d.price_delta_pct}%  ${d.articulo}  wb ${d.wb_price} -> cat ${d.our_price} (${d.vigente})${d.oct?' ['+d.oct+']':''}  ${d.desc}`); }
}
const txt = L.join("\n");
writeFileSync(`${OUT}/RECOST_resumen.txt`, txt);
console.log(txt);
