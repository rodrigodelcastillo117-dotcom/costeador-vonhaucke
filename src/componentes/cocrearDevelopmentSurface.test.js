import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

describe('Cocrear · product development surface',()=>{
  const s=fs.readFileSync('src/componentes/CocrearV3.jsx','utf8');
  it('uses deterministic diagnostic instead of free-form savings claims',()=>{
    expect(s).toContain('diagnosticoDesarrolloProducto(spec)');
    expect(s).toContain('VONI Industrial · desarrollo');
    expect(s).toContain('ahorro no certificado');
  });
});
