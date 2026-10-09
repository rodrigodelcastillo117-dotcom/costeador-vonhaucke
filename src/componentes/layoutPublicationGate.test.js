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
    // corresponde al layout actual (React P0-A: firmaLayout incluye posición/rotación por pieza).
    expect(s).toContain('render3d: (validez.publicable && renderCorrespondeAlLayout) ? stagingUrl : \'\'');
  });

  it('React P0-A: firma de layout determinista (firmaLayout) y autoridad única fail-closed',()=>{
    // El helper ya no hashea por conteo: delega en firmaLayout, que incluye la
    // geometría (x/y/rot) de cada colocación.
    expect(s).toContain("import { firmaLayout } from '../datos/acomodoHash.js'");
    expect(s).toContain('const firmaRender = (pa, pl) => firmaLayout(pl, pa?.program_hash, pa?.floor_hash)');
    // Autoridad única fail-closed: sin firma registrada ⇒ no viaja.
    expect(s).toContain('const renderCorrespondeAlLayout = !!stagingUrl');
    expect(s).toContain('&& !!stagingSigRef.current');
    expect(s).toContain('&& stagingSigRef.current === firmaRender(payloadAcomodo, plan)');
  });

  it('React P0-A: los DOS botones de guardar pasan por la misma autoridad (no bypass)',()=>{
    // guardarEnPropuesta: el render sólo se incluye si corresponde al layout.
    expect(s).toContain('...(layoutPublicable && renderCorrespondeAlLayout ? { render3d: stagingUrl } : {})');
    // guardarStaging: si no corresponde, cae a borrador sin render3d.
    expect(s).toContain('if (!layoutPublicable || !renderCorrespondeAlLayout) {');
    // Antes del fix, guardarEnPropuesta publicaba con sólo `stagingUrl` y
    // guardarStaging con sólo `!layoutPublicable`. Esos bypass ya no existen.
    expect(s).not.toContain('...(layoutPublicable && stagingUrl ? { render3d: stagingUrl } : {})');
  });
});
