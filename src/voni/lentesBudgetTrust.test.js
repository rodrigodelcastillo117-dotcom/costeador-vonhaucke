import {describe,it,expect} from 'vitest';
import {lenteVentas} from './lentes.js';

describe('VONI ventas · presupuesto fail-closed',()=>{
  it('no concluye presupuesto con cotizaciones sin total',()=>{
    const r=lenteVentas({
      get_project_context:{
        presupuesto:100000,
        total_actual:null,
        total_conocido:50000,
        cotizaciones_sin_total:1,
        proxima_accion:'Revisar',
      },
      get_quote:{partidas:[{nombre:'A'}],sinPrecio:[]},
    });
    expect(r.estado).toBe('ATENCION');
    expect(r.bloqueos.some(x=>/Total de proyecto incompleto/.test(x.titulo))).toBe(true);
    expect(r.findings.some(x=>/arriba del presupuesto/.test(x.texto))).toBe(false);
  });

  it('sí compara cuando todos los totales son autoritativos',()=>{
    const r=lenteVentas({
      get_project_context:{
        presupuesto:100000,total_actual:110000,total_conocido:110000,
        cotizaciones_sin_total:0,proxima_accion:'Negociar',
      },
      get_quote:{partidas:[{nombre:'A'}],sinPrecio:[]},
    });
    expect(r.findings.some(x=>/arriba del presupuesto/.test(x.texto))).toBe(true);
  });
});
