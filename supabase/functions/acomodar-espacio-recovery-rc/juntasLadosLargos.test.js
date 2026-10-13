// ============================================================================
//  ACOMODO 10 · VH-A10-03 (RC) · MESA DE JUNTAS: primero los lados largos, cabeceras sólo si hacen falta.
//
//  layoutMeeting sentaba SIEMPRE a dos personas en las cabeceras (n ≥ 4). Los planos del laboratorio
//  dibujan otra cosa: C3 "sillas alrededor de la mesa: 3 arriba + 3 abajo", C2 SALA CREATIVA "sillas 3+3",
//  C5 SALA DE CONSEJO "sillas dibujadas 6+6". En C5 (8 × 4 m, puerta en el muro corto) la cabecera
//  izquierda quedaba frente a la puerta con 100 mm de acceso y el acomodo no se podía publicar.
//  Regla: los lados largos reciben una silla cada PITCH (650 mm, la constante de siempre del solver);
//  si ahí caben todas, no hay cabeceras. Si no caben (8 en 2.40 m), se usan como antes.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { layoutMeeting } from './placementProfiles.js';
import { construirRespuestaAcomodo } from './recoveryPipeline.js';
import { juzgarSemantico } from './semanticPlacementJudge.js';

const lados = (lay) => lay.seats.reduce((m, s) => ({ ...m, [s.side]: (m[s.side] || 0) + 1 }), {});

describe('VH-A10-03 · topología de la mesa de juntas', () => {
  it('12 en la Eclipse de 4.80 m: 6 + 6 en los lados largos, sin cabeceras (C5 dibuja 6+6)', () => {
    expect(lados(layoutMeeting(4800, 1200, 12))).toEqual({ A: 6, B: 6 });
  });
  it('6 en una mesa de 2.40 m: 3 + 3 (C3 y C2 dibujan 3+3)', () => {
    expect(lados(layoutMeeting(2400, 1200, 6))).toEqual({ A: 3, B: 3 });
  });
  it('8 en una mesa de 2.40 m no caben en los lados largos: 3 + 3 + 2 cabeceras, como antes', () => {
    expect(lados(layoutMeeting(2400, 1200, 8))).toEqual({ A: 3, B: 3, HEAD_A: 1, HEAD_B: 1 });
  });
  it('cada silla de lado largo tiene al menos 650 mm de mesa', () => {
    const lay = layoutMeeting(4800, 1200, 14);
    const a = lay.seats.filter((s) => s.side === 'A').map((s) => s.dx).sort((x, y) => x - y);
    for (let i = 1; i < a.length; i++) expect(a[i] - a[i - 1]).toBeGreaterThanOrEqual(650);
  });
  it('C5 · SALA DE CONSEJO 8 × 4 m con puerta en el muro corto: las 12 sillas con acceso ≥ 600 mm', () => {
    const area = { nombre: 'SALA DE CONSEJO', tipo: 'juntas', ancho: 8000, largo: 4000, poly: [[0, 0], [8000, 0], [8000, 4000], [0, 4000]],
      obstaculos: [{ x: -900, y: 1000, w: 1800, h: 1800, tipo: 'puerta' }],
      puertas: [{ x: 0, y: 1900, ancho: 900, tieneBarrido: true, bisagraX: 0, bisagraY: 1450, anguloCerradaDeg: 90, sentido: 'antihorario', barridoDeg: 90 }] };
    const piezas = [
      { id: 'mesa', nombre: 'Mesa de consejo Eclipse', relation_role: 'ANCHOR_MEETING', w: 4800, d: 1200, user_capacity: 14, zone_id: 'SALA DE CONSEJO', functional_group_id: 'fg:m' },
      ...Array.from({ length: 12 }, (_, i) => ({ id: `s${i + 1}`, nombre: 'Silla CONCERTO', relation_role: 'MEETING_SEAT', anchor_role: 'ANCHOR_MEETING', anchor_instance_id: 'mesa', functional_group_id: 'fg:m', w: 600, d: 600, zone_id: 'SALA DE CONSEJO' })),
    ];
    const r = construirRespuestaAcomodo([area], piezas);
    expect(r.plan.colocacion).toHaveLength(13);
    expect(juzgarSemantico([area], r.plan.piezas, r.plan.colocacion).issues).toEqual([]);
    expect(r.status).toBe('PASS');
  });
});
