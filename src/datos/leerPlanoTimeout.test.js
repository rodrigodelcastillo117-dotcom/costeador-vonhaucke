import { describe, it, expect, vi, afterEach } from 'vitest';
import { TIMEOUT_LECTURA_MS, conTimeout } from './leerPlanoArchivo.js';

// ChatGPT #1: en PROD una lectura real de plano tardó 64.841 s y el cliente la
// abortaba a los 60 s. El timeout debe superar con holgura esa duración observada.
describe('leerPlanoDeArchivo · timeout real (ChatGPT #1)', () => {
  it('el timeout supera la lectura real observada (64.841 s) con holgura', () => {
    expect(TIMEOUT_LECTURA_MS).toBeGreaterThan(64841);
    expect(TIMEOUT_LECTURA_MS).toBeGreaterThanOrEqual(120000);  // ≥ 2 min de holgura
  });
});

// ChatGPT P0-3: una operación que termina DESPUÉS de 60 s pero ANTES del SLA
// (180 s) debe completar; una que lo rebasa debe rechazar y ABORTAR. Fake timers:
// no se espera realmente.
describe('conTimeout · delayed-success y timeout con abort (ChatGPT P0-3)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('éxito tardío a 100 s (<180 s) → RESUELVE (ya no corta a 60 s)', async () => {
    vi.useFakeTimers();
    const lenta = new Promise((res) => setTimeout(() => res('LECTURA_OK'), 100000)); // 100 s
    const p = conTimeout(lenta, TIMEOUT_LECTURA_MS);
    await vi.advanceTimersByTimeAsync(100000);
    await expect(p).resolves.toBe('LECTURA_OK');
  });

  it('operación que rebasa el SLA → RECHAZA y ABORTA el controller', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const nunca = new Promise((res) => setTimeout(() => res('tarde'), 300000)); // 300 s
    const p = conTimeout(nunca, TIMEOUT_LECTURA_MS, controller).catch((e) => e);
    await vi.advanceTimersByTimeAsync(TIMEOUT_LECTURA_MS);
    const err = await p;
    expect(err).toBeInstanceOf(Error);
    expect(controller.signal.aborted).toBe(true);   // la petición se abortó, no quedó viva
  });
});
