import {describe,it,expect} from 'vitest';
import { evaluarAcomodoCliente, cotizacionSinAcomodoNoValidado } from './acomodoCliente.js';

describe('gate de acomodo para cliente',()=>{
  const partidas=[{id:'p1',nombre:'Escritorio operativo',cantidad:1,w:1200,d:600}];
  it('sin acomodo no bloquea la cotización',()=>{
    expect(evaluarAcomodoCliente(null,partidas)).toMatchObject({valido:true,mostrar:false,estado:'SIN_ACOMODO'});
  });
  it('PlacementSpec PASS sí puede mostrarse',()=>{
    const a={areas:[{nombre:'ÁREA OPERATIVA',ancho:4000,largo:4000}],plan:{
      colocacion:[{id:'p1-1',area:0,x:500,y:500,rot:0}],
      strictPlacement:true,render_ready:true,
      layoutSpec:{status:'PASS',validation:{render_ready:true,invariant_ok:true}}
    }};
    expect(evaluarAcomodoCliente(a,partidas).mostrar).toBe(true);
  });

  it('un plan legacy contaminado con IDs sug-* jamás llega al cliente',()=>{
    const a={areas:[{nombre:'ÁREA OPERATIVA',ancho:4000,largo:4000}],plan:{
      colocacion:[
        {id:'p1-1',area:0,x:500,y:500,rot:0},
        {id:'sug-bench-1',area:0,x:1800,y:500,rot:0},
      ],
      strictPlacement:true,render_ready:true,
      layoutSpec:{status:'PASS',validation:{render_ready:true,invariant_ok:true}}
    }};
    const g=evaluarAcomodoCliente(a,partidas);
    expect(g.mostrar).toBe(false);
    expect(g.estado).toBe('PLAN_CONTAMINADO_SUGERIDOS');
  });

  it('una recomendación opcional NO bloquea un PlacementSpec PASS real',()=>{
    const a={
      areas:[{nombre:'ÁREA OPERATIVA',ancho:4000,largo:4000}],
      sugerenciasPendientes:[{id:'sug-credenza',nombre:'Credenza opcional',cantidad:1}],
      programaPropuesto:true,
      plan:{
        colocacion:[{id:'p1-1',area:0,x:500,y:500,rot:0}],
        strictPlacement:true,render_ready:true,
        layoutSpec:{status:'PASS',validation:{render_ready:true,invariant_ok:true}}
      }
    };
    expect(evaluarAcomodoCliente(a,partidas).mostrar).toBe(true);
  });

  it('PROGRAM_INCOMPLETE sí bloquea aunque el plan aparente PASS',()=>{
    const a={
      areas:[{nombre:'ÁREA OPERATIVA',ancho:4000,largo:4000}],
      layoutEstado:'PROGRAM_INCOMPLETE',
      layoutMotivo:'falta bench operativo',
      plan:{
        colocacion:[{id:'p1-1',area:0,x:500,y:500,rot:0}],
        strictPlacement:true,render_ready:true,
        layoutSpec:{status:'PASS',validation:{render_ready:true,invariant_ok:true}}
      }
    };
    const g=evaluarAcomodoCliente(a,partidas);
    expect(g.mostrar).toBe(false);
    expect(g.estado).toBe('PROGRAM_INCOMPLETE');
  });

  it('layout local aunque se vea sano no se vende como validado espacial',()=>{
    const a={areas:[{nombre:'ÁREA OPERATIVA',ancho:4000,largo:4000}],plan:{colocacion:[{id:'p1-1',area:0,x:500,y:500,rot:0}]}};
    const g=evaluarAcomodoCliente(a,partidas);
    expect(g.mostrar).toBe(false);
    expect(g.estado).toBe('LEGACY_REQUIERE_VALIDACION_ESPACIAL');
  });
  it('un layout no validado se omite del documento, sin borrar el original',()=>{
    const a={areas:[{nombre:'ÁREA OPERATIVA',ancho:4000,largo:4000}],plan:{colocacion:[]}};
    const cot={folio:'X',acomodo:a};
    const r=cotizacionSinAcomodoNoValidado(cot,partidas);
    expect(r.cot.acomodo).toBeNull();
    expect(cot.acomodo).toBe(a);
  });
});


describe('gate FloorSpec + PlacementSpec',()=>{
  const partidas=[{id:'p1',nombre:'Escritorio operativo',cantidad:1,w:1200,d:600}];
  const basePlan={
    colocacion:[{id:'p1-1',area:0,x:500,y:500,rot:0}],
    strictPlacement:true,render_ready:true,
    layoutSpec:{status:'PASS',validation:{render_ready:true,invariant_ok:true}}
  };
  it('FloorSpec REVIEW_REQUIRED mantiene fuera el layout aunque Placement sea PASS',()=>{
    const a={
      areas:[{nombre:'ÁREA OPERATIVA',ancho:4000,largo:4000}],
      floorSpec:{validation:{state:'REVIEW_REQUIRED',warnings:[{code:'DOOR_SWING_UNVERIFIED',message:'Puerta sin barrido verificado'}]}},
      plan:basePlan,
    };
    const g=evaluarAcomodoCliente(a,partidas);
    expect(g.mostrar).toBe(false);
    expect(g.estado).toBe('FLOOR_SPEC_REVIEW_REQUIRED');
    expect(g.razones.join(' ')).toMatch(/Puerta/i);
  });
  it('FloorSpec PASS + Placement PASS sí libera presentación',()=>{
    const a={
      areas:[{nombre:'ÁREA OPERATIVA',ancho:4000,largo:4000}],
      floorSpec:{validation:{state:'PASS'}},
      plan:basePlan,
    };
    expect(evaluarAcomodoCliente(a,partidas).mostrar).toBe(true);
  });
});
