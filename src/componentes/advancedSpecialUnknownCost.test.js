import { describe,it,expect } from 'vitest';
import fs from 'node:fs';

describe('App · UNKNOWN cost never becomes ZERO for advanced special',()=>{
  it('persiste null + costoPendiente, no ?? 0',()=>{
    const s=fs.readFileSync('src/App.jsx','utf8');
    const i=s.indexOf('function onAgregarCotizacion');
    const j=s.indexOf('function onGuardarPieza',i);
    const b=s.slice(i,j);
    expect(b).toContain('costoPendiente:');
    expect(b).toContain(': null');
    expect(b).not.toContain('resultado?.costoUnitario ?? 0');
    expect(b).toContain('resultado?.costoUnitario != null');
    expect(b).not.toContain('costoUnitario: Number.isFinite(Number(resultado?.costoUnitario))');
  });
});
