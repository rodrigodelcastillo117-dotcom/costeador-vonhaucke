import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

describe('Cocrear saved-list trust contract',()=>{
  const s=fs.readFileSync('src/componentes/CocrearV3.jsx','utf8');
  it('no traga errores de listar guardadas',()=>{
    expect(s).not.toContain('listarCocreaciones(12).then(r=>{if(live&&r?.ok)setGuardadas(r.items||[])}).catch(()=>{})');
    expect(s).toContain('setGuardadasError');
  });
  it('limpia datos potencialmente stale antes de recargar',()=>{
    expect(s).toContain("setGuardadasError('');setGuardadas([])");
  });
  it('ofrece reintento explícito',()=>{
    expect(s).toContain('Reintentar');
    expect(s).toContain('setGuardadasReload(x=>x+1)');
  });
});
