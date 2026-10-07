import { describe, it, expect } from 'vitest';
import { selloPartida } from './util.js';

describe('selloPartida · la autoridad de precio NUEVA manda (audit #8)', () => {
  it('SNAPSHOT_DISPLAY → Referencia (no Firme, no Estimado)', () => {
    const s = selloPartida({ price_status: 'SNAPSHOT_DISPLAY', precioReal: false, sinPrecioAutorizado: true, precioUnitario: 28540 });
    expect(s.tipo).toBe('referencia');
    expect(s.texto).toMatch(/Referencia/i);
  });

  it('SIN_PRECIO → Sin precio', () => {
    const s = selloPartida({ price_status: 'SIN_PRECIO', precioUnitario: null, sinPrecioAutorizado: true });
    expect(s.tipo).toBe('sin_precio');
    expect(s.texto).toMatch(/Sin precio/i);
  });

  it('AUTHORIZED_REAL → Firme', () => {
    expect(selloPartida({ price_status: 'AUTHORIZED_REAL' }).tipo).toBe('firme');
  });

  it('una partida del programa (precioReal:false, snapshot) NUNCA se etiqueta Firme', () => {
    const s = selloPartida({ precioReal: false, sinPrecioAutorizado: true, precioUnitario: 15780, price_status: 'SNAPSHOT_DISPLAY' });
    expect(s.tipo).not.toBe('firme');
  });

  it('legacy sin price_status se comporta como antes (deBanco/precioReal → Firme, otro → Estimado)', () => {
    expect(selloPartida({ deBanco: true }).tipo).toBe('firme');
    expect(selloPartida({ precioReal: true }).tipo).toBe('firme');
    expect(selloPartida({}).tipo).toBe('estimado');
  });
});
