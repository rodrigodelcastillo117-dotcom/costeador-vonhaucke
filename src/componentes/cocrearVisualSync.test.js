import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

describe('Cocrear visual synchronization contract',()=>{
  const v=fs.readFileSync('src/componentes/CocrearV3.jsx','utf8');
  const visual=fs.readFileSync('src/componentes/CocrearVisual.jsx','utf8');

  it('changing canonical revision clears old render immediately',()=>{
    const i=v.indexOf('const commit=');
    const b=v.slice(i,i+700);
    expect(b).toContain('setRender(null)');
    expect(b).toContain('setCotizadoHash(null)');
  });

  it('render capture cannot accidentally use exploded/4D visible tab',()=>{
    expect(v).toContain('[data-view="render-reference"] svg');
    expect(visual).toContain('data-view="render-reference"');
    expect(visual).toContain('solids={solids}');
  });

  it('generated render stores same visualRevisionHash as ProductSpec compiler',()=>{
    expect(v).toContain('visualRevisionHash:c.visualRevisionHash');
    expect(v).toContain('geometryHash=visualRevisionHash(spec)');
  });
});
