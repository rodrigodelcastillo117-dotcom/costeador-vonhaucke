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
