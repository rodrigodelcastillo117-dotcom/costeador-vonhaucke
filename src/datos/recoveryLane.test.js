import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

describe('recovery lane · solver aislado',()=>{
  it('el preview no toca acomodar-espacio productivo',()=>{
    const s=fs.readFileSync('src/nube.js','utf8');
    const i=s.indexOf('export async function acomodarEspacio');
    const b=s.slice(i,i+700);
    expect(b).toContain("invoke('acomodar-espacio-recovery'");
    expect(b).not.toContain("invoke('acomodar-espacio',");
  });

  it('la UI no dice que ya acomodó antes de validar',()=>{
    const s=fs.readFileSync('src/componentes/AcomodoBase.jsx','utf8');
    expect(s).toContain('Acomodo <strong>validado</strong>');
    expect(s).toContain('Acomodo <strong>en revisión</strong>');
    expect(s).toContain('todavía no lo considero terminado');
    expect(s).not.toContain('Ya acomodamos los <strong>{piezas.length}</strong>');
  });
});
