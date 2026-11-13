// Regresión: mapIaComps debe PRESERVAR areaPintadaM2 y tubular de la IA al componente, o la pintura
// en polvo por área cae a 1 kg default (bug VONI→motor hallado costeando un exhibidor: 10 m² pintados
// cobraban 1 kg en vez de 1.28). netoComponente ya sabe convertir área→kg; el mapeador los borraba.
import { describe, it, expect } from 'vitest';
import { calcular, PARAMETROS_DEFAULT } from '../motor/calculo.js';
import { mapIaComps } from './mapIaComps.js';

const INS = {
  'pintura-polvo-negro': { id: 'pintura-polvo-negro', clase: 'indirecta', nombre: 'Pintura polvo negro', precio: 120.68, unidad: 'kg', seccion: 'acabados', fraccion: false, mermaCorte: 0, formato: null },
};

describe('mapIaComps preserva pintura por área', () => {
  it('areaPintadaM2 y tubular sobreviven el mapeo', () => {
    const prop = { piezas: [{ nombre: 'Estructura pintada', material_solicitado: 'pintura en polvo negro', insumoId: 'pintura-polvo-negro', areaPintadaM2: 10, tubular: true, forma: 'pieza' }] };
    const comps = mapIaComps(prop, INS);
    expect(comps[0].areaPintadaM2).toBe(10);
    expect(comps[0].tubular).toBe(true);
  });

  it('tubular: 10 m² → 10/7.8 kg (no 1 kg default)', () => {
    const prop = { piezas: [{ nombre: 'Estructura', material_solicitado: 'pintura en polvo negro', insumoId: 'pintura-polvo-negro', areaPintadaM2: 10, tubular: true, forma: 'pieza' }] };
    const r = calcular({ componentes: mapIaComps(prop, INS) }, 1, INS, { ...PARAMETROS_DEFAULT });
    expect(r.detalleInsumos[0].neto).toBeCloseTo(10 / 7.8, 6);       // 1.282 kg, no 1
    expect(r.detalleInsumos[0].costo).toBeCloseTo((10 / 7.8) * 120.68, 4); // ~$154.72
  });

  it('plano: 8 m² → 8/8 = 1 kg', () => {
    const prop = { piezas: [{ nombre: 'Lámina', material_solicitado: 'pintura en polvo negro', insumoId: 'pintura-polvo-negro', areaPintadaM2: 8, forma: 'pieza' }] };
    const r = calcular({ componentes: mapIaComps(prop, INS) }, 1, INS, { ...PARAMETROS_DEFAULT });
    expect(r.detalleInsumos[0].neto).toBeCloseTo(1, 6);
  });
});
