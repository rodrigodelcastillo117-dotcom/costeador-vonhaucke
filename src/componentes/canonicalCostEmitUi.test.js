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
    // El gate canónico sigue siendo obligatorio, pero Compras agrega un candado:
    // datos técnicos/precios no certificados NO pueden emitir como oficiales.
    expect(s).toMatch(/disabled=\{incompletoC \|\| simulando(?: \|\| costoComprasPreliminar)?\}/);
    expect(s).toContain('costoComprasPreliminar');
    expect(s).toContain('Costo NO EMITIBLE');
  });
});
