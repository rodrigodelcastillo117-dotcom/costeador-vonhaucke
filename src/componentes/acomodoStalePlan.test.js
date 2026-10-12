import {describe,it,expect} from 'vitest';
import {sanearAcomodoContraPartidas} from './Acomodo.jsx';

describe('Acomodo · no revive planes contaminados',()=>{
  it('descarta un plan guardado que contiene IDs sugeridos/fantasma',()=>{
    const partidas=[
      {id:'p1',nombre:'Silla operativa WIN',cantidad:2},
      {id:'p2',nombre:'Mesa de juntas',cantidad:1},
    ];
    const acomodo={
      render3d:'https://example.invalid/stale.jpg',
      plan:{
        colocacion:[
          {id:'p1-1',area:0,x:0,y:0,rot:0},
          {id:'p1-2',area:0,x:600,y:0,rot:0},
          {id:'p2-1',area:1,x:0,y:0,rot:0},
          {id:'sug-gap-silla-1',area:1,x:900,y:0,rot:0},
        ],
        layoutSpec:{requested:4},
      }
    };
    const limpio=sanearAcomodoContraPartidas(acomodo,partidas);
    expect(limpio.plan).toBeNull();
    expect(limpio.render3d).toBeUndefined();
    expect(limpio.layoutEstado).toBe('STALE_PROGRAM');
  });

  it('conserva un plan cuyos IDs coinciden exactamente con las piezas reales',()=>{
    const partidas=[{id:'p1',nombre:'Mesa de juntas',cantidad:1}];
    const acomodo={plan:{colocacion:[{id:'p1-1',area:0,x:0,y:0,rot:0}],layoutSpec:{requested:1}}};
    expect(sanearAcomodoContraPartidas(acomodo,partidas).plan).toBe(acomodo.plan);
  });
});
