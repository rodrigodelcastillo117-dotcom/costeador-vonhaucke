import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

describe('Acomodo · publicación honesta',()=>{
  const s=fs.readFileSync('src/componentes/AcomodoBase.jsx','utf8');

  it('sólo faltantes funcionales duros bloquean publicación; sugerencias opcionales no',()=>{
    expect(s).toContain('const layoutPublicable = layoutListo && programaListo');
    expect(s).not.toContain('const layoutPublicable = layoutListo && !programaPropuesto');
    expect(s).toContain("layoutEstado: programaListo ? (serverStatus || layout?.status || null) : 'PROGRAM_INCOMPLETE'");
  });

  it('plano real/multiárea exige PASS espacial de servidor; el fallback local no publica',()=>{
    expect(s).toContain('const requiereValidacionServidor = planReal || areasMM.length > 1');
    expect(s).toContain("serverStrict && serverStatus === 'PASS' && plan?.render_ready === true");
    expect(s).toContain("'falta validación espacial del servidor'");
  });

  it('la IA de acomodo tampoco puede saltarse el gate de programa',()=>{
    const i=s.indexOf('async function acomodarIA()');
    expect(s.slice(i,i+500)).toContain('if (!programaListo)');
  });

  it('AcomodoBase declara explícitamente bloqueosPrograma para no explotar en runtime',()=>{
    expect(s).toContain('pendientesPrograma = [], bloqueosPrograma = []');
  });

  it('GAP2: AUTORIDAD ÚNICA de validez (derivarValidez) usada por gate, autosave y publicación',()=>{
    expect(s).toContain('derivarValidez');
    expect(s).toContain('const validez = useMemo(() => derivarValidez(');
    // el gate de publicación deriva de la autoridad única (status PASS)
    expect(s).toContain('validez.layoutEspacialValidado');
    // el autosave persiste desde la autoridad única, no desde el PASS del edge
    expect(s).toContain('layoutEspacialValidado: validez.layoutEspacialValidado');
    expect(s).toContain('layoutValidado: validez.layoutValidado');
    // el render final sólo viaja si la autoridad única lo declara publicable Y además el render
    // corresponde al plano actual (React P0-3: firma program_hash/floor_hash/colocación vigente).
    expect(s).toContain('render3d: (validez.publicable && stagingUrl && (!stagingSigRef.current || stagingSigRef.current === firmaRender(payloadAcomodo, plan)))');
  });
});
