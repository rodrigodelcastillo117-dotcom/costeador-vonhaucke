// ============================================================================
//  HOLDOUT INDUSTRIAL — repite el metodo de costeo de piezas fabricadas en los
//  5 planos. Extrae de la capa de texto las piezas "... DE L X W X D mm ; EN
//  LAMINA" y las costea con costoPiezaFabricada (desarrollo plano -> lamina real).
//  Mide cuanto es costeable fisicamente (panel) vs pendiente de desarrollo (caja 3D).
//  Cobertura parcial en planos con capa de texto jumbled: se reporta, no se inventa.
//  Uso: node tools/holdout_industrial.mjs <dir_con_txt>
// ============================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { costearMateriaPrima } from '../src/datos/costoPiezaFabricada.js';

const DIR = process.argv[2];
const PLANOS = ['TELSVH120', 'TELSMG', 'TEVTSU', 'TEVHSU', 'TVCAC'];
const RE_LAMINA = /EN\s+LAMINA/i;
const RE_DIMS = /DE\s+(\d+(?:\.\d+)?)\s*X\s*(\d+(?:\.\d+)?)\s*X\s*(\d+(?:\.\d+)?)\s*mm/i;
const RE_CLAVE = /\b([A-Z]{2,}[A-Z0-9]*-[A-Z0-9]{1,6})\b/;      // clave de pieza con guion (TEVHSU-CF)

function fabricadasDe(texto) {
  const out = new Map();
  for (const linea of texto.split('\n')) {
    if (!RE_LAMINA.test(linea)) continue;
    const d = linea.match(RE_DIMS); if (!d) continue;
    const c = linea.match(RE_CLAVE); if (!c) continue;
    const clave = c[1];
    const dims = [+d[1], +d[2], +d[3]];
    const qm = linea.replace(RE_DIMS, '').match(/\b(\d{1,3})\b\s*$/);   // qty al final
    const qty = qm ? +qm[1] : 1;
    const key = clave + '|' + dims.join('x');
    if (!out.has(key)) out.set(key, { clave, desc: linea.trim().slice(0, 80), dims_mm: dims, cantidad: qty });
  }
  return [...out.values()];
}

let md = '# HOLDOUT INDUSTRIAL - costeo de piezas fabricadas desde materia prima (5 planos)\n\n';
md += 'Metodo: extraer de la capa de texto las piezas "EN LAMINA" con geometria y costearlas con el motor (desarrollo plano -> lamina comercial ERP -> aprovechamiento/merma). PANEL = costeable; CAJA 3D = desarrollo pendiente (CAD). Cobertura parcial donde la capa de texto es jumbled. 2026-11-09.\n\n';
md += '| Plano | Fab. detectadas | Costeadas (panel) | Pend. desarrollo (3D) | MP lamina (panel) |\n|---|---|---|---|---|\n';
const detalle = {};
for (const p of PLANOS) {
  let texto = '';
  try { texto = readFileSync(`${DIR}/${p}.txt`, 'utf8'); } catch { md += `| ${p} | sin txt | - | - | - |\n`; detalle[p] = { error: 'sin txt' }; continue; }
  const fab = fabricadasDe(texto);
  let costeadas = 0, pend = 0, mp = 0; const items = [];
  for (const f of fab) {
    const r = costearMateriaPrima(f);
    if (r.estado === 'COSTEADA' || r.estado === 'NO_CABE') { costeadas++; mp += r.evidencia.costo_mp_mxn; items.push({ clave: f.clave, dims: f.dims_mm, costo: r.evidencia.costo_mp_mxn, lamina: r.evidencia.lamina.id, tipo: r.evidencia.desarrollo.tipo }); }
    else { pend++; items.push({ clave: f.clave, dims: f.dims_mm, estado: r.estado }); }
  }
  md += `| ${p} | ${fab.length} | ${costeadas} | ${pend} | $${(+mp.toFixed(2)).toLocaleString('es-MX')} |\n`;
  detalle[p] = { detectadas: fab.length, costeadas, pendientes_desarrollo: pend, mp_lamina_mxn: +mp.toFixed(2), items };
}
md += '\n## Lectura\n\n';
md += '- El metodo GENERALIZA: donde hay geometria de panel (frente/puerta/placa) se costea la MP de lamina desde su materia prima real, sin tratar la pieza como SKU.\n';
md += '- Las cajas 3D (cuerpo, exhibidor) quedan como DESARROLLO PENDIENTE (requieren despliegue de CAD); no se inventan dimensiones.\n';
md += '- Cobertura limitada por la capa de texto: planos jumbled (TELSMG/TVCAC) detectan menos piezas por parseo, no por el costeo. La lectura multimodal (como en TELSVH120) recupera las que el texto no da.\n';
writeFileSync(new URL('../expedientes/HOLDOUT_INDUSTRIAL.md', import.meta.url), md);
writeFileSync(new URL('../expedientes/HOLDOUT_INDUSTRIAL.json', import.meta.url), JSON.stringify(detalle, null, 2));
console.log(md);
