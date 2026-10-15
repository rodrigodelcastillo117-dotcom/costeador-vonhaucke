#!/usr/bin/env node
// Runner oficial del holdout (v5.7, P1-HO-04): prepara un entorno EFÍMERO y verificable, del que luego salen Vite y
// Playwright. No depende de pasos a mano ni reutiliza instalaciones previas.
//   node scripts/prepararEntornoHoldout.mjs <dir-destino> [sha]
// 1) worktree limpio del sha (por defecto HEAD); 2) aborta si integridadGit no está limpio (reusa P1-HO-02/03);
// 3) rm -rf node_modules (nunca se reutiliza ni se aceptan hardlinks de otra instalación); 4) `npm ci` del lockfile
// congelado; 5) borra cachés de runtime (node_modules/.vite, .cache); 6) mide node_modules; 7) escribe holdout-deps.json.
// Falla cerrado (exit != 0) si el checkout no es byte a byte, si npm ci falla, o si no puede medir la instalación.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { envGitLimpio } from '../src/datos/holdoutHuellas.js';
import { medirIntegridadGit } from './integridadGit.mjs';
import { hashNodeModules, sha256Archivo } from './integridadDeps.mjs';

const [destino, shaArg] = process.argv.slice(2);
if (!destino) { console.error('uso: prepararEntornoHoldout.mjs <dir-destino> [sha]'); process.exit(2); }
const RAIZ = process.cwd();
const ENV = envGitLimpio(process.env);
const git = (args, cwd = RAIZ) => execFileSync('git', args, { cwd, env: ENV, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();

const sha = git(['rev-parse', shaArg || 'HEAD']);
const abs = path.resolve(destino);

// 1) worktree limpio y exclusivo
try { git(['worktree', 'remove', '--force', abs]); } catch (_e) {}
fs.rmSync(abs, { recursive: true, force: true });
git(['worktree', 'add', '-q', '--detach', abs, sha]);

// 2) el checkout es el sha byte a byte (sin banderas del índice ni blobs distintos)
const ig = medirIntegridadGit(abs, process.env);
if (ig.headGit !== sha || ig.banderas.length || ig.distintos.length) {
  console.error(`ABORTO: el checkout no es ${sha.slice(0, 7)} byte a byte (HEAD ${ig.headGit.slice(0, 7)}, banderas ${ig.banderas.length}, distintos ${ig.distintos.length})`);
  process.exit(3);
}

// 3) + 4) instalación limpia desde el lockfile congelado (nunca se reutiliza node_modules)
fs.rmSync(path.join(abs, 'node_modules'), { recursive: true, force: true });
let npmCiOk = false;
try { execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: abs, env: process.env, stdio: 'inherit', maxBuffer: 1 << 28 }); npmCiOk = true; } catch (_e) { npmCiOk = false; }
if (!npmCiOk) { console.error('ABORTO: `npm ci` falló'); process.exit(4); }

// 5) borra cachés de runtime para que Vite/esbuild las reconstruyan desde la instalación limpia
for (const c of ['.vite', '.cache']) fs.rmSync(path.join(abs, 'node_modules', c), { recursive: true, force: true });

// 6) + 7) mide la instalación y deja la evidencia de la preparación
const hm = hashNodeModules(abs);
if (!hm.nodeModulesHash || !hm.archivos) { console.error('ABORTO: no se pudo medir node_modules tras npm ci'); process.exit(5); }
const rec = {
  metodo: 'npm ci',
  sha,
  freshInstall: true,
  reutilizado: false,
  npmCiOk: true,
  lockfileSha256: sha256Archivo(path.join(abs, 'package-lock.json')),
  nodeModulesHash: hm.nodeModulesHash,
  archivos: hm.archivos,
  bytes: hm.bytes,
  nodeVersion: process.version,
  npmVersion: execFileSync('npm', ['-v'], { encoding: 'utf8' }).trim(),
  preparadoEn: new Date().toISOString(),
};
fs.writeFileSync(path.join(abs, 'holdout-deps.json'), JSON.stringify(rec, null, 2));
console.log(`PREPARADO ${abs}`);
console.log(`  sha ${sha.slice(0, 7)} · node_modules ${hm.archivos} archivos ${(hm.bytes / 1e6).toFixed(0)} MB · hash ${hm.nodeModulesHash.slice(0, 16)} · lockfile ${rec.lockfileSha256.slice(0, 16)} · node ${rec.nodeVersion} npm ${rec.npmVersion}`);
