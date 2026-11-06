// VEREDICTO: ¿la diferencia motor vs costeo real es NUESTRA o del costeo real?
// El recost usa el MISMO consumo del workbook en ambos lados, así que la diferencia de
// material es PURAMENTE de precio. Quién tiene razón en el precio se decide por la FECHA
// de la última compra real: precio más nuevo = más correcto. Cierra huecos de genéricos
// (pintura/aglomerado) con el precio promedio real del artículo. Solo lectura + cómputo.
import { readFileSync } from 'node:fs';

const CAT = "/root/.claude/projects/-home-user-costeador-vonhaucke/4ebe1775-de26-5cdd-8f53-1edeaa08f67a/tool-results/mcp-Supabase-execute_sql-1793948927403.txt";
const norm = (s) => (s == null ? "" : String(s).trim().toUpperCase());
const num = (s) => { const n = Number(String(s ?? "").replace(/,/g, "").trim()); return Number.isFinite(n) ? n : null; };
const fecha = (s) => String(s ?? "").trim().split(" ")[0].split("T")[0] || null;

function parseCSV(txt) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < txt.length; i++) { const c = txt[i];
    if (q) { if (c === '"') { if (txt[i+1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else if (c === "\r") {} else f += c; }
  if (f.length || row.length) { row.push(f); rows.push(row); } return rows;
}

// Catálogo: por (articulo|opcion) y por articulo (para promedio de genéricos)
const raw = readFileSync(CAT, "utf8");
let esc = raw.slice(raw.indexOf("[", raw.indexOf("<untrusted-data")), raw.lastIndexOf("]") + 1);
if (esc.includes('\\"')) esc = JSON.parse('"' + esc + '"');
const cat = new Map(); const porArt = new Map();
for (const r of JSON.parse(esc)) {
  const art = norm(r.articulo), op = norm(r.opcion);
  const precio = num(r.precio) ?? num(r.precio_compra);
  if (precio == null || precio <= 0) continue;
  const rec = { precio, fecha: fecha(r.vigente_desde), nombre: r.nombre, unidad: r.unidad_costeo };
  cat.set(art + "|" + op, rec);
  if (!porArt.has(art)) porArt.set(art, []);
  porArt.get(art).push(rec);
}
function precioDe(art, op) {
  let r = cat.get(art + "|" + op) || cat.get(art + "|");
  if (r) return { ...r, via: "exacto" };
  const lista = porArt.get(art);
  if (lista && lista.length) {
    const avg = lista.reduce((a, x) => a + x.precio, 0) / lista.length;
    const fmax = lista.map((x) => x.fecha).filter(Boolean).sort().pop() || null;
    return { precio: Math.round(avg * 100) / 100, fecha: fmax, nombre: lista[0].nombre, via: `promedio ${lista.length} opciones` };
  }
  return null;
}

function leerBOM(path, layout) {
  const out = [];
  for (const r of parseCSV(readFileSync(path, "utf8"))) {
    const ai = r.findIndex((c) => /^M[A-Z]{2}[A-Z0-9]{6,}/.test((c || "").trim()));
    if (ai < 0) continue;
    const g = (o) => r[ai + o];
    let op, wbp, cons, wbf;
    if (layout === "vento") { op = g(2); wbf = fecha(g(5)); wbp = num(g(6)); cons = num(g(7)); }
    else { op = ""; wbf = fecha(g(3)); wbp = num(g(4)); cons = num(g(5)); }
    if (wbp == null || cons == null) continue;
    out.push({ articulo: norm(g(0)), opcion: norm(op), desc: (g(1) || "").slice(0, 42), consumo: cons, wb_price: wbp, wb_fecha: wbf });
  }
  return out;
}

function veredicto(nombre, bom) {
  const clases = { NUESTRO_MAS_NUEVO: { n: 0, money: 0 }, WB_MAS_NUEVO: { n: 0, money: 0 },
    CONFLICTO_FECHA_IGUAL: { n: 0, money: 0 }, IGUAL: { n: 0, money: 0 }, SIN_FECHA: { n: 0, money: 0 }, HUECO: { n: 0, money: 0 } };
  let wbTot = 0, ourTot = 0; const detalle = [];
  for (const l of bom) {
    wbTot += l.wb_price * l.consumo;
    const m = precioDe(l.articulo, l.opcion);
    if (!m) { clases.HUECO.n++; clases.HUECO.money += l.wb_price * l.consumo; detalle.push({ ...l, clase: "HUECO" }); continue; }
    ourTot += m.precio * l.consumo;
    const dMoney = (m.precio - l.wb_price) * l.consumo;
    const dPct = l.wb_price > 0 ? (m.precio - l.wb_price) / l.wb_price : 0;
    let clase;
    if (Math.abs(dPct) <= 0.02) clase = "IGUAL";
    else if (!m.fecha || !l.wb_fecha) clase = "SIN_FECHA";
    else if (m.fecha > l.wb_fecha) clase = "NUESTRO_MAS_NUEVO";
    else if (l.wb_fecha > m.fecha) clase = "WB_MAS_NUEVO";
    else clase = "CONFLICTO_FECHA_IGUAL";   // misma fecha de compra, precio distinto = dato en conflicto
    clases[clase].n++; clases[clase].money += dMoney;
    if (Math.abs(dMoney) >= 20) detalle.push({ ...l, our_price: m.precio, our_fecha: m.fecha, via: m.via, dMoney: Math.round(dMoney * 100) / 100, dPct: Math.round(dPct * 1000) / 10, clase });
  }
  return { nombre, nLineas: bom.length, wbTot, ourTot, clases, detalle: detalle.sort((a, b) => Math.abs(b.dMoney || 0) - Math.abs(a.dMoney || 0)) };
}

const sets = [
  ["VENTO C-CO-526R", "/home/user/costeador-vonhaucke/lab/precios_vento/C-CO-526R__Explo_MP.csv", "vento"],
  ["TELCEL C-CO-320R", "/home/user/costeador-vonhaucke/lab/datos_reales_drive/costeos/CCO320R_DATS_TELCEL/explo_x_id_BOM.csv", "telcel"],
];
for (const [n, p, lay] of sets) {
  const v = veredicto(n, leerBOM(p, lay));
  console.log(`\n═══ ${n} (${v.nLineas} renglones) ═══`);
  console.log(`  MATERIAL real workbook: ${v.wbTot.toFixed(2)}   motor (precio catálogo): ${v.ourTot.toFixed(2)}   Δ ${(v.ourTot - v.wbTot >= 0 ? '+' : '')}${(v.ourTot - v.wbTot).toFixed(2)} (${((v.ourTot - v.wbTot) / v.wbTot * 100).toFixed(1)}%)`);
  console.log(`  ─ ¿de quién es la diferencia? (material = precio, consumo igual en ambos) ─`);
  const C = v.clases;
  console.log(`   NUESTRO precio MÁS NUEVO (real costeo desactualizado): ${C.NUESTRO_MAS_NUEVO.n} renglones · ${C.NUESTRO_MAS_NUEVO.money >= 0 ? '+' : ''}${C.NUESTRO_MAS_NUEVO.money.toFixed(2)}`);
  console.log(`   WORKBOOK más nuevo (vamos atrás, lo refresca compra semanal): ${C.WB_MAS_NUEVO.n} · ${C.WB_MAS_NUEVO.money >= 0 ? '+' : ''}${C.WB_MAS_NUEVO.money.toFixed(2)}`);
  console.log(`   CONFLICTO misma fecha (misma compra, precio distinto → revisar OC): ${C.CONFLICTO_FECHA_IGUAL.n} · ${C.CONFLICTO_FECHA_IGUAL.money >= 0 ? '+' : ''}${C.CONFLICTO_FECHA_IGUAL.money.toFixed(2)}`);
  console.log(`   IGUAL (±2%): ${C.IGUAL.n} · ${C.IGUAL.money.toFixed(2)}`);
  console.log(`   sin fecha comparable: ${C.SIN_FECHA.n} · ${C.SIN_FECHA.money.toFixed(2)}`);
  console.log(`   HUECO (sin precio aún): ${C.HUECO.n} · ${C.HUECO.money.toFixed(2)}`);
  console.log(`  ─ mayores diferencias de precio por renglón ─`);
  for (const d of v.detalle.slice(0, 12)) console.log(`   ${d.clase.padEnd(18)} ${d.dPct > 0 ? '+' : ''}${d.dPct}%  Δ$${d.dMoney}  ${d.articulo}  wb ${d.wb_price}(${d.wb_fecha}) -> ${d.our_price ?? '—'}(${d.our_fecha ?? '—'})  ${d.desc}`);
}
