// ============================================================================
//  BUSCADOR DE MATERIA PRIMA EN EL ERP
//
//  82 de los 103 insumos no dicen de dónde salió su precio. Este script NO
//  asigna precios solo: busca en la última compra del ERP los artículos que
//  podrían ser cada insumo y los deja ordenados para confirmar.
//
//  Por qué no automático: la lección que ya costó una vez es que el error caro
//  no es el precio, es la UNIDAD (la lámina cotizada por pieza y consumida por
//  kg). Un match por nombre con la unidad equivocada mete un error de 10× sin
//  que nadie lo vea. Aquí la unidad del ERP se imprime SIEMPRE al lado.
//
//    node scripts/busca-mp.mjs                 → los insumos sin fuente
//    node scripts/busca-mp.mjs melamina 28     → busca un término suelto
// ============================================================================
import fs from 'node:fs';
import { INSUMOS_SEMILLA } from '../src/datos/insumos.js';

const CSV = new URL('../mp_erp_ultima_compra.csv', import.meta.url).pathname;
function filas() {
  const txt = fs.readFileSync(CSV, 'utf8').split('\n').slice(1);
  const out = [];
  for (const l of txt) {
    if (!l.trim()) continue;
    // parser mínimo con comillas (las descripciones traen comas y pulgadas)
    const c = []; let cur = '', q = false;
    for (const ch of l) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { c.push(cur); cur = ''; }
      else cur += ch;
    }
    c.push(cur);
    if (c.length < 8) continue;
    out.push({ articulo: c[0], desc: c[1], unidad: c[2], producto: c[3], elemento: c[4], fecha: c[6], costo: Number(c[7]) });
  }
  return out.filter((r) => Number.isFinite(r.costo) && r.costo > 0);
}

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const PALABRAS = (s) => norm(s).split(/[^A-Z0-9]+/).filter((w) => w.length > 2);
// Palabras que aparecen en todo y no distinguen nada
const VACIAS = new Set(['DEL', 'LOS', 'LAS', 'PARA', 'CON', 'POR', 'MODELO', 'COLOR', 'MTS', 'MTR']);

function candidatos(texto, ERP, n = 4) {
  const ws = PALABRAS(texto).filter((w) => !VACIAS.has(w));
  if (!ws.length) return [];
  return ERP
    .map((r) => {
      const d = norm(r.desc + ' ' + r.articulo);
      const pegan = ws.filter((w) => d.includes(w)).length;
      return { r, score: pegan / ws.length };
    })
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score || b.r.fecha.localeCompare(a.r.fecha))
    .slice(0, n);
}

const ERP = filas();
const termino = process.argv.slice(2).join(' ');
console.log(`ERP: ${ERP.length} artículos con costo de última compra.\n`);

if (termino) {
  for (const { r, score } of candidatos(termino, ERP, 15))
    console.log(`  ${(score * 100).toFixed(0)}%  ${r.articulo.padEnd(16)} ${r.unidad.padEnd(6)} $${String(r.costo).padStart(9)}  ${r.fecha}  ${r.desc.slice(0, 78)}`);
} else {
  const sin = INSUMOS_SEMILLA.filter((i) => !i.fuente);
  let conCandidato = 0;
  for (const i of sin) {
    const c = candidatos(i.nombre, ERP);
    if (!c.length) { console.log(`— ${i.id.padEnd(22)} (${i.unidad}, $${i.precio})  sin candidato en el ERP`); continue; }
    conCandidato++;
    console.log(`\n▸ ${i.id}  —  hoy: ${i.unidad} $${i.precio}   «${i.nombre}»`);
    for (const { r, score } of c) {
      const alerta = r.unidad.trim().toLowerCase() !== i.unidad.toLowerCase() ? '  ⚠️ UNIDAD DISTINTA' : '';
      console.log(`    ${(score * 100).toFixed(0)}%  ${r.articulo.padEnd(16)} ${r.unidad.padEnd(6)} $${String(r.costo).padStart(9)}  ${r.fecha}  ${r.desc.slice(0, 62)}${alerta}`);
    }
  }
  console.log(`\n${conCandidato} de ${sin.length} insumos sin fuente tienen al menos un candidato en el ERP.`);
  console.log('Ninguno se aplicó solo: confirmar unidad y artículo antes de sembrar el precio.');
}
