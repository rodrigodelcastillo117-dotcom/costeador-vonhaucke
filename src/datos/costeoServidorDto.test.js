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
});

// VH-156 · paridad cliente/servidor: los campos que lee el motor viajan en el DTO (areaPintadaM2, tubular, excluida).
import { it as itDto, expect as expectDto } from 'vitest';
import { dtoCosteoServidor as dtoVH156 } from '../nube.js';
itDto('dtoCosteoServidor manda areaPintadaM2/tubular/excluida cuando existen y los omite cuando no', () => {
  const d = dtoVH156({ componentes: [
    { insumoId: 'pintura-electrostatica', nombre: 'Pintura base', areaPintadaM2: 0.9, tubular: true, cantidad: 1 },
    { insumoId: 'mdf', nombre: 'Lateral', largoMM: 650, anchoMM: 450, cantidad: 2, excluida: true },
    { insumoId: 'bisagra', nombre: 'Bisagra', cantidad: 6, areaPintadaM2: 0, tubular: false },
  ] }, 1);
  expectDto(d.pieza.componentes[0]).toMatchObject({ areaPintadaM2: 0.9, tubular: true });
  expectDto(d.pieza.componentes[1]).toMatchObject({ excluida: true, largoMM: 650 });
  expectDto(d.pieza.componentes[2]).not.toHaveProperty('areaPintadaM2');
  expectDto(d.pieza.componentes[2]).not.toHaveProperty('tubular');
  expectDto(d.pieza.componentes[2]).not.toHaveProperty('excluida');
});
