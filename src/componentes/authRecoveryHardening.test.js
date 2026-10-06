import { describe,it,expect } from 'vitest';
import fs from 'node:fs';

describe('auth recovery hardening',()=>{
  it('recovery/update operations have bounded waits',()=>{
    const s=fs.readFileSync('src/nube.js','utf8');
    expect(s).toContain("12000, 'recuperación de contraseña'");
    expect(s).toContain("12000, 'verificación de contraseña'");
    expect(s).toContain("12000, 'cambio de contraseña'");
  });
  it('successful PASSWORD_RECOVERY removes auth fragment from address bar',()=>{
    const s=fs.readFileSync('src/App.jsx','utf8');
    const i=s.indexOf("evento === 'PASSWORD_RECOVERY'");
    const b=s.slice(i,i+900);
    expect(b).toContain('history.replaceState');
    expect(b).toContain('window.location.hash');
  });
});
