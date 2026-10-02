// Tests de feature flags (puros, con fuentes inyectadas — no tocan window).
import { describe, it, expect } from 'vitest';
import { flagActivo, todasLasFlags, BASE, NOMBRES_FLAG } from './flags.js';

const stor = (obj) => ({ getItem: (k) => (k === 'vh_flags' ? JSON.stringify(obj) : null) });

describe('flags', () => {
  it('BASE define las 6 flags esperadas', () => {
    expect(NOMBRES_FLAG.slice().sort()).toEqual(
      ['client_presentation_v2', 'commercial_v2', 'layout_v2', 'plan_analysis_v2', 'render_v2', 'voni_v2'],
    );
  });

  it('sin overrides devuelve el valor BASE', () => {
    for (const n of NOMBRES_FLAG) {
      expect(flagActivo(n, { storage: { getItem: () => null }, search: '' })).toBe(BASE[n]);
    }
  });

  it('flag desconocida siempre es false (fail-closed)', () => {
    expect(flagActivo('no_existe', { storage: { getItem: () => null }, search: '' })).toBe(false);
  });

  it('localStorage sobreescribe BASE', () => {
    expect(flagActivo('voni_v2', { storage: stor({ voni_v2: false }), search: '' })).toBe(false);
    expect(flagActivo('commercial_v2', { storage: stor({ commercial_v2: false }), search: '' })).toBe(false);
  });

  it('URL ?ff gana sobre localStorage', () => {
    expect(flagActivo('voni_v2', { storage: stor({ voni_v2: false }), search: '?ff=voni_v2' })).toBe(true);
    expect(flagActivo('commercial_v2', { storage: stor({ commercial_v2: true }), search: '?ff=-commercial_v2' })).toBe(false);
  });

  it('URL ?ff=all prende todo', () => {
    const t = todasLasFlags({ storage: { getItem: () => null }, search: '?ff=all' });
    for (const n of NOMBRES_FLAG) expect(t[n]).toBe(true);
  });

  it('storage corrupto no truena (fail-safe a BASE)', () => {
    const malo = { getItem: () => '{no json' };
    expect(flagActivo('commercial_v2', { storage: malo, search: '' })).toBe(BASE.commercial_v2);
  });

  it('URL con varios tokens y espacios', () => {
    const t = todasLasFlags({ storage: { getItem: () => null }, search: '?ff=voni_v2, -layout_v2 ,render_v2' });
    expect(t.voni_v2).toBe(true);
    expect(t.layout_v2).toBe(false);
    expect(t.render_v2).toBe(true);
  });
});
