import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

describe('Acomodo · publicación honesta',()=>{
  const s=fs.readFileSync('src/componentes/AcomodoBase.jsx','utf8');

  it('sólo faltantes funcionales duros bloquean publicación; sugerencias opcionales no',()=>{
    expect(s).toContain('const layoutPublicable = layoutListo && programaListo');
    expect(s).not.toContain('const layoutPublicable = layoutListo && !programaPropuesto');
    expect(s).toContain("layoutEstado: programaListo ? (serverStatus || layout?.status || null) : 'PROGRAM_INCOMPLETE'");
  });

  it('la IA de acomodo tampoco puede saltarse el gate de programa',()=>{
    const i=s.indexOf('async function acomodarIA()');
    expect(s.slice(i,i+500)).toContain('if (!programaListo)');
  });

  it('AcomodoBase declara explícitamente bloqueosPrograma para no explotar en runtime',()=>{
    expect(s).toContain('pendientesPrograma = [], bloqueosPrograma = []');
  });
});
