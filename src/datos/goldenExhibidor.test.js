// PRUEBA DE ORO · el exhibidor de 3 módulos que Dirección pegó el 12-oct (salida real de la IA):
// 15 renglones, 9 sin costo. Reproduce la propuesta y mide cuántos quedan sin costo tras las
// reglas de casa (sin ERP: sólo catálogo semilla) y qué agregan las reglas por geometría.
import { describe, it, expect } from 'vitest';
import { mapIaComps } from './mapIaComps.js';
import { conAcompanantes } from './autoInsumos.js';
import { revisarEstructura } from './revisionEstructural.js';
import { INSUMOS_SEMILLA, mapaInsumos } from './insumos.js';
import { calcular } from '../motor/calculo.js';
import { resumenMotor } from './resumenMotor.js';

const insumos = mapaInsumos(INSUMOS_SEMILLA);
const P = { piezas: [
  { nombre: 'Laterales módulo bajo (divisiones y extremos)', insumoId: 'melamina-19-color', material_solicitado: 'Melamina nogal 18 mm', material_match: 'EXACT', forma: 'area', largoMM: 950, anchoMM: 650, cantidad: 4, hojas: 0.83 },
  { nombre: 'Cubierta mostrador (3 tramos)', insumoId: 'melamina-19-color', material_solicitado: 'Melamina nogal 18 mm', material_match: 'EXACT', forma: 'area', largoMM: 800, anchoMM: 700, cantidad: 3, hojas: 0.56 },
  { nombre: 'Puertas módulo bajo izquierdo', insumoId: 'melamina-19-color', material_solicitado: 'Melamina nogal 18 mm', material_match: 'EXACT', forma: 'area', largoMM: 395, anchoMM: 790, cantidad: 2, hojas: 0.21 },
  { nombre: 'Repisa y fondo módulo bajo derecho', insumoId: 'melamina-19-color', material_solicitado: 'Melamina nogal 18 mm', material_match: 'EXACT', forma: 'area', largoMM: 760, anchoMM: 600, cantidad: 3, hojas: 0.46 },
  { nombre: 'Repisas superiores de exhibición', insumoId: 'mdf', material_solicitado: 'MDF 19 mm', material_match: 'EXACT', forma: 'area', largoMM: 790, anchoMM: 250, cantidad: 6, hojas: 0.40 },
  { nombre: 'Respaldo superior (panel trasero nogal)', insumoId: 'melamina-19-color', material_solicitado: 'Melamina nogal 18 mm', material_match: 'EXACT', forma: 'area', largoMM: 800, anchoMM: 1100, cantidad: 3, hojas: 0.89 },
  { nombre: 'Tapacanto PVC', insumoId: '', material_solicitado: 'Tapacanto PVC', material_match: 'NOT_AVAILABLE', forma: 'lineal', cantidad: 18 },
  { nombre: 'Bastidor PTR estructura negra (postes y travesaños)', insumoId: '', material_solicitado: 'PTR cal.14 negro', material_match: 'NOT_AVAILABLE', forma: 'lineal', cantidad: 30 },
  { nombre: 'Rótulos negros SNACKS/BEBIDAS/GRAB&GO (lámina)', insumoId: '', material_solicitado: 'Lámina de acero cal. 18 negra', material_match: 'NOT_AVAILABLE', forma: 'area', largoMM: 800, anchoMM: 400, cantidad: 3 },
  { nombre: 'Pintura electrostática estructura', insumoId: '', material_solicitado: 'Pintura electrostática negra', material_match: 'NOT_AVAILABLE', forma: 'pieza', cantidad: 1 },
  { nombre: 'Kit iluminación LED', insumoId: '', material_solicitado: 'Kit iluminacion LED 5000 K (tiras + fuente + arnes)', material_match: 'NOT_AVAILABLE', forma: 'pieza', cantidad: 1 },
  { nombre: 'Refrigerador doble puerta de vidrio', insumoId: '', material_solicitado: 'Refrigerador doble puerta de vidrio', material_match: 'NOT_AVAILABLE', forma: 'pieza', cantidad: 1 },
  { nombre: 'Bisagras puertas', insumoId: '', material_solicitado: 'Bisagra', material_match: 'NOT_AVAILABLE', forma: 'pieza', cantidad: 4 },
  { nombre: 'Jaladeras', insumoId: '', material_solicitado: 'Jaladera', material_match: 'NOT_AVAILABLE', forma: 'pieza', cantidad: 2 },
  { nombre: 'Niveladores', insumoId: '', material_solicitado: 'Nivelador conico cromado 3/8', material_match: 'NOT_AVAILABLE', forma: 'pieza', cantidad: 12 },
] };

describe('golden · exhibidor 3 módulos (12-oct)', () => {
  const comps = conAcompanantes(mapIaComps(P, insumos), insumos);
  const sinCosto = comps.filter((c) => !c.insumoId);
  it('antes: 9 de 15 sin costo → después: sólo el refrigerador (lo pone el cliente; no es "cristal" por decir vidrio)', () => {
    expect(comps.filter((c) => c.insumoId).length).toBe(14);
    expect(sinCosto.map((c) => c.nombre)).toEqual(['Refrigerador doble puerta de vidrio']);
    expect(sinCosto[0].material_match).toBe('NOT_AVAILABLE'); expect(sinCosto[0]._match.motivo).toMatch(/Equipo externo/);
  });
  it('PTR y lámina pedidos en negro ya no son "crítico": provisional, el color lo da la pintura', () => {
    const ptr = comps.find((c) => /Bastidor/.test(c.nombre)); expect(ptr.insumoId).toBe('ptr-14'); expect(ptr.material_match).toBe('SAME_FAMILY_COMPATIBLE_PROPOSED'); expect(ptr._match.cambio).toMatch(/pintura/);
    const lam = comps.find((c) => /Rótulos/.test(c.nombre)); expect(lam.insumoId).toBe('lamina-18');
  });
  it('herrajes amarrados: bisagra, jaladera, nivelador, tapacanto, pintura (negra, por m² calculado)', () => {
    expect(comps.find((c) => /Bisagras/.test(c.nombre)).insumoId).toBe('bisagra');
    expect(comps.find((c) => /Jaladeras/.test(c.nombre)).insumoId).toBe('jaladera');
    expect(comps.find((c) => /^Niveladores$/.test(c.nombre)).insumoId).toBe('nivelador');
    expect(comps.find((c) => /^Tapacanto PVC$/.test(c.nombre)).insumoId).toBe('tapacanto');
    const pin = comps.find((c) => /^Pintura electrostática estructura$/.test(c.nombre)); expect(pin.insumoId).toMatch(/^pintura-polvo/);
  });
  it('no duplica lo que la IA ya puso: tapacanto y pintura se completan con la geometría sobre la misma línea', () => {
    expect(comps.filter((c) => c._regla === 'tapacanto')).toHaveLength(1);
    const tc = comps.find((c) => c._regla === 'tapacanto'); expect(tc.nombre).toBe('Tapacanto PVC'); expect(tc.iaCantidad).toBe(18); expect(tc.cantidad).toBeCloseTo(27.16, 2);   // laterales 6.4 + cubiertas 9 + puertas 4.74 + repisas bajas 2.28 + repisas MDF 4.74
    expect(comps.filter((c) => c._regla === 'pintura')).toHaveLength(1);
    const pin = comps.find((c) => c._regla === 'pintura'); expect(pin.nombre).toBe('Pintura electrostática estructura'); expect(pin.areaPintadaM2).toBeCloseTo(3.05 + 0.96 * 2, 1); expect(pin.tubular).toBe(true);
    expect(comps.filter((c) => c._regla === 'niveladores')).toHaveLength(0);
    expect(comps).toHaveLength(15);
  });
  it('la hoja de tablero la decide el motor (A14/rejilla): laterales 4 × 950×650 → 2 hojas, no 0.83', () => {
    const r = calcular({ componentes: comps }, 1, insumos, {});
    const mel = r.detalleInsumos.find((d) => d.insumoId === 'melamina-19-color');
    expect(mel.metodoConsumo).toBe('RENDIMIENTO_GEOMETRICO');
    const m = resumenMotor(r);
    expect(m.hojasTablero).toBeGreaterThan(3.35);   // la IA sumaba 3.35 hojas por área pura
    expect(m.renglones.some((x) => /A14|rejilla/.test(x.metodo))).toBe(true);
  });
  it('revisión estructural avisa: repisas en MDF crudo vs melamina nogal; respaldo de 19; claro ≥ 800', () => {
    const rev = revisarEstructura({ componentes: comps, insumos });
    const reglas = rev.observaciones.map((o) => o.regla).filter(Boolean);
    expect(reglas).toContain('acabado_consistente'); expect(reglas).toContain('respaldo_espesor');
  });
});
