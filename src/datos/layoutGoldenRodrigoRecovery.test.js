import {describe,it,expect} from 'vitest';
import {partidasSugeridasDeAreas,completarProgramaVisual} from './piezasDePrograma.js';
import {expandirPiezas} from './espacio.js';
import {canonicalProductRole,canonicalZoneRole,semanticVerdict} from '../../supabase/functions/acomodar-espacio/spatial-semantics.js';
import {planearDeterminista} from '../../supabase/functions/acomodar-espacio/acomodo-core.js';

const norm=(s='')=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

describe('golden real · oficina CEO + consejo + operativo + recepción',()=>{
  const areasM=[
    {nombre:'OFICINA CEO',tipo:'privado',ancho:4,largo:3.2},
    {nombre:'SALA DE CONSEJO',tipo:'juntas',ancho:7,largo:3.2,puestos:4},
    {nombre:'ÁREA OPERATIVA',tipo:'open',ancho:8,largo:3.2,puestos:10},
    {nombre:'RECEPCIÓN',tipo:'recepcion',ancho:4,largo:2.4},
    {nombre:'SITE (IT)',tipo:'servicio',ancho:4,largo:2.4},
    {nombre:'SANITARIOS H',tipo:'servicio',ancho:3,largo:3.2},
    {nombre:'SANITARIOS M',tipo:'servicio',ancho:3,largo:2.4},
  ];
  const reales=[
    {id:'op',nombre:'Silla operativa · WIN',cantidad:10,nota:'Una por puesto de la banca.'},
    {id:'dir',nombre:'Silla directiva ALPHA',cantidad:1,nota:'Para la oficina privada.'},
    {id:'vis',nombre:'Silla de visita · CONCERTO',cantidad:2,nota:'2 visitas por privado (regla de la casa).'},
    {id:'mt',nombre:'Mesa de juntas (1200 × 1200 mm)',cantidad:1,nota:'Sala de juntas para 4.'},
    {id:'ms',nombre:'Silla · SONATA',cantidad:4,nota:'4 sillas para la mesa de juntas.'},
    {id:'rcp',nombre:'Módulo recepción 2 usuarios (2420 × 830 mm)',cantidad:1,nota:'Recepción con mostrador; sin sillas de espera por no solicitarse.'},
    {id:'gav',nombre:'Mox · Gaveta pedestal (380 × 455 × 720 mm)',cantidad:10,nota:'Se cotiza pedestal según lo indicado entre paréntesis.'},
    {id:'arch',nombre:'Archivero Modulor 2 puertas + 1 entrepaño (900 × 750 × 420 mm)',cantidad:1,nota:'Puertas de 900 mm conforme a lo indicado.'},
  ];

  function preparar(){
    const sugeridas=partidasSugeridasDeAreas(areasM);
    const programa=completarProgramaVisual(reales,sugeridas);
    const areas=areasM.map(a=>({...a,ancho:Math.round(a.ancho*1000),largo:Math.round(a.largo*1000),zone_role:canonicalZoneRole(a)}));
    const piezas=expandirPiezas(programa.partidas).map(p=>{
      const product_role=canonicalProductRole(p);
      const z=norm(p.zonaSugerida||'');
      const exact=z ? areas.map((a,i)=>norm(a.nombre)===z?i:null).filter(i=>i!=null) : [];
      const sem=areas.map((a,i)=>({i,v:semanticVerdict(product_role,a.zone_role)})).filter(x=>x.v.level!=='FAIL').map(x=>x.i);
      const allowedAreas=exact.length?exact:sem;
      return {...p,product_role,allowedAreas,...(allowedAreas.length?{area:allowedAreas[0]}:{})};
    });
    return {programa,areas,piezas};
  }

  it('propone exactamente los anclajes comerciales que faltan, sin duplicar lo ya cotizado',()=>{
    const {programa}=preparar();
    expect(programa.sugerencias.some(p=>/Banca doble APP LT/.test(p.nombre))).toBe(true);
    expect(programa.sugerencias.some(p=>/Escritorio directivo/.test(p.nombre))).toBe(true);
    expect(programa.sugerencias.some(p=>/Mesa de juntas/.test(p.nombre))).toBe(false);
    expect(programa.sugerencias.some(p=>/Silla de juntas/.test(p.nombre))).toBe(false);
    expect(programa.sugerencias.some(p=>/Silla de visita recepción/.test(p.nombre))).toBe(false);
  });

  it('pone cada grupo en su cuarto semántico y mantiene sus dependientes cerca del ancla',()=>{
    const {areas,piezas}=preparar();
    const r=planearDeterminista(areas,piezas,{gapMM:80,stepMM:100});
    expect(r.noColocadas.map(x=>x.id)).toEqual([]);
    const byId=Object.fromEntries(r.colocacion.map(x=>[x.id,x]));
    const zoneOf=(id)=>areas[byId[id]?.area]?.nombre;

    const work=piezas.filter(p=>p.relation_role==='WORK_SEAT');
    const meeting=piezas.filter(p=>p.relation_role==='MEETING_SEAT');
    const exec=piezas.filter(p=>p.relation_role==='EXECUTIVE_SEAT');
    const visitors=piezas.filter(p=>p.relation_role==='VISITOR_SEAT' && /privado/i.test(String(p.zonaSugerida||'')));

    expect(work.every(p=>zoneOf(p.id)==='ÁREA OPERATIVA')).toBe(true);
    expect(meeting.every(p=>zoneOf(p.id)==='SALA DE CONSEJO')).toBe(true);
    expect(exec.every(p=>zoneOf(p.id)==='OFICINA CEO')).toBe(true);
    expect(visitors.every(p=>zoneOf(p.id)==='OFICINA CEO')).toBe(true);
    expect(piezas.filter(p=>p.relation_role==='ANCHOR_RECEPTION').every(p=>zoneOf(p.id)==='RECEPCIÓN')).toBe(true);
  });
});
