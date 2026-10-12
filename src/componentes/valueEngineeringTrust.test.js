import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

describe('ProyectoWorkspace · value engineering trust',()=>{
  const s=fs.readFileSync('src/componentes/comercial/ProyectoWorkspace.jsx','utf8');
  it('muestra NO_EVALUABLE sin fabricar diferencia',()=>{
    expect(s).toContain("plan.estado === 'NO_EVALUABLE'");
    expect(s).toContain("plan.faltaBajar == null");
  });
});
