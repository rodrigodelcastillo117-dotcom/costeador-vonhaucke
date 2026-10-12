import { describe, it, expect, vi } from 'vitest';
import { resolverAcomodo } from './acomodoOrquestador.js';
import { formatearMensajeVendedor } from './mensajeAcomodo.js';

// ============================================================================
//  P0.2b · G (integración) · el `mensaje_vendedor` del edge debe viajar HASTA el
//  plan del cliente: edge response → solve adapter → resolverAcomodo → plan →
//  formatter. (Antes el adapter descartaba r.mensaje_vendedor.)
// ============================================================================
const PARTIDAS = [{ id: 'e-win', nombre: 'Silla operativa WIN', cantidad: 1 }];
const AREAS_M = [{ nombre: 'OPERATIVA', ancho: 6, largo: 3 }];

// Simula el edge recovery: devuelve plan + mensaje_vendedor (como lo arma index.ts).
const MENSAJE = {
  pendientes: [{ rol: 'WORK_SEAT', n: 2, texto: '2 sillas operativas' }],
  motivos: [{ invariante: 'NO_SPACE', texto: 'El grupo necesita ~10.8 m² y el área "OPERATIVA" tiene ~9.0 m².' }],
  opciones: [{ id: 'estacion_2', texto: 'Usar una estación de 2 puesto(s) en lugar de 4: cabe completa (2 de 4).' }],
  sin_opcion: null,
  hay_pendientes: true,
};

describe('G · propagación end-to-end de mensaje_vendedor', () => {
  it('edge response con mensaje_vendedor → resolverAcomodo → plan.mensaje_vendedor → formatter', async () => {
    // Adapter idéntico al de AcomodoBase: conserva mensaje_vendedor del edge.
    const solve = vi.fn(async () => {
      const r = { ok: true, plan: { colocacion: [{ id: 'e-win-1', area: 0, x: 0, y: 0, rot: 0 }] }, layoutSpec: { status: 'PASS', validation: { render_ready: true } }, render_ready: true, mensaje_vendedor: MENSAJE };
      const mensaje_vendedor = r.mensaje_vendedor || r.layoutSpec?.mensaje_vendedor || null;
      return { ...r.plan, mensaje_vendedor, layoutSpec: r.layoutSpec, render_ready: true, strictPlacement: true };
    });

    const res = await resolverAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, solve });
    expect(res.plan).toBeTruthy();
    // 1) el mensaje llegó hasta el plan (no se descartó en el adapter/orquestador).
    expect(res.plan.mensaje_vendedor).toBeTruthy();
    expect(res.plan.mensaje_vendedor.hay_pendientes).toBe(true);

    // 2) el formatter del cliente lo convierte en tarjeta legible.
    const card = formatearMensajeVendedor(res.plan.mensaje_vendedor);
    expect(card).not.toBeNull();
    expect(card.queNoCupo).toContain('2 sillas operativas');   // D: una sola viñeta (la pone el <li>)
    expect(card.porque[0]).toContain('m²');
    expect(card.queHacer[0]).toContain('estación de 2');
  });

  it('sin pendientes → el plan no gatilla tarjeta (formatter null)', async () => {
    const solve = vi.fn(async () => ({ colocacion: [{ id: 'e-win-1', area: 0, x: 0, y: 0, rot: 0 }], layoutSpec: { status: 'PASS', validation: { render_ready: true } }, render_ready: true, strictPlacement: true, mensaje_vendedor: { hay_pendientes: false, pendientes: [], motivos: [], opciones: [] } }));
    const res = await resolverAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, solve });
    expect(formatearMensajeVendedor(res.plan.mensaje_vendedor)).toBeNull();
  });
});
