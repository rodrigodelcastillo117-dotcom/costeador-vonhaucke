// Holdout v5.6 (P1-HO-03, auditoría de 6a0091e): los BYTES del checkout que sirvió son los del HEAD medido.
// `git status`, `git diff HEAD` y `git diff-files` quedan ciegos ante archivos versionados modificados si el índice dice
// que no hay que mirarlos: `assume-unchanged` y `skip-worktree` (comprobado con git 2.43; con `skip-worktree` y el archivo
// borrado, también). Y ante una modificación del MISMO tamaño con el mtime restaurado si la config local pone
// `core.trustctime=false`, que ni `git ls-files -v` delata. Por eso:
//   1. las banderas del índice se leen explícitamente (`git ls-files -v`: minúscula = assume-unchanged, `S` = skip-worktree;
//      con ambas, git muestra `h`), y
//   2. cada archivo del árbol de HEAD se compara por bytes: el sha1 de blob se calcula aquí con node sobre lo que hay en
//      disco y se compara con el que guarda el árbol de HEAD (`git ls-tree`). No pasa por el índice, la caché de stat, los
//      filtros ni el fsmonitor de git.
// Todo comando git corre con envGitLimpio (v5.5): sin variables GIT_* heredadas y con GIT_NO_REPLACE_OBJECTS=1.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { envGitLimpio } from '../src/datos/holdoutHuellas.js';

// sha1 de blob de git: sha1("blob <tamaño>\0" + bytes).
export const blobSha1 = (buf) => crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

// Salida de `git ls-files -v -z` → entradas cuyo flag oculta cambios: etiqueta en minúscula (assume-unchanged) o `S`
// (skip-worktree). Devuelve "<etiqueta> <ruta>".
export function banderasDelIndice(salidaZ) {
  return String(salidaZ || '').split('\0').filter(Boolean)
    .map((l) => ({ tag: l.slice(0, 1), ruta: l.slice(2) }))
    .filter(({ tag }) => tag === 'S' || (tag !== tag.toUpperCase()))
    .map(({ tag, ruta }) => `${tag} ${ruta}`);
}

// Mide el checkout que contiene `cwd`. `env` es el entorno heredado: se sanea antes de llamar a git.
export function medirIntegridadGit(cwd = process.cwd(), env = process.env) {
  const git = (args, dir) => execFileSync('git', args, { cwd: dir, env: envGitLimpio(env), maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');
  const raiz = git(['rev-parse', '--show-toplevel'], cwd).trim();
  const headGit = git(['rev-parse', 'HEAD'], raiz).trim();
  const banderas = banderasDelIndice(git(['ls-files', '-v', '-z'], raiz));
  const distintos = []; let revisados = 0;
  for (const linea of git(['ls-tree', '-r', '-z', '--full-tree', headGit], raiz).split('\0').filter(Boolean)) {
    const tab = linea.indexOf('\t');
    const [modo, tipo, sha] = linea.slice(0, tab).split(' ');
    const ruta = linea.slice(tab + 1);
    if (tipo !== 'blob') continue; // submódulos: no hay bytes propios que comparar
    revisados++;
    const abs = path.join(raiz, ruta);
    let bytes;
    try { bytes = modo === '120000' ? Buffer.from(fs.readlinkSync(abs)) : fs.readFileSync(abs); } catch { distintos.push(ruta); continue; }
    if (blobSha1(bytes) !== sha) distintos.push(ruta);
  }
  return { raiz, headGit, banderas, distintos, revisados };
}

// Lo que va a 0-binario.json (sin la ruta absoluta del checkout).
export function evidenciaIntegridadGit(cwd = process.cwd(), env = process.env) {
  const m = medirIntegridadGit(cwd, env);
  return { headGit: m.headGit, banderas: m.banderas.slice(0, 50), nBanderas: m.banderas.length, distintos: m.distintos.slice(0, 50), nDistintos: m.distintos.length, revisados: m.revisados };
}
