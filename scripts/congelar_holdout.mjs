#!/usr/bin/env node
// Holdout Intelisis v3 (reauditoría externa v2, 14-oct, P1-02): los archivos son el CIERRE TRANSITIVO de imports de las
// ENTRADAS (más este script, el comparador y package-lock.json) y los modelos de IA quedan congelados por (fn, modo).
//   … --verificar --db <huellas.json> --edges <edges.json> --modelos <modelos_observados.json> --corrida <dir de la corrida>
// v5 (cierre pre-deploy): --corrida lee llamadas.json (TODAS las llamadas de IA con su request_id, null si faltó; las de
// costeo por Edge) y 0-binario.json de cada hoja; el MANIFIESTO guarda frontendSha y el SHA servido no puede traer código
// distinto (git diff). Congelar exige árbol limpio y acepta --db/--edges frescos.
// v4 (reauditoría v3): [] de modelos no verifica; cada request de IA de la corrida exige su evento; correr.sh exige la Edge
// de costeo RC exacta y que el navegador sirva el SHA y el árbol limpio que se congelaron.
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
import { execFileSync } from 'node:child_process';
import { compararHuellas, cierreDeImports, unirCorrida, envGitLimpio, esShaCompleto } from '../src/datos/holdoutHuellas.js';
import { medirIntegridadGit } from './integridadGit.mjs';

const RAIZ = process.cwd();
const SALIDA = 'lab/costear/holdout_intelisis/MANIFIESTO.json';
// ENTRADAS: superficies del holdout. Lo que importan (a cualquier profundidad) entra solo: ya no hay lista a mano.
const RAICES = [
  'src/motor', 'src/datos/materialMatch.js', 'src/datos/estadoCosto.js', 'src/datos/topeEstadoCosteo.js',
  'src/datos/revisionEstructural.js', 'src/datos/validarIntentCosteo.js', 'src/datos/autoridadCosteoServidor.js',
  'src/datos/conservarConfirmados.js', 'src/datos/insumos.js', 'src/datos/metricasHoldout.js', 'src/datos/holdoutHuellas.js', 'src/voni',
  'supabase/functions/costear-servidor-rc', 'supabase/functions/analizar-mueble-rc',
  'e2e/labCostear.e2e.js', 'lab/costear/holdout_intelisis/huellas_db.sql', 'lab/costear/holdout_intelisis/modelos_observados.sql',
  'lab/costear/ciego_erp/comparar.mjs', 'lab/costear/ciego_erp/correr.sh', 'lab/costear/ciego_erp/gen_hojas.py',
  'scripts/congelar_holdout.mjs', 'scripts/prepararEntornoHoldout.mjs', 'package-lock.json',
  // v5.3 (auditoría binaria 14-oct, P1): el config de Playwright decide reintentos, proyectos y servidor de la corrida, y el
  // de Vite decide qué se sirve; los dos se congelan (antes sólo contaban en el git diff, y el de Playwright ni eso).
  'playwright.config.js', 'vite.config.js',
];
// Modelo de IA por (fn, modo) que la corrida debe observar en ai_eventos. Medido 14-oct (ai_eventos, últimas 30 h):
// texto → claude-opus-5; imagen y revisión → claude-opus-5-5 (cambió el 13-oct 18:44 desde claude-sonnet-5-5).
const MODELOS_ESPERADOS = {
  'analizar-mueble-rc': { texto: 'claude-opus-5', imagen: 'claude-opus-5-5', revision: 'claude-opus-5-5' },
};
// v5.3: lo que el servidor de desarrollo inyecta en import.meta.env durante la corrida (lo registra el E2E en 0-binario.json).
// Cualquier otra variable VITE_ (un .env ignorado por git, una variable extra al lanzar Vite) cambia lo que corre: CAMBIO.
const ENTORNO_VITE_ESPERADO = {
  BASE_URL: '/', DEV: true, MODE: 'development', PROD: false, SSR: false,
  VITE_ANALIZAR_MUEBLE_FN: 'analizar-mueble-rc', VITE_COSTEAR_FN: 'costear-servidor-rc',
};
const archivos = (p) => {
  const abs = path.join(RAIZ, p);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [p];
  return fs.readdirSync(abs).flatMap((n) => archivos(path.join(p, n)));
};
const leerRel = (f) => { try { const abs = path.join(RAIZ, f); return fs.statSync(abs).isFile() ? fs.readFileSync(abs, 'utf8') : null; } catch { return null; } };
const entradas = [...new Set(RAICES.flatMap(archivos))].filter((f) => !/\.test\.js$/.test(f));
const lista = cierreDeImports(entradas, leerRel).filter((f) => !/\.test\.js$/.test(f));
const sinResolver = lista.filter((f) => f.startsWith('FALTA:'));
if (sinResolver.length) { console.error(`Imports que no resuelven (arréglalos antes de congelar): ${sinResolver.join(', ')}`); process.exit(3); }
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ, f))).digest('hex');
const huellas = Object.fromEntries(lista.map((f) => [f, sha(f)]));
const total = crypto.createHash('sha256').update(JSON.stringify(huellas)).digest('hex');

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const leerJson = (f) => JSON.parse(fs.readFileSync(path.resolve(f), 'utf8'));
// v5.5: sin variables GIT_* del entorno ni objetos `git replace` (envGitLimpio).
const ENV_GIT = envGitLimpio(process.env);
const git = (...a) => { try { return execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', env: ENV_GIT }).trim(); } catch { return null; } };
// v5: una corrida = un directorio con una carpeta por hoja (llamadas.json + 0-binario.json que escribe el E2E).
// v5.1: también edges.json (llamadas crudas); el resumen tiene que cuadrar con ellas o no verifica.
// v5.2: la FIXTURE de la hoja (de donde sale si el caso es costeable) se lee de GIT en el SHA que sirvió el navegador, no
// del directorio de trabajo ni del resumen: una hoja sin commit en ese SHA no existe para el verificador.
function fixtureEnGit(ruta, sha) {
  if (typeof ruta !== 'string' || !ruta || path.isAbsolute(ruta) || ruta.split(/[\\/]/).includes('..') || typeof sha !== 'string' || !/^[0-9a-f]{7,40}$/.test(sha)) return null;
  let buf; try { buf = execFileSync('git', ['show', `${sha}:${ruta}`], { cwd: RAIZ, stdio: ['ignore', 'pipe', 'ignore'], env: ENV_GIT }); } catch { return null; }
  let datos; try { datos = JSON.parse(buf.toString('utf8')); } catch { return null; }
  return { ruta, sha256: crypto.createHash('sha256').update(buf).digest('hex'), datos };
}
function leerCorrida(dir) {
  const hojas = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => {
    const leer = (f) => { const p = path.join(dir, d.name, f); return fs.existsSync(p) ? leerJson(p) : null; };
    const auditoria = leer('llamadas.json'); const binario = leer('0-binario.json');
    // v5.5 (P1-HO-02): la hoja se lee en el HEAD MEDIDO (headGit), no en el SHA declarado.
    return { hoja: d.name, auditoria, binario, crudas: leer('edges.json'), fixture: fixtureEnGit(auditoria?.hoja?.ruta, binario?.headGit) };
  });
  return unirCorrida(hojas);
}
if (process.argv.includes('--verificar')) {
  const m = JSON.parse(fs.readFileSync(path.join(RAIZ, SALIDA), 'utf8'));
  const corrida = arg('--corrida') ? leerCorrida(arg('--corrida')) : undefined;
  // Diferencias git entre el SHA congelado y el HEAD MEDIDO del checkout que sirvió (v5.5, P1-HO-02: antes era el SHA
  // declarado en LAB_GIT_SHA). Sólo si ese commit existe en este repo; si no, cambiosGit queda indefinido ⇒ NO VERIFICADO.
  let cambiosGit;
  if (corrida?.binarios?.length && m.frontendSha) {
    const shas = [...new Set(corrida.binarios.map((b) => b?.headGit).filter(esShaCompleto))];
    const diffs = shas.map((s) => (git('cat-file', '-e', `${s}^{commit}`) == null ? null : git('diff', '--name-only', m.frontendSha, s)));
    cambiosGit = diffs.some((d) => d == null) ? undefined : [...new Set(diffs.flatMap((d) => (d ? d.split('\n') : [])))];
  }
  const r = compararHuellas(m, { archivos: huellas, db: arg('--db') ? leerJson(arg('--db')) : null, edges: arg('--edges') ? leerJson(arg('--edges')) : null,
    modelos: arg('--modelos') ? leerJson(arg('--modelos')) : undefined, corrida, cambiosGit });
  if (r.cambios.length) { console.error(`HOLDOUT INVÁLIDO: cambió ${r.cambios.join(', ')}`); process.exit(1); }
  if (r.estado === 'NO_VERIFICADO') { console.error(`NO VERIFICADO: faltan ${r.falta.join(' y ')}.`); process.exit(2); }
  console.log(`OK: ${lista.length} archivos, base de datos, Edge, modelos, llamadas y binario idénticos al congelamiento (${m.huellaTotal.slice(0, 16)}).`);
  process.exit(0);
}
// Congelar: con --db/--edges se guardan las huellas FRESCAS (si no, se conservan las previas) y el SHA de HEAD exacto.
if (git('status', '--porcelain', '--untracked-files=no')) { console.error('ABORTO: hay cambios sin commit; se congela sobre un árbol limpio'); process.exit(2); }
// v5.6 (P1-HO-03): `git status` no ve archivos marcados assume-unchanged/skip-worktree; las huellas del manifiesto salen de
// los bytes en disco, así que se exige que sean los de HEAD.
{ const integ = medirIntegridadGit(RAIZ, process.env);
  if (integ.banderas.length || integ.distintos.length) { console.error(`ABORTO: el checkout no es HEAD byte a byte (banderas del índice: ${integ.banderas.slice(0, 3).join(', ') || 'ninguna'}; distintos: ${integ.distintos.slice(0, 3).join(', ') || 'ninguno'})`); process.exit(2); } }
const previo = fs.existsSync(path.join(RAIZ, SALIDA)) ? JSON.parse(fs.readFileSync(path.join(RAIZ, SALIDA), 'utf8')) : {};
fs.writeFileSync(path.join(RAIZ, SALIDA), JSON.stringify({
  congeladoEn: new Date().toISOString(), huellaTotal: total, nArchivos: lista.length,
  frontendSha: git('rev-parse', 'HEAD'),
  archivos: huellas,
  baseDatos: arg('--db') ? leerJson(arg('--db')) : (previo.baseDatos || null),
  edges: arg('--edges') ? leerJson(arg('--edges')) : (previo.edges || null),
  modelosEsperados: MODELOS_ESPERADOS,
  entornoVite: ENTORNO_VITE_ESPERADO,
}, null, 1) + '\n');
console.log(`Congelado: ${lista.length} archivos · ${total.slice(0, 16)} · frontend ${git('rev-parse', '--short', 'HEAD')}`);
