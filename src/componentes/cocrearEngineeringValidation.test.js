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

  // COCREAR 10 (D-03): la aprobación ya no es un sello en el JSON del cliente. La decide el SERVIDOR
  // (rol, costo emitible, validador estructural y misma revisión visual) sobre la revisión guardada.
  // El despiece 3D completo sigue calculándose y se muestra como diagnóstico: exigirlo hacía la
  // validación inalcanzable para un BOM real (PTR por metro, herrajes por pieza).
  it('aprobación: BOM sin pendientes, la decide el servidor y queda ligada a visual hash',()=>{
    expect(s).toContain("desarrollo?.estado==='ANALIZADO'");
    expect(s).toContain("modelo3d?.status==='EXPLODED_READY'");
    expect(s).toContain('const visual_hash=visualRevisionHash(spec)');
    expect(s).toContain('spec_hash_prevalidacion:spec.hash');
    expect(s).toContain('const ingenieriaListaParaRevision=!!(spec?.componentes?.length&&!piezasPendientes.length)');
    expect(s).toContain('costearCocreacionServidor(g.id,validar?{validarIngenieria:true,visualHash:visualRevisionHash(spec)}:{})');
    // VALIDADA sólo si la validó el servidor para ESTA revisión (spec hash del servidor = el actual).
    expect(s).toContain('const servidorVigente=!!(servidor?.ok&&specBase&&servidor.spec_hash===specBase.hash)');
    expect(s).toContain("fuente:'costear-servidor'");
    expect(s).not.toContain('_engineering_validated:true');
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
