// Holdout v5.1/v5.2 · Q4 reproducible: copia la corrida de humo real, la altera de muchas formas y corre el verificador sobre cada
// copia. Ninguna puede dar OK (exit 0). Las copias van a un directorio temporal; el repo no se toca (v5.3: sólo objetos
// git sueltos para el caso del config de Playwright).
//   node lab/costear/holdout_intelisis/casos_falla_cerrada.mjs <corrida> <huellas_db_post> <edges_post> <modelos>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { auditarLlamadasCorrida } from '../../../src/datos/holdoutHuellas.js';

const [corrida, db, edges, modelos] = process.argv.slice(2);
if (!corrida || !db || !edges || !modelos) { console.error('uso: casos_falla_cerrada.mjs <corrida> <db> <edges> <modelos>'); process.exit(2); }
const hoja = fs.readdirSync(corrida, { withFileTypes: true }).find((d) => d.isDirectory()).name;
const leer = (f) => JSON.parse(fs.readFileSync(path.join(corrida, hoja, f), 'utf8'));
const crudas = leer('edges.json');
const binario = leer('0-binario.json');
// Las crudas guardan body como texto; para recalcular el resumen como lo hace el E2E se usa el request_id guardado aparte.
const comoE2E = (lista) => lista.map((e) => ({ fn: e.fn, body: { request_id: e.request_id } }));
// v5.2: el resumen recalculado conserva la hoja declarada y el `costeable` que escribió el E2E (así cada caso falla por
// lo que altera, no por falta de hoja).
const original = leer('llamadas.json');
const resumen = (lista, extra = {}) => auditarLlamadasCorrida(comoE2E(lista), { hoja: original.hoja, costeable: original.costeo?.costeable, ...extra });
const eventos = JSON.parse(fs.readFileSync(modelos, 'utf8'));
const ia = (e) => /^analizar-mueble/.test(e.fn);
const prod = { fn: 'costear-servidor', status: 200, body: '{}' };

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'holdout-q4-'));
// v5.3: commit-OBJETO local = HEAD con sólo playwright.config.js cambiado (retries 5). Índice temporal: no toca ramas, el
// árbol de trabajo ni el remoto; sólo deja objetos sueltos en .git que nadie referencia.
function shaConConfigCambiado() {
  const g = (args, env = {}, input) => spawnSync('git', args, { encoding: 'utf8', env: { ...process.env, ...env }, input });
  const env = { GIT_INDEX_FILE: path.join(base, 'index.tmp') };
  const head = g(['rev-parse', 'HEAD']).stdout.trim();
  g(['read-tree', head], env);
  const cfg = g(['show', `${head}:playwright.config.js`]).stdout.replace(/retries:[^,\n]*,/, 'retries: 5,');
  const blob = g(['hash-object', '-w', '--stdin'], {}, cfg).stdout.trim();
  g(['update-index', '--cacheinfo', `100644,${blob},playwright.config.js`], env);
  const tree = g(['write-tree'], env).stdout.trim();
  const sha = g(['commit-tree', tree, '-p', head, '-m', 'holdout v5.3: ataque retries (objeto local, no se publica)']).stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('no se pudo crear el commit de ataque');
  return sha;
}

const casos = [
  ['corrida real, sin alterar', {}],
  ['una llamada de IA sin request_id', { crudas: crudas.map((e) => (ia(e) ? { ...e, request_id: null } : e)) }],
  ['caso costeable sin ninguna llamada a costear-servidor-rc', { crudas: crudas.filter((e) => e.fn !== 'costear-servidor-rc') }],
  ['una llamada a costear-servidor (producción), resumen honesto', { crudas: [...crudas, prod] }],
  ['producción en porFn pero ajenas [] en el resumen', { crudas: [...crudas, prod], editar: (a) => ({ ...a, costeo: { ...a.costeo, ajenas: [] }, motivos: [] }) }],
  ['producción en las crudas, resumen "limpio" de otra corrida', { crudas: [...crudas, prod], resumen: resumen(crudas) }],
  ['resumen con 2 llamadas de IA y 1 request_id', { editar: (a) => ({ ...a, ia: { ...a.ia, llamadas: 2 } }) }],
  ['hoja sin edges.json (sólo el resumen)', { sinCrudas: true }],
  ['0-binario.json sin SHA de git', { binario: { ...binario, shaGit: null } }],
  // v5.2 (reauditoría GO/NO-GO)
  ['request_id repetido (la misma llamada de IA dos veces, un solo evento)', { crudas: [...crudas, ...crudas.filter(ia)] }],
  ['dos eventos de IA para el mismo request_id', { modelos: [...eventos, ...eventos.slice(0, 1)] }],
  ['un evento de IA que no es de la corrida', { modelos: [...eventos, { ...eventos[0], request_id: '00000000-0000-0000-0000-000000000000' }] }],
  ['hoja costeable + resumen costeable:false (LAB_COSTEABLE=0) + 0 llamadas RC', { crudas: crudas.filter((e) => e.fn !== 'costear-servidor-rc'), extra: { costeable: false } }],
  ['producción en el recosteo, entre llamadas RC', { crudas: (() => { const i = crudas.findIndex((e) => e.fn === 'costear-servidor-rc'); return [...crudas.slice(0, i + 1), prod, ...crudas.slice(i + 1)]; })() }],
  ['hoja declarada con otro sha256 (no es la que está en git)', { editar: (a) => ({ ...a, hoja: { ...a.hoja, sha256: '0'.repeat(64) } }) }],
  ['hoja sin declarar (E2E v5.1)', { editar: (a) => ({ ...a, hoja: null }) }],
  // v5.3 (auditoría binaria del FINAL_SHA, P1): el arnés de la prueba también está congelado y la evidencia sólo vale del
  // primer intento.
  ['SHA servido = HEAD + sólo playwright.config.js con retries 5', { binario: (() => { const s = shaConConfigCambiado(); return { ...binario, shaGit: s.slice(0, 7), shaApp: s.slice(0, 7) }; })() }],
  ['evidencia de un reintento de Playwright (reintento 1)', { binario: { ...binario, reintento: 1 } }],
  ['0-binario.json sin `reintento` (E2E v5.2)', { binario: (({ reintento, ...b }) => b)(binario) }],
  ['corrida servida con cambios sin commit (arbolLimpio false)', { binario: { ...binario, arbolLimpio: false } }],
  ['entorno de Vite con una variable extra (VITE_CONTROL_OPTIMISTA, p. ej. de un .env ignorado)', { binario: { ...binario, entornoVite: { ...binario.entornoVite, VITE_CONTROL_OPTIMISTA: '1' } } }],
  ['entorno de Vite apuntando a la Edge de producción', { binario: { ...binario, entornoVite: { ...binario.entornoVite, VITE_COSTEAR_FN: 'costear-servidor' } } }],
];
const filas = [];
for (const [i, [nombre, c]] of casos.entries()) {
  const dir = path.join(base, String(i), hoja); fs.mkdirSync(dir, { recursive: true });
  const lista = c.crudas || crudas;
  let a = c.resumen || (c.crudas ? resumen(lista, c.extra) : leer('llamadas.json'));
  if (c.editar) a = c.editar(a);
  fs.writeFileSync(path.join(dir, 'llamadas.json'), JSON.stringify(a));
  if (!c.sinCrudas) fs.writeFileSync(path.join(dir, 'edges.json'), JSON.stringify(lista));
  fs.writeFileSync(path.join(dir, '0-binario.json'), JSON.stringify(c.binario || binario));
  let fModelos = modelos;
  if (c.modelos) { fModelos = path.join(base, `modelos_${i}.json`); fs.writeFileSync(fModelos, JSON.stringify(c.modelos)); }
  const r = spawnSync('node', ['scripts/congelar_holdout.mjs', '--verificar', '--db', db, '--edges', edges, '--modelos', fModelos,
    '--corrida', path.join(base, String(i))], { encoding: 'utf8' });
  filas.push({ caso: nombre, exit: r.status, salida: (r.stdout + r.stderr).trim() });
}
const r = spawnSync('node', ['scripts/congelar_holdout.mjs', '--verificar', '--db', db, '--edges', edges, '--modelos', modelos], { encoding: 'utf8' });
filas.push({ caso: 'sin --corrida', exit: r.status, salida: (r.stdout + r.stderr).trim() });

for (const f of filas) console.log(`| ${f.caso} | ${f.exit} | ${f.salida.replace(/\|/g, '\\|')} |`);
const malos = filas.slice(1).filter((f) => f.exit === 0);
if (filas[0].exit !== 0) { console.error('la corrida real no verificó'); process.exit(1); }
if (malos.length) { console.error(`FALSO OK en: ${malos.map((f) => f.caso).join(', ')}`); process.exit(1); }
console.error(`\nla corrida real da OK y los ${filas.length - 1} casos alterados fallan cerrado`);
