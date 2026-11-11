// IDENTIDAD FISICA de piezas (auditoria 0f9ebc0). Dos piezas con el mismo nombre son distintas
// por su posicion: la clave no debe colisionar, y confirmar el CAD de una no toca a su gemela.
import { describe, it, expect } from 'vitest';
import { despieceDesdeComponentes, expedienteIndustrialDesdeDespiece } from './expedienteIndustrialDesdeDespiece.js';
import { recostearExpediente } from './pantallaIngenieria.js';

const catalogoLamina = [{ id: 'lam18', calibre: 18, acero: 'negra', formato: { largoMM: 3050, anchoMM: 1220 }, precio: 571.54, certificable: true }];
const insumos = { lam: { nombre: 'Lamina cal.18', seccion: 'metal' } };
// Dos laterales FISICAMENTE IDENTICOS (mismo nombre, insumoId, dims), SIN id.
const componentes = [
  { nombre: 'Lateral', insumoId: 'lam', cantidad: 1, seccion: 'metal' },
  { nombre: 'Lateral', insumoId: 'lam', cantidad: 1, seccion: 'metal' },
];

describe('IDENTIDAD FISICA de piezas', () => {
  it('dos piezas con el MISMO nombre reciben claves DISTINTAS (no colisionan); se conserva el nombre', () => {
    const d = despieceDesdeComponentes(componentes, insumos);
    expect(d[0].clave).not.toBe(d[1].clave);
    expect(new Set(d.map((x) => x.clave)).size).toBe(2);
    expect(d[0].desc).toBe('Lateral'); expect(d[1].desc).toBe('Lateral');
  });
  it('un id explicito de VONI se respeta como identidad fisica', () => {
    const d = despieceDesdeComponentes([{ nombre: 'Lateral', id: 'L-izq', seccion: 'metal' }, { nombre: 'Lateral', id: 'L-der', seccion: 'metal' }], insumos);
    expect(d[0].clave).toContain('L-izq'); expect(d[1].clave).toContain('L-der');
  });
  it('confirmar el CAD de UNA pieza NO afecta a su gemela; recalcula solo esa (CAD + recalculo)', () => {
    const d = despieceDesdeComponentes(componentes, insumos);
    const v1 = expedienteIndustrialDesdeDespiece(d, { clave: 'IDENT', insumosERP: insumos, catalogoLamina });
    const [k0, k1] = d.map((x) => x.clave);
    expect(v1.costo_industrial.material.pendiente.desarrollos_3d).toEqual(expect.arrayContaining([k0, k1])); // ambas pendientes
    const v2 = recostearExpediente(v1, { tipo: 'desarrollo', clave: k0, desarrollo_mm: [600, 400], fuente: 'CAD' });
    const pend2 = v2.costo_industrial.material.pendiente.desarrollos_3d;
    expect(pend2).not.toContain(k0);   // la confirmada salio de pendientes
    expect(pend2).toContain(k1);       // la GEMELA sigue pendiente (no se confirmo sola)
  });
});
