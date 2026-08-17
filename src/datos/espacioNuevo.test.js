import { describe, it, expect } from 'vitest';
import { areasDeM2, ladosDe, totalM2, m2QueNecesita, limpiaM2, M2_TIPICOS } from './espacioNuevo.js';

describe('de m² a plantas', () => {
  it('los lados dan los m² que se pidieron', () => {
    for (const m2 of M2_TIPICOS) {
      const { ancho, largo } = ladosDe(m2);
      expect(Math.abs(ancho * largo - m2) / m2).toBeLessThan(0.02);   // ±2% por el redondeo
      expect(largo).toBeLessThanOrEqual(ancho);                        // planta, no cuadrado
    }
  });

  it('un piso da un área; tres pisos dan tres, numeradas', () => {
    expect(areasDeM2(400, 1)).toHaveLength(1);
    const tres = areasDeM2(400, 3);
    expect(tres).toHaveLength(3);
    expect(tres.map((a) => a.nombre)).toEqual([
      'Piso 1 (400 m²)', 'Piso 2 (400 m²)', 'Piso 3 (400 m²)',
    ]);
    expect(tres.every((a) => a.m2 === 400)).toBe(true);
  });

  it('medio piso es UNA planta de la mitad, y lo dice', () => {
    const [a] = areasDeM2(400, 0.5);
    expect(a.m2).toBe(200);
    expect(a.nombre).toMatch(/medio piso/i);
    expect(areasDeM2(400, 0.5)).toHaveLength(1);
  });

  it('el total del proyecto cuadra', () => {
    expect(totalM2(400, 3)).toBe(1200);
    expect(totalM2(400, 1)).toBe(400);
    expect(totalM2(400, 0.5)).toBe(200);
  });

  it('no acepta números imposibles', () => {
    expect(limpiaM2(-5)).toBe(20);
    expect(limpiaM2(99999)).toBe(5000);
    expect(limpiaM2('120')).toBe(120);
  });
});

describe('el aviso de "no te va a alcanzar"', () => {
  it('20 escritorios no caben en 50 m² y sí en 400', () => {
    const piezas = Array.from({ length: 20 }, (_, i) => ({ id: 'e' + i, w: 1500, d: 750, tipo: 'escritorio' }));
    const necesita = m2QueNecesita(piezas);
    expect(necesita).toBeGreaterThan(50);
    expect(necesita).toBeLessThan(400);
  });
});
