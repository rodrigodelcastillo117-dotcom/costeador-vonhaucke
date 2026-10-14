// Bucle del cliente para la firma de precios ERP por lotes (RPC firmar_precios_erp_lote, cursor por id).
import { describe, it, expect } from 'vitest';
import { firmarPreciosErp } from '../nube.js';

const rpcDe = (respuestas) => { const llamadas = []; return { llamadas, rpc: async (fn, a) => { llamadas.push([fn, a]); return respuestas.shift(); } }; };

describe('firmarPreciosErp (cliente por lotes)', () => {
  it('sigue el cursor hasta ultimo_id null y suma firmados y motivos', async () => {
    const { rpc, llamadas } = rpcDe([
      { data: { firmados: 200, no_firmados: 0, motivos: {}, firmado_por: 'r@vh.mx', ultimo_id: 410 } },
      { data: { firmados: 197, no_firmados: 3, motivos: { integridad: 3 }, firmado_por: 'r@vh.mx', ultimo_id: null } }]);
    const r = await firmarPreciosErp(24, { rpc, limite: 200 });
    expect(r).toMatchObject({ ok: true, resultado: { firmados: 397, no_firmados: 3, motivos: { integridad: 3 }, firmado_por: 'r@vh.mx', lotes: 2 } });
    expect(llamadas.map(([fn, a]) => [fn, a.p_despues_de, a.p_limite, a.p_meses])).toEqual([['firmar_precios_erp_lote', null, 200, 24], ['firmar_precios_erp_lote', 410, 200, 24]]);
  });

  it('si un lote falla, devuelve el error y lo que ya quedó firmado', async () => {
    const { rpc } = rpcDe([{ data: { firmados: 200, no_firmados: 0, ultimo_id: 410 } }, { error: { message: 'canceling statement due to statement timeout' } }]);
    const r = await firmarPreciosErp(24, { rpc });
    expect(r).toMatchObject({ ok: false, resultado: { firmados: 200 } });
    expect(r.error).toMatch(/timeout/);
  });

  it('un cursor que no avanza se detiene en vez de ciclar', async () => {
    const { rpc } = rpcDe([{ data: { firmados: 1, ultimo_id: 5 } }, { data: { firmados: 0, ultimo_id: 5 } }]);
    const r = await firmarPreciosErp(24, { rpc });
    expect(r.ok).toBe(false); expect(r.error).toMatch(/no avanzó/);
  });
});
