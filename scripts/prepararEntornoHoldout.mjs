#!/usr/bin/env node
// Runner oficial del holdout (v5.8, P1-HO-05): prepara un entorno EFÍMERO y verificable, del que luego salen Vite y
// Playwright. No depende de pasos a mano ni reutiliza instalaciones previas.
//   node scripts/prepararEntornoHoldout.mjs <dir-destino> [sha]
// 1) worktree limpio del sha (por defecto HEAD); 2) aborta si integridadGit no está limpio (reusa P1-HO-02/03);
// 3) rm -rf node_modules (nunca se reutiliza ni se aceptan hardlinks de otra instalación); 4) `npm ci` del lockfile
// congelado; 5) PREEMPAQUETA las dependencias con `vite optimize` (genera node_modules/.vite determinista que el dev
// server REUTILIZA byte a byte sin re-optimizar); 6) mide node_modules ENTERO, con .vite dentro; 7) escribe holdout-deps.json.
// Falla cerrado (exit != 0) si el checkout no es byte a byte, si npm ci o el preempaquetado fallan, o si no puede medir.
// v5.8: antes (v5.7) el paso 5 BORRABA node_modules/.vite y lo dejaba fuera de la huella. Pero Vite 5 sirve al navegador
// los prebundles de node_modules/.vite/deps/*.js (react, react-dom, @supabase, jspdf, pdfjs, recharts): son código EJECUTADO.
// Dejarlos fuera permitía envenenar un prebundle tras preparar y aun así obtener OK (P1-HO-05). Ahora se GENERAN en la
// preparación (reproducible) y ENTRAN a la huella; la corrida los reutiliza y el verificador exige hash_corrida == hash_prep.
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

// 5) PREEMPAQUETA las dependencias que el navegador ejecuta (node_modules/.vite/deps) de forma reproducible. `vite optimize`
// recorre el grafo de imports desde index.html y escribe .vite igual que lo haría el dev server, pero SIN levantar servidor,
// así que es determinista y sin condiciones de carrera. Comprobado: el dev server reutiliza este .vite byte a byte, sin
// re-optimizar (no se pasa --force). Entra a la huella en el paso 6. Entorno mínimo: `vite optimize` no depende de las vars
// VITE_* del holdout (sólo preempaqueta dependencias), así que se corre con el entorno limpio del worktree.
let viteOptimizeOk = false;
try {
  execFileSync(path.join(abs, 'node_modules', '.bin', 'vite'), ['optimize'], { cwd: abs, env: process.env, stdio: 'inherit', maxBuffer: 1 << 28 });
  viteOptimizeOk = true;
} catch (_e) { viteOptimizeOk = false; }
if (!viteOptimizeOk) { console.error('ABORTO: `vite optimize` (preempaquetado de dependencias) falló'); process.exit(6); }
if (!fs.existsSync(path.join(abs, 'node_modules', '.vite', 'deps'))) {
  console.error('ABORTO: `vite optimize` no generó node_modules/.vite/deps'); process.exit(6);
}

// 6) + 7) mide la instalación ENTERA (incluyendo node_modules/.vite, los prebundles que el navegador ejecuta) y deja la evidencia
const hm = hashNodeModules(abs);
if (!hm.nodeModulesHash || !hm.archivos) { console.error('ABORTO: no se pudo medir node_modules tras npm ci'); process.exit(5); }
const rec = {
  metodo: 'npm ci',
  sha,
  freshInstall: true,
  reutilizado: false,
  npmCiOk: true,
  viteOptimize: true,
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
