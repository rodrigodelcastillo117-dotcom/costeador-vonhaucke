import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

describe('AsistenteEspecial · recost delta trust',()=>{
  const s=fs.readFileSync('src/componentes/AsistenteEspecial.jsx','utf8');
  const i=s.indexOf('Re-costeo con catálogo de hoy');
  const b=s.slice(Math.max(0,i-800),i+900);
  it('no compara costo guardado desconocido contra cero',()=>{
    expect(b).toContain('aCentavosEnteros(costoGuardado.costoUnitario) != null');
    expect(b).not.toContain('costoGuardado.costoUnitario || 0');
  });
});
