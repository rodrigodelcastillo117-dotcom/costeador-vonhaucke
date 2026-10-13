import { describe, it, expect } from 'vitest';
import { aplicarAHermanas } from './materialHermanas.js';

const conf = (id) => (c) => ({ ...c, insumoId: id, material_confirmado: true });
// BOM real del lab librero 5×8 (lab/noche/ab_opus55/costear/librero_5x8/8-dto-servidor.json), reducido.
const bom = () => [
  { nombre: 'Laterales', insumoId: 'erp-ame28152-b709', material_confirmado: true },   // la persona ya eligió el ERP
  { nombre: 'Piso y techo', insumoId: 'melamina-28-walnut' },
  { nombre: 'Entrepaño fijo', insumoId: 'melamina-28-walnut' },
  { nombre: 'Respaldo', insumoId: 'melamina-16-walnut' },
  { nombre: 'Tapacanto', insumoId: 'tapacanto' },
];

describe('elegir el artículo de una pieza lo aplica a las piezas del mismo material sin decisión humana', () => {
  it('librero: el tablero 5×8 elegido para los laterales pasa a piso/techo y entrepaños; respaldo y canto no', () => {
    const { comps, aplicadas } = aplicarAHermanas(bom(), 0, 'melamina-28-walnut', 'erp-ame28152-b709', conf('erp-ame28152-b709'));
    expect(aplicadas).toEqual(['Piso y techo', 'Entrepaño fijo']);
    expect(comps.map((c) => c.insumoId)).toEqual(['erp-ame28152-b709', 'erp-ame28152-b709', 'erp-ame28152-b709', 'melamina-16-walnut', 'tapacanto']);
  });
  it('no pisa una decisión humana previa ni piezas excluidas', () => {
    const b = bom(); b[1].material_confirmado = true; b[2].excluida = true;
    const { aplicadas } = aplicarAHermanas(b, 0, 'melamina-28-walnut', 'erp-ame28152-b709', conf('x'));
    expect(aplicadas).toEqual([]);
  });
  it('una pieza SIN material no arrastra a las otras piezas sin material (no son el mismo material)', () => {
    const b = [{ nombre: 'A', insumoId: '' }, { nombre: 'B', insumoId: '' }];
    expect(aplicarAHermanas(b, 0, '', 'erp-x', conf('erp-x')).aplicadas).toEqual([]);
  });
  it('mismo material antes y después: nada que propagar', () => {
    expect(aplicarAHermanas(bom(), 1, 'melamina-28-walnut', 'melamina-28-walnut', conf('m')).aplicadas).toEqual([]);
  });
});
