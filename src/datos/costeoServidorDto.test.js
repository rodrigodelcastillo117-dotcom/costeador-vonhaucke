import { describe,it,expect } from 'vitest';
import { dtoCosteoServidor } from '../nube.js';
import { validarIntentCosteo } from './validarIntentCosteo.js';

describe('costear-servidor client DTO',()=>{
  it('never sends economics or bulky UI state',()=>{
    const huge='x'.repeat(900000);
    const pieza={
      nombre:'Recepción',margen:40,modeloCosteo:'intelisis',precio:999,costoUnitario:10,render:huge,
      componentes:[{nombre:'Cubierta',insumoId:'melamina-28',largoMM:1200,anchoMM:600,piezas:1,cantidad:1,precio:999,insumo:{precio:1}}],
      horas:{carpinteria:2}
    };
    const dto=dtoCosteoServidor(pieza,1);
    const txt=JSON.stringify(dto);
    expect(txt.length).toBeLessThan(2000);
    expect(txt).not.toContain('margen');
    expect(txt).not.toContain('modeloCosteo');
    expect(txt).not.toContain('render');
    expect(txt).not.toContain('"precio"');
    expect(txt).not.toContain('"insumo"');
    expect(validarIntentCosteo(dto).ok).toBe(true);
  });

  it('pending material saved in _match survives DTO instead of causing server 400',()=>{
    const pieza={
      componentes:[{
        nombre:'Pintura en polvo negro mate',
        insumoId:'',
        cantidad:2.5,
        _match:{clase:'NOT_AVAILABLE',solicitado:'Pintura electrostática negra'}
      }]
    };
    const dto=dtoCosteoServidor(pieza,1);
    expect(dto.pieza.componentes[0]).toMatchObject({
      insumoId:'',
      material_solicitado:'Pintura electrostática negra',
      material_match:'NOT_AVAILABLE',
    });
    const v=validarIntentCosteo(dto);
    expect(v.ok).toBe(true);
  });
});
