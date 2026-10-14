// ============================================================================
//  VH-148 · guardarCotizacion con control optimista (la llamada RPC, con la nube simulada).
//   · sin `actualizadoEsperado` → la llamada es EXACTAMENTE la de hoy (dos argumentos): la app con la
//     bandera apagada, o sin versión conocida, sigue funcionando contra la RPC de producción.
//   · con `actualizadoEsperado` → viaja `p_actualizado_esperado` TAL CUAL (cadena).
//   · el servidor responde 40001 → { motivo: 'conflicto', actualizadoServidor }, sin soltar el id.
//   · un guardado confirmado devuelve `actualizado` (la versión nueva) o null con la RPC vieja.
// ============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('../nube.js', () => ({ nube: { rpc: (...a) => rpc(...a), from: vi.fn() } }));

const { guardarCotizacion, clasificarErrorGuardado } = await import('./cotizaciones.js');

const estado = {
  insumos: { a: { id: 'a', precio: 100 } },
  parametros: { ivaPorcentaje: 16 },
  cotizacion: { cliente: 'Tradeco', folio: 'T-1', partidas: [{ id: 'p1', nombre: 'Banca', cantidad: 2, precioUnitario: 1000 }] },
};
const ISO = '2026-10-13T05:20:00.123456+00:00';
const ISO2 = '2026-10-13T05:21:30.654321+00:00';
const errorConflicto = { code: '40001', message: `CONFLICTO_VERSION: la cotización cambió en el servidor (${ISO2}). Recarga antes de guardar.`, details: `actualizado=${ISO2}`, hint: 'Vuelve a cargar…' };

describe('VH-148 · guardarCotizacion y p_actualizado_esperado', () => {
  beforeEach(() => rpc.mockReset());

  it('bandera APAGADA (actualizadoEsperado undefined) → NO viaja p_actualizado_esperado: la llamada de siempre', async () => {
    rpc.mockResolvedValue({ data: { ok: true, id: 1372 }, error: null });
    await guardarCotizacion(estado, 'x@vh.mx', 1372);
    await guardarCotizacion(estado, 'x@vh.mx', 1372, { actualizadoEsperado: undefined });
    expect(rpc).toHaveBeenCalledTimes(2);
    for (const [fn, args] of rpc.mock.calls) {
      expect(fn).toBe('actualizar_cotizacion_segura');
      expect(Object.keys(args).sort()).toEqual(['p_cotizacion_id', 'p_patch']);
    }
  });

  it('VH-148b · bandera PRENDIDA sin versión conocida (null) → NO se escribe a ciegas: conflicto 409 sin llamar al servidor', async () => {
    rpc.mockResolvedValue({ data: { ok: true, id: 1372 }, error: null });
    const r = await guardarCotizacion(estado, 'x@vh.mx', 1372, { actualizadoEsperado: null });
    expect(rpc).not.toHaveBeenCalled();
    expect(r).toEqual({ id: 1372, guardado: false, motivo: 'conflicto', actualizadoServidor: null, sinVersion: true,
      ok: false, code: 'VERSION_CONFLICT', status: 409, error: 'Existe una versión más reciente. Recarga o compara antes de guardar.' });
  });

  it('con versión → viaja p_actualizado_esperado TAL CUAL (cadena con microsegundos, sin pasar por Date)', async () => {
    rpc.mockResolvedValue({ data: { ok: true, id: 1372, actualizado: ISO2 }, error: null });
    const r = await guardarCotizacion(estado, 'x@vh.mx', 1372, { actualizadoEsperado: ISO });
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('actualizar_cotizacion_segura');
    expect(args.p_cotizacion_id).toBe(1372);
    expect(args.p_actualizado_esperado).toBe(ISO);
    expect(args.p_patch).not.toHaveProperty('actualizado');     // la versión no va dentro del patch
    expect(args.p_patch).not.toHaveProperty('estado');
    expect(r).toEqual({ id: 1372, guardado: true, actualizado: ISO2 });
  });

  it('40001 → motivo "conflicto" con la versión del servidor; el id se CONSERVA (no es fila ajena) y no se reintenta', async () => {
    rpc.mockResolvedValue({ data: null, error: errorConflicto });
    const r = await guardarCotizacion(estado, 'x@vh.mx', 1372, { actualizadoEsperado: ISO });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ id: 1372, guardado: false, motivo: 'conflicto', actualizadoServidor: ISO2,
      ok: false, code: 'VERSION_CONFLICT', status: 409, error: 'Existe una versión más reciente. Recarga o compara antes de guardar.' });
    expect(r).not.toHaveProperty('soltarId');
  });

  it('un conflicto sin DETAIL también se clasifica y toma la versión del paréntesis del mensaje', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '40001', message: errorConflicto.message } });
    const r = await guardarCotizacion(estado, 'x@vh.mx', 1372, { actualizadoEsperado: ISO });
    expect(r.motivo).toBe('conflicto');
    expect(r.actualizadoServidor).toBe(ISO2);
  });

  it('clasificarErrorGuardado: el conflicto gana a "desconocido" y no pisa las otras clases', () => {
    expect(clasificarErrorGuardado(errorConflicto)).toBe('conflicto');
    expect(clasificarErrorGuardado({ code: 'P0001', message: 'sin acceso' })).toBe('sin-acceso');
    expect(clasificarErrorGuardado({ code: 'P0001', message: 'cotizacion no editable en estado emitida' })).toBe('no-editable');
    expect(clasificarErrorGuardado(new Error('fetch failed'))).toBe('desconocido');
  });

  it('guardado confirmado con la RPC VIEJA (sin `actualizado` en la respuesta) → actualizado: null (siguiente guardado sin control)', async () => {
    rpc.mockResolvedValue({ data: { ok: true, id: 1372 }, error: null });
    const r = await guardarCotizacion(estado, 'x@vh.mx', 1372, { actualizadoEsperado: ISO });
    expect(r).toEqual({ id: 1372, guardado: true, actualizado: null });
  });

  it('crear también devuelve `actualizado` si el servidor lo manda (y null si no)', async () => {
    rpc.mockResolvedValueOnce({ data: { ok: true, id: 9, actualizado: ISO }, error: null });
    expect(await guardarCotizacion(estado, 'x@vh.mx', null, { claveCreacion: 'cot-abc-123456' })).toEqual({ id: 9, guardado: true, actualizado: ISO });
    rpc.mockResolvedValueOnce({ data: { ok: true, id: 10 }, error: null });
    expect(await guardarCotizacion(estado, 'x@vh.mx', null, { claveCreacion: 'cot-abc-123457' })).toEqual({ id: 10, guardado: true, actualizado: null });
    // Crear nunca manda la versión (no hay fila todavía).
    for (const [, args] of rpc.mock.calls) expect(args).not.toHaveProperty('p_actualizado_esperado');
  });
});
