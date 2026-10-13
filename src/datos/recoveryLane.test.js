import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

describe('recovery lane · solver aislado',()=>{
  it('el preview no toca acomodar-espacio productivo',()=>{
    const s=fs.readFileSync('src/nube.js','utf8');
    const i=s.indexOf('export async function acomodarEspacio');
    const b=s.slice(i,i+700);
    // La función invocada es FN_ACOMODAR, cuyo valor por omisión es el carril de recuperación y cuyo
    // override sólo puede ser una copia '-rc' del mismo carril (si no, se ignora).
    expect(b).toContain('invoke(FN_ACOMODAR');
    expect(b).not.toContain("invoke('acomodar-espacio',");
    expect(s).toContain("envFn('VITE_ACOMODAR_FN', 'acomodar-espacio-recovery')");
    expect(s).toContain("v.startsWith('acomodar-espacio-recovery') ? v : 'acomodar-espacio-recovery'");
    expect(s).not.toMatch(/invoke\('acomodar-espacio'[,)]/);
    // Los overrides VITE_*_FN sólo valen en desarrollo (labs); el build publicado usa siempre las Edge productivas.
    expect(s).toContain('import.meta.env.DEV === true && import.meta.env[k]');
  });

  it('la UI no dice que ya acomodó antes de validar',()=>{
    const s=fs.readFileSync('src/componentes/AcomodoBase.jsx','utf8');
    expect(s).toContain('Acomodo <strong>validado</strong>');
    expect(s).toContain('Acomodo <strong>en revisión</strong>');
    expect(s).toContain('todavía no lo considero terminado');
    expect(s).not.toContain('Ya acomodamos los <strong>{piezas.length}</strong>');
  });
});
