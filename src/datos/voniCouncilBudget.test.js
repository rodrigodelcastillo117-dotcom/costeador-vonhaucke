import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('VONI Council · dynamic deep latency budget', () => {
  it('allows deep work up to 60s while keeping quick tasks shorter', () => {
    const s = fs.readFileSync('supabase/functions/voni-council/index.ts', 'utf8');
    expect(s).toContain('function budgetCouncil(task:string)');
    expect(s).toContain('review_product:60000');
    expect(s).toContain('plan_review:60000');
    expect(s).toContain('layout_review:60000');
    expect(s).toContain('cost_review:50000');
    expect(s).toContain('quote_review:50000');
    expect(s).toContain('interpret_change:25000');
    expect(s).toContain('Math.min(60000');
    expect(s).toContain('budget_ms:councilBudget');
    expect(s).toContain('Promise.race');
    expect(s).toContain('deadline_hit');
    expect(s).toContain("deterministic_validation_required:true");
    expect(s).toContain("status:'SINGLE_PROVIDER'");
    expect(s).toContain("status:'NO_PROVIDER'");
  });

  it('is a grounded Von Haucke advocate, not a hallucinating fan', () => {
    const s = fs.readFileSync('supabase/functions/voni-council/index.ts', 'utf8');
    expect(s).toContain('ERES FAN DE VON HAUCKE EN EL SENTIDO PROFESIONAL');
    expect(s).toContain('Ser fan NO significa inventar');
    expect(s).toContain('busca primero una solución real de Von Haucke');
  });
});
