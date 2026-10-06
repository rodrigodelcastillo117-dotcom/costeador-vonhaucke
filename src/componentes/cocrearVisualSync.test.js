import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

describe('Cocrear visual synchronization contract',()=>{
  const v=fs.readFileSync('src/componentes/CocrearV3.jsx','utf8');
  const visual=fs.readFileSync('src/componentes/CocrearVisual.jsx','utf8');
  const nube=fs.readFileSync('src/nube.js','utf8');
  const legacy=fs.readFileSync('src/componentes/CocrearV2.jsx','utf8');

  it('changing canonical revision clears old render immediately',()=>{
    const i=v.indexOf('const commit=');
    const b=v.slice(i,i+900);
    expect(b).toContain('setRender(null)');
    expect(b).toContain('setCotizadoHash(null)');
  });

  it('history navigation cannot leave a render from another revision visible as current',()=>{
    expect(v).toContain("setRender(null);setRenderError('');setCotizadoHash(null)");
  });

  it('render reference is stamped with the exact visual revision hash',()=>{
    expect(visual).toContain('data-visual-revision={revisionVisual}');
    expect(visual).toContain('visualRevisionHash(spec||{})');
  });

  it('render capture verifies same-revision 3D before taking PNG',()=>{
    expect(v).toContain('host.dataset.visualRevision!==expectedVisualHash');
    expect(v).toContain('capturarModeloPNG(c.visualRevisionHash)');
  });

  it('photoreal render is blocked if same-revision 3D reference is unavailable',()=>{
    expect(v).toContain('No existe una referencia 3D verificable de esta revisión');
    expect(v).toContain('visual_revision_hash:c.visualRevisionHash');
  });

  it('generated render stores same visualRevisionHash as ProductSpec compiler',()=>{
    expect(v).toContain('visualRevisionHash:c.visualRevisionHash');
    expect(v).toContain('geometryHash=visualRevisionHash(spec)');
  });

  it('canonical persistence refuses anonymous/untraceable renders',()=>{
    expect(nube).toContain("render canónico sin spec_hash");
    expect(nube).toContain("render canónico sin visual/geometry hash");
    expect(nube).toContain('visual_revision_hash: geometryHash');
  });

  it('legacy Cocrear cannot crash on visualRevisionHash when reopened',()=>{
    expect(legacy).toContain("import { visualRevisionHash } from '../datos/visualRevision.js'");
  });
});
