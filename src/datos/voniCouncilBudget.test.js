import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('VONI Council · latency budget', () => {
  it('has a global deadline without weakening deterministic validation', () => {
    const s = fs.readFileSync('supabase/functions/voni-council/index.ts', 'utf8');
    expect(s).toContain("VONI_COUNCIL_BUDGET_MS");
    expect(s).toContain('Promise.race');
    expect(s).toContain('deadline_hit');
    expect(s).toContain("deterministic_validation_required:true");
    expect(s).toContain("status:'SINGLE_PROVIDER'");
    expect(s).toContain("status:'NO_PROVIDER'");
  });
});
