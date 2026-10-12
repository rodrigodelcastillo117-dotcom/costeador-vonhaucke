import { describe, it, expect } from 'vitest';
import { inferirDestinoPartida, marcarDestinoPartida, destinoMarcado } from './destinoAcomodo.js';

describe('destino semántico de partidas reales', () => {
  it('manda SONATA de las salas a juntas aunque el nombre comercial sea genérico', () => {
    const p = { nombre: 'Silla · SONATA', nota: '8 para la sala App LT y 12 para la sala Cirque.' };
    expect(inferirDestinoPartida(p)).toBe('juntas');
    expect(destinoMarcado(marcarDestinoPartida(p))).toBe('juntas');
  });

  it('manda archiveros y credenzas explícitas de privados a privados', () => {
    expect(inferirDestinoPartida({ nombre: 'Modulor · Archivero horizontal', nota: 'Uno por oficina privada.' })).toBe('privado');
    expect(inferirDestinoPartida({ nombre: 'Eclipse Credenza baja', nota: 'Una por oficina privada, a juego con el escritorio.' })).toBe('privado');
  });

  it('recepción gana sobre la palabra operativa', () => {
    expect(inferirDestinoPartida({ nombre: 'Silla operativa · GAMMA-E', nota: 'Sugerida: puesto de recepción.' })).toBe('recepcion');
  });

  it('bench/apartado se mantiene en open', () => {
    expect(inferirDestinoPartida({ nombre: 'Banca doble APP LT 1.50 · 8 usuarios', nota: 'Para APARTADO 1 (8 PAX).' })).toBe('open');
  });

  it('no inventa destino cuando el texto no lo dice', () => {
    expect(inferirDestinoPartida({ nombre: 'Mesa auxiliar', nota: '' })).toBe(null);
  });
});
