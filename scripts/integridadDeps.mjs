// Holdout v5.7 (P1-HO-04, auditoría de ecec624): las dependencias que EJECUTA el holdout (Vite, @vitejs/plugin-react,
// Playwright y todo lo que produce la evidencia) proceden de una instalación LIMPIA `npm ci` del lockfile congelado.
// `package-lock.json` dice QUÉ debería instalarse; no prueba que lo que de verdad está en node_modules sea eso. El ataque
// P1-HO-04 modifica un paquete instalado (p. ej. el transform del plugin React) sin tocar ningún archivo versionado ni el
// lockfile: git, integridadGit (sólo compara blobs de HEAD) y el SHA servido siguen limpios, pero el navegador recibe
// código alterado. Por eso:
//   1. El runner oficial (prepararEntornoHoldout.mjs) hace worktree limpio → rm -rf node_modules → `npm ci` del lockfile
//      congelado → borra cachés de runtime → mide node_modules → escribe holdout-deps.json. Nunca reutiliza una instalación.
//   2. El E2E vuelve a medir node_modules EN VIVO y lo escribe en 0-binario.json junto al registro de la preparación.
//   3. El verificador exige: lockfile de la preparación = lockfile congelado; hash medido en vivo = hash de la preparación
//      (la instalación no cambió entre preparar y correr); npm ci ok, instalación fresca, sin reutilizar.
// `npm ci` borra node_modules y reinstala desde el lockfile verificando el `integrity` (sha512) de cada tarball: un paquete
// con bytes distintos a los del lockfile no se instala. Frontera declarada (fuera de alcance): operador root que modifique
// memoria/Node/FS/registro DESPUÉS de las comprobaciones, proxy externo o SO comprometido. node_modules ordinario ya NO.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// v5.8 (P1-HO-05): se hashea TODO node_modules, sin exclusiones. En v5.7 se excluían `.vite` y `.cache` por "caché de
// runtime", pero Vite 5 PREEMPAQUETA las dependencias en `node_modules/.vite/deps/*.js` y el navegador EJECUTA esos
// archivos en el dev server (p. ej. react.js). Excluirlos dejaba una vía para servir código alterado (envenenar un
// prebundle tras preparar) sin huella. Comprobado: `node_modules/.vite` es byte-estable entre reinicios del dev server
// sin `--force`, así que el runner lo genera en la preparación con `vite optimize` (determinista, reutilizado byte a byte
// por la corrida) y entra a la huella. No hay whitelist: si cambia un byte de cualquier archivo instalado o preempaquetado,
// el hash cambia. `node_modules/.cache` no existe en esta instalación; si apareciera, también entraría al hash.

// sha256 estable de TODO node_modules: por cada entrada (ordenada) la ruta relativa + tipo + (bytes del archivo | destino
// del symlink). No se siguen symlinks de directorio (se registra su destino): evita ciclos y cubre los .bin.
export function hashNodeModules(raiz) {
  const nm = path.join(raiz, 'node_modules');
  if (!fs.existsSync(nm)) return { nodeModulesHash: null, archivos: 0, bytes: 0 };
  const archivos = [];
  const walk = (d) => {
    let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      const rel = path.relative(nm, p);
      if (e.isDirectory()) walk(p); else archivos.push(rel); // isDirectory() es false para symlinks a directorio
    }
  };
  walk(nm);
  archivos.sort();
  const h = crypto.createHash('sha256');
  let bytes = 0;
  for (const rel of archivos) {
    const abs = path.join(nm, rel);
    let st; try { st = fs.lstatSync(abs); } catch { h.update(rel); h.update('\0X\0'); continue; }
    h.update(rel); h.update('\0');
    if (st.isSymbolicLink()) { h.update('L\0'); h.update(fs.readlinkSync(abs)); }
    else if (st.isFile()) { h.update('F\0'); const b = fs.readFileSync(abs); bytes += b.length; h.update(b); }
    else { h.update('O\0'); }
  }
  return { nodeModulesHash: h.digest('hex'), archivos: archivos.length, bytes };
}

export const sha256Archivo = (f) => { try { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); } catch { return null; } };

// Lo que el E2E mide EN VIVO de la instalación que de verdad ejecutó, para 0-binario.json.
export function evidenciaDepsEjecutadas(raiz = process.cwd()) {
  const r = hashNodeModules(raiz);
  return { nodeModulesHash: r.nodeModulesHash, archivos: r.archivos, bytes: r.bytes, lockfileSha256: sha256Archivo(path.join(raiz, 'package-lock.json')) };
}

// El registro de la preparación limpia (holdout-deps.json) que escribe el runner oficial. Lo lee el E2E y lo copia a
// 0-binario.json. `prep` es válido sólo si demuestra una instalación fresca por npm ci, con su hash y el sha del lockfile.
export const prepDepsValida = (p) => !!p && typeof p === 'object' && p.metodo === 'npm ci' && p.npmCiOk === true
  && p.freshInstall === true && p.reutilizado === false && /^[0-9a-f]{64}$/.test(String(p.lockfileSha256 || ''))
  && /^[0-9a-f]{64}$/.test(String(p.nodeModulesHash || '')) && Number.isInteger(p.archivos) && p.archivos > 0;
