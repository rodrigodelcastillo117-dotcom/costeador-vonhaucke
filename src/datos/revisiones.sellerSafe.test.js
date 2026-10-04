// SELLER-SAFE: el historial de revisiones de una cotización debe leerse por el RPC
// `cotizacion_revisiones_seguras` (SECURITY DEFINER, strippea economía del snapshot por
// rol) cuando hay id — NUNCA por SELECT crudo a `cotizaciones_revisiones`. Esta prueba
// fija el contrato cliente (la defensa dura vive en la DB).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
const from = vi.fn();
vi.mock('../nube.js', () => ({ nube: { rpc: (...a) => rpc(...a), from: (...a) => from(...a) } }));

const { listarRevisiones } = await import('./revisiones.js');

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
