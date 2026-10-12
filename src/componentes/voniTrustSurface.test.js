import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

describe('VONI trust surface contract',()=>{
  const s=fs.readFileSync('src/componentes/Voni2.jsx','utf8');

  it('muestra impacto y confianza agregada',()=>{
    expect(s).toContain('Impacto');
    expect(s).toContain('Confianza');
    expect(s).toContain('Math.round(resp.confianza*100)');
  });

  it('distingue hechos, inferencias, supuestos y recomendaciones',()=>{
    for(const k of ['HECHO','INFERENCIA','SUPUESTO','RECOMENDACION']) expect(s).toContain(k);
  });

  it('muestra fuente y confianza de cada evidencia',()=>{
    expect(s).toContain('fuente: {a.fuente.source_type}');
    expect(s).toContain('a.fuente?.confidence');
  });

  it('no convierte ausencia de confianza en un porcentaje inventado',()=>{
    expect(s).toContain("typeof resp.confianza === 'number'");
    expect(s).toContain("typeof a.fuente?.confidence === 'number'");
  });
});
