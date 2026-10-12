import {describe,it,expect} from 'vitest';
import {partidasSugeridasDeAreas, completarProgramaVisual} from './piezasDePrograma.js';

describe('programa visual = cotización real + faltantes del plano',()=>{
  const areas=[
    {nombre:'ÁREA OPERATIVA',tipo:'open',ancho:8,largo:3.2,puestos:10},
    {nombre:'OFICINA CEO',tipo:'privado',ancho:4,largo:3.2},
    {nombre:'SALA DE CONSEJO',tipo:'juntas',ancho:7,largo:3.2,puestos:4},
    {nombre:'RECEPCIÓN',tipo:'recepcion',ancho:4,largo:2.4},
  ];
  it('propone bench/escritorio faltante pero reutiliza sillas y mesa reales',()=>{
    const sug=partidasSugeridasDeAreas(areas);
    const r=completarProgramaVisual([
      {id:'op',nombre:'Silla operativa WIN',cantidad:10,nota:'Una por puesto de la banca.'},
      {id:'dir',nombre:'Silla directiva ALPHA',cantidad:1,nota:'Para la oficina privada.'},
      {id:'vis',nombre:'Silla de visita CONCERTO',cantidad:2,nota:'2 visitas por privado.'},
      {id:'mt',nombre:'Mesa de juntas 1200 × 1200',cantidad:1,nota:'Sala de juntas para 4.'},
      {id:'ms',nombre:'Silla SONATA',cantidad:4,nota:'4 sillas para la mesa de juntas.'},
      {id:'rcp',nombre:'Módulo recepción 2 usuarios',cantidad:1,nota:'Recepción; sin sillas de espera por no solicitarse.'},
      {id:'gav',nombre:'Mox Gaveta pedestal',cantidad:10},
    ],sug);
    expect(r.reales.find(x=>x.id==='op')?.functional_group_id).toMatch(/workstation/);
    expect(r.reales.find(x=>x.id==='mt')?.functional_group_id).toMatch(/juntas/);
    expect(r.reales.find(x=>x.id==='dir')?.functional_group_id).toMatch(/privado/);
    expect(r.sugerencias.some(x=>/Banca doble APP LT/.test(x.nombre))).toBe(true);
    expect(r.sugerencias.some(x=>/Escritorio directivo/.test(x.nombre))).toBe(true);
    expect(r.sugerencias.some(x=>/Silla de visita recepción/.test(x.nombre))).toBe(false);
  });

  it('no duplica una familia cuando ya está completa comercialmente',()=>{
    const sug=partidasSugeridasDeAreas([{nombre:'SALA DE CONSEJO',tipo:'juntas',ancho:7,largo:3.2,puestos:4}]);
    const r=completarProgramaVisual([
      {id:'m',nombre:'Mesa de juntas',cantidad:1,nota:'Sala de consejo'},
      {id:'s',nombre:'Silla de juntas SONATA',cantidad:4,nota:'Sala de consejo'},
    ],sug);
    expect(r.sugerencias.filter(x=>/Mesa de juntas|Silla de juntas/.test(x.nombre))).toHaveLength(0);
  });
});
