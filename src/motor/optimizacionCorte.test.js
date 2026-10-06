import {describe,it,expect} from 'vitest';
import {optimizarCorte2D} from './optimizacionCorte.js';

const formato={largoMM:2440,anchoMM:1220};
describe('optimizacion de corte 2D advisory',()=>{
  it('acomoda piezas distintas en una misma hoja cuando caben',()=>{
    const r=optimizarCorte2D({formato,kerfMM:6,recorteOrillaMM:10,componentes:[
      {nombre:'Cubierta',largoMM:1200,anchoMM:600,piezas:1},
      {nombre:'Costado',largoMM:600,anchoMM:600,piezas:1},
    ]});
    expect(r.disponible).toBe(true);
    expect(r.hojas).toBe(1);
    expect(r.piezas_colocadas).toBe(2);
  });
  it('con veta no rota una pieza',()=>{
    const r=optimizarCorte2D({formato,veta:true,componentes:[{nombre:'Chapa',largoMM:1500,anchoMM:500,piezas:1}]});
    expect(r.placements[0].rot).toBe(0);
  });
  it('reporta en vez de inventar cuando una pieza no cabe',()=>{
    const r=optimizarCorte2D({formato,componentes:[{nombre:'Gigante',largoMM:3000,anchoMM:1500,piezas:1}]});
    expect(r.piezas_colocadas).toBe(0);
    expect(r.issues[0].code).toBe('PIEZA_NO_CABE');
    expect(r.completo).toBe(false);
    expect(r.certificable).toBe(false);
  });
  it('nunca coloca rectángulos traslapados',()=>{
    const r=optimizarCorte2D({formato,componentes:[
      {nombre:'A',largoMM:800,anchoMM:500,piezas:3},
      {nombre:'B',largoMM:600,anchoMM:400,piezas:3},
    ]});
    for(const h of new Set(r.placements.map(p=>p.hoja))){
      const ps=r.placements.filter(p=>p.hoja===h);
      for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){
        const a=ps[i],b=ps[j];
        const overlap=a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
        expect(overlap).toBe(false);
      }
    }
  });
});


  it('plan completo sigue siendo advisory, no certificado automáticamente',()=>{
    const r=optimizarCorte2D({formato,componentes:[{nombre:'A',largoMM:800,anchoMM:500,piezas:1}]});
    expect(r.completo).toBe(true);
    expect(r.advisory).toBe(true);
    expect(r.certificable).toBe(false);
  });
