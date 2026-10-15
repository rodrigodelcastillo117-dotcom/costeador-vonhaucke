// Holdout v5.6 (P1-HO-03) · integridad por bytes del checkout, contra repositorios git REALES (temporales).
// Cada caso prueba primero que el ataque existe (git status / diff HEAD no lo ven) y luego que medirIntegridadGit lo ve.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { medirIntegridadGit, banderasDelIndice, blobSha1 } from './integridadGit.mjs';

const hayGit = spawnSync('git', ['--version']).status === 0;
// Entorno para PREPARAR los repos: sin GIT_* heredadas (como el holdout) y con los objetos `git replace` activos.
const ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_/i.test(k)));
const APP = 'export default function App() { return 1; }\n';

function repo() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'holdout-integridad-'));
  const g = (...a) => execFileSync('git', ['-c', 'user.name=holdout', '-c', 'user.email=holdout@local', '-c', 'commit.gpgsign=false', ...a], { cwd: d, env: ENV, encoding: 'utf8' });
  g('init', '-q');
  fs.mkdirSync(path.join(d, 'src'));
  fs.writeFileSync(path.join(d, 'src/App.jsx'), APP);
  fs.writeFileSync(path.join(d, 'src/motor.js'), 'export const precio = 100;\n');
  g('add', '-A'); g('commit', '-qm', 'congelado');
  return { d, g, head: g('rev-parse', 'HEAD').trim(), app: path.join(d, 'src/App.jsx') };
}
const modificar = (f) => fs.appendFileSync(f, "globalThis.__ataque = 'P1-HO-03';\n");

describe.skipIf(!hayGit)('Holdout v5.6 · P1-HO-03 · los bytes del checkout son los del HEAD medido (git real)', () => {
  it('A · checkout limpio en el commit congelado ⇒ sin banderas, sin archivos distintos', () => {
    const r = repo();
    expect(medirIntegridadGit(r.d, ENV)).toEqual({ raiz: fs.realpathSync(r.d), headGit: r.head, banderas: [], distintos: [], revisados: 2 });
  });
  it('C · ATAQUE assume-unchanged: git status y git diff HEAD no ven src/App.jsx modificado; la integridad sí', () => {
    const r = repo();
    r.g('update-index', '--assume-unchanged', 'src/App.jsx'); modificar(r.app);
    expect(r.g('status', '--porcelain', '--untracked-files=no')).toBe('');
    expect(r.g('diff', '--name-only', 'HEAD')).toBe('');
    const m = medirIntegridadGit(r.d, ENV);
    expect(m.headGit).toBe(r.head);
    expect(m.banderas).toEqual(['h src/App.jsx']);
    expect(m.distintos).toEqual(['src/App.jsx']);
  });
  it('D · ATAQUE skip-worktree: modificado o BORRADO, git status no lo ve; la integridad sí', () => {
    const r = repo();
    r.g('update-index', '--skip-worktree', 'src/App.jsx'); modificar(r.app);
    expect(r.g('status', '--porcelain', '--untracked-files=no')).toBe('');
    let m = medirIntegridadGit(r.d, ENV);
    expect(m.banderas).toEqual(['S src/App.jsx']);
    expect(m.distintos).toEqual(['src/App.jsx']);
    fs.rmSync(r.app);
    expect(r.g('status', '--porcelain', '--untracked-files=no')).toBe('');
    m = medirIntegridadGit(r.d, ENV);
    expect(m.distintos).toEqual(['src/App.jsx']);
  });
  it('C+D · con ambas banderas git muestra `h` (no `S`): igual se detecta', () => {
    const r = repo();
    r.g('update-index', '--assume-unchanged', '--skip-worktree', 'src/App.jsx'); modificar(r.app);
    const m = medirIntegridadGit(r.d, ENV);
    expect(m.banderas).toEqual(['h src/App.jsx']);
    expect(m.distintos).toEqual(['src/App.jsx']);
  });
  it('misma clase, SIN banderas: mismo tamaño + mtime restaurado + core.trustctime=false ⇒ git status ciego; los bytes no', () => {
    const r = repo();
    const viejo = new Date('2020-01-01T00:00:00Z');
    fs.utimesSync(r.app, viejo, viejo);
    r.g('config', 'core.trustctime', 'false'); r.g('config', 'core.checkStat', 'minimal');
    r.g('status', '--porcelain'); // la caché de stat del índice queda con el mtime viejo
    fs.writeFileSync(r.app, APP.replace('return 1', 'return 7')); // mismo tamaño
    fs.utimesSync(r.app, viejo, viejo);
    expect(r.g('status', '--porcelain', '--untracked-files=no')).toBe('');
    expect(r.g('ls-files', '-v', 'src/App.jsx').trim()).toBe('H src/App.jsx');
    const m = medirIntegridadGit(r.d, ENV);
    expect(m.banderas).toEqual([]);
    expect(m.distintos).toEqual(['src/App.jsx']);
  });
  it('E · ATAQUE git replace: HEAD = commit congelado pero el árbol sacado es el de B ⇒ GIT_NO_REPLACE_OBJECTS lo destapa', () => {
    const r = repo();
    const rama = r.g('rev-parse', '--abbrev-ref', 'HEAD').trim();
    r.g('checkout', '-qb', 'b'); modificar(r.app); r.g('commit', '-qam', 'B');
    const B = r.g('rev-parse', 'HEAD').trim();
    r.g('replace', r.head, B); // el commit congelado "es" B para git mientras haya objetos replace
    r.g('checkout', '-q', rama);
    expect(r.g('rev-parse', 'HEAD').trim()).toBe(r.head); // la identidad sigue siendo la del congelado…
    expect(r.g('status', '--porcelain', '--untracked-files=no')).toBe(''); // …y git, con replace, lo ve limpio
    expect(fs.readFileSync(r.app, 'utf8')).toContain('P1-HO-03'); // pero en disco está B
    const m = medirIntegridadGit(r.d, ENV);
    expect(m.headGit).toBe(r.head);
    expect(m.distintos).toEqual(['src/App.jsx']);
  });
  it('F · GIT_DIR / GIT_WORK_TREE / GIT_INDEX_FILE apuntando a un checkout limpio no tapan el checkout que se mide', () => {
    const limpio = repo();
    const sucio = repo();
    sucio.g('update-index', '--assume-unchanged', 'src/App.jsx'); modificar(sucio.app);
    const desvio = { ...ENV, GIT_DIR: path.join(limpio.d, '.git'), GIT_WORK_TREE: limpio.d, GIT_INDEX_FILE: path.join(limpio.d, '.git/index') };
    // sin sanear, git mediría el checkout limpio aunque el cwd sea el sucio
    expect(execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: sucio.d, env: desvio, encoding: 'utf8' }).trim()).toBe(fs.realpathSync(limpio.d));
    const m = medirIntegridadGit(sucio.d, desvio);
    expect(m.raiz).toBe(fs.realpathSync(sucio.d));
    expect(m.headGit).toBe(sucio.head);
    expect(m.banderas).toEqual(['h src/App.jsx']);
    expect(m.distintos).toEqual(['src/App.jsx']);
  });
});

describe('Holdout v5.6 · piezas puras de la integridad', () => {
  it('blobSha1 = el sha de blob de git', () => {
    expect(blobSha1(Buffer.from(''))).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
    expect(blobSha1(Buffer.from('hello\n'))).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
  });
  it('banderasDelIndice: minúscula (assume-unchanged) o S (skip-worktree); H, M, R, C y vacío no', () => {
    expect(banderasDelIndice('H a.js\0h b.js\0S c.js\0s d.js\0M e.js\0R f.js\0C g.js\0')).toEqual(['h b.js', 'S c.js', 's d.js']);
    expect(banderasDelIndice('')).toEqual([]);
    expect(banderasDelIndice(undefined)).toEqual([]);
  });
});
