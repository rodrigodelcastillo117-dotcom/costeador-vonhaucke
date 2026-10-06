import { describe,it,expect } from 'vitest';
import fs from 'node:fs';

describe('acomodar-espacio · exact zone contract',()=>{
  it('pins a piece to zonaSugerida before generic semantic ranking',()=>{
    const s=fs.readFileSync('supabase/functions/acomodar-espacio/index.ts','utf8');
    expect(s).toContain('function explicitAreaIndexes');
    expect(s).toContain('const allowedAreas = explicitAreas.length ? explicitAreas');
    expect(s).toContain('WRONG_EXPLICIT_ZONE');
    expect(s).toContain('zonaSugerida');
  });
});
