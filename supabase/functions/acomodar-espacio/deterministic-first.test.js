import { describe,it,expect } from 'vitest';
import { planearDeterminista } from './acomodo-core.js';

describe('deterministic layout semantic constraints',()=>{
  const areas=[
    {nombre:'Operativo',ancho:5000,largo:5000},
    {nombre:'Juntas',ancho:5000,largo:5000},
  ];
  it('never falls back into a disallowed zone just because it has room',()=>{
    const piezas=[
      {id:'mesa',w:4200,d:4200,allowedAreas:[1],area:1},
      {id:'silla-juntas',w:900,d:900,allowedAreas:[1],area:1},
    ];
    const r=planearDeterminista(areas,piezas,{gapMM:150,stepMM:100});
    expect(r.colocacion.some(x=>x.id==='silla-juntas'&&x.area===0)).toBe(false);
  });
  it('places a meeting piece only in its allowed meeting area',()=>{
    const r=planearDeterminista(areas,[{id:'mtg',w:1800,d:900,allowedAreas:[1],area:1}],{gapMM:100,stepMM:100});
    expect(r.colocacion.find(x=>x.id==='mtg')?.area).toBe(1);
  });
});
