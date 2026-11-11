// SELLER-SAFE: el historial de revisiones de una cotización debe leerse por el RPC
// `cotizacion_revisiones_seguras` (SECURITY DEFINER, strippea economía del snapshot por
// rol) cuando hay id — NUNCA por SELECT crudo a `cotizaciones_revisiones`. Esta prueba
// fija el contrato cliente (la defensa dura vive en la DB).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
const from = vi.fn();
vi.mock('../nube.js', () => ({ nube: { rpc: (...a) => rpc(...a), from: (...a) => from(...a) } }));

const { listarRevisiones, cargarRevisiones } = await import('./revisiones.js');

describe('seller-safe: revisiones por RPC seguro cuando hay cotizacionId', () => {
  beforeEach(() => { rpc.mockReset(); from.mockReset(); });

  it('con cotizacionId usa rpc("cotizacion_revisiones_seguras") y NO toca from()', async () => {
    rpc.mockResolvedValue({ data: [{ id: 9, revision: 2, total: 100 }, { id: 8, revision: 1, total: 90 }], error: null });
    const r = await listarRevisiones(123, 'F-1');
    expect(rpc).toHaveBeenCalledWith('cotizacion_revisiones_seguras', { p_cotizacion_id: 123 });
    expect(from).not.toHaveBeenCalled();
    expect(r).toHaveLength(2);
  });

  it('sin id (solo folio) cae a metadata pública (sin snapshot/economía)', async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id: 1, revision: 1, total: 50 }], error: null });
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    from.mockReturnValue({ select });
    const r = await listarRevisiones(null, 'F-9');
    expect(from).toHaveBeenCalledWith('cotizaciones_revisiones');
    expect(select.mock.calls[0][0]).not.toMatch(/snapshot/);
    expect(r).toHaveLength(1);
  });

  it('error del RPC ⇒ arreglo vacío, no revienta', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('sin acceso') });
    expect(await listarRevisiones(5)).toEqual([]);
  });
});

// cargarRevisiones: MISMA ruta seller-safe, pero con estado explícito para que la UI NO
// afirme "nunca se emitió" cuando la carga falla (distingue error de vacío real).
describe('cargarRevisiones: distingue falla de vacío (seller-safe en la UI)', () => {
  beforeEach(() => { rpc.mockReset(); from.mockReset(); });

  it('éxito con datos ⇒ {ok:true, revisiones:[...]} vía RPC seguro, sin tocar from()', async () => {
    rpc.mockResolvedValue({ data: [{ id: 9, revision: 2, total: 100 }], error: null });
    const r = await cargarRevisiones(123, 'F-1');
    expect(rpc).toHaveBeenCalledWith('cotizacion_revisiones_seguras', { p_cotizacion_id: 123 });
    expect(from).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, revisiones: [{ id: 9, revision: 2, total: 100 }] });
  });

  it('vacío REAL (data:[] sin error) ⇒ {ok:true, revisiones:[]} — NO es error', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await cargarRevisiones(7)).toEqual({ ok: true, revisiones: [] });
  });

  it('data no-array sin error ⇒ {ok:true, revisiones:[]} (normaliza, no es error)', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await cargarRevisiones(7)).toEqual({ ok: true, revisiones: [] });
  });

  it('error del RPC ⇒ {ok:false} — la UI NO debe decir "nunca se emitió"', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('sin acceso') });
    expect(await cargarRevisiones(5)).toEqual({ ok: false, revisiones: [] });
  });

  it('error en la ruta por folio ⇒ {ok:false}', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: new Error('red') });
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    from.mockReturnValue({ select });
    expect(await cargarRevisiones(null, 'F-9')).toEqual({ ok: false, revisiones: [] });
  });
});
