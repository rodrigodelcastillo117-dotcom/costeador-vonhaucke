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

describe('textoReparto · reparto parcial y destinos mezclados (lab 19-oct)', () => {
  it('13 en el renglón y el plano pide 1 para la recepción: lo dice así, sin "1 recepciones (1 = 1)"', () => {
    const t = textoReparto([{ code: 'SPLIT_REQUIRED', relation_role: 'WORK_SEAT', anchor_role: 'ANCHOR_RECEPTION', fila_cantidad: 13, requerido: 1, fila_nombre: 'Silla operativa · GAMMA-E' }]);
    expect(t.titulo).toBe('Tienes 13 × Silla operativa · GAMMA-E en un solo renglón y el plano necesita 1 para la recepción.');
    expect(t.boton).toBe('Usar 1 para la recepción');
    expect(t.ayuda).toMatch(/las otras 12 quedan para los demás lugares/);
  });
  it('destinos mezclados (operativos + recepción): "muebles", no "estaciones operativas"', () => {
    const t = textoReparto([
      { relation_role: 'WORK_SEAT', anchor_role: 'ANCHOR_WORKSTATION', fila_cantidad: 13, requerido: 12, fila_nombre: 'GAMMA-E' },
      { relation_role: 'WORK_SEAT', anchor_role: 'ANCHOR_RECEPTION', fila_cantidad: 13, requerido: 1, fila_nombre: 'GAMMA-E' },
    ]);
    expect(t.titulo).toMatch(/entre 2 muebles \(12 \+ 1 = 13\)/);
  });
});
