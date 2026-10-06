import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

const FILES=[
  'src/componentes/Costeador.jsx',
  'src/componentes/Asistente.jsx',
  'src/componentes/Catalogo.jsx',
  'src/componentes/CocrearV3.jsx',
  'supabase/functions/costear-servidor/index.ts',
];

describe('single target-margin truth',()=>{
  for(const file of FILES){
    it(file+' no mantiene fallback 40 paralelo',()=>{
      const s=fs.readFileSync(file,'utf8');
      expect(s).not.toMatch(/margen(?:Objetivo)?[^\n]*(?:\?\?|:)\s*40\b/);
    });
  }
  it('pantallas clásicas dependen de PARAMETROS_DEFAULT cuando no hay config',()=>{
    for(const file of ['src/componentes/Costeador.jsx','src/componentes/Asistente.jsx','src/componentes/Catalogo.jsx']){
      const s=fs.readFileSync(file,'utf8');
      expect(s).toContain('PARAMETROS_DEFAULT.margenObjetivo');
    }
  });
});
