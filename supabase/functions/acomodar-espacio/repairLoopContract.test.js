import { describe,it,expect } from 'vitest';
import fs from 'node:fs';

describe('acomodar-espacio recovery contract',()=>{
  it('uses up to 3 repair attempts and reports the attempts used',()=>{
    const s=fs.readFileSync('supabase/functions/acomodar-espacio/index.ts','utf8');
    expect(s).toContain("intento <= (deterministicPass ? 0 : 3)");
    expect(s).toContain("attempts_used: attemptsUsed");
    expect(s).toContain("attempts: Math.max(1, attemptsUsed)");
  });
});
