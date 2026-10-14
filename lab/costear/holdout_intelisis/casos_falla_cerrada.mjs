// Holdout v5.1 · Q4 reproducible: copia la corrida de humo real, la altera de 8 formas y corre el verificador sobre cada
// copia. Ninguna puede dar OK (exit 0). Las copias van a un directorio temporal; el repo no se toca.
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
const resumen = (lista) => auditarLlamadasCorrida(comoE2E(lista));
const ia = (e) => /^analizar-mueble/.test(e.fn);
const prod = { fn: 'costear-servidor', status: 200, body: '{}' };

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
];

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'holdout-q4-'));
const filas = [];
for (const [i, [nombre, c]] of casos.entries()) {
  const dir = path.join(base, String(i), hoja); fs.mkdirSync(dir, { recursive: true });
  const lista = c.crudas || crudas;
  let a = c.resumen || (c.crudas ? resumen(lista) : leer('llamadas.json'));
  if (c.editar) a = c.editar(a);
  fs.writeFileSync(path.join(dir, 'llamadas.json'), JSON.stringify(a));
  if (!c.sinCrudas) fs.writeFileSync(path.join(dir, 'edges.json'), JSON.stringify(lista));
  fs.writeFileSync(path.join(dir, '0-binario.json'), JSON.stringify(c.binario || binario));
  const r = spawnSync('node', ['scripts/congelar_holdout.mjs', '--verificar', '--db', db, '--edges', edges, '--modelos', modelos,
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
