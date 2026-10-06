import { describe, it, expect } from 'vitest';
import { transformWithEsbuild } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

async function parseTs(rel) {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  const r = await transformWithEsbuild(source, rel, { loader: 'ts', target: 'esnext', format: 'esm' });
  expect(r.code.length).toBeGreaterThan(20);
}

describe('edge functions · TypeScript parse smoke', () => {
  it('acomodar-espacio v7 parsea completo', async () => {
    await parseTs('supabase/functions/acomodar-espacio/index.ts');
  });

  it('leer-plano wrapper seguro parsea completo', async () => {
    await parseTs('supabase/functions/leer-plano/index.ts');
  });

  it('leer-plano-core v2 parsea completo', async () => {
    await parseTs('supabase/functions/leer-plano-core/index.ts');
  });

  it('voni-council parsea completo y queda source-controlled', async () => {
    await parseTs('supabase/functions/voni-council/index.ts');
  });
  it('analizar-mueble parsea completo', async () => {
    await parseTs('supabase/functions/analizar-mueble/index.ts');
  });

  it('generar-render parsea completo', async () => {
    await parseTs('supabase/functions/generar-render/index.ts');
  });

  it('voni-council parsea completo', async () => {
    await parseTs('supabase/functions/voni-council/index.ts');
  });

});
