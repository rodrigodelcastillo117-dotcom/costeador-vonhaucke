import { describe, it, expect } from 'vitest';
import { sondearAnalisis } from './sondearAnalisis.js';

// rpc falso: devuelve en orden las respuestas de la cola; al agotarse, repite la última.
function rpcDeCola(respuestas) {
  let i = 0;
  return async () => respuestas[Math.min(i++, respuestas.length - 1)];
}
const fila = (row) => ({ data: [row], error: null });
const vacio = { data: [], error: null };
const errRpc = { data: null, error: { message: 'red caída' } };

describe('sondearAnalisis · async del análisis de texto (opus en segundo plano)', () => {
  const opts = (rpc, extra = {}) => ({ intervaloMs: 1, maxMs: 500, rpc, ...extra });

  it('devuelve el resultado cuando la fila ya lo tiene (éxito)', async () => {
    const rpc = rpcDeCola([fila({ status: 'ok', resultado: { ok: true, propuesta: { piezas: [1, 2] } } })]);
    const r = await sondearAnalisis('rid', opts(rpc));
    expect(r).toEqual({ ok: true, propuesta: { piezas: [1, 2] } });
  });

  it('sigue sondeando mientras está started/sin fila y luego devuelve el resultado', async () => {
    const rpc = rpcDeCola([
      vacio,                                           // aún no visible
      fila({ status: 'started', resultado: null }),    // procesando
      fila({ status: 'started', resultado: null }),
      fila({ status: 'ok', resultado: { ok: true, propuesta: { piezas: [] } } }),
    ]);
    const r = await sondearAnalisis('rid', opts(rpc));
    expect(r.ok).toBe(true);
    expect(r.propuesta).toEqual({ piezas: [] });
  });

  it('devuelve el objeto de ERROR cuando la función guardó un fallo en resultado', async () => {
    const rpc = rpcDeCola([fila({ status: 'error', error_code: 'PROVIDER_TIMEOUT', resultado: { ok: false, code: 'PROVIDER_TIMEOUT', error: 'tardó' } })]);
    const r = await sondearAnalisis('rid', opts(rpc));
    expect(r).toEqual({ ok: false, code: 'PROVIDER_TIMEOUT', error: 'tardó' });
  });

  it('estado final con error_code pero SIN resultado → error legible (worker murió antes de escribir)', async () => {
    const rpc = rpcDeCola([fila({ status: 'error', error_code: 'BACKGROUND_CRASH', resultado: null })]);
    const r = await sondearAnalisis('rid', opts(rpc));
    expect(r.ok).toBe(false);
    expect(r.code).toBe('BACKGROUND_CRASH');
  });

  it('errores transitorios del rpc NO rompen: reintenta y termina bien', async () => {
    const rpc = rpcDeCola([
      errRpc, errRpc,
      fila({ status: 'ok', resultado: { ok: true, propuesta: { piezas: [9] } } }),
    ]);
    const r = await sondearAnalisis('rid', opts(rpc));
    expect(r.ok).toBe(true);
  });

  it('si nunca termina, devuelve POLL_TIMEOUT (no cuelga para siempre)', async () => {
    const rpc = rpcDeCola([fila({ status: 'started', resultado: null })]);
    const r = await sondearAnalisis('rid', { intervaloMs: 1, maxMs: 15, rpc });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('POLL_TIMEOUT');
  });

  it('sin rpc inyectado NO revienta: devuelve error controlado', async () => {
    const r = await sondearAnalisis('rid', { intervaloMs: 1, maxMs: 15 });
    expect(r).toEqual({ ok: false, code: 'SIN_RPC', error: expect.any(String) });
  });

  it('resultado presente gana aunque el status siga "started" (no hay carrera status/resultado)', async () => {
    // La función escribe `resultado` como señal de completitud; el front NO depende de `status`.
    const rpc = rpcDeCola([fila({ status: 'started', resultado: { ok: true, propuesta: { piezas: [7] } } })]);
    const r = await sondearAnalisis('rid', opts(rpc));
    expect(r.propuesta).toEqual({ piezas: [7] });
  });
});
