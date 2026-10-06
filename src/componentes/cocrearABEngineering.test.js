import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import {compararVariantesProducto} from '../datos/desarrolloProducto.js';

describe('Cocrear A/B engineering comparison',()=>{
  it('sin dos costos conocidos no fabrica un delta económico',()=>{
    const a={componentes:[{nombre:'A',insumoId:'m1',largoMM:1000,anchoMM:500,espesorMM:18,piezas:1}]};
    const b={componentes:[{nombre:'A',insumoId:'m1',largoMM:1000,anchoMM:500,espesorMM:18,piezas:1}]};
    const r=compararVariantesProducto(a,b,1000,null);
    expect(r.costo_comparable).toBe(false);
    expect(r.delta.costo).toBeNull();
  });

  it('UI etiqueta costo no comparable y evita lenguaje de ganador automático',()=>{
    const s=fs.readFileSync('src/componentes/CocrearV3.jsx','utf8');
    expect(s).toContain("'No comparable'");
    expect(s).toContain('NO significa automáticamente mejor producto');
    expect(s).not.toContain('Ganador A');
    expect(s).not.toContain('Ganador B');
  });

  it('UI muestra deltas de piezas/materiales/geometrías además del costo',()=>{
    const s=fs.readFileSync('src/componentes/CocrearV3.jsx','utf8');
    for(const k of ['piezas_totales','familias_material','geometrias_distintas']) expect(s).toContain(k);
  });
});
