import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// ============================================================================
//  P0.2c · GAP1 — el baseline histórico vive en baseline-f6eb266.json (INMUTABLE)
//  y NO se re-deriva del código actual. Este test sólo verifica que el registro
//  documenta el ANTES; los tests "target" (DESPUÉS) viven en targetP02c.test.js.
// ============================================================================
const base = JSON.parse(readFileSync('bench/acomodo-calidad/baseline-f6eb266.json', 'utf8'));

describe('P0.2c · baseline INMUTABLE (GAP1)', () => {
  it('registra SHA y blobs de módulos del baseline', () => {
    expect(base.baseline_sha_short).toBe('f6eb266');
    expect(base.module_blobs['bench/acomodo/judge.js']).toMatch(/^[0-9a-f]{40}$/);
    expect(base.module_blobs['supabase/functions/acomodar-espacio-recovery/kit-solver.js']).toMatch(/^[0-9a-f]{40}$/);
  });
  it('documenta el ANTES de A/B/C sin re-derivarlo del código actual', () => {
    expect(base.A.observed_sides).toBe(1);                       // 8 sillas de un lado
    expect(base.B.observed_top_bottom_sides).toEqual([7, 3, 0]); // 7+3 sin cabeceras
    expect(base.C.baseline_wrongly_used_area_as_cause).toBe(true);
  });
  it('documenta el DESPUÉS esperado de P0.2c', () => {
    expect(base.A.expected_p02c).toBe('4+4');
    expect(base.B.expected_p02c).toBe('4+4+1+1');
  });
});
