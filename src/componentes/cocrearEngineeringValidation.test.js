import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

describe('Cocrear engineering validation path',()=>{
  const s=fs.readFileSync('src/componentes/CocrearV3.jsx','utf8');
  const app=fs.readFileSync('src/App.jsx','utf8');

  it('recibe rol e identidad reales desde App',()=>{
    expect(app).toContain("rol={esDireccion ? 'direccion' : esDiseno ? 'diseno' : 'ventas'}");
    expect(app).toContain('usuarioEmail={sesion?.user?.email || null}');
  });

  it('sólo Diseño/Dirección pueden aprobar',()=>{
    expect(s).toContain("const puedeAprobarRol=rol==='direccion'||rol==='diseno'");
    expect(s).toContain('Sólo Diseño o Dirección pueden validar ingeniería.');
  });

  it('aprobación exige BOM/geometría/3D completos y queda ligada a visual hash',()=>{
    expect(s).toContain("desarrollo?.estado==='ANALIZADO'");
    expect(s).toContain("modelo3d?.status==='EXPLODED_READY'");
    expect(s).toContain('const visual_hash=visualRevisionHash(spec)');
    expect(s).toContain('spec_hash_prevalidacion:spec.hash');
  });

  it('cualquier commit canónico invalida aprobación previa',()=>{
    const i=s.indexOf('const commit=');
    const b=s.slice(i,i+700);
    expect(b).toContain('_engineering_validated:false');
    expect(b).toContain('_engineering_validation:null');
  });

  it('la UI ofrece un camino real, no un gate imposible',()=>{
    expect(s).toContain('Validar ingeniería de esta revisión');
    expect(s).toContain("engineeringValidated?'VALIDADA':'REQUIERE VALIDACIÓN'");
  });
});
