import {describe,it,expect} from 'vitest';
import { evaluarAcomodoCliente, cotizacionSinAcomodoNoValidado, planDesfasadoContraPartidas } from './acomodoCliente.js';

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


// FRESCURA (P0-05): un spec PASS/ready/invariant se CONGELA al acomodar. Si después se edita la
// cotización (borrar/agregar un mueble) sin re-acomodar, el gate NO debe enseñar el plano/3D viejo.
describe('gate de acomodo · frescura contra partidas editadas',()=>{
  const specPASS={status:'PASS',validation:{render_ready:true,invariant_ok:true},requested:1};
  const base=(coloc,requested=1)=>({
    areas:[{nombre:'ÁREA OPERATIVA',ancho:4000,largo:4000}],
    plan:{ colocacion:coloc, strictPlacement:true, render_ready:true,
      layoutSpec:{...specPASS,requested} },
  });

  it('mueble BORRADO tras acomodar (colocación huérfana) ⇒ no se muestra, STALE_PROGRAM',()=>{
    // Se acomodó con [p1,p2]; el cliente borró p2. La colocación aún trae p2-1 (ID real, no sug-*).
    const a=base([{id:'p1-1',area:0,x:500,y:500,rot:0},{id:'p2-1',area:0,x:1800,y:500,rot:0}],2);
    const g=evaluarAcomodoCliente(a,[{id:'p1',nombre:'Escritorio',cantidad:1,w:1200,d:600}]);
    expect(g.mostrar).toBe(false);
    expect(g.estado).toBe('STALE_PROGRAM');
    expect(g.razones.join(' ')).toMatch(/vuelve a acomodar/i);
  });

  it('mueble AGREGADO tras acomodar (requested ya no cuadra) ⇒ no se muestra, STALE_PROGRAM',()=>{
    const a=base([{id:'p1-1',area:0,x:500,y:500,rot:0}],1);
    const g=evaluarAcomodoCliente(a,[
      {id:'p1',nombre:'Escritorio',cantidad:1,w:1200,d:600},
      {id:'p2',nombre:'Mesa de juntas',cantidad:1,w:2400,d:1200},
    ]);
    expect(g.mostrar).toBe(false);
    expect(g.estado).toBe('STALE_PROGRAM');
  });

  it('partidas sin cambios ⇒ sigue mostrándose (sin regresión, aun con requested presente)',()=>{
    const a=base([{id:'p1-1',area:0,x:500,y:500,rot:0}],1);
    expect(evaluarAcomodoCliente(a,[{id:'p1',nombre:'Escritorio',cantidad:1,w:1200,d:600}]).mostrar).toBe(true);
  });

  it('una sugerida (sug-*) en partidas NO cuenta como mueble agregado (no falso positivo)',()=>{
    // La sugerida se filtra: ids reales = {p1-1}, requested=1 ⇒ cuadra ⇒ no desfasado.
    const plan={colocacion:[{id:'p1-1',area:0,x:500,y:500,rot:0}],layoutSpec:{requested:1}};
    const conSug=[{id:'p1',nombre:'Escritorio',cantidad:1,w:1200,d:600},{id:'sug-credenza',nombre:'Credenza opcional',cantidad:1,sugeridoPlano:true}];
    expect(planDesfasadoContraPartidas(plan,conSug)).toBe(false);
  });

  it('predicado: colocación vacía no se marca desfasada aquí (otras ramas deciden)',()=>{
    expect(planDesfasadoContraPartidas({colocacion:[],layoutSpec:{requested:3}},[{id:'p1',cantidad:1}])).toBe(false);
  });
});
