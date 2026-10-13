// Área J · R-04 (causa raíz): el servidor CREÓ la cotización pero la respuesta se perdió; la persona editó y el
// reintento llevó la MISMA clave con OTRO contenido → 'idempotency key reused with different payload' → el
// cliente rotaba la clave → SEGUNDA fila (e2e/resiliencia.e2e.js · 4c: filas 2, creates 2).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('../nube.js', () => ({ nube: { rpc: (...a) => rpc(...a), from: vi.fn() } }));
const { guardarCotizacion, CLAVE_CREACION_PENDIENTE, clasificarErrorGuardado } = await import('./cotizaciones.js');

const memoria = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
const est = (cliente) => ({ insumos: {}, parametros: {}, cotizacion: { cliente, partidas: [{ id: 'p1', nombre: 'Banca', cantidad: 1, precioUnitario: 48000 }] } });

// Servidor con la semántica de private_api.crear_cotizacion_segura (08_private_api.sql:980-995).
function servidor() {
  const idem = new Map(); const filas = new Map(); let sig = 100;
  rpc.mockImplementation(async (fn, args) => {
    if (fn === 'crear_cotizacion_segura') {
      const { _idempotency_key: k, ...resto } = args.p_payload; const h = JSON.stringify(resto);
      const prev = idem.get(k);
      if (prev) return prev.h === h ? { data: { ok: true, id: prev.id }, error: null } : { data: null, error: { code: 'P0001', message: 'idempotency key reused with different payload' } };
      const id = sig++; filas.set(id, resto); idem.set(k, { id, h });
      return { data: { ok: true, id }, error: null };
    }
    if (fn === 'actualizar_cotizacion_segura') { filas.set(args.p_cotizacion_id, { ...filas.get(args.p_cotizacion_id), ...args.p_patch }); return { data: { ok: true, id: args.p_cotizacion_id }, error: null }; }
    return { data: null, error: { message: 'x' } };
  });
  return { filas };
}

describe('R-04 · creación con respuesta perdida', () => {
  beforeEach(() => rpc.mockReset());

  it('respuesta perdida + edición → se recupera LA MISMA fila y se actualiza; nunca una segunda', async () => {
    const srv = servidor(); const s = memoria();
    const real = rpc.getMockImplementation();
    // 1er intento: el servidor crea, pero la red se cae antes de la respuesta.
    rpc.mockImplementationOnce(async (fn, args) => { await real(fn, args); throw new TypeError('Failed to fetch'); });
    const r1 = await guardarCotizacion(est('Huérfana SA'), 'v@vh.mx', null, { claveCreacion: 'cot-k-123456', storage: s });
    expect(r1).toMatchObject({ guardado: false, motivo: 'red' });
    expect(srv.filas.size).toBe(1);
    expect(s.getItem(CLAVE_CREACION_PENDIENTE)).not.toBeNull();
    // 2º intento con OTRO contenido y la misma clave.
    const r2 = await guardarCotizacion(est('Huérfana SA Norte'), 'v@vh.mx', null, { claveCreacion: 'cot-k-123456', storage: s });
    expect(r2).toMatchObject({ id: 100, guardado: true });
    expect(r2.rotarClave).toBeFalsy();
    expect(srv.filas.size).toBe(1);
    expect(srv.filas.get(100).cliente).toBe('Huérfana SA Norte');
    expect(s.getItem(CLAVE_CREACION_PENDIENTE)).toBeNull();
  });

  it('postgrest-js DEVUELVE el fallo de red (no lanza): la creación pendiente se conserva y se recupera', async () => {
    const srv = servidor(); const s = memoria();
    const real = rpc.getMockImplementation();
    rpc.mockImplementationOnce(async (fn, args) => { await real(fn, args); return { data: null, error: { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' } }; });
    const r1 = await guardarCotizacion(est('X'), 'v@vh.mx', null, { claveCreacion: 'cot-k-333333', storage: s });
    expect(r1.guardado).toBe(false);
    expect(s.getItem(CLAVE_CREACION_PENDIENTE)).not.toBeNull();
    const r2 = await guardarCotizacion(est('X Norte'), 'v@vh.mx', null, { claveCreacion: 'cot-k-333333', storage: s });
    expect(r2).toMatchObject({ id: 100, guardado: true });
    expect(srv.filas.size).toBe(1);
  });

  it('si la creación nunca llegó al servidor, el reenvío la crea con lo de entonces y la actualiza: una sola fila', async () => {
    const srv = servidor(); const s = memoria();
    rpc.mockImplementationOnce(async () => { throw new TypeError('Failed to fetch'); });
    await guardarCotizacion(est('A'), 'v@vh.mx', null, { claveCreacion: 'cot-k-654321', storage: s });
    expect(srv.filas.size).toBe(0);
    const r = await guardarCotizacion(est('B'), 'v@vh.mx', null, { claveCreacion: 'cot-k-654321', storage: s });
    expect(r).toMatchObject({ guardado: true });
    expect(srv.filas.size).toBe(1);
    expect([...srv.filas.values()][0].cliente).toBe('B');
  });

  it('camino feliz: una creación confirmada no deja pendiente y no hace llamadas de más', async () => {
    servidor(); const s = memoria();
    const r = await guardarCotizacion(est('C'), 'v@vh.mx', null, { claveCreacion: 'cot-k-111111', storage: s });
    expect(r).toMatchObject({ id: 100, guardado: true });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(s.getItem(CLAVE_CREACION_PENDIENTE)).toBeNull();
  });

  it('un rechazo del servidor (respondió) no deja creación pendiente', async () => {
    const s = memoria();
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'acomodo invalido' } });
    await guardarCotizacion(est('D'), 'v@vh.mx', null, { claveCreacion: 'cot-k-222222', storage: s });
    expect(s.getItem(CLAVE_CREACION_PENDIENTE)).toBeNull();
  });
});

// Área J · R-07 (causa raíz): 'no autorizado' / JWT vencido se clasificaban 'sin-acceso' (o 'desconocido' = "sin
// conexión") → el cliente soltaba el id en silencio y al volver a entrar duplicaba la cotización (e2e 6).
describe('R-07 · sesión expirada', () => {
  beforeEach(() => rpc.mockReset());
  it('JWT vencido y "no autorizado" son la sesión, no una fila ajena ni la red', () => {
    expect(clasificarErrorGuardado({ code: 'PGRST301', message: 'JWT expired' })).toBe('sesion');
    expect(clasificarErrorGuardado({ code: 'P0001', message: 'no autorizado' })).toBe('sesion');
    expect(clasificarErrorGuardado({ code: 'P0001', message: 'sin acceso' })).toBe('sin-acceso');
    expect(clasificarErrorGuardado({ message: 'TypeError: Failed to fetch', code: '' })).toBe('desconocido');
  });
  it('al actualizar con la sesión vencida se CONSERVA el id (no soltarId) y no se dice "guardado"', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'no autorizado' } });
    const r = await guardarCotizacion(est('S'), 'v@vh.mx', 100, { storage: memoria() });
    expect(r).toMatchObject({ id: 100, guardado: false, motivo: 'sesion' });
    expect(r.soltarId).toBeFalsy();
  });
});
