// P0-08 / FASE 13 — SELLER-SAFE: el Archivo (listarCotizaciones) debe leerse SIEMPRE
// por el RPC `cotizaciones_mias` (SECURITY DEFINER, que strippea economía por rol) y
// JAMÁS por `from('cotizaciones').select('*')` —que entregaría las partidas crudas con
// costoUnitario/costoDerivado/margen—. Esta prueba fija ese contrato para que nadie lo
// revierta por accidente. La defensa dura vive en la DB (SELECT de la columna partidas
// revocado a authenticated/anon, verificado con has_column_privilege); aquí blindamos
// el lado cliente.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
const from = vi.fn();
vi.mock('../nube.js', () => ({ nube: { rpc: (...a) => rpc(...a), from: (...a) => from(...a) } }));

const { listarCotizaciones } = await import('./cotizaciones.js');

describe('P0-08 seller-safe: el archivo se lee por RPC, nunca por SELECT crudo', () => {
  beforeEach(() => { rpc.mockReset(); from.mockReset(); });

  it('llama al RPC cotizaciones_mias con el límite y NO toca from("cotizaciones")', async () => {
    rpc.mockResolvedValue({ data: [{ id: 1, cliente: 'X', partidas: [{ nombre: 'a', precioUnitario: 10 }] }], error: null });
    const r = await listarCotizaciones({ limite: 50 });
    expect(rpc).toHaveBeenCalledWith('cotizaciones_mias', { p_limite: 50 });
    expect(from).not.toHaveBeenCalled();
    expect(r).toHaveLength(1);
  });

  it('propaga el error (no finge archivo vacío cuando la consulta se cae)', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('permiso denegado') });
    await expect(listarCotizaciones({})).rejects.toThrow();
  });

  it('filtra por q sobre el resultado del RPC (cliente/folio/nombres)', async () => {
    rpc.mockResolvedValue({ data: [
      { cliente: 'Alpura', folio: 'A1', partidas: [] },
      { cliente: 'Tradeco', folio: 'B2', partidas: [] },
    ], error: null });
    const r = await listarCotizaciones({ q: 'alpura' });
    expect(r).toHaveLength(1);
    expect(r[0].cliente).toBe('Alpura');
  });

  it('tolera data no-array del RPC sin reventar', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const r = await listarCotizaciones({});
    expect(Array.isArray(r)).toBe(true);
    expect(r).toHaveLength(0);
  });
});
