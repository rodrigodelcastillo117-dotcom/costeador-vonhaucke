// P1-HO-01 META-TEST · la certificación del holdout es FAIL-CLOSED.
//
// Prueba el INVARIANTE de lab/certificacion/caso.sh rama holdout-*): el exit del job de holdout
// debe seguir al VERIFICADOR (congelar_holdout --verificar), NUNCA al de Playwright. El bug que
// HO-01 corrigió era justo lo contrario: la rama terminaba en el `pw` y PASABA sin verificar el
// MANIFIESTO congelado. Si alguien revierte ese arreglo (p. ej. borra la guarda del vr, o deja el
// exit del pw como el del job), este test debe ponerse rojo.
//
// Método honesto: NO reimplementa la lógica — COPIA el caso.sh REAL del repo a un sandbox aislado
// y lo ejecuta, con `node`, `npx` y `git` apuntados a stubs que controlan dos únicas señales:
//   META_PW_EXIT        → lo que "devuelve" la corrida de Playwright (labCostear.e2e.js)
//   META_VERIFIER_EXIT  → lo que "devuelve" congelar_holdout --verificar (0 OK / 1 CAMBIO / 2 NO_VERIFICADO)
// El stub del verificador deja un marcador en disco: así comprobamos ADEMÁS que, cuando la corrida
// falla, el verificador NI SIQUIERA se ejecuta (no se "certifica" sobre una corrida rota).
//
// Al copiar el caso.sh REAL en cada corrida, el test siempre valida el script que se despliega: no
// hay copia que pueda quedar desfasada.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CASO_SH_REAL = fileURLToPath(new URL('./caso.sh', import.meta.url));

let sandbox, root, binDir, marker;

function stub(file, body) {
  fs.writeFileSync(file, body, { mode: 0o755 });
  fs.chmodSync(file, 0o755);
}

beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ho01meta-'));
  root = path.join(sandbox, 'root');                       // RAIZ que caso.sh deduce con cd ../..
  fs.mkdirSync(path.join(root, 'lab', 'certificacion'), { recursive: true });
  fs.mkdirSync(path.join(sandbox, 'envh'), { recursive: true }); // ../envh (hermano de root) para `cd ../envh`
  binDir = path.join(sandbox, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  marker = path.join(sandbox, 'verifier-ran');

  // El caso.sh REAL del repo, tal cual. Sin esto el test valida una copia que puede divergir.
  fs.copyFileSync(CASO_SH_REAL, path.join(root, 'lab', 'certificacion', 'caso.sh'));

  // node: despacha por argumento. -e con 'playwright'/'MANIFIESTO' imprime un valor; los .mjs del
  // holdout salen 0, salvo congelar_holdout que deja el marcador y propaga META_VERIFIER_EXIT.
  stub(path.join(binDir, 'node'), `#!/usr/bin/env bash
if [ "$1" = "-e" ]; then
  case "$2" in
    *playwright*) echo "/fake/chrome" ;;
    *MANIFIESTO*) echo "deadbeefsha" ;;
    *) echo "" ;;
  esac
  exit 0
fi
case "$*" in
  *prepararEntornoHoldout*) exit 0 ;;
  *congelar_holdout*) : > "$META_MARKER"; exit "\${META_VERIFIER_EXIT:-0}" ;;
  *) exit 0 ;;
esac
`);
  // npx: sólo nos importa `playwright test` → propaga META_PW_EXIT (la "corrida").
  stub(path.join(binDir, 'npx'), `#!/usr/bin/env bash
case "$*" in
  *playwright*) exit "\${META_PW_EXIT:-0}" ;;
  *) exit 0 ;;
esac
`);
  // git: caso.sh sólo usa rev-parse en esta rama.
  stub(path.join(binDir, 'git'), `#!/usr/bin/env bash
[ "$1" = "rev-parse" ] && echo "deadbee"
exit 0
`);
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

function correrHoldout({ pw, verifier }) {
  const env = {
    PATH: `${binDir}:${process.env.PATH}`,
    META_PW_EXIT: String(pw),
    META_VERIFIER_EXIT: String(verifier),
    META_MARKER: marker,
  };
  const r = spawnSync('bash', [path.join(root, 'lab', 'certificacion', 'caso.sh'), 'holdout-r1'], {
    env, encoding: 'utf8', timeout: 30000,
  });
  return { status: r.status, verifierRan: fs.existsSync(marker), stdout: r.stdout, stderr: r.stderr };
}

describe('P1-HO-01 · la certificación del holdout es fail-closed (exit = verificador, no Playwright)', () => {
  it('corrida OK + verificador OK (0) → job PASA (exit 0), y el verificador corrió', () => {
    const r = correrHoldout({ pw: 0, verifier: 0 });
    expect(r.status).toBe(0);
    expect(r.verifierRan).toBe(true);
  });

  it('corrida OK pero verificador CAMBIO (1) → job FALLA con 1, aunque Playwright pasó', () => {
    const r = correrHoldout({ pw: 0, verifier: 1 });
    expect(r.status).toBe(1);             // el exit del job es el del verificador
    expect(r.verifierRan).toBe(true);
  });

  it('corrida OK pero verificador NO_VERIFICADO (2) → job FALLA con 2', () => {
    const r = correrHoldout({ pw: 0, verifier: 2 });
    expect(r.status).toBe(2);
    expect(r.verifierRan).toBe(true);
  });

  it('corrida FALLA (pw exit 3) → job FALLA con 3 y el verificador NO se ejecuta (no se certifica sobre una corrida rota)', () => {
    const r = correrHoldout({ pw: 3, verifier: 0 });
    expect(r.status).toBe(3);             // el exit del job es el de la corrida
    expect(r.verifierRan).toBe(false);    // clave: no llegó a "certificar"
  });

  it('CERO falsos verdes: ningún verificador distinto de 0 deja pasar el job (barrido 1..5)', () => {
    for (const v of [1, 2, 3, 4, 5]) {
      const r = correrHoldout({ pw: 0, verifier: v });
      expect(r.status, `verificador=${v}`).toBe(v);
      expect(r.status, `verificador=${v}`).not.toBe(0);
    }
  });
});
