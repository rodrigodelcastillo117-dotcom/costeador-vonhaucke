import {describe,it,expect} from 'vitest';
import {validarCoherenciaPrograma} from './coherenciaPrograma.js';

describe('coherencia del programa antes de Acomodo',()=>{
  it('bloquea el caso real: sillas/pedestales sin bench ni escritorio',()=>{
    const r=validarCoherenciaPrograma([
      {id:'1',nombre:'Silla operativa WIN',cantidad:10,nota:'Una por puesto de la banca.'},
      {id:'2',nombre:'Silla directiva ALPHA',cantidad:1,nota:'Para la oficina privada.'},
      {id:'3',nombre:'Silla de visita CONCERTO',cantidad:2,nota:'2 visitas por privado.'},
      {id:'4',nombre:'Mesa de juntas',cantidad:1,nota:'Sala de juntas para 4.'},
      {id:'5',nombre:'Silla SONATA',cantidad:4,nota:'4 sillas para la mesa de juntas.'},
      {id:'7',nombre:'Mox Gaveta pedestal',cantidad:10},
    ]);
    expect(r.ok).toBe(false);
    expect(r.bloqueos.map(x=>x.code)).toContain('MISSING_WORK_ANCHOR');
    expect(r.bloqueos.map(x=>x.code)).toContain('MISSING_PEDESTAL_ANCHOR');
  });
  it('pasa cuando los anclajes comerciales sí existen',()=>{
    const r=validarCoherenciaPrograma([
      {id:'a',nombre:'Bench APP LT operativo',cantidad:10},
      {id:'b',nombre:'Silla operativa WIN',cantidad:10},
      {id:'c',nombre:'Escritorio dirección privado',cantidad:1},
      {id:'d',nombre:'Silla directiva ALPHA',cantidad:1},
      {id:'e',nombre:'Mesa de juntas',cantidad:1},
      {id:'f',nombre:'Silla de juntas SONATA',cantidad:4},
    ]);
    expect(r.ok).toBe(true);
  });
});
