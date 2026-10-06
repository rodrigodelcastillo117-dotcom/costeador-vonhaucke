import { describe,it,expect } from 'vitest';
import { elegirPartidasAcomodo } from './Acomodo.jsx';

describe('Acomodo operativo · reales + faltantes sugeridos',()=>{
  it('conserva lo comercial y agrega sólo la pieza que falta para completar el programa',()=>{
    const reales=[
      {id:'r-mesa',nombre:'Mesa de juntas',cantidad:1,nota:'sala de juntas'},
      {id:'r-sillas',nombre:'Silla SONATA',cantidad:4,nota:'4 sillas para sala de juntas'},
    ];
    const sugeridas=[
      {id:'sug-mesa',nombre:'Mesa de juntas 4 personas',cantidad:1,sugeridoPlano:true,zonaSugerida:'SALA DE JUNTAS',functional_group_id:'fg-j',relation_role:'ANCHOR_MEETING'},
      {id:'sug-sillas',nombre:'Silla de juntas',cantidad:4,sugeridoPlano:true,zonaSugerida:'SALA DE JUNTAS',functional_group_id:'fg-j',relation_role:'MEETING_SEAT',anchor_role:'ANCHOR_MEETING'},
      {id:'sug-credenza',nombre:'Credenza de sala de juntas',cantidad:1,sugeridoPlano:true,zonaSugerida:'SALA DE JUNTAS',functional_group_id:'fg-j',relation_role:'SUPPORT_STORAGE',anchor_role:'ANCHOR_MEETING'},
    ];
    const out=elegirPartidasAcomodo(reales,sugeridas);
    expect(out.some(x=>x.id==='r-mesa')).toBe(true);
    expect(out.some(x=>x.id==='r-sillas')).toBe(true);
    expect(out.some(x=>x.id==='sug-credenza')).toBe(true);
    expect(out.some(x=>x.id==='sug-mesa')).toBe(false);
    expect(out.some(x=>x.id==='sug-sillas')).toBe(false);
  });

  it('nunca convierte una sugerencia en partida con precio',()=>{
    const out=elegirPartidasAcomodo([],[
      {id:'sug-bench',nombre:'Bench',cantidad:1,sugeridoPlano:true,noCobrar:true,precioUnitario:0}
    ]);
    expect(out[0].sugeridoPlano).toBe(true);
    expect(out[0].noCobrar).toBe(true);
    expect(Number(out[0].precioUnitario||0)).toBe(0);
  });
});
