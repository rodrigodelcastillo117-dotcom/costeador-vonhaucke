import { describe,it,expect } from 'vitest';
import { evaluarGoldenCosteo, fuenteGoldenValida } from './calibracion.js';

describe('golden cost contract',()=>{
  it('certifica sólo si todos los campos cuadran al centavo',()=>{
    const g={materialTotal:100.01,manoObra:20.02,indirectosFabrica:5.03,costoFabricacion:125.06,costoTotal:162.58,precio:195.10,precioLista:585.30};
    const r=evaluarGoldenCosteo({...g},g,{toleranciaCentavos:1});
    expect(r.certificable).toBe(true);
    expect(r.max_abs_delta_centavos).toBe(0);
  });
  it('falla con diferencia de dos centavos',()=>{
    const r=evaluarGoldenCosteo({costoTotal:100.02},{costoTotal:100},{campos:['costoTotal'],toleranciaCentavos:1});
    expect(r.certificable).toBe(false);
    expect(r.fallas[0].delta_centavos).toBe(2);
  });
  it('no certifica si falta evidencia esperada',()=>{
    const r=evaluarGoldenCosteo({costoTotal:100},{},{campos:['costoTotal']});
    expect(r.certificable).toBe(false);
    expect(r.faltantes[0].estado).toBe('SIN_GOLDEN');
  });
  it('exige fuente identificable',()=>{
    expect(fuenteGoldenValida({tipo:'INTELISIS',folio:'OC-1',fecha:'2026-10-05'})).toBe(true);
    expect(fuenteGoldenValida({tipo:'INTELISIS'})).toBe(false);
  });
});
