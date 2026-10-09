import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('../nube.js', () => ({ nube: mock }));
import { guardarCotizacion, cargarCotizacionCompleta } from './cotizaciones.js';

// Simulación de contrato cliente↔RPC, SIN escritura en Supabase productivo.
// No sustituye Playwright autenticado por roles contra un entorno aislado.
const estado = (cantidad = 1) => ({
  cotizacion: { cliente: 'QA aislado', estadoComercial: 'borrador',
    partidas: [{ id: 'qa-1', nombre: 'Mesa de prueba', cantidad, precioUnitario: 100 }] },
  parametros: {},
});
const ok = (id) => ({ data: { ok: true, id }, error: null });

describe('contrato de guardado de cotizaciones con RPC seguras', () => {
  beforeEach(() => { mock.rpc.mockReset(); mock.from.mockReset(); });

  it('crea por RPC autorizada y utiliza ID confirmado', async () => {
    mock.rpc.mockResolvedValueOnce(ok(901));
    expect(await guardarCotizacion(estado(), 'vendedor@qa.test')).toBe(901);
    expect(mock.rpc).toHaveBeenCalledWith('crear_cotizacion_segura',
      expect.objectContaining({ p_payload: expect.objectContaining({ usuario: 'vendedor@qa.test', piezas: 1, estado: 'borrador' }) }));
    expect(mock.from).not.toHaveBeenCalled();
  });

  it('actualiza la misma cotización y verifica el ID de respuesta', async () => {
    mock.rpc.mockResolvedValueOnce(ok(901));
    expect(await guardarCotizacion(estado(2), 'vendedor@qa.test', 901)).toBe(901);
    expect(mock.rpc).toHaveBeenCalledWith('actualizar_cotizacion_segura',
      expect.objectContaining({ p_cotizacion_id: 901, p_patch: expect.objectContaining({ piezas: 2 }) }));
  });

  it('rechaza una confirmación que devuelve otro ID', async () => {
    mock.rpc.mockResolvedValueOnce(ok(902));
    expect(await guardarCotizacion(estado(), 'vendedor@qa.test', 901)).toBeNull();
  });

  it('rechaza sin confirmación y nunca hace fallback a escritura directa', async () => {
    mock.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await guardarCotizacion(estado(), 'vendedor@qa.test')).toBeNull();
    expect(mock.from).not.toHaveBeenCalled();
  });

  it('rechaza respuesta explícita sin permiso', async () => {
    mock.rpc.mockResolvedValueOnce({ data: { ok: false, motivo: 'sin_acceso', id: 901 }, error: null });
    expect(await guardarCotizacion(estado(), 'vendedor@qa.test', 901)).toBeNull();
  });

  it('rechaza error de permisos, timeout y fallo de red sin reportar guardado', async () => {
    mock.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501' } })
      .mockRejectedValueOnce(new Error('red'))
      .mockResolvedValueOnce({ data: null, error: { code: '57014' } });
    expect(await guardarCotizacion(estado(), 'vendedor@qa.test')).toBeNull();
    expect(await guardarCotizacion(estado(), 'vendedor@qa.test')).toBeNull();
    expect(await guardarCotizacion(estado(), 'vendedor@qa.test', 901)).toBeNull();
  });

  it('no crea borradores vacíos', async () => {
    expect(await guardarCotizacion({ cotizacion: { partidas: [] }, parametros: {} }, 'vendedor@qa.test')).toBeNull();
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it('crea, actualiza y reabre por RPC, preservando el ID', async () => {
    mock.rpc.mockResolvedValueOnce(ok(901)).mockResolvedValueOnce(ok(901))
      .mockResolvedValueOnce({ data: { ok: true, id: 901, partidas: estado(2).cotizacion.partidas }, error: null });
    const id = await guardarCotizacion(estado(), 'vendedor@qa.test');
    expect(await guardarCotizacion(estado(2), 'vendedor@qa.test', id)).toBe(id);
    const reabierta = await cargarCotizacionCompleta(id);
    expect(reabierta?.id).toBe(901);
    expect(reabierta.partidas[0].cantidad).toBe(2);
    expect(mock.rpc).toHaveBeenNthCalledWith(3, 'cotizacion_segura', { p_id: 901 });
  });

  it('reintento después de error sólo puede crear de nuevo sin una clave idempotente (riesgo abierto)', async () => {
    mock.rpc.mockRejectedValueOnce(new Error('timeout después de insert'))
      .mockResolvedValueOnce(ok(902));
    expect(await guardarCotizacion(estado(), 'vendedor@qa.test')).toBeNull();
    expect(await guardarCotizacion(estado(), 'vendedor@qa.test')).toBe(902);
    expect(mock.rpc.mock.calls.filter(([name]) => name === 'crear_cotizacion_segura')).toHaveLength(2);
  });
});
