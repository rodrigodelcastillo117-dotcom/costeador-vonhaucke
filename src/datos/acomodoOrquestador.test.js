import { describe, it, expect, vi } from 'vitest';
import { resolverAcomodo } from './acomodoOrquestador.js';
import { construirPayloadAcomodo } from './acomodoPayload.js';

// Piezas genéricas (sin relation_role de dependiente): el test ejercita la
// mecánica del loop/precedencia, no la relación ancla-dependiente.
const PARTIDAS = [{ id: 'e-win', nombre: 'Silla operativa WIN', cantidad: 2 }];
const AREAS_M = [{ nombre: 'OPERATIVA', ancho: 6, largo: 3 }];

// Plan válido: ambas sillas (600×600) dentro del área, sin solape.
const planValido = () => ({
  colocacion: [
    { id: 'e-win-1', area: 0, x: 0, y: 0, rot: 0 },
    { id: 'e-win-2', area: 0, x: 1000, y: 0, rot: 0 },
  ],
  render_ready: true,
  layoutSpec: { status: 'PASS', validation: { render_ready: true } },
});
const planRoto = () => ({
  colocacion: [{ id: 'e-win-1', area: 0, x: 0, y: 0 }, { id: 'e-win-2', area: 0, x: 0, y: 0 }], // solape
  layoutSpec: { status: 'FAIL' },
});

describe('acomodoOrquestador · contrato de entrada', () => {
  it('sin FloorSpec → SIN_LAYOUT y NO llama al solver', async () => {
    const solve = vi.fn();
    const r = await resolverAcomodo({ partidas: PARTIDAS, areasM: [], solve });
    expect(r.ok).toBe(false);
    expect(r.status).toBe('SIN_LAYOUT');
    expect(solve).not.toHaveBeenCalled();
  });

  it('GAP3: geometría válida pero FloorSpec rechazado → el solver NUNCA se llama', async () => {
    const solve = vi.fn();
    const r = await resolverAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, floorSpecEstado: 'INVALID', solve });
    expect(r.ok).toBe(false);
    expect(r.status).toBe('SIN_LAYOUT');
    expect(r.motivo).toBe('FLOORSPEC_RECHAZADO');
    expect(solve).not.toHaveBeenCalled();
  });
  it('COT-P0-022: FloorSpec REVIEW_REQUIRED (warnings) → el solver SÍ se llama y el resultado va marcado como BORRADOR', async () => {
    const solve = vi.fn(async () => planValido());
    const r = await resolverAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, floorSpecEstado: 'REVIEW_REQUIRED', solve });
    expect(solve).toHaveBeenCalledTimes(1);
    expect(r.payload?.borrador).toBe(true);
    expect(r.payload?.floorSpecEstado).toBe('REVIEW_REQUIRED');
    expect(r.plan).toBeTruthy();
  });
});

describe('acomodoOrquestador · repair loop (obj 8)', () => {
  it('válido al primer intento → PASS, 1 entrada de rastro', async () => {
    const solve = vi.fn(async () => planValido());
    const r = await resolverAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, solve });
    expect(r.ok).toBe(true);
    expect(r.status).toBe('PASS');
    expect(r.render_ready).toBe(true);
    expect(r.trace).toHaveLength(1);
    expect(solve).toHaveBeenCalledTimes(1);
  });

  it('falla→repara: 2º intento válido → PASS con rastro de lo movido', async () => {
    const solve = vi.fn()
      .mockResolvedValueOnce(planRoto())
      .mockResolvedValueOnce(planValido());
    const r = await resolverAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, solve });
    expect(r.ok).toBe(true);
    expect(r.trace).toHaveLength(2);
    expect(r.trace[0].status).toBe('FAIL');
    expect(r.trace[0].invariantesFallados).toContain('OVERLAP');
    expect(r.trace[1].status).toBe('PASS');
    expect(r.trace[1].piezasMovidas.length).toBeGreaterThan(0);
  });

  it('inválido tras 3 intentos → NEEDS_REVIEW, no render_ready, rastro de 3', async () => {
    const solve = vi.fn(async () => planRoto());
    const r = await resolverAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, solve });
    expect(r.ok).toBe(false);
    expect(r.status).toBe('NEEDS_REVIEW');
    expect(r.render_ready).toBe(false);
    expect(r.trace).toHaveLength(3);
    expect(solve).toHaveBeenCalledTimes(3);
  });

  it('error del solver se registra y se sigue intentando', async () => {
    const solve = vi.fn()
      .mockRejectedValueOnce(new Error('timeout edge'))
      .mockResolvedValueOnce(planValido());
    const r = await resolverAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, solve });
    expect(r.trace[0].accion).toBe('SOLVE_ERROR');
    expect(r.ok).toBe(true);
  });
});

describe('acomodoOrquestador · precedencia manual (obj 9)', () => {
  it('program/floor sin cambios + plan manual → CONSERVA, NO re-resuelve', async () => {
    const payload = construirPayloadAcomodo({ partidas: PARTIDAS, areasM: AREAS_M });
    const planGuardado = {
      colocacion: [
        { id: 'e-win-1', area: 0, x: 200, y: 200, rot: 0, manual: true },
        { id: 'e-win-2', area: 0, x: 1500, y: 0, rot: 0 },
      ],
      program_hash: payload.program_hash,
      floor_hash: payload.floor_hash,
    };
    const solve = vi.fn();
    const r = await resolverAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, solve, planGuardado });
    expect(solve).not.toHaveBeenCalled();
    expect(r.conservadoManual).toBe(true);
    expect(r.trace[0].accion).toBe('CONSERVA_MANUAL');
    expect(r.render_ready).toBe(true);
  });

  it('si program cambió: re-resuelve pero RE-IMPONE la posición manual (el edge no la pisa)', async () => {
    const planGuardado = {
      colocacion: [{ id: 'e-win-1', area: 0, x: 300, y: 300, rot: 0, manual: true }],
      program_hash: 'p_viejo',   // fuerza stale
      floor_hash: 'f_viejo',
    };
    // El solver intenta mover e-win-1 lejos; la orquestación debe re-imponer (300,300).
    const solve = vi.fn(async () => ({
      colocacion: [{ id: 'e-win-1', area: 0, x: 5000, y: 2000 }, { id: 'e-win-2', area: 0, x: 1500, y: 0 }],
      layoutSpec: { status: 'PASS', validation: { render_ready: true } }, render_ready: true,
    }));
    const r = await resolverAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, solve, planGuardado });
    expect(solve).toHaveBeenCalled();
    const manual = r.plan.colocacion.find((c) => c.id === 'e-win-1');
    expect(manual.x).toBe(300);
    expect(manual.y).toBe(300);
    expect(manual.manual).toBe(true);
  });
});
