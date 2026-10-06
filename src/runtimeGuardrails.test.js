import { describe,it,expect } from 'vitest';
import fs from 'node:fs';

describe('runtime disabled-action guardrail',()=>{
  it('explains explicit disabled reasons without enabling business actions',()=>{
    const s=fs.readFileSync('src/runtimeGuardrails.js','utf8');
    expect(s).toContain('data-disabled-reason');
    expect(s).toContain('btn.disabled');
    expect(s).toContain('Todavía no:');
    expect(s).not.toContain('btn.disabled = false');
  });
});
