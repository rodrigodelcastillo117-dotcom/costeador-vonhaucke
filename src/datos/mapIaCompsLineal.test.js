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
  it('si la IA ya puso los metros en cantidad (5.0 con largoMM 5000) no se multiplica', () => {
    expect(pieza({ nombre: 'Base PTR', insumoId: 'ptr-14', forma: 'lineal', largoMM: 5000, cantidad: 5 }).cantidad).toBe(5);
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
