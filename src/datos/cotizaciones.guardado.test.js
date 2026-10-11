// ============================================================================
//  Bloque 1 (2026-10-10) · GUARDADO = UNA SOLA AUTORIDAD (VH-034 / VH-035)
//
//  Antes: INSERT/UPDATE directos a `cotizaciones` y el id en un useRef que moría
//  al recargar → cada recarga insertaba otra fila. Ahora: RPCs seguros del
//  servidor (`crear_cotizacion_segura` idempotente / `actualizar_cotizacion_segura`),
//  id persistido, firma para no escribir lo mismo dos veces, y `estado` comercial
//  NUNCA sale del cliente.
// ============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
const from = vi.fn();
vi.mock('../nube.js', () => ({ nube: { rpc: (...a) => rpc(...a), from: (...a) => from(...a) } }));

const {
  guardarCotizacion, paraGuardar, firmaGuardado, patchParaServidor,
  claveCreacionNueva, CLAVE_CREACION_RE, clasificarErrorGuardado,
} = await import('./cotizaciones.js');

const estado = {
  insumos: { a: { id: 'a', precio: 100 } },
  parametros: { ivaPorcentaje: 16 },
  cotizacion: {
    cliente: 'Tradeco', folio: 'T-1', estadoComercial: 'borrador',
    partidas: [{ id: 'p1', nombre: 'Banca', cantidad: 2, precioUnitario: 1000 }],
  },
};

describe('la clave de creación cumple el contrato del servidor', () => {
  it('es válida y distinta cada vez', () => {
    const a = claveCreacionNueva(), b = claveCreacionNueva();
    expect(a).toMatch(CLAVE_CREACION_RE);
    expect(b).toMatch(CLAVE_CREACION_RE);
    expect(a).not.toBe(b);
  });
});

describe('firma del guardado', () => {
  it('es la misma para el mismo contenido y cambia si cambia un renglón', () => {
    const f1 = firmaGuardado(paraGuardar(estado, 'x@vh.mx'));
    const f2 = firmaGuardado(paraGuardar(estado, 'otro@vh.mx'));   // el usuario no cuenta
    expect(f1).toBe(f2);
    const e2 = { ...estado, cotizacion: { ...estado.cotizacion, partidas: [{ ...estado.cotizacion.partidas[0], cantidad: 3 }] } };
    expect(firmaGuardado(paraGuardar(e2, 'x@vh.mx'))).not.toBe(f1);
  });
});

describe('el cliente NUNCA escribe el estado comercial', () => {
  it('patchParaServidor quita `estado` y `usuario`', () => {
    const patch = patchParaServidor(paraGuardar(estado, 'x@vh.mx'));
    expect(patch).not.toHaveProperty('estado');
    expect(patch).not.toHaveProperty('usuario');
    expect(patch.partidas).toHaveLength(1);
    expect(patch.total).toBeGreaterThan(0);
  });
});

describe('guardarCotizacion por RPCs seguros', () => {
  beforeEach(() => { rpc.mockReset(); from.mockReset(); });

  it('sin id → crear_cotizacion_segura CON clave idempotente; nunca from("cotizaciones")', async () => {
    rpc.mockResolvedValue({ data: { ok: true, id: 77 }, error: null });
    const r = await guardarCotizacion(estado, 'x@vh.mx', null, { claveCreacion: 'cot-abc-123456' });
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('crear_cotizacion_segura');
    expect(args.p_payload._idempotency_key).toBe('cot-abc-123456');
    expect(args.p_payload).not.toHaveProperty('estado');
    expect(from).not.toHaveBeenCalled();
    expect(r).toMatchObject({ id: 77, guardado: true });
  });

  it('con id → actualizar_cotizacion_segura con patch (sin estado)', async () => {
    rpc.mockResolvedValue({ data: { ok: true, id: 77 }, error: null });
    const r = await guardarCotizacion(estado, 'x@vh.mx', 77);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('actualizar_cotizacion_segura');
    expect(args.p_cotizacion_id).toBe(77);
    expect(args.p_patch).not.toHaveProperty('estado');
    expect(r).toMatchObject({ id: 77, guardado: true });
  });

  it('una clave inválida no se manda (el servidor la rechazaría)', async () => {
    rpc.mockResolvedValue({ data: { ok: true, id: 1 }, error: null });
    await guardarCotizacion(estado, 'x@vh.mx', null, { claveCreacion: 'corta' });
    expect(rpc.mock.calls[0][1].p_payload).not.toHaveProperty('_idempotency_key');
  });

  it('sin partidas no escribe nada (no llena el archivo de borradores vacíos)', async () => {
    const r = await guardarCotizacion({ ...estado, cotizacion: { partidas: [] } }, 'x@vh.mx', 5);
    expect(rpc).not.toHaveBeenCalled();
    expect(r).toMatchObject({ id: 5, guardado: false, motivo: 'vacia' });
  });

  it('fila ajena o inexistente → soltarId (la siguiente vez se crea una propia)', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('sin acceso') });
    const r = await guardarCotizacion(estado, 'x@vh.mx', 77);
    expect(r).toMatchObject({ id: null, guardado: false, motivo: 'sin-acceso', soltarId: true });
    rpc.mockResolvedValue({ data: null, error: new Error('cotizacion no existe') });
    const r2 = await guardarCotizacion(estado, 'x@vh.mx', 77);
    expect(r2.soltarId).toBe(true);
  });

  it('cotización ya emitida → NO guarda pero CONSERVA el id (no duplica)', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('cotizacion no editable en estado emitida') });
    const r = await guardarCotizacion(estado, 'x@vh.mx', 77);
    expect(r).toMatchObject({ id: 77, guardado: false, motivo: 'no-editable' });
    expect(r.soltarId).toBeUndefined();
  });

  it('clave reusada con otro contenido → pide rotar la clave', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('idempotency key reused with different payload') });
    const r = await guardarCotizacion(estado, 'x@vh.mx', null, { claveCreacion: 'cot-abc-123456' });
    expect(r).toMatchObject({ guardado: false, rotarClave: true });
  });

  it('la red se cae → no lanza, conserva el id, reintenta al siguiente cambio', async () => {
    rpc.mockRejectedValue(new Error('fetch failed'));
    const r = await guardarCotizacion(estado, 'x@vh.mx', 77);
    expect(r).toMatchObject({ id: 77, guardado: false, motivo: 'red' });
  });

  it('clasificarErrorGuardado cubre los mensajes del servidor', () => {
    expect(clasificarErrorGuardado(new Error('no autorizado'))).toBe('sin-acceso');
    expect(clasificarErrorGuardado({ message: 'rol sin permiso' })).toBe('sin-acceso');
    expect(clasificarErrorGuardado('propietario protegido')).toBe('sin-acceso');
    expect(clasificarErrorGuardado(null)).toBe('desconocido');
  });
});
