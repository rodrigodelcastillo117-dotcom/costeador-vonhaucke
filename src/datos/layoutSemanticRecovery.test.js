import { describe,it,expect } from 'vitest';
import { acomodarLocal } from './planner.js';
import { marcarDestinoPartida, destinoMarcado } from './destinoAcomodo.js';

describe('layout semántico · proyecto real',()=>{
  const areas=[
    {nombre:'RECEPCION',tipo:'recepcion',ancho:3300,largo:2700},
    {nombre:'OPEN SPACE',tipo:'open',ancho:7200,largo:8800},
    {nombre:'DIRECCION',tipo:'privado',ancho:4500,largo:3000},
    {nombre:'SALA DE JUNTAS',tipo:'juntas',ancho:4500,largo:3100},
  ];
  const mk=(base,partida)=>({...base,...marcarDestinoPartida(partida),ruta:marcarDestinoPartida(partida).ruta});
  it('keeps explicitly destined furniture in the matching room type',()=>{
    const piezas=[
      mk({id:'rcp',tipo:'recepcion',w:1600,d:700},{nombre:'Mostrador recepción',nota:'puesto de recepción'}),
      mk({id:'bench',tipo:'escritorio',w:2400,d:1400},{nombre:'Banca APP LT',nota:'operativo open space'}),
      mk({id:'dir',tipo:'escritorio',w:1800,d:800},{nombre:'Escritorio dirección',nota:'oficina privada dirección'}),
      mk({id:'mtg',tipo:'juntas',w:2400,d:1100},{nombre:'Mesa de juntas 8 personas',nota:'sala de juntas'}),
    ];
    expect(destinoMarcado(piezas[0])).toBe('recepcion');
    expect(destinoMarcado(piezas[1])).toBe('open');
    expect(destinoMarcado(piezas[2])).toBe('privado');
    expect(destinoMarcado(piezas[3])).toBe('juntas');
    const r=acomodarLocal(areas,piezas,{ajustar:false});
    const byId=Object.fromEntries(r.colocacion.map(x=>[x.id,x]));
    expect(byId.rcp?.area).toBe(0);
    expect(byId.bench?.area).toBe(1);
    expect(byId.dir?.area).toBe(2);
    expect(byId.mtg?.area).toBe(3);
  });
});
