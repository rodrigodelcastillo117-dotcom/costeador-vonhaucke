import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('edge spatial intelligence · hardening no negociable', () => {
  it('acomodar-espacio conserva auth, roles, rate-limit, semántica, repair-loop y spatial gate', () => {
    const s = read('supabase/functions/acomodar-espacio/index.ts');
    expect(s).toContain('createClient');
    expect(s).toContain('UNAUTHENTICATED');
    expect(s).toContain('FORBIDDEN');
    expect(s).toContain('RATE_LIMITED_USER');
    expect(s).toContain('RATE_LIMITED_GLOBAL');
    expect(s).toContain('semanticVerdict');
    expect(s).toContain('PLACEMENT_INVARIANT_BROKEN');
    expect(s).toContain('for (let intento = 1; intento <= 3; intento++)');
    expect(s).toContain('bloqueaPuertaEspacial');
    expect(s).toContain('FUNCTIONAL_CLEARANCE');
    expect(s).toContain('auditarPuertas');
    expect(s).toContain('render_ready: renderReady');
  });

  it('ProductRevision espacial es autoridad server-side y no acepta spoof del navegador', () => {
    const s = read('supabase/functions/acomodar-espacio/index.ts');
    expect(s).toContain('spatial_specs_para_versiones');
    expect(s).toContain('CANONICAL_SPATIAL_SOURCE_UNAVAILABLE');
    expect(s).toContain('delete p.spatial_spec');
    expect(s).toContain('SERVER_PRODUCT_REVISION');
    expect(s).toContain('canonical_specs_resolved');
  });

  it('leer-plano conserva wrapper seguro y delega visión al core', () => {
    const s = read('supabase/functions/leer-plano/index.ts');
    expect(s).toContain('createClient');
    expect(s).toContain('UNAUTHENTICATED');
    expect(s).toContain('FORBIDDEN_CAPABILITY');
    expect(s).toContain('RATE_LIMITED_USER');
    expect(s).toContain('/functions/v1/leer-plano-core');
    expect(s).toContain('FLOOR_SPEC_INVALID');
    expect(s).toContain('DOOR_SWING_UNVERIFIED');
    expect(s).toContain('FLOOR_SPEC_V2');
  });

  it('leer-plano-core es fail-closed con barrido: nunca inventa bisagra/sentido', () => {
    const s = read('supabase/functions/leer-plano-core/index.ts');
    expect(s).toContain('tieneBarrido');
    expect(s).toContain('bisagraX');
    expect(s).toContain('bisagraY');
    expect(s).toContain("sentido='desconocido'");
    expect(s).toContain('NO ADIVINES');
  });
});
