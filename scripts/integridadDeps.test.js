// Holdout v5.8 (P1-HO-05) · hash estable de node_modules ENTERO (incl. node_modules/.vite) y validez de la atestación.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hashNodeModules, sha256Archivo, evidenciaDepsEjecutadas, prepDepsValida } from './integridadDeps.mjs';

function raizFalsa(arbol) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'holdout-deps-'));
  const nm = path.join(d, 'node_modules');
  for (const [rel, val] of Object.entries(arbol)) {
    const abs = path.join(nm, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (val && val.symlink) fs.symlinkSync(val.symlink, abs);
    else fs.writeFileSync(abs, val);
  }
  return d;
}

describe('Holdout v5.7 · hash de node_modules', () => {
  it('determinista: mismo árbol ⇒ mismo hash; el orden de creación no importa', () => {
    const a = raizFalsa({ 'vite/bin/vite.js': 'A', 'b/index.js': 'B' });
    const b = raizFalsa({ 'b/index.js': 'B', 'vite/bin/vite.js': 'A' });
    const ha = hashNodeModules(a), hb = hashNodeModules(b);
    expect(ha.nodeModulesHash).toBe(hb.nodeModulesHash);
    expect(ha.archivos).toBe(2);
    expect(/^[0-9a-f]{64}$/.test(ha.nodeModulesHash)).toBe(true);
  });
  it('un byte distinto en CUALQUIER dependencia cambia el hash (el ataque P1-HO-04)', () => {
    const limpio = raizFalsa({ '@vitejs/plugin-react/dist/index.js': 'transform(){return code;}' });
    const h1 = hashNodeModules(limpio).nodeModulesHash;
    fs.appendFileSync(path.join(limpio, 'node_modules/@vitejs/plugin-react/dist/index.js'), "\nglobalThis.__ATAQUE='P1-HO-04';\n");
    expect(hashNodeModules(limpio).nodeModulesHash).not.toBe(h1);
  });
  it('P1-HO-05: envenenar un prebundle de node_modules/.vite/deps SÍ cambia el hash (el navegador lo ejecuta)', () => {
    const r = raizFalsa({ 'vite/bin/vite.js': 'A', '.vite/deps/react.js': 'export default React;' });
    const h1 = hashNodeModules(r).nodeModulesHash;
    // el ataque de la clase: alterar el código preempaquetado que el navegador ejecuta en el dev server, sin tocar nada versionado
    fs.appendFileSync(path.join(r, 'node_modules/.vite/deps/react.js'), "\nglobalThis.__HOLDOUT_VITE_CACHE_ATTACK='P1-HO-05';\n");
    expect(hashNodeModules(r).nodeModulesHash).not.toBe(h1);
  });
  it('P1-HO-05: ya NO hay whitelist — un archivo nuevo bajo node_modules/.vite o .cache cambia el hash', () => {
    const r = raizFalsa({ 'vite/bin/vite.js': 'A', '.vite/deps/_metadata.json': '{}' });
    const h1 = hashNodeModules(r).nodeModulesHash;
    fs.mkdirSync(path.join(r, 'node_modules/.cache'), { recursive: true });
    fs.writeFileSync(path.join(r, 'node_modules/.cache/x'), 'y');
    expect(hashNodeModules(r).nodeModulesHash).not.toBe(h1);
    fs.writeFileSync(path.join(r, 'node_modules/.vite/deps/chunk.js'), 'cualquier cosa');
    expect(hashNodeModules(r).nodeModulesHash).not.toBe(h1);
  });
  it('los symlinks (.bin) cuentan por su destino, no se siguen como directorio', () => {
    const r = raizFalsa({ 'vite/bin/vite.js': 'A', '.bin/vite': { symlink: '../vite/bin/vite.js' } });
    const h1 = hashNodeModules(r).nodeModulesHash;
    fs.rmSync(path.join(r, 'node_modules/.bin/vite')); fs.symlinkSync('../otro/destino', path.join(r, 'node_modules/.bin/vite'));
    expect(hashNodeModules(r).nodeModulesHash).not.toBe(h1);
  });
  it('sin node_modules ⇒ hash null', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'holdout-deps-'));
    expect(hashNodeModules(d)).toEqual({ nodeModulesHash: null, archivos: 0, bytes: 0 });
  });
  it('evidenciaDepsEjecutadas trae hash + lockfile sha256 + archivos', () => {
    const r = raizFalsa({ 'vite/bin/vite.js': 'A' });
    fs.writeFileSync(path.join(r, 'package-lock.json'), '{"lockfileVersion":3}');
    const e = evidenciaDepsEjecutadas(r);
    expect(/^[0-9a-f]{64}$/.test(e.nodeModulesHash)).toBe(true);
    expect(e.lockfileSha256).toBe(sha256Archivo(path.join(r, 'package-lock.json')));
    expect(e.archivos).toBe(1);
  });
  it('prepDepsValida: sólo acepta un registro de npm ci fresco, sin reutilizar, con hashes de 64 hex', () => {
    const ok = { metodo: 'npm ci', npmCiOk: true, freshInstall: true, reutilizado: false, lockfileSha256: 'a'.repeat(64), nodeModulesHash: 'b'.repeat(64), archivos: 10 };
    expect(prepDepsValida(ok)).toBe(true);
    expect(prepDepsValida({ ...ok, npmCiOk: false })).toBe(false);
    expect(prepDepsValida({ ...ok, freshInstall: false })).toBe(false);
    expect(prepDepsValida({ ...ok, reutilizado: true })).toBe(false);
    expect(prepDepsValida({ ...ok, metodo: 'cp -al' })).toBe(false);
    expect(prepDepsValida({ ...ok, lockfileSha256: 'corto' })).toBe(false);
    expect(prepDepsValida({ ...ok, archivos: 0 })).toBe(false);
    expect(prepDepsValida(null)).toBe(false);
  });
});
