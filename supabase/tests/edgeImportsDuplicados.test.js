// Regresión 2026-10-13: costear-servidor-rc se desplegó con `import { revisarEstructura }` dos veces → "worker boot
// error: Identifier 'revisarEstructura' has already been declared": la función ni siquiera arrancaba (OPTIONS 503) y
// ningún costeo llegaba al servidor. Ningún index.ts de una Edge puede importar el mismo identificador dos veces.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs'; import path from 'node:path';

const RAIZ = 'supabase/functions';
const indices = fs.readdirSync(RAIZ).map((d) => path.join(RAIZ, d, 'index.ts')).filter((f) => fs.existsSync(f));

describe('Edge Functions: ningún identificador importado dos veces', () => {
  it.each(indices)('%s', (f) => {
    const s = fs.readFileSync(f, 'utf8');
    const nombres = [];
    for (const m of s.matchAll(/^import\s*\{([^}]+)\}\s*from/gm)) for (const x of m[1].split(',')) { const n = x.trim().split(/\s+as\s+/).pop().trim(); if (n) nombres.push(n); }
    for (const m of s.matchAll(/^import\s+([A-Za-z_$][\w$]*)\s*(?:,|from)/gm)) nombres.push(m[1]);
    const dup = nombres.filter((n, i) => nombres.indexOf(n) !== i);
    expect(dup, `importaciones duplicadas en ${f}`).toEqual([]);
  });
});
