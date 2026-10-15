// Holdout v5.6 · P1-HO-02 y P1-HO-03 con checkouts git REALES y el verificador REAL (scripts/congelar_holdout.mjs --verificar).
//   node lab/costear/holdout_intelisis/casos_integridad_git.mjs <corrida> <huellas_db_post> <edges_post> <modelos>
// Cada caso saca un checkout desechable (worktree del repo, o un clon cuando el ataque toca refs compartidas), le aplica el
// ataque, MIDE headGit e integridadGit con las mismas funciones que el E2E, y arma el 0-binario.json que el E2E escribiría
// ahí: los campos medidos tal cual y los que el atacante controla por entorno (shaGit = LAB_GIT_SHA, shaApp = GIT_SHA que
// vite.config.js prefiere) con el valor del ataque. Luego corre --verificar sobre una copia de la corrida real.
// Sólo A puede dar exit 0. El repo no se toca: worktrees y clon en un temporal, commits como objetos sueltos sin rama.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { envGitLimpio } from '../../../src/datos/holdoutHuellas.js';
import { evidenciaIntegridadGit } from '../../../scripts/integridadGit.mjs';

const [corrida, db, edges, modelos] = process.argv.slice(2);
if (!corrida || !db || !edges || !modelos) { console.error('uso: casos_integridad_git.mjs <corrida> <db> <edges> <modelos>'); process.exit(2); }
const RAIZ = process.cwd();
const ENV = envGitLimpio(process.env);
const ENV_REPLACE = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_/i.test(k))); // objetos replace ACTIVOS
const g = (args, cwd = RAIZ, env = ENV, input) => execFileSync('git', ['-c', 'user.name=holdout', '-c', 'user.email=holdout@local', '-c', 'commit.gpgsign=false', ...args], { cwd, env, input, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();
const hoja = fs.readdirSync(corrida, { withFileTypes: true }).find((d) => d.isDirectory()).name;
const binario = JSON.parse(fs.readFileSync(path.join(corrida, hoja, '0-binario.json'), 'utf8'));
const FINAL = g(['rev-parse', 'HEAD']);
const F7 = FINAL.slice(0, 7);
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'holdout-integridad-'));

// commit-objeto = FINAL con un archivo cambiado (índice temporal; sin rama ni push)
function commitCon(ruta, cambiar, msg) {
  const env = { ...ENV, GIT_INDEX_FILE: path.join(base, `idx-${ruta.replace(/\W/g, '_')}`) };
  g(['read-tree', FINAL], RAIZ, env);
  const blob = g(['hash-object', '-w', '--stdin'], RAIZ, ENV, cambiar(g(['show', `${FINAL}:${ruta}`])) + '\n');
  g(['update-index', '--cacheinfo', `100644,${blob},${ruta}`], RAIZ, env);
  return g(['commit-tree', g(['write-tree'], RAIZ, env), '-p', FINAL, '-m', msg]);
}
const ATAQUE = "\nglobalThis.__HOLDOUT_ATAQUE = 'código distinto al congelado';";
const B = commitCon('src/App.jsx', (t) => t + ATAQUE, 'checkout B (objeto local, no se publica)');
const C = commitCon('lab/costear/ciego_erp/hojas/ATPU2M.json', (t) => JSON.stringify({ ...JSON.parse(t), piezas: 99 }, null, 2), 'hoja cambiada (objeto local)');

const worktrees = [];
function checkout(sha, nombre) {
  const d = path.join(base, nombre);
  g(['worktree', 'add', '-q', '--detach', d, sha]); worktrees.push(d);
  return d;
}
const modificar = (d) => fs.appendFileSync(path.join(d, 'src/App.jsx'), ATAQUE + '\n');
// lo que el E2E escribiría corriendo en `d` (medido) + lo que el atacante declara por entorno
function evidencia(d, { shaApp, shaGit, env = process.env } = {}) {
  const integ = evidenciaIntegridadGit(d, env);
  return { ...binario, headGit: integ.headGit, integridadGit: integ, arbolLimpio: g(['status', '--porcelain', '--untracked-files=no'], d) === '', shaApp: shaApp ?? integ.headGit.slice(0, 7), shaGit: shaGit ?? integ.headGit.slice(0, 7) };
}
function gitVe(d, env = ENV) {
  return `status [${g(['status', '--porcelain', '--untracked-files=no'], d, env).replace(/\n/g, ' ')}] · diff HEAD [${g(['diff', '--name-only', 'HEAD'], d, env).replace(/\n/g, ' ')}]`;
}

const casos = [];
const caso = (id, nombre, preparar) => casos.push({ id, nombre, preparar });
caso('A', 'checkout limpio exactamente en FINAL_SHA', () => { const d = checkout(FINAL, 'A'); return { b: evidencia(d), git: gitVe(d) }; });
caso('B', 'P1-HO-02: checkout B (FINAL + src/App.jsx) con LAB_GIT_SHA y GIT_SHA = FINAL', () => {
  const d = checkout(B, 'B'); return { b: evidencia(d, { shaApp: F7, shaGit: F7 }), git: gitVe(d) };
});
caso('C', 'P1-HO-03: FINAL + src/App.jsx modificado y marcado assume-unchanged (LAB_GIT_SHA y GIT_SHA = FINAL)', () => {
  const d = checkout(FINAL, 'C'); g(['update-index', '--assume-unchanged', 'src/App.jsx'], d); modificar(d);
  return { b: evidencia(d, { shaApp: F7, shaGit: F7 }), git: gitVe(d) };
});
caso('D', 'P1-HO-03: FINAL + src/App.jsx modificado y marcado skip-worktree', () => {
  const d = checkout(FINAL, 'D'); g(['update-index', '--skip-worktree', 'src/App.jsx'], d); modificar(d);
  return { b: evidencia(d, { shaApp: F7, shaGit: F7 }), git: gitVe(d) };
});
caso('D2', 'P1-HO-03: FINAL + src/App.jsx BORRADO y marcado skip-worktree', () => {
  const d = checkout(FINAL, 'D2'); g(['update-index', '--skip-worktree', 'src/App.jsx'], d); fs.rmSync(path.join(d, 'src/App.jsx'));
  return { b: evidencia(d, { shaApp: F7, shaGit: F7 }), git: gitVe(d) };
});
caso('D3', 'misma clase SIN banderas: mismo tamaño + mtime restaurado + core.trustctime=false (clon: es config del repo)', () => {
  const d = path.join(base, 'D3'); g(['clone', '-q', RAIZ, d]); g(['checkout', '-q', '--detach', FINAL], d);
  const f = path.join(d, 'src/App.jsx'); const viejo = new Date('2020-01-01T00:00:00Z');
  fs.utimesSync(f, viejo, viejo); g(['config', 'core.trustctime', 'false'], d); g(['config', 'core.checkStat', 'minimal'], d);
  g(['status', '--porcelain'], d); // la caché de stat del índice queda con el mtime viejo
  const t = fs.readFileSync(f, 'utf8'); const k = t.indexOf('import');
  fs.writeFileSync(f, t.slice(0, k) + 'IMPORT' + t.slice(k + 6)); fs.utimesSync(f, viejo, viejo); // mismo tamaño
  return { b: evidencia(d, { shaApp: F7, shaGit: F7 }), git: `${gitVe(d)} · ls-files -v [${g(['ls-files', '-v', 'src/App.jsx'], d)}]` };
});
caso('E', 'git replace: HEAD = FINAL, pero el árbol sacado es el de B (en un clon: refs/replace se comparte entre worktrees)', () => {
  const d = path.join(base, 'E'); g(['clone', '-q', RAIZ, d]); g(['checkout', '-q', '-b', 'holdout-b', FINAL], d);
  modificar(d); g(['commit', '-qam', 'B (sólo en el clon)'], d); const Bc = g(['rev-parse', 'HEAD'], d);
  g(['replace', FINAL, Bc], d, ENV_REPLACE); // FINAL "es" B mientras haya objetos replace
  g(['checkout', '-q', '--detach', FINAL], d, ENV_REPLACE);
  const conReplace = `con replace activo: HEAD=${g(['rev-parse', 'HEAD'], d, ENV_REPLACE).slice(0, 7)} ${gitVe(d, ENV_REPLACE)}`;
  return { b: evidencia(d, { shaApp: F7, shaGit: F7 }), git: conReplace };
});
caso('F', 'GIT_DIR / GIT_WORK_TREE / GIT_INDEX_FILE del E2E apuntando al checkout limpio del repo, mientras corre en uno con assume-unchanged', () => {
  const d = checkout(FINAL, 'F'); g(['update-index', '--assume-unchanged', 'src/App.jsx'], d); modificar(d);
  const desvio = { ...process.env, GIT_DIR: path.join(RAIZ, '.git'), GIT_WORK_TREE: RAIZ, GIT_INDEX_FILE: path.join(RAIZ, '.git/index') };
  const sinSanear = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: d, env: desvio, encoding: 'utf8' }).trim();
  return { b: evidencia(d, { shaApp: F7, shaGit: F7, env: desvio }), git: `${gitVe(d)} · sin sanear, git mediría ${sinSanear === RAIZ ? 'el repo limpio' : sinSanear}` };
});
caso('G', 'SHA visible de 1 carácter que "coincide" con el HEAD medido', () => {
  const d = checkout(FINAL, 'G'); return { b: evidencia(d, { shaApp: F7.slice(0, 1), shaGit: F7.slice(0, 1) }), git: gitVe(d) };
});
caso('H', 'hoja congelada: checkout C (FINAL + hoja ATPU2M cambiada), identidad honesta; la hoja se lee en el HEAD medido', () => {
  const d = checkout(C, 'H'); return { b: evidencia(d), git: gitVe(d) };
});
caso('H2', 'hoja congelada: checkout C con LAB_GIT_SHA y GIT_SHA = FINAL', () => {
  const d = checkout(C, 'H2'); return { b: evidencia(d, { shaApp: F7, shaGit: F7 }), git: gitVe(d) };
});

const filas = [];
try {
  for (const c of casos) {
    const r = c.preparar();
    const dir = path.join(base, `corrida-${c.id}`, hoja); fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(path.join(corrida, hoja))) fs.copyFileSync(path.join(corrida, hoja, f), path.join(dir, f));
    fs.writeFileSync(path.join(dir, '0-binario.json'), JSON.stringify(r.b, null, 1));
    const v = spawnSync('node', ['scripts/congelar_holdout.mjs', '--verificar', '--db', db, '--edges', edges, '--modelos', modelos, '--corrida', path.dirname(dir)], { encoding: 'utf8' });
    const ig = r.b.integridadGit;
    filas.push({ ...c, exit: v.status, git: r.git, medido: `headGit ${r.b.headGit.slice(0, 7)} · shaApp ${r.b.shaApp} · shaGit ${r.b.shaGit} · arbolLimpio ${r.b.arbolLimpio} · banderas [${ig.banderas.join(', ')}] · distintos [${ig.distintos.join(', ')}] · revisados ${ig.revisados}`, salida: (v.stdout + v.stderr).trim() });
  }
} finally {
  for (const d of worktrees) spawnSync('git', ['worktree', 'remove', '--force', d], { cwd: RAIZ, env: ENV });
  spawnSync('git', ['worktree', 'prune'], { cwd: RAIZ, env: ENV });
  fs.rmSync(base, { recursive: true, force: true });
}
console.log(`# FINAL_SHA = ${FINAL} · B = ${B} · C = ${C} (objetos locales)`);
for (const f of filas) {
  console.log(`\n## ${f.id} · ${f.nombre}\n- git ve: ${f.git}\n- 0-binario (medido + declarado): ${f.medido}\n- --verificar: exit ${f.exit} · ${f.salida.replace(/\n/g, ' ').slice(0, 400)}`);
}
const malos = filas.filter((f) => (f.id === 'A' ? f.exit !== 0 : f.exit === 0));
if (malos.length) { console.error(`\nFALLO: ${malos.map((f) => `${f.id} (exit ${f.exit})`).join(', ')}`); process.exit(1); }
console.error(`\nA da OK y los ${filas.length - 1} ataques fallan cerrado`);
