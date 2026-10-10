import { describe, it, expect, vi, afterEach } from 'vitest';
import { nube, guardarExpediente, actualizarExpediente, guardarRevisionExpediente, guardarConfirmaciones, dtoCosteoServidor } from '../nube.js';
import { validarIntentCosteo } from '../datos/validarIntentCosteo.js';

afterEach(() => vi.restoreAllMocks());

describe('P0 biblioteca — respuesta PostgREST verificada, nunca éxito supuesto', () => {
  it('no trata INSERT sin ID como guardado válido', async () => {
    vi.spyOn(nube, 'from').mockReturnValue({
      insert: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    });
    const r = await guardarExpediente({ nombre: 'QA' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no devolvió ID/);
  });

  it('no trata UPDATE bajo RLS con cero filas como éxito', async () => {
    vi.spyOn(nube, 'from').mockReturnValue({
      update: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    });
    const r = await actualizarExpediente(1234, { nombre: 'QA' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/ninguna fila/);
  });

  it('reporta error de historial que antes se perdía silenciosamente', async () => {
    vi.spyOn(nube, 'from').mockReturnValue({
      insert: async () => ({ error: { message: 'RLS_REVISION_DENIED' } }),
    });
    const r = await guardarRevisionExpediente({ expediente_id: 1, rev: 1 });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('RLS_REVISION_DENIED');
  });

  it('reporta cuando las confirmaciones no quedaron guardadas', async () => {
    vi.spyOn(nube, 'from').mockReturnValue({
      insert: async () => ({ error: { message: 'CONFIRMATIONS_RLS' } }),
    });
    const r = await guardarConfirmaciones([{ pregunta: 'Quién hace rótulos', respuesta: 'Cliente' }]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('CONFIRMATIONS_RLS');
  });

  it('rechaza costo del servidor sin insumo y sin especificación, con causas identificables', () => {
    const body = dtoCosteoServidor({ componentes: [{ nombre: 'Rótulos P-01', insumoId: '', material_match: 'USER_CONFIRMED' }] }, 1);
    const r = validarIntentCosteo(body);
    expect(r.ok).toBe(false);
    expect(r.issues.some(x => x.field.includes('insumoId'))).toBe(true);
  });

  it('admite la partida pendiente cuando declara el material y el estado no emitible', () => {
    const body = dtoCosteoServidor({ componentes: [
      { nombre: 'Rótulos P-01', insumoId: '', material_solicitado: 'Rótulos personalizados', material_match: 'NOT_AVAILABLE' },
    ] }, 1);
    const r = validarIntentCosteo(body);
    expect(r.ok).toBe(true);
  });
});
