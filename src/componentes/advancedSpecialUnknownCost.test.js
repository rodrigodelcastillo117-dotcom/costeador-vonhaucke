import { describe,it,expect } from 'vitest';
import fs from 'node:fs';

describe('App · UNKNOWN cost never becomes ZERO for advanced special',()=>{
  it('persiste únicamente el costo autoritativo y falla cerrado si falta o difiere',()=>{
    const s=fs.readFileSync('src/App.jsx','utf8');
    const i=s.indexOf('function onAgregarCotizacion');
    const j=s.indexOf('function onGuardarPieza',i);
    const b=s.slice(i,j);
    expect(b).toContain('costearServidor(costeo, n)');
    expect(b).toContain('clienteC == null || servidorC == null');
    expect(b).toContain('clienteC !== servidorC');
    expect(b).toContain('costoUnitario: costoServidor');
    expect(b).toContain('costoPendiente: false');
    expect(b).not.toContain('resultado?.costoUnitario ?? 0');
    expect(b).not.toContain('costoUnitario: 0');
  });
});
