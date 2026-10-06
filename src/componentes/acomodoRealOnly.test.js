import { describe,it,expect } from 'vitest';
import { elegirPartidasAcomodo } from './Acomodo.jsx';

describe('Acomodo operativo · fuente única real',()=>{
  it('si existen partidas comerciales, ninguna sugerencia entra al solver',()=>{
    const reales=[
      {id:'r-mesa',nombre:'Mesa de juntas',cantidad:1,nota:'sala de juntas'},
      {id:'r-sillas',nombre:'Silla SONATA',cantidad:4,nota:'4 sillas para sala de juntas'},
    ];
    const sugeridas=[
      {id:'sug-mesa',nombre:'Mesa de juntas 4 personas',cantidad:1,sugeridoPlano:true},
      {id:'sug-sillas',nombre:'Silla de juntas',cantidad:4,sugeridoPlano:true},
      {id:'sug-credenza',nombre:'Credenza de sala de juntas',cantidad:1,sugeridoPlano:true},
    ];
    const out=elegirPartidasAcomodo(reales,sugeridas);
    expect(out.map(x=>x.id)).toEqual(['r-mesa','r-sillas']);
    expect(out.some(x=>x.sugeridoPlano || String(x.id).startsWith('sug-'))).toBe(false);
  });

  it('sin partidas comerciales sí permite sugeridos como preview visual no cobrable',()=>{
    const out=elegirPartidasAcomodo([],[
      {id:'sug-bench',nombre:'Bench',cantidad:1,sugeridoPlano:true,noCobrar:true,precioUnitario:0}
    ]);
    expect(out[0].sugeridoPlano).toBe(true);
    expect(out[0].noCobrar).toBe(true);
    expect(Number(out[0].precioUnitario||0)).toBe(0);
  });
});
