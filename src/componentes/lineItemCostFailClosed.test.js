import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

describe('App · line-item costing fail-closed',()=>{
  const s=fs.readFileSync('src/App.jsx','utf8');
  const i=s.indexOf('function partidaDeCosteo');
  const j=s.indexOf('const sumarPartidas',i);
  const b=s.slice(i,j);

  it('nunca deriva costo desde precio/margen si calcular falla',()=>{
    expect(b).not.toContain('precioUnitario * (1 - margen / 100)');
    expect(b).not.toContain(': 0;');
    expect(b).toContain('FAIL-CLOSED');
  });

  it('marca costoPendiente sólo para rol que ve costos cuando el costo sigue desconocido',()=>{
    expect(b).toContain('costoPendiente: veCostos && costo == null');
  });

  it('margen no se conserva como si fuera real cuando el costo es desconocido',()=>{
    expect(b).toContain('margenEf = costo != null');
  });
});
