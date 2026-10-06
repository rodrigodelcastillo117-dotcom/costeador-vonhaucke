import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('VONI Council · adaptive latency budget', () => {
  it('keeps 20s fast mode and allows 55s deep mode without weakening deterministic validation', () => {
    const s = fs.readFileSync('supabase/functions/voni-council/index.ts', 'utf8');
    expect(s).toContain("const councilBudget=councilMode==='deep'?55000:20000");
    expect(s).toContain("const deepTasks=new Set(['review_product','cost_review','plan_review','layout_review'])");
    expect(s).toContain("mode:councilMode");
    expect(s).toContain("budget_ms:councilBudget");
    expect(s).toContain('Promise.race');
    expect(s).toContain('deadline_hit');
    expect(s).toContain("deterministic_validation_required:true");
    expect(s).toContain("status:'SINGLE_PROVIDER'");
    expect(s).toContain("status:'NO_PROVIDER'");
  });
});
