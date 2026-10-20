import { describe, it, expect } from 'vitest';
import { textoReparto } from './textoReparto.js';

describe('textoReparto (prueba de Rodrigo 19-oct)', () => {
  const g = [
    { code: 'SPLIT_REQUIRED', relation_role: 'WORK_SEAT', anchor_role: 'ANCHOR_WORKSTATION', fila_cantidad: 16, requerido: 8, fila_nombre: 'Silla operativa · WIN' },
    { code: 'SPLIT_REQUIRED', relation_role: 'WORK_SEAT', anchor_role: 'ANCHOR_WORKSTATION', fila_cantidad: 16, requerido: 8, fila_nombre: 'Silla operativa · WIN' },
  ];
  it('explica el reparto en palabras, sin ids ni "—"', () => {
    const t = textoReparto(g);
    expect(t.titulo).toBe('Tienes 16 × Silla operativa · WIN en un solo renglón y el plano las reparte entre 2 estaciones operativas (8 + 8 = 16).');
    expect(t.ayuda).toMatch(/no se agregan ni se duplican/);
    expect(t.boton).toBe('Repartir entre las 2 estaciones operativas');
    expect(`${t.titulo} ${t.ayuda}`).not.toMatch(/—|inst:|req:/);
  });
  it('si el renglón no alcanza, dice que lo que falte se agrega', () => {
    expect(textoReparto([{ ...g[0], fila_cantidad: 10 }, { ...g[1], fila_cantidad: 10 }]).ayuda).toMatch(/cubre 10 lugares/);
  });
});
