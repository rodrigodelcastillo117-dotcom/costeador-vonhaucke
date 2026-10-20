import { describe, it, expect } from 'vitest';
import { mapIaComps } from './mapIaComps.js';
import { INSUMOS_SEMILLA as INSUMOS } from './insumos.js';

const insumos = Object.fromEntries((INSUMOS || []).map((i) => [i.id, i]));
const pieza = (z) => mapIaComps({ piezas: [{ material_solicitado: z.nombre, material_match: 'EXACT', confianza: 'alta', ...z }] }, insumos)[0];

describe('VH-160 · piezas lineales: los metros salen de largoMM × piezas', () => {
  it('PTR de la credenza: largoMM 5000, cantidad 1 → 5 m (antes 1 m)', () => {
    expect(pieza({ nombre: 'Base PTR', insumoId: 'ptr-14', forma: 'lineal', largoMM: 5000, cantidad: 1 }).cantidad).toBe(5);
  });
  it('4 patas de 731 → 2.924 m', () => {
    const c = pieza({ nombre: 'Patas PTR', insumoId: 'ptr', forma: 'lineal', largoMM: 731, cantidad: 4 });
    expect(c.cantidad).toBeCloseTo(2.924, 6);
    expect(c.piezasLineales).toBe(4);
  });
  it('VH-AUD-201: cantidad 5 con largoMM 5000 son 5 piezas (25 m), nunca "ya eran metros"; queda para revisión', () => {
    const c = pieza({ nombre: 'Base PTR', insumoId: 'ptr-14', forma: 'lineal', largoMM: 5000, cantidad: 5 });
    expect(c.cantidad).toBe(25);
    expect(c.iaIncoherencia).toMatchObject({ campo: 'cantidadLineal' });
  });
  it('lineal sin largoMM: cantidad son metros (contrato anterior intacto)', () => {
    expect(pieza({ nombre: 'Tapacanto', insumoId: 'tapacanto', forma: 'lineal', cantidad: 4.4 }).cantidad).toBe(4.4);
  });
});

// Certificación 19-oct (mesa de trabajo, lote 10): la IA mandó el faldón de lámina cal. 18 como forma "lineal" con
// largoMM 1400 y anchoMM 300 (y su nota dice "no es lineal real"). La app lo costeaba como 1.4 m lineales de un
// material que se vende por HOJA; la hoja de control esperaba la pieza 1400 × 300.
describe('pieza de lámina/tablero mandada como "lineal" con largo y ancho → se costea por área', () => {
  const faldon = { nombre: 'Faldón lámina cal.18', insumoId: 'lamina-18', forma: 'lineal', largoMM: 1400, anchoMM: 300, cantidad: 1,
    nota: 'Una pieza 1400x300. El catálogo vende lámina cal.18 por kg: 0.42 m2. El motor debe convertir a kg; no es lineal real.' };
  it('faldón 1400 × 300 de lámina-18: forma área, 1 pieza de 1400 × 300', () => {
    const c = pieza(faldon);
    expect(c.forma).toBe('area');
    expect([c.largoMM, c.anchoMM, c.piezas, c.cantidad]).toEqual([1400, 300, 1, 1]);
  });
  it('un PTR lineal con anchoMM (perfil) sigue siendo lineal', () => {
    const c = pieza({ nombre: 'Patas PTR', insumoId: 'ptr', forma: 'lineal', largoMM: 731, anchoMM: 50, cantidad: 4 });
    expect(c.forma).toBe('lineal');
    expect(c.cantidad).toBeCloseTo(2.924, 6);
  });
  it('tablero (mdf) lineal con largo y ancho → área', () => {
    expect(pieza({ nombre: 'Copete', insumoId: 'mdf', forma: 'lineal', largoMM: 1800, anchoMM: 100, cantidad: 2 })).toMatchObject({ forma: 'area', largoMM: 1800, anchoMM: 100, piezas: 2 });
  });
});

// Auditoría 2026-10-19 (certificación total, mesa de trabajo): la IA mandó el faldón como forma "pieza" con 1400 × 300.
// En producción lamina-18 se costea POR HOJA ($571.54): "pieza ×1" cobraba UNA HOJA ENTERA por una pieza de 0.42 m².
// Y en el laboratorio ciego ERP, piezas de lámina doblada con "cantidad" 1.3 / 2.8 (kg, no piezas) eran 1.3 / 2.8 hojas.
describe('pieza de lámina/tablero mandada como "pieza" con largo y ancho → se costea por área', () => {
  it('faldón "pieza" 1400 × 300 ×1 de lámina-18: área, 1 pieza de 1400 × 300', () => {
    const c = pieza({ nombre: 'Faldón lámina cal.18 1400x300', insumoId: 'lamina-18', forma: 'pieza', largoMM: 1400, anchoMM: 300, cantidad: 1 });
    expect(c.forma).toBe('area');
    expect([c.largoMM, c.anchoMM, c.piezas, c.cantidad]).toEqual([1400, 300, 1, 1]);
    expect(c.iaIncoherencia).toBeUndefined();
  });
  it('2 placas "pieza" 120 × 100 ×2 de lámina-10: área, 2 piezas', () => {
    const c = pieza({ nombre: 'Placa de fijación', insumoId: 'lamina-10', forma: 'pieza', largoMM: 120, anchoMM: 100, cantidad: 2 });
    expect(c).toMatchObject({ forma: 'area', largoMM: 120, anchoMM: 100, piezas: 2 });
  });
  it('omega "pieza" 850 × 100 ×1.3 (no es un número de piezas): área de 1 pieza y queda marcado para revisión', () => {
    const c = pieza({ nombre: 'Perfil omega lámina doblada 850 × 100 × 17 mm', insumoId: 'lamina-18', forma: 'pieza', largoMM: 850, anchoMM: 100, cantidad: 1.3 });
    expect(c).toMatchObject({ forma: 'area', largoMM: 850, anchoMM: 100, piezas: 1 });
    expect(c.iaIncoherencia).toMatchObject({ campo: 'cantidadPiezas', dice: 1.3, puso: 1 });
  });
  it('una "pieza" de herraje (no de hoja) con medidas sigue siendo pieza', () => {
    const c = pieza({ nombre: 'Jaladera 300 mm', insumoId: 'jaladera', forma: 'pieza', largoMM: 300, anchoMM: 20, cantidad: 3 });
    expect(c.forma).toBe('pieza');
  });
});
