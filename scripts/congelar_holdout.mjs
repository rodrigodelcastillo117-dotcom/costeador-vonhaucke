#!/usr/bin/env node
// Holdout Intelisis (Operación 9.5 · punto 7). Congela TODO lo que influye en el costo antes de ver los muebles nuevos.
//   node scripts/congelar_holdout.mjs            → escribe lab/costear/holdout_intelisis/MANIFIESTO.json
//   node scripts/congelar_holdout.mjs --verificar → falla (exit 1) si cualquier archivo cambió desde el congelamiento
// Las huellas de base de datos (precios, catálogo, config) se miden con SQL de solo lectura y se anotan a mano en el
// manifiesto (campo `baseDatos`); el script las conserva al verificar y la corrida debe volver a medirlas.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RAIZ = process.cwd();
const SALIDA = 'lab/costear/holdout_intelisis/MANIFIESTO.json';
const RAICES = [
  'src/motor', 'src/datos/materialMatch.js', 'src/datos/estadoCosto.js', 'src/datos/topeEstadoCosteo.js',
  'src/datos/revisionEstructural.js', 'src/datos/validarIntentCosteo.js', 'src/datos/autoridadCosteoServidor.js',
  'src/datos/conservarConfirmados.js', 'src/datos/insumos.js', 'src/datos/metricasHoldout.js', 'src/voni',
  'supabase/functions/costear-servidor-rc', 'supabase/functions/analizar-mueble-rc',
  'e2e/labCostear.e2e.js', 'lab/costear/ciego_erp/comparar.mjs', 'lab/costear/ciego_erp/correr.sh', 'lab/costear/ciego_erp/gen_hojas.py',
];
const archivos = (p) => {
  const abs = path.join(RAIZ, p);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [p];
  return fs.readdirSync(abs).flatMap((n) => archivos(path.join(p, n)));
};
const lista = [...new Set(RAICES.flatMap(archivos))].filter((f) => !/\.test\.js$/.test(f)).sort();
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ, f))).digest('hex');
const huellas = Object.fromEntries(lista.map((f) => [f, sha(f)]));
const total = crypto.createHash('sha256').update(JSON.stringify(huellas)).digest('hex');

if (process.argv.includes('--verificar')) {
  const m = JSON.parse(fs.readFileSync(path.join(RAIZ, SALIDA), 'utf8'));
  const cambios = [...new Set([...Object.keys(m.archivos), ...lista])].filter((f) => m.archivos[f] !== huellas[f]);
  if (cambios.length) { console.error(`HOLDOUT INVÁLIDO: ${cambios.length} archivo(s) cambiaron desde el congelamiento:\n  ${cambios.join('\n  ')}`); process.exit(1); }
  console.log(`OK: ${lista.length} archivos idénticos al congelamiento (${m.huellaTotal.slice(0, 16)}).`);
  process.exit(0);
}
const previo = fs.existsSync(path.join(RAIZ, SALIDA)) ? JSON.parse(fs.readFileSync(path.join(RAIZ, SALIDA), 'utf8')) : {};
fs.writeFileSync(path.join(RAIZ, SALIDA), JSON.stringify({
  congeladoEn: new Date().toISOString(), huellaTotal: total, nArchivos: lista.length, archivos: huellas,
  baseDatos: previo.baseDatos || null,
}, null, 1) + '\n');
console.log(`Congelado: ${lista.length} archivos · ${total.slice(0, 16)}`);
