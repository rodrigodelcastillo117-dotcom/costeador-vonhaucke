import { describe, it, expect, vi } from 'vitest';
import { esErrorDeVersion, recargarUnaVez, instalarRecargaPorVersion, sinRed, CLAVE_RECARGA_VERSION, VENTANA_RECARGA_MS } from './versionNueva.js';

const memoria = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };

describe('esErrorDeVersion: reconoce el archivo de pantalla que ya no existe tras un deploy', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://costeador-vonhaucke.vercel.app/assets/CargaERP-BdTU-JqV.js',
    'error loading dynamically imported module: https://x/assets/Precios-a.js',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/Voni-x.css',
    'ChunkLoadError: Loading chunk 12 failed.',
  ])('%s', (m) => {
    expect(esErrorDeVersion(new Error(m))).toBe(true);
    expect(esErrorDeVersion(m)).toBe(true);
  });
  it('no confunde errores de la app con un cambio de versión', () => {
    for (const m of ["Cannot read properties of undefined (reading 'map')", 'acomodo invalido', 'Failed to fetch']) {
      expect(esErrorDeVersion(new Error(m))).toBe(false);
    }
    for (const m of [null, undefined, {}]) expect(esErrorDeVersion(m)).toBe(false);
  });
});

describe('recargarUnaVez: recarga una vez y nunca en bucle', () => {
  it('primera vez recarga y deja el candado', () => {
    const s = memoria(); const recargar = vi.fn();
    expect(recargarUnaVez({ storage: s, recargar, ahora: 1_000_000 })).toBe(true);
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(s.getItem(CLAVE_RECARGA_VERSION)).toBe('1000000');
  });
  it('dentro de la ventana NO vuelve a recargar (la red de seguridad muestra el botón)', () => {
    const s = memoria(); const recargar = vi.fn();
    recargarUnaVez({ storage: s, recargar, ahora: 1_000_000 });
    expect(recargarUnaVez({ storage: s, recargar, ahora: 1_000_000 + VENTANA_RECARGA_MS - 1 })).toBe(false);
    expect(recargar).toHaveBeenCalledTimes(1);
  });
  it('pasada la ventana (otro deploy más tarde) vuelve a recargar', () => {
    const s = memoria(); const recargar = vi.fn();
    recargarUnaVez({ storage: s, recargar, ahora: 1_000_000 });
    expect(recargarUnaVez({ storage: s, recargar, ahora: 1_000_000 + VENTANA_RECARGA_MS })).toBe(true);
    expect(recargar).toHaveBeenCalledTimes(2);
  });
  it('sin sessionStorage (o si truena) no recarga sola: sin candado habría bucle', () => {
    const recargar = vi.fn();
    expect(recargarUnaVez({ storage: null, recargar })).toBe(false);
    const roto = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => {} };
    expect(recargarUnaVez({ storage: roto, recargar })).toBe(false);
    expect(recargar).not.toHaveBeenCalled();
  });
});

describe('instalarRecargaPorVersion: engancha vite:preloadError', () => {
  it('recarga y cancela el error la primera vez', () => {
    const w = new EventTarget(); const recargar = vi.fn(); const s = memoria();
    instalarRecargaPorVersion(w, { storage: s, recargar, ahora: 1_792_000_000_000 });
    const ev = new Event('vite:preloadError', { cancelable: true });
    w.dispatchEvent(ev);
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
  });
  it('con el candado puesto deja pasar el error (Vite lo relanza y llega a la pantalla de fallo)', () => {
    const w = new EventTarget(); const recargar = vi.fn(); const s = memoria();
    s.setItem(CLAVE_RECARGA_VERSION, '5');
    instalarRecargaPorVersion(w, { storage: s, recargar, ahora: 10 });
    const ev = new Event('vite:preloadError', { cancelable: true });
    w.dispatchEvent(ev);
    expect(recargar).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });
});

describe('sin internet NO se recarga (sería la página de error del navegador en lugar de la app)', () => {
  it('sinRed lee navigator.onLine (sólo false explícito cuenta como sin red)', () => {
    expect(sinRed({ onLine: false })).toBe(true);
    expect(sinRed({ onLine: true })).toBe(false);
    expect(sinRed(null)).toBe(false);
    expect(sinRed({})).toBe(false);
  });
  it('offline: no recarga y NO gasta el candado (al volver la red sí podrá recargar)', () => {
    const s = memoria(); const recargar = vi.fn();
    expect(recargarUnaVez({ storage: s, recargar, ahora: 1_000_000, offline: true })).toBe(false);
    expect(recargar).not.toHaveBeenCalled();
    expect(s.getItem(CLAVE_RECARGA_VERSION)).toBeNull();
    expect(recargarUnaVez({ storage: s, recargar, ahora: 1_000_100, offline: false })).toBe(true);
    expect(recargar).toHaveBeenCalledTimes(1);
  });
  it('vite:preloadError sin red: no recarga ni cancela el error (llega a la red de seguridad, que lo explica)', () => {
    const w = new EventTarget(); const recargar = vi.fn(); const s = memoria();
    instalarRecargaPorVersion(w, { storage: s, recargar, ahora: 10, offline: true });
    const ev = new Event('vite:preloadError', { cancelable: true });
    w.dispatchEvent(ev);
    expect(recargar).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });
});
