import { describe,it,expect } from 'vitest';
import fs from 'node:fs';

describe('Vercel browser security headers',()=>{
  it('ships baseline headers without blocking OAuth popups or camera workflows',()=>{
    const x=JSON.parse(fs.readFileSync('vercel.json','utf8'));
    const h=Object.fromEntries(x.headers[0].headers.map(v=>[v.key,v.value]));
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(h).not.toHaveProperty('Permissions-Policy');
    expect(h).not.toHaveProperty('Content-Security-Policy');
  });
});
