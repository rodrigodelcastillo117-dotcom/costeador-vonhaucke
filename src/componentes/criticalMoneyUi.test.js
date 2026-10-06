import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

const CRITICOS=[
  'src/componentes/HojaCosto.jsx',
  'src/componentes/Costeador.jsx',
  'src/componentes/Cotizacion.jsx',
  'src/componentes/AsistenteEspecial.jsx',
];

describe('critical money UI · pennies and cents',()=>{
  for(const file of CRITICOS){
    it(file+' no usa el formatter que redondea al peso',()=>{
      const s=fs.readFileSync(file,'utf8');
      expect(s).not.toMatch(/\bpesos\(/);
      expect(s).toContain('pesos2(');
    });
  }
});
