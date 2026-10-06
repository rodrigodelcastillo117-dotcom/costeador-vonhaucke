import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

describe('VONI host live cost context',()=>{
  const s=fs.readFileSync('src/App.jsx','utf8');
  it('uses the shared live cost path',()=>{
    expect(s).toContain('calcularCosteoVivo(estado, costeo).resultado');
    expect(s).toContain('costing: veCostos ? voniCosting : null');
  });
  it('only injects economic context when the host already allows cost visibility',()=>{
    expect(s).toContain('const veCostos = esDireccion || esDiseno');
    expect(s).toContain('bom: veCostos ?');
  });
});
