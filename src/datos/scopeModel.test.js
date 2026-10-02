// N5 — ScopeModel + reconciliación. Puro.
import { describe, it, expect } from 'vitest';
import { construirScope, reconciliarScope, estadoPorConfianza, requeridoDeZona, ESTADOS_ZONA } from './scopeModel.js';

describe('estadoPorConfianza', () => {
  it('umbrales CONFIRMADO/INFERIDO/REVISAR', () => {
    expect(estadoPorConfianza(0.95)).toBe(ESTADOS_ZONA.CONFIRMADO);
    expect(estadoPorConfianza(0.6)).toBe(ESTADOS_ZONA.INFERIDO);
    expect(estadoPorConfianza(0.2)).toBe(ESTADOS_ZONA.REVISAR);
  });
});

describe('construirScope', () => {
  it('normaliza zonas, suma requerido y clasifica estado', () => {
    const s = construirScope([
      { nombre: 'Open office', tipo: 'open', required_items: [{ tipo: 'puesto', cantidad: 80 }], confidence: 0.95 },
      { nombre: 'Privados', tipo: 'privado', requeridos: [{ tipo: 'privado', cantidad: 6 }], confidence: 0.6 },
      { nombre: 'Sala', tipo: 'juntas', required_items: [{ tipo: 'silla', cantidad: 12 }], confidence: 0.2 },
    ]);
    expect(s.totalZonas).toBe(3);
    expect(s.totalRequerido).toBe(98);
    expect(s.zonas[0].status).toBe(ESTADOS_ZONA.CONFIRMADO);
    expect(s.zonas[1].status).toBe(ESTADOS_ZONA.INFERIDO);
    expect(s.zonas[2].status).toBe(ESTADOS_ZONA.REVISAR);
    expect(s.requiereRevision).toBe(true);
    expect(s.zonas[0].zone_id).toBeTruthy();
  });
  it('requeridoDeZona cae a .requerido si no hay items', () => {
    expect(requeridoDeZona({ requerido: 5 })).toBe(5);
  });
});

describe('reconciliarScope (REQUERIDO vs COTIZADO vs ACOMODADO)', () => {
  it('detecta falta y sobra por zona', () => {
    const s = construirScope([
      { nombre: 'Open office', required_items: [{ cantidad: 80 }], confidence: 0.9 },
      { nombre: 'Sala', required_items: [{ cantidad: 12 }], confidence: 0.9 },
    ]);
    const r = reconciliarScope(s, {
      cotizadoPorZona: { 'Open office': 80, Sala: 12 },
      acomodadoPorZona: { 'Open office': 80, Sala: 10 }, // faltan 2 por acomodar
    });
    expect(r.totalZonas).toBe(2);
    expect(r.hayDiscrepancia).toBe(true);
    const sala = r.zonas.find((z) => z.nombre === 'Sala');
    expect(sala.estado).toBe('falta');
    expect(sala.faltaAcomodar).toBe(2);
    const open = r.zonas.find((z) => z.nombre === 'Open office');
    expect(open.estado).toBe('ok');
  });
  it('requerido desconocido → ok si no hay faltante, sin inventar', () => {
    const s = construirScope([{ nombre: 'X', confidence: 0.9 }]); // sin required
    const r = reconciliarScope(s, {});
    expect(r.zonas[0].estado).toBe('ok');
  });
});
