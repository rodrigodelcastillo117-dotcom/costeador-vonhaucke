import {describe,it,expect} from 'vitest';
import { candidatosRelacionales, planearDeterminista } from './acomodo-core.js';

describe('layout funcional alrededor de anchors',()=>{
  it('pone las sillas operativas a ambos lados del bench',()=>{
    const anchor={id:'bench',w:7500,d:1200,functional_group_id:'fg',relation_role:'ANCHOR_WORKSTATION',allowedAreas:[0],area:0};
    const seats=Array.from({length:10},(_,i)=>({
      id:'s'+(i+1),w:600,d:600,functional_group_id:'fg',relation_role:'WORK_SEAT',anchor_role:'ANCHOR_WORKSTATION',
      max_anchor_distance_mm:1500,relation_index:i+1,allowedAreas:[0],area:0,
    }));
    const r=planearDeterminista([{nombre:'OPEN',ancho:8000,largo:3200}], [anchor,...seats], {gapMM:100,stepMM:100});
    expect(r.noColocadas).toHaveLength(0);
    const a=r.colocacion.find(x=>x.id==='bench');
    expect(a).toBeTruthy();
    const ys=r.colocacion.filter(x=>x.id.startsWith('s')).map(x=>x.y);
    expect(Math.min(...ys)).toBeLessThan(a.y);
    expect(Math.max(...ys)).toBeGreaterThan(a.y+1200);
  });

  it('coloca visitas y silla directiva en lados funcionalmente distintos del escritorio',()=>{
    const desk={id:'desk',w:1800,d:800,functional_group_id:'fgp',relation_role:'ANCHOR_DESK',allowedAreas:[0],area:0};
    const exec={id:'exec',w:650,d:650,functional_group_id:'fgp',relation_role:'EXECUTIVE_SEAT',anchor_role:'ANCHOR_DESK',relation_index:1,allowedAreas:[0],area:0};
    const v1={id:'v1',w:600,d:600,functional_group_id:'fgp',relation_role:'VISITOR_SEAT',anchor_role:'ANCHOR_DESK',relation_index:1,allowedAreas:[0],area:0};
    const v2={...v1,id:'v2',relation_index:2};
    const r=planearDeterminista([{nombre:'CEO',ancho:4000,largo:3200}],[desk,exec,v1,v2],{gapMM:80,stepMM:100});
    expect(r.noColocadas).toHaveLength(0);
    const d=r.colocacion.find(x=>x.id==='desk');
    const e=r.colocacion.find(x=>x.id==='exec');
    const vs=r.colocacion.filter(x=>x.id==='v1'||x.id==='v2');
    expect(e.y).toBeGreaterThan(d.y);
    expect(vs.every(x=>x.y<d.y)).toBe(true);
  });

  it('candidatos de juntas se generan alrededor de la mesa, no en una fila aleatoria',()=>{
    const table={id:'m',w:2600,d:1200,functional_group_id:'fgm',relation_role:'ANCHOR_MEETING'};
    const chair={id:'c',w:600,d:600,functional_group_id:'fgm',relation_role:'MEETING_SEAT',anchor_role:'ANCHOR_MEETING',relation_index:1};
    const anchorC={id:'m',area:0,x:2000,y:1000,rot:0};
    const cs=candidatosRelacionales(chair,[table,chair],table,anchorC);
    expect(cs.length).toBeGreaterThan(1);
    expect(cs.some(x=>x.y<1000)).toBe(true);
    expect(cs.some(x=>x.y>2200)).toBe(true);
  });
});
