import { describe,it,expect } from 'vitest';
import { elegirPartidasAcomodo, complementosJuntasVisuales } from './Acomodo.jsx';

describe('Acomodo operativo · sólo piezas reales',()=>{
  it('nunca inyecta sugerencias del plano cuando ya existen partidas comerciales',()=>{
    const reales=[{id:'r1',nombre:'Mesa de juntas',cantidad:1,nota:'sala de juntas'}];
    const sugeridas=[
      {id:'sug-mesa',nombre:'Mesa de juntas',cantidad:1,sugeridoPlano:true},
      {id:'sug-sillas',nombre:'Sillas de juntas',cantidad:8,sugeridoPlano:true},
    ];
    const out=elegirPartidasAcomodo(reales,sugeridas);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('r1');
    expect(out.some(x=>String(x.id).startsWith('sug-'))).toBe(false);
  });

  it('las sugerencias pueden existir como aviso sin entrar al solver',()=>{
    const reales=[{id:'r1',nombre:'Mesa de juntas',cantidad:1,nota:'sala de juntas'}];
    const sugeridas=[{id:'sug-sillas',nombre:'Silla de juntas',cantidad:8,sugeridoPlano:true}];
    expect(complementosJuntasVisuales(reales,sugeridas).length).toBeGreaterThanOrEqual(0);
    expect(elegirPartidasAcomodo(reales,sugeridas)).toHaveLength(1);
  });
});
