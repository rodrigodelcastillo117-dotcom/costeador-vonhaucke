import {describe,it,expect} from 'vitest';
import {expandirPiezas} from './espacio.js';
import {validarCoherenciaPrograma} from './coherenciaPrograma.js';
import {marcarDestinoPartida} from './destinoAcomodo.js';
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

  // Caso real que falló: dependientes presentes, anclajes comercialmente ausentes.
  const incompleto=[
    {id:'op',nombre:'Silla operativa · WIN',cantidad:10,nota:'Una por puesto de la banca.'},
    {id:'dir',nombre:'Silla directiva ALPHA',cantidad:1,nota:'Para la oficina privada.'},
    {id:'vis',nombre:'Silla de visita · CONCERTO',cantidad:2,nota:'2 visitas por privado (regla de la casa).'},
    {id:'mt',nombre:'Mesa de juntas (1200 × 1200 mm)',cantidad:1,nota:'Sala de juntas para 4.'},
    {id:'ms',nombre:'Silla · SONATA',cantidad:4,nota:'4 sillas para la mesa de juntas.'},
    {id:'rcp',nombre:'Módulo recepción 2 usuarios (2420 × 830 mm)',cantidad:1,nota:'Recepción con mostrador; sin sillas de espera por no solicitarse.'},
    {id:'gav',nombre:'Mox · Gaveta pedestal (380 × 455 × 720 mm)',cantidad:10,nota:'Se cotiza pedestal según lo indicado entre paréntesis.'},
    {id:'arch',nombre:'Archivero Modulor 2 puertas + 1 entrepaño (900 × 750 × 420 mm)',cantidad:1},
  ];

  it('detecta el programa incompleto en vez de inventar bench/escritorio',()=>{
    const v=validarCoherenciaPrograma(incompleto);
    expect(v.ok).toBe(false);
    expect(v.bloqueos.map(x=>x.code)).toContain('MISSING_WORK_ANCHOR');
    expect(v.bloqueos.map(x=>x.code)).toContain('MISSING_PEDESTAL_ANCHOR');
  });

  it('cuando los anclajes YA son partidas reales, el solver respeta cada cuarto semántico',()=>{
    const reales=[
      ...incompleto,
      {id:'bench',nombre:'Bench APP LT operativo 10 puestos',cantidad:1,w:7500,d:1200,nota:'Área operativa'},
      {id:'desk',nombre:'Escritorio dirección privado',cantidad:1,w:1800,d:800,nota:'OFICINA CEO dirección privada'},
    ].map(marcarDestinoPartida);

    expect(validarCoherenciaPrograma(reales).ok).toBe(true);

    const areas=areasM.map(a=>({...a,ancho:Math.round(a.ancho*1000),largo:Math.round(a.largo*1000),zone_role:canonicalZoneRole(a)}));
    const piezas=expandirPiezas(reales).map(p=>{
      const product_role=canonicalProductRole(p);
      const sem=areas
        .map((a,i)=>({i,v:semanticVerdict(product_role,a.zone_role)}))
        .filter(x=>x.v.level!=='FAIL')
        .map(x=>x.i);
      const ruta=String(p.ruta||'');
      const exact = ruta.includes('vh-dest-opn') ? [2]
        : ruta.includes('vh-dest-mtg') ? [1]
        : ruta.includes('vh-dest-prv') ? [0]
        : ruta.includes('vh-dest-rcp') ? [3]
        : [];
      const allowedAreas=exact.length?exact:sem;
      return {...p,product_role,allowedAreas,...(allowedAreas.length?{area:allowedAreas[0]}:{})};
    });

    const r=planearDeterminista(areas,piezas,{gapMM:80,stepMM:100});
    // No aceptamos piezas en sanitarios/site ni destinos cruzados.
    const byId=Object.fromEntries(r.colocacion.map(x=>[x.id,x]));
    const zoneOf=(id)=>areas[byId[id]?.area]?.nombre;
    const work=piezas.filter(p=>String(p.ruta||'').includes('vh-dest-opn'));
    const meeting=piezas.filter(p=>String(p.ruta||'').includes('vh-dest-mtg'));
    const priv=piezas.filter(p=>String(p.ruta||'').includes('vh-dest-prv'));
    const reception=piezas.filter(p=>String(p.ruta||'').includes('vh-dest-rcp'));

    expect(work.filter(p=>byId[p.id]).every(p=>zoneOf(p.id)==='ÁREA OPERATIVA')).toBe(true);
    expect(meeting.filter(p=>byId[p.id]).every(p=>zoneOf(p.id)==='SALA DE CONSEJO')).toBe(true);
    expect(priv.filter(p=>byId[p.id]).every(p=>zoneOf(p.id)==='OFICINA CEO')).toBe(true);
    expect(reception.filter(p=>byId[p.id]).every(p=>zoneOf(p.id)==='RECEPCIÓN')).toBe(true);
    expect(r.colocacion.every(x=>![4,5,6].includes(x.area))).toBe(true);
  });
});
