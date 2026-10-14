// ============================================================================
//  Emisión · nunca gatea ni congela una cotización VIEJA si falla el guardado vivo (comportamiento).
//  Antes: buscaba "guardado: false, motivo: 'red'" y '!r.guardado' en el TEXTO de cotizaciones.js / App.jsx.
//  Ahora: guardarCotizacion con la red caída (nube simulada) y las funciones que usa App
//  (datos/emisionViva.js) con guardados fallidos, sin id, con excepción y exitosos.
// ============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';

const rpc = vi.fn();
vi.mock('../nube.js', () => ({ nube: { rpc: (...a) => rpc(...a), from: vi.fn() } }));
const { guardarCotizacion } = await import('./cotizaciones.js');
const { verificarEmisionViva, registrarEmisionViva } = await import('./emisionViva.js');

const ESTADO = {
  insumos: {}, parametros: { ivaPorcentaje: 16 },
  cotizacion: { cliente: 'Tradeco', folio: 'T-1', partidas: [{ id: 'p1', nombre: 'Banca', cantidad: 2, precioUnitario: 1000 }] },
};

describe('emisión · nunca gatea una cotización vieja si falla el guardado vivo', () => {
  beforeEach(() => { rpc.mockReset(); });   // con llaves: si devuelve la fn, vitest la llama como teardown

  it('guardarCotizacion reporta guardado:false (red) ante excepción, nunca "guardado"', async () => {
    rpc.mockRejectedValue(new Error('fetch failed'));
    const act = await guardarCotizacion(ESTADO, 'v@vh.mx', 77);           // actualizar
    expect(act).toEqual({ id: 77, guardado: false, motivo: 'red' });
    const nueva = await guardarCotizacion(ESTADO, 'v@vh.mx', null);        // crear
    expect(nueva).toEqual({ id: null, guardado: false, motivo: 'red' });
  });

  it('verificarEmision falla cerrado (DESCONOCIDO) y NO consulta el gate si no guardó', async () => {
    const casos = [
      { r: { id: 77, guardado: false, motivo: 'red' }, error: 'red' },
      { r: { id: null, guardado: true }, error: 'sin-id' },
      { r: { id: 77, guardado: false }, error: 'sin-id' },
    ];
    for (const c of casos) {
      const evaluarEmision = vi.fn(async () => ({ ok: true, estado: 'ALLOWED' }));
      const snapshot = vi.fn(() => ({ partidas: [] }));
      const g = await verificarEmisionViva({ haySesion: true, guardarEnNube: async () => c.r, evaluarEmision, snapshot });
      expect(g).toEqual({ ok: false, estado: 'DESCONOCIDO', motivos: [], error: c.error });
      expect(evaluarEmision).not.toHaveBeenCalled();
    }
    const evaluarEmision = vi.fn();
    const exc = await verificarEmisionViva({ haySesion: true, guardarEnNube: async () => { throw new Error('timeout'); }, evaluarEmision, snapshot: () => ({}) });
    expect(exc).toMatchObject({ ok: false, estado: 'DESCONOCIDO', error: 'timeout' });
    expect(evaluarEmision).not.toHaveBeenCalled();
    const sinSesion = vi.fn();
    expect(await verificarEmisionViva({ haySesion: false, guardarEnNube: sinSesion, evaluarEmision, snapshot: () => ({}) }))
      .toEqual({ ok: false, estado: 'DESCONOCIDO', motivos: [] });
    expect(sinSesion).not.toHaveBeenCalled();
  });

  it('verificarEmision gatea el id RECIÉN guardado con el MISMO snapshot (tomado después de guardar)', async () => {
    const orden = [];
    const guardarEnNube = vi.fn(async () => { orden.push('guardar'); return { id: 912, guardado: true }; });
    const snapshot = vi.fn(() => { orden.push('snapshot'); return { partidas: [{ id: 'p1' }], total: 2320 }; });
    const evaluarEmision = vi.fn(async (id, snap) => ({ ok: true, estado: 'ALLOWED', id, snap }));
    const g = await verificarEmisionViva({ haySesion: true, guardarEnNube, evaluarEmision, snapshot });
    expect(orden).toEqual(['guardar', 'snapshot']);
    expect(evaluarEmision).toHaveBeenCalledWith(912, { partidas: [{ id: 'p1' }], total: 2320 });
    expect(g.estado).toBe('ALLOWED');
  });

  it('onEmitida no congela revisión contra un id anterior ni si no se guardó', async () => {
    const guardarRevision = vi.fn(async () => ({ ok: true, nueva: true, revision: 3 }));
    const noGuardo = await registrarEmisionViva({ haySesion: true, guardarEnNube: async () => ({ id: 41, guardado: false }), guardarRevision, estado: ESTADO });
    expect(noGuardo).toEqual({ ok: false, motivo: 'no-se-guardo-estado-vivo' });
    const conMotivo = await registrarEmisionViva({ haySesion: true, guardarEnNube: async () => ({ id: 41, guardado: false, motivo: 'conflicto' }), guardarRevision, estado: ESTADO });
    expect(conMotivo).toEqual({ ok: false, motivo: 'conflicto' });
    const exc = await registrarEmisionViva({ haySesion: true, guardarEnNube: async () => { throw new Error('caída'); }, guardarRevision, estado: ESTADO });
    expect(exc).toEqual({ ok: false, motivo: 'caída' });
    expect(guardarRevision).not.toHaveBeenCalled();
    expect(await registrarEmisionViva({ haySesion: false, guardarEnNube: vi.fn(), guardarRevision, estado: ESTADO }))
      .toEqual({ ok: false, motivo: 'sin-sesion' });
  });

  it('onEmitida congela la revisión con el id del guardado VIVO y avisa sólo si es nueva', async () => {
    const aviso = vi.fn();
    const guardarRevision = vi.fn(async () => ({ ok: true, nueva: true, revision: 3 }));
    const r = await registrarEmisionViva({ haySesion: true, guardarEnNube: async () => ({ id: 512, guardado: true }), guardarRevision, estado: ESTADO, alNuevaRevision: aviso });
    expect(guardarRevision).toHaveBeenCalledWith(ESTADO, 512);
    expect(r).toEqual({ ok: true, nueva: true, revision: 3 });
    expect(aviso).toHaveBeenCalledTimes(1);
    const igual = await registrarEmisionViva({ haySesion: true, guardarEnNube: async () => ({ id: 512, guardado: true }), guardarRevision: async () => ({ ok: true, nueva: false, revision: 3 }), estado: ESTADO, alNuevaRevision: aviso });
    expect(igual.ok).toBe(true);
    expect(aviso).toHaveBeenCalledTimes(1);
    const nula = await registrarEmisionViva({ haySesion: true, guardarEnNube: async () => ({ id: 512, guardado: true }), guardarRevision: async () => null, estado: ESTADO });
    expect(nula).toEqual({ ok: false, motivo: 'desconocido' });
  });

  // STATIC GUARD: App.jsx no se monta en node (sin jsdom). Sólo verifica el CABLEADO hacia la lógica probada.
  it('cableado: App delega verificarEmision/onEmitida en emisionViva con su guardarEnNube', () => {
    const s = fs.readFileSync('src/App.jsx', 'utf8');
    const v = s.slice(s.indexOf('function verificarEmision()'), s.indexOf('async function solicitarAprobacion'));
    expect(v).toContain('return verificarEmisionViva({');
    expect(v).toContain('guardarEnNube, evaluarEmision');
    expect(v).toContain('snapshot: () => snapshotEmitido(estado)');
    const e = s.slice(s.indexOf('function onEmitida()'), s.indexOf('// permiso ==='));
    expect(e).toContain('return registrarEmisionViva({');
    expect(e).toContain('guardarEnNube, guardarRevision, estado');
  });
});
