import { describe, it, expect, vi } from 'vitest';
import { lecturaConReintento } from './lecturaConReintento.js';

const rechazo = { ok: false, code: 'FLOOR_SPEC_INVALID', error: 'La lectura del plano no pasó la validación geométrica determinista.', floorSpec: { validation: { issues: ['cotas 14000 ≠ 24000'] } } };
describe('lectura de plano con UN reintento ante el validador geométrico', () => {
  it('primera rechazada, segunda buena → la buena, marcada', async () => {
    const f = vi.fn().mockResolvedValueOnce(rechazo).mockResolvedValueOnce({ ok: true, areas: [1] });
    const r = await lecturaConReintento(f);
    expect(f).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ ok: true, reintentoGeometrico: true });
  });
  it('las dos rechazadas → el error (nunca un tercer intento)', async () => {
    const f = vi.fn().mockResolvedValue(rechazo);
    const r = await lecturaConReintento(f);
    expect(f).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ ok: false, code: 'FLOOR_SPEC_INVALID', reintentado: true });
  });
  it('otros errores (red, 429, sesión) NO se reintentan aquí', async () => {
    for (const e of [{ ok: false, error: 'red' }, { ok: false, code: 'RATE_LIMITED_USER' }]) {
      const f = vi.fn().mockResolvedValue(e);
      expect(await lecturaConReintento(f)).toEqual(e);
      expect(f).toHaveBeenCalledTimes(1);
    }
  });
  it('una lectura buena a la primera no se repite', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true });
    await lecturaConReintento(f);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
