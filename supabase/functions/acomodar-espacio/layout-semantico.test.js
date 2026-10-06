import { describe,it,expect } from 'vitest';
import { prepararPiezas, planearSemantico } from './layout-semantico.js';

describe('layout semántico Von Haucke',()=>{
  const areas=[
    {nombre:'Área operativa',ancho:6000,largo:5000},
    {nombre:'Sala de juntas',ancho:6000,largo:5000},
    {nombre:'Sanitarios',ancho:3000,largo:3000},
  ];

  it('nunca permite muebles en sanitarios',()=>{
    const [p]=prepararPiezas(areas,[{id:'d1',nombre:'Escritorio operativo',tipo:'escritorio',w:1500,d:700}]);
    expect(p.allowedAreas).not.toContain(2);
  });

  it('pone silla de juntas en la sala y cerca de la mesa',()=>{
    const piezas=[
      {id:'t1',nombre:'Mesa de juntas',tipo:'mesa',w:2400,d:1200},
      {id:'c1',nombre:'Silla de juntas',tipo:'asiento',w:600,d:600},
    ];
    const r=planearSemantico(areas,piezas,{gapMM:150,stepMM:100});
    const t=r.colocacion.find(x=>x.id==='t1');
    const c=r.colocacion.find(x=>x.id==='c1');
    expect(t?.area).toBe(1);
    expect(c?.area).toBe(1);
    const dx=Math.abs((c?.x||0)-(t?.x||0));
    const dy=Math.abs((c?.y||0)-(t?.y||0));
    expect(Math.min(dx,dy)).toBeLessThan(2200);
  });
});
