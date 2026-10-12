import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

describe('canonical cost emit gate in critical UI',()=>{
  for(const file of ['src/componentes/Costeador.jsx','src/componentes/HojaCosto.jsx']){
    it(file+' usa costeoEmitible como único juez',()=>{
      const s=fs.readFileSync(file,'utf8');
      expect(s).toContain('costeoEmitible');
      expect(s).toMatch(/!emision(?:C)?\.emitible/);
      expect(s).not.toMatch(/const incompleto(?:C)? = pendientes(?:C)?\.length > 0/);
    });
  }
  it('Costeador bloquea cotizar y ficha con el gate canónico',()=>{
    const s=fs.readFileSync('src/componentes/Costeador.jsx','utf8');
    expect(s).toContain('disabled={incompletoC || simulando}');
    expect(s).toContain('Costo NO EMITIBLE');
  });
});
