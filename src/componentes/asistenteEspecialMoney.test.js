import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('AsistenteEspecial · pennies and cents persistence', () => {
  it('no usa Math.round para congelar costo/precio del expediente', () => {
    const s = fs.readFileSync('src/componentes/AsistenteEspecial.jsx','utf8');
    const bloque = s.slice(s.indexOf('costo: { costoUnitario:'), s.indexOf('confirmaciones:', s.indexOf('costo: { costoUnitario:')));
    expect(bloque).toContain('dinero(resultado.costoUnitario)');
    expect(bloque).toContain('dinero(precio)');
    expect(bloque).not.toContain('Math.round(');
  });
});
