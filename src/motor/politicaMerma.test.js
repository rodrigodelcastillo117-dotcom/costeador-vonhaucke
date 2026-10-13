// A14 · VH-077 · Reglas de merma de Producción (Rogelio) como fórmula oficial (2026-10-12).
import { describe, it, expect } from 'vitest';
import { hojasPorPiezaProduccion, kgPinturaPorArea, esPinturaPolvo, REGLAS_MERMA_PRODUCCION } from './politicaMerma.js';
import { calcular, costeoEmitible, netoComponente, piezasPorTablero, PARAMETROS_DEFAULT, MOTOR_VERSION } from './calculo.js';
import { validarIntentCosteo } from '../datos/validarIntentCosteo.js';

const TABLERO = { tipo: 'tablero', nombre: 'tablero 1.22 x 2.44', corto: 'tablero', medida: 2.9768, largoMM: 2440, anchoMM: 1220 };
const INS = {
  'melamina-19': { id: 'melamina-19', nombre: 'Melamina 19', seccion: 'cubiertas', unidad: 'hoja', precio: 544, formato: TABLERO, fraccion: true, mermaCorte: 6 },
  'pintura-polvo': { id: 'pintura-polvo', nombre: 'Pintura en polvo', seccion: 'acabados', unidad: 'kg', precio: 115.949073, clase: 'indirecta' },
  'ptr': { id: 'ptr', nombre: 'PTR', seccion: 'metal', unidad: 'm', precio: 38.19, formato: { tipo: 'tramo', medida: 6 }, mermaCorte: 5 },
};
const par = { ...PARAMETROS_DEFAULT, margenObjetivo: 50 };
const mat = (r) => r.detalleInsumos.find((d) => d.insumoId === 'melamina-19' || d.id === 'melamina-19' || d.nombre === 'Melamina 19') || r.detalleInsumos[0];

describe('regla de tablero de Producción (literal de Rogelio)', () => {
  it('≥ 1.50 × ≤ 0.60 → ½ hoja; ≥ 1.50 × > 0.60 → 1 hoja; < 1.50 → sin regla (rejilla)', () => {
    expect(hojasPorPiezaProduccion(1600, 600)).toBe(0.5);
    expect(hojasPorPiezaProduccion(600, 1600)).toBe(0.5);   // orientación indiferente
    expect(hojasPorPiezaProduccion(2400, 600)).toBe(0.5);
    expect(hojasPorPiezaProduccion(1600, 700)).toBe(1);
    // VH-183: 1.50 exacto SÍ entra (Intelisis ATCUBS45ABS 1500×600 = 0.5 hoja; ATCUBD45ABS 1500×1200 = 1 hoja).
    expect(hojasPorPiezaProduccion(1500, 600)).toBe(0.5);
    expect(hojasPorPiezaProduccion(1500, 1200)).toBe(1);
    expect(hojasPorPiezaProduccion(1499, 600)).toBeNull();
    expect(hojasPorPiezaProduccion(1400, 700)).toBeNull();
    expect(hojasPorPiezaProduccion(400, 200)).toBeNull();
    expect(hojasPorPiezaProduccion(0, 600)).toBeNull();
    expect(hojasPorPiezaProduccion(-1600, 600)).toBeNull();
  });
  it('la regla CORRIGE a la rejilla donde difieren: una tapa 1.60×0.60 era 1 hoja en rejilla (kerf+orilla) y Producción cobra ½', () => {
    expect(piezasPorTablero(1600, 600)).toBe(1); // rejilla: dos de 0.60 no caben lado a lado tras orilla 1 cm + kerf 6 mm
    const r = calcular({ componentes: [{ nombre: 'Tapa', insumoId: 'melamina-19', largoMM: 1600, anchoMM: 600 }] }, 1, INS, par);
    const d = mat(r);
    expect(d.unidades).toBeCloseTo(0.5, 9);
    expect(d.costo).toBeCloseTo(0.5 * 544, 6);
    expect(d.reglaProduccion).toBe(REGLAS_MERMA_PRODUCCION.version);
    expect(d.piezasRegla).toEqual([{ pieza: 'Tapa', largoMM: 1600, anchoMM: 600, hojasPorPieza: 0.5 }]);
  });
  it('1.60×0.70 → 1 hoja entera; dos piezas → 2 hojas (no se promedian)', () => {
    const r = calcular({ componentes: [{ nombre: 'Costado', insumoId: 'melamina-19', largoMM: 1600, anchoMM: 700, piezas: 2 }] }, 1, INS, par);
    expect(mat(r).unidades).toBeCloseTo(2, 9);
    expect(mat(r).costo).toBeCloseTo(2 * 544, 6);
  });
  it('pieza chica (repisa 0.40×0.20) NO cambia: sigue la fracción real de la rejilla (25 por tablero con kerf 6 y orilla 1 cm)', () => {
    expect(piezasPorTablero(400, 200)).toBe(25);
    const r = calcular({ componentes: [{ nombre: 'Repisa', insumoId: 'melamina-19', largoMM: 400, anchoMM: 200 }] }, 1, INS, par);
    expect(mat(r).unidades).toBeCloseTo(1 / 25, 9);
    expect(mat(r).reglaProduccion).toBeUndefined();
  });
  it('pieza más grande que el tablero (2.60×0.70): se cobra 1 hoja por la regla Y se avisa que no cabe (antes caía al 80 % genérico)', () => {
    const r = calcular({ componentes: [{ nombre: 'Cubierta larga', insumoId: 'melamina-19', largoMM: 2600, anchoMM: 700 }] }, 1, INS, par);
    expect(mat(r).unidades).toBeCloseTo(1, 9);
    expect(mat(r).noCabe).toBe(true);
    const g = costeoEmitible(r);
    expect(g.emitible).toBe(false); // el formato incompatible sigue bloqueando la emisión
  });
  it('la regla NO aplica a formatos que no son tablero (PTR por tramo de 6 m sigue igual)', () => {
    const r = calcular({ componentes: [{ nombre: 'Pata', insumoId: 'ptr', cantidad: 7 }] }, 1, INS, par);
    const d = r.detalleInsumos[0];
    expect(d.unidades).toBe(2);           // 7 m × 1.05 merma = 7.35 m → 2 tramos de 6 m
    expect(d.reglaProduccion).toBeUndefined();
  });
});

describe('pintura en polvo por área pintada (8 m²/kg plano y tubular, Dirección 12-oct)', () => {
  it('kgPinturaPorArea: 0.8 m² → 0.1 kg; tubular → 0.1 kg; área 0/negativa → null', () => {
    expect(kgPinturaPorArea(0.8)).toBeCloseTo(0.1, 12);
    expect(kgPinturaPorArea(8)).toBe(1);
    expect(kgPinturaPorArea(0.8, { tubular: true })).toBeCloseTo(0.1, 9);
    expect(kgPinturaPorArea(0)).toBeNull();
    expect(kgPinturaPorArea(-2)).toBeNull();
  });
  it('esPinturaPolvo: sólo pintura en polvo por kg', () => {
    expect(esPinturaPolvo(INS['pintura-polvo'])).toBe(true);
    expect(esPinturaPolvo({ id: 'pintura-polvo-antracita-tx', unidad: 'kg' })).toBe(true);
    expect(esPinturaPolvo({ id: 'pintura-electrostatica', unidad: 'm2' })).toBe(false);
    expect(esPinturaPolvo(INS['melamina-19'])).toBe(false);
    expect(esPinturaPolvo(null)).toBe(false);
  });
  it('componente con areaPintadaM2 en pintura-polvo: neto en kg y costo = kg × precio/kg', () => {
    const comp = { nombre: 'Estructura pintada', insumoId: 'pintura-polvo', areaPintadaM2: 0.8 };
    expect(netoComponente(comp, 1, INS['pintura-polvo'])).toBeCloseTo(0.1, 12);
    const r = calcular({ componentes: [comp] }, 1, INS, par);
    const d = r.detalleInsumos[0];
    expect(d.costo).toBeCloseTo(0.1 * 115.949073, 9);
    expect(r.componentesIgnorados).toEqual([]);
  });
  it('areaPintadaM2 en un insumo que NO es pintura se ignora (sigue cantidad/medidas)', () => {
    const comp = { nombre: 'Tapa', insumoId: 'melamina-19', largoMM: 400, anchoMM: 200, areaPintadaM2: 5 };
    expect(netoComponente(comp, 1, INS['melamina-19'])).toBeCloseTo(0.08, 12);
  });
  it('tubular pintado por área: desde el 12-oct (Dirección: "es 8") costea a 8 m²/kg como el plano', () => {
    const r = calcular({ componentes: [{ nombre: 'Tubular pintado', insumoId: 'pintura-polvo', areaPintadaM2: 0.8, tubular: true }] }, 1, INS, par);
    expect(r.componentesIgnorados).toEqual([]);
    expect(r.detalleInsumos[0].neto).toBeCloseTo(0.1, 9);
  });
  it('tubular pintado CON kg capturados (cantidad): se respeta la cantidad del estimador', () => {
    const r = calcular({ componentes: [{ nombre: 'Tubular pintado', insumoId: 'pintura-polvo', cantidad: 0.2, tubular: true }] }, 1, INS, par);
    expect(r.detalleInsumos[0].costo).toBeCloseTo(0.2 * 115.949073, 9);
  });
});

describe('contrato DTO (cliente → costear-servidor)', () => {
  it('areaPintadaM2 y tubular pasan el saneado; areaPintadaM2 negativa → 400', () => {
    const ok = validarIntentCosteo({ cantidad: 1, pieza: { componentes: [{ insumoId: 'pintura-polvo', areaPintadaM2: 0.8, tubular: true }] } });
    expect(ok.ok).toBe(true);
    expect(ok.intent.pieza.componentes[0]).toEqual({ insumoId: 'pintura-polvo', areaPintadaM2: 0.8, tubular: true });
    const mal = validarIntentCosteo({ cantidad: 1, pieza: { componentes: [{ insumoId: 'pintura-polvo', areaPintadaM2: -1 }] } });
    expect(mal.ok).toBe(false);
    expect(mal.issues[0].field).toBe('componentes[0].areaPintadaM2');
  });
});

describe('versión del motor', () => {
  it('la fórmula cambió → MOTOR_VERSION avanzó (las cotizaciones viejas conservan su huella)', () => {
    expect(MOTOR_VERSION).toBe('2026-10-13b'); // 13b: regla de tablero de Producción inclusiva en 1.50 m (VH-183); 13: rejilla con el formato del insumo
  });
});

// VH-183 · cubiertas APP LT contra el REPORTE DEL COTIZADOR Intelisis (lab/applt/componentes, 12/08/2026): fracción de
// hoja AME2848 4×8 que cobra el ERP para cada medida. El motor debe cobrar la MISMA fracción (rejilla o regla).
describe('VH-183 · fracción de hoja de las cubiertas reales (Intelisis) = la del motor', () => {
  const casos = [
    ['ATCUBS44ABS', 1200, 600, 0.25], ['ATCUBS45ABS', 1500, 600, 0.5], ['ATCUBS46ABS', 1800, 600, 0.5],
    ['ATCUBD44ABS', 1200, 1200, 0.5], ['ATCUBD45ABS', 1500, 1200, 1], ['ATCUBD46ABS', 1800, 1200, 1],
  ];
  for (const [clave, l, a, hojas] of casos) {
    it(`${clave} ${l}×${a} → ${hojas} hoja`, () => {
      const r = calcular({ componentes: [{ nombre: 'Cubierta', insumoId: 'melamina-19', largoMM: l, anchoMM: a }] }, 1, INS, par);
      expect(mat(r).unidades).toBeCloseTo(hojas, 9);
    });
  }
});
