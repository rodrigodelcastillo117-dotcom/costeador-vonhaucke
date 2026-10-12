import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

describe('lineas · costo derivado siempre etiquetado',()=>{
  const s=fs.readFileSync('src/datos/lineas.js','utf8');
  it('precioDePieza expone costoDerivado para price-book/por-usuario',()=>{
    expect(s).toContain('const costoDerivado = !!real || !!porUsuario');
    expect(s).toContain('costoDerivado, real:');
  });
  it('partida modelo y recosteo propagan la bandera',()=>{
    expect(s).toContain('costoDerivado: !!pr.costoDerivado');
    expect(s).toContain('costoDerivado: true, precioUnitario: a.lista');
  });
});
