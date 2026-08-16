// ============================================================================
//  ¿Los presupuestos SIN renglón de descuento traen lista BRUTA o ya NETA?
//  No se puede contestar leyendo un documento solo. Sí se puede contrastando el
//  MISMO producto entre un documento que sí trae el −40% y uno que no.
//  Si la razón sale ~1.0 → los dos son bruta. Si sale ~0.5–0.6 → el que no trae
//  descuento ya viene rebajado, y cargarlo como bruta subvaluaría al doble.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';

const DIR = '/private/tmp/claude-501/-Users-rodrigodelcastillo-Documents/9bc9c4f4-68fb-4f82-814d-c99d09a93ccd/scratchpad/extraccion';

const docs = [];
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
  try { docs.push({ archivo: f, ...JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) }); } catch (e) { /* ya se reporta en el consolidado */ }
}

// ¿El documento aplica descuento renglón por renglón?
// Sólo cuenta un descuento DE VERDAD aplicado renglón por renglón (≥5%). El
// texto de condiciones no sirve: todos dicen "el descuento es en función del
// volumen" aunque no apliquen ninguno, y los hallazgos citan el −40% ajeno.
function traeDescuento(d) {
  return (d.renglones || []).some((r) => (r.descuento_pct || 0) >= 5);
}

const filas = [];
for (const d of docs) {
  const con = traeDescuento(d);
  for (const r of d.renglones || []) {
    if (r.familia !== 'mobiliario' || !(r.p_unitario > 0)) continue;
    filas.push({ ...r, _pres: d.encabezado?.presupuesto || d.archivo, _conDesc: con });
  }
}

// Huella de producto: palabras significativas + medidas. Es tosco a propósito:
// se busca coincidencia fuerte, no parecido.
const NORM = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const RUIDO = /\b(DE|CON|Y|EN|EL|LA|LOS|LAS|UN|UNA|MODELO|MM|COLOR|PARA|SOBRE|TIPO)\b/g;
function huella(r) {
  const t = NORM(r.descripcion_literal).replace(/[^A-Z0-9 ]/g, ' ').replace(RUIDO, ' ');
  const pal = [...new Set(t.split(/\s+/).filter((w) => w.length >= 4 && !/^\d+$/.test(w)))].sort();
  const med = [r.largo_mm, r.fondo_mm, r.alto_mm].filter(Boolean).sort((a, b) => a - b).join('x');
  return { pal: new Set(pal), med };
}
const jaccard = (a, b) => {
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
};

const conD = filas.filter((f) => f._conDesc), sinD = filas.filter((f) => !f._conDesc);
console.log(`Documentos CON descuento por renglón: ${[...new Set(conD.map((f) => f._pres))].join(', ')}`);
console.log(`Documentos SIN renglón de descuento : ${[...new Set(sinD.map((f) => f._pres))].join(', ')}\n`);

const pares = [];
for (const a of conD) {
  const ha = huella(a);
  for (const b of sinD) {
    const hb = huella(b);
    if (ha.med && hb.med && ha.med !== hb.med) continue;   // medidas distintas = otro mueble
    const j = jaccard(ha.pal, hb.pal);
    if (j >= 0.62) pares.push({ a, b, j, razon: b.p_unitario / a.p_unitario });
  }
}
pares.sort((x, y) => y.j - x.j);

// Un mismo mueble puede emparejar varias veces; se conserva el mejor par.
const vistos = new Set(); const unicos = [];
for (const p of pares) {
  const k = `${p.a._pres}|${p.a.p_unitario}|${p.b._pres}|${p.b.p_unitario}`;
  if (vistos.has(k)) continue; vistos.add(k); unicos.push(p);
}

if (!unicos.length) { console.log('No hubo ningún producto que aparezca en los dos tipos de documento.'); process.exit(0); }

console.log(`─── ${unicos.length} productos que aparecen en los DOS tipos de documento ───\n`);
for (const p of unicos.slice(0, 25)) {
  console.log(`  ${(p.j * 100).toFixed(0)}% parecido · medidas ${huella(p.a).med || '—'}`);
  console.log(`    CON −40%  [${p.a._pres}]  $${p.a.p_unitario.toLocaleString('es-MX')}`);
  const neto = p.a.p_unitario * 0.6;
  console.log(`      su NETO (−40%) = $${neto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`);
  console.log(`    SIN desc. [${p.b._pres}]  $${p.b.p_unitario.toLocaleString('es-MX')}   → razón ${p.razon.toFixed(3)} · vs el neto: ${(p.b.p_unitario / neto).toFixed(3)}`);
  console.log(`    ${String(p.a.descripcion_literal || '').slice(0, 100)}`);
}

const rs = unicos.map((p) => p.razon).sort((a, b) => a - b);
const med = rs[Math.floor(rs.length / 2)];
const prom = rs.reduce((s, x) => s + x, 0) / rs.length;
console.log(`\n─── Razón (precio sin-descuento ÷ precio con-descuento) ───`);
console.log(`    ${rs.length} pares · mínimo ${rs[0].toFixed(3)} · mediana ${med.toFixed(3)} · promedio ${prom.toFixed(3)} · máximo ${rs[rs.length - 1].toFixed(3)}`);
const vsNeto = unicos.map((p) => p.b.p_unitario / (p.a.p_unitario * 0.6)).sort((a, b) => a - b);
console.log(`─── Contra el NETO del documento con −40% ───`);
console.log(`    mediana ${vsNeto[Math.floor(vsNeto.length / 2)].toFixed(3)} · promedio ${(vsNeto.reduce((s, x) => s + x, 0) / vsNeto.length).toFixed(3)}`);
console.log(med > 0.85
  ? '\n  → Cerca de 1: los dos formatos publican la MISMA lista bruta. Se pueden cargar igual.'
  : `\n  → Lejos de 1 (${(med * 100).toFixed(0)}%): los presupuestos sin renglón de descuento publican un precio YA REBAJADO.\n     Cargarlos como lista bruta subvaluaría ~${(1 / med).toFixed(2)}×. NO cargar hasta confirmarlo con Rodrigo.`);
