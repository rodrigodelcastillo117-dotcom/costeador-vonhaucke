#!/usr/bin/env node
// ============================================================================
//  Contador HEURÍSTICO de "static guards": casos de prueba (it/test) que comparan el TEXTO de un
//  archivo fuente (readFileSync / read / leer → .toContain / .toMatch / .includes) en lugar de
//  ejecutar el comportamiento. Uso:  node scripts/contarStaticGuards.mjs [--detalle] [--ref <commit>]
//
//  Heurística (documentada en docs/auditoria/STATIC_GUARDS_A_COMPORTAMIENTO_20261014.md):
//   · variable "texto fuente" = asignada desde readFileSync(...) / read(...) / leer(...) o un .slice/.substring
//     de otra variable texto fuente;
//   · un caso it/test es string-assert si dentro de él hay expect(<texto fuente>…) o expect(<re>.test(<texto>))
//     o expect(<texto>.includes(…)). Los casos que leen SQL para EJECUTARLO en PGlite no cuentan (no hacen
//     expect sobre el texto).
//  Es una medida aproximada (no un parser): sirve para comparar antes/después con la MISMA regla.
// ============================================================================
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const args = process.argv.slice(2);
const detalle = args.includes('--detalle');
const iRef = args.indexOf('--ref');
const ref = iRef >= 0 ? args[iRef + 1] : null;

const listar = () => {
  const cmd = ref ? `git ls-tree -r --name-only ${ref}` : 'git ls-files --cached --others --exclude-standard';
  return execSync(cmd, { encoding: 'utf8', maxBuffer: 64 << 20 }).split('\n')
    .filter((f) => /\.test\.(m?js|jsx|ts|tsx)$/.test(f))
    .filter((f) => /^(src|supabase|e2e|bench|lab|scripts)\//.test(f));
};
const leerArchivo = (f) => (ref ? execSync(`git show ${ref}:${f}`, { encoding: 'utf8', maxBuffer: 64 << 20 }) : fs.readFileSync(f, 'utf8'));

function analizar(src) {
  const taint = new Set();
  const reFuente = /(?:const|let|var)\s+(\w+)\s*=\s*(?:fs\.|node_fs\.)?(?:readFileSync|read|leer|leerFuente|fuente)\s*\(/g;
  let m;
  while ((m = reFuente.exec(src))) taint.add(m[1]);
  // Propagación por slice/substring (varias pasadas).
  for (let k = 0; k < 4; k++) {
    const reSlice = /(?:const|let|var)\s+(\w+)\s*=\s*(\w+)\s*\.\s*(?:slice|substring|substr)\s*\(/g;
    while ((m = reSlice.exec(src))) if (taint.has(m[2])) taint.add(m[1]);
  }
  // Bloques it/test.
  const idx = [];
  const reIt = /\b(?:it|test)(?:\.(?:fails|skip|only|todo))?\s*\(/g;
  while ((m = reIt.exec(src))) idx.push(m.index);
  const casos = [];
  for (let i = 0; i < idx.length; i++) {
    const cuerpo = src.slice(idx[i], i + 1 < idx.length ? idx[i + 1] : src.length);
    const nombre = (cuerpo.match(/\(\s*(['"`])(.*?)\1/) || [])[2] || '?';
    let asserts = 0;
    const directos = /expect\s*\(\s*(?:fs\.)?readFileSync\s*\(/g;
    asserts += (cuerpo.match(directos) || []).length;
    for (const v of taint) {
      const reV = new RegExp(`expect\\s*\\(\\s*(?:${v}\\b|[^)]*?\\.test\\(\\s*${v}\\s*\\)|${v}\\s*\\.\\s*(?:includes|indexOf|match))`, 'g');
      asserts += (cuerpo.match(reV) || []).length;
    }
    casos.push({ nombre, asserts });
  }
  return casos;
}

let totalCasos = 0, totalAsserts = 0, archivos = 0;
const filas = [];
for (const f of listar()) {
  let src;
  try { src = leerArchivo(f); } catch { continue; }
  const casos = analizar(src).filter((c) => c.asserts > 0);
  if (!casos.length) continue;
  archivos++;
  totalCasos += casos.length;
  const a = casos.reduce((s, c) => s + c.asserts, 0);
  totalAsserts += a;
  filas.push({ f, casos: casos.length, asserts: a });
}
filas.sort((x, y) => y.casos - x.casos || x.f.localeCompare(y.f));
if (detalle) for (const r of filas) console.log(`${String(r.casos).padStart(3)} casos  ${String(r.asserts).padStart(4)} expect  ${r.f}`);
console.log(JSON.stringify({ ref: ref || 'worktree', archivos, casos: totalCasos, expects: totalAsserts }));
