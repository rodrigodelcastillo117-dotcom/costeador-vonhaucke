#!/usr/bin/env node
// Holdout Intelisis v2 (Operación 9.5 · reauditoría externa 14-oct, P1-02). Congela TODO lo que influye en el costo
// antes de ver los muebles nuevos: código (archivos), base de datos (huellas_db.sql: precios con TODAS las columnas que
// mueven selección/certificación, catálogo con nombre/familia/clasificación/sección, config, definiciones SQL de la vista
// y las RPC del catálogo) y Edge desplegadas (versión + ezbr_sha256 de costear-servidor-rc y analizar-mueble-rc).
//   node scripts/congelar_holdout.mjs                     → escribe MANIFIESTO.json (conserva baseDatos/edges si ya existen)
//   node scripts/congelar_holdout.mjs --verificar --db <huellas.json> --edges <edges.json>
//        → exit 0 SOLO si archivos, base y Edge coinciden; exit 1 si algo cambió; exit 2 si faltan huellas frescas
//          (sin --db/--edges NO hay verificación: un OK de archivos solos no demuestra un holdout congelado).
// El modelo resuelto (ai_eventos.model_id) se registra por llamada durante la corrida; ver PROTOCOLO.md.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { compararHuellas } from '../src/datos/holdoutHuellas.js';

const RAIZ = process.cwd();
const SALIDA = 'lab/costear/holdout_intelisis/MANIFIESTO.json';
const RAICES = [
  'src/motor', 'src/datos/materialMatch.js', 'src/datos/estadoCosto.js', 'src/datos/topeEstadoCosteo.js',
  'src/datos/revisionEstructural.js', 'src/datos/validarIntentCosteo.js', 'src/datos/autoridadCosteoServidor.js',
  'src/datos/conservarConfirmados.js', 'src/datos/insumos.js', 'src/datos/metricasHoldout.js', 'src/datos/holdoutHuellas.js', 'src/voni',
  'supabase/functions/costear-servidor-rc', 'supabase/functions/analizar-mueble-rc',
  'e2e/labCostear.e2e.js', 'lab/costear/holdout_intelisis/huellas_db.sql', 'lab/costear/ciego_erp/comparar.mjs', 'lab/costear/ciego_erp/correr.sh', 'lab/costear/ciego_erp/gen_hojas.py',
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

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const leerJson = (f) => JSON.parse(fs.readFileSync(path.resolve(f), 'utf8'));
if (process.argv.includes('--verificar')) {
  const m = JSON.parse(fs.readFileSync(path.join(RAIZ, SALIDA), 'utf8'));
  const r = compararHuellas(m, { archivos: huellas, db: arg('--db') ? leerJson(arg('--db')) : null, edges: arg('--edges') ? leerJson(arg('--edges')) : null });
  if (r.cambios.length) { console.error(`HOLDOUT INVÁLIDO: cambió ${r.cambios.join(', ')}`); process.exit(1); }
  if (r.estado === 'NO_VERIFICADO') { console.error(`NO VERIFICADO: archivos idénticos, pero faltan ${r.falta.join(' y ')}.`); process.exit(2); }
  console.log(`OK: ${lista.length} archivos, base de datos y Edge idénticos al congelamiento (${m.huellaTotal.slice(0, 16)}).`);
  process.exit(0);
}
const previo = fs.existsSync(path.join(RAIZ, SALIDA)) ? JSON.parse(fs.readFileSync(path.join(RAIZ, SALIDA), 'utf8')) : {};
fs.writeFileSync(path.join(RAIZ, SALIDA), JSON.stringify({
  congeladoEn: new Date().toISOString(), huellaTotal: total, nArchivos: lista.length, archivos: huellas,
  baseDatos: previo.baseDatos || null,
  edges: previo.edges || null,
}, null, 1) + '\n');
console.log(`Congelado: ${lista.length} archivos · ${total.slice(0, 16)}`);
