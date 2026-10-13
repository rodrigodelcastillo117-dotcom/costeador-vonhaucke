// ============================================================================
//  ACOMODO 10 · VH-A10-03 (RC) · MESA DE JUNTAS: la canónica primero; sólo lados largos si así todas tienen acceso.
//
//  La topología canónica de la mesa de juntas (P0.2c, regla curada) es lados largos + 2 cabeceras (10 → 4+4+1+1)
//  y se queda. Pero en C5 (SALA DE CONSEJO 8 × 4 m, puerta en el muro corto) la Eclipse de 12 salía 5+5+1+1 y la
//  cabecera izquierda quedaba frente a la puerta con 100 mm de acceso: el acomodo no se podía publicar. Los planos
//  del laboratorio dibujan las sillas en los lados largos (C3 "3 arriba + 3 abajo", C2 "3+3", C5 "6+6").
//  Regla: el solver prueba la canónica con holgura; si no cabe en ningún lado, prueba la variante SÓLO LADOS
//  LARGOS (una silla cada PITCH_JUNTAS = 650 mm, la constante de siempre) con holgura; luego el compacto.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { layoutMeeting, admiteLadosLargos } from './placementProfiles.js';
import { construirRespuestaAcomodo } from './recoveryPipeline.js';
import { juzgarSemantico } from './semanticPlacementJudge.js';

const lados = (lay) => lay.seats.reduce((m, s) => ({ ...m, [s.side]: (m[s.side] || 0) + 1 }), {});
const consejo = (n) => [
  { id: 'mesa', nombre: 'Mesa de consejo Eclipse', relation_role: 'ANCHOR_MEETING', w: 4800, d: 1200, user_capacity: 14, zone_id: 'SALA DE CONSEJO', functional_group_id: 'fg:m' },
  ...Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, nombre: 'Silla CONCERTO', relation_role: 'MEETING_SEAT', anchor_role: 'ANCHOR_MEETING', anchor_instance_id: 'mesa', functional_group_id: 'fg:m', w: 600, d: 600, zone_id: 'SALA DE CONSEJO' })),
];

describe('VH-A10-03 · topología de la mesa de juntas', () => {
  it('la canónica no cambia: 10 → 4+4+1+1, 12 en la Eclipse → 5+5+1+1, 8 en 2.40 m → 3+3+1+1', () => {
    expect(lados(layoutMeeting(5000, 1200, 10))).toEqual({ A: 4, B: 4, HEAD_A: 1, HEAD_B: 1 });
    expect(lados(layoutMeeting(4800, 1200, 12))).toEqual({ A: 5, B: 5, HEAD_A: 1, HEAD_B: 1 });
    expect(lados(layoutMeeting(2400, 1200, 8))).toEqual({ A: 3, B: 3, HEAD_A: 1, HEAD_B: 1 });
  });
  it('variante sólo lados largos: 12 en 4.80 m → 6+6; 6 en 2.40 m → 3+3; 8 en 2.40 m no la admite', () => {
    expect(lados(layoutMeeting(4800, 1200, 12, { soloLadosLargos: true }))).toEqual({ A: 6, B: 6 });
    expect(lados(layoutMeeting(2400, 1200, 6, { soloLadosLargos: true }))).toEqual({ A: 3, B: 3 });
    expect(admiteLadosLargos(2400, 8)).toBe(false);
    expect(lados(layoutMeeting(2400, 1200, 8, { soloLadosLargos: true }))).toEqual({ A: 3, B: 3, HEAD_A: 1, HEAD_B: 1 });
  });
  it('en la variante, cada silla de lado largo tiene al menos 650 mm de mesa', () => {
    const lay = layoutMeeting(4800, 1200, 14, { soloLadosLargos: true });
    const a = lay.seats.filter((s) => s.side === 'A').map((s) => s.dx).sort((x, y) => x - y);
    expect(a).toHaveLength(7);
    for (let i = 1; i < a.length; i++) expect(a[i] - a[i - 1]).toBeGreaterThanOrEqual(650);
  });
  it('C5 · SALA DE CONSEJO 8 × 4 m con puerta en el muro corto: la canónica no deja acceso; 6+6 sí (PASS)', () => {
    const area = { nombre: 'SALA DE CONSEJO', tipo: 'juntas', ancho: 8000, largo: 4000, poly: [[0, 0], [8000, 0], [8000, 4000], [0, 4000]],
      obstaculos: [{ x: -900, y: 1000, w: 1800, h: 1800, tipo: 'puerta' }],
      puertas: [{ x: 0, y: 1900, ancho: 900, tieneBarrido: true, bisagraX: 0, bisagraY: 1450, anguloCerradaDeg: 90, sentido: 'antihorario', barridoDeg: 90 }] };
    const r = construirRespuestaAcomodo([area], consejo(12));
    expect(r.plan.colocacion).toHaveLength(13);
    expect(r.plan.colocacion.find((c) => c.id === 'mesa').layout_variant).toBe('LADOS_LARGOS');
    expect(juzgarSemantico([area], r.plan.piezas, r.plan.colocacion).issues).toEqual([]);
    expect(r.status).toBe('PASS');
  });
  it('si la canónica cabe con su holgura, se queda la canónica (sala amplia de 10 × 6 m)', () => {
    const area = { nombre: 'SALA DE CONSEJO', tipo: 'juntas', ancho: 10000, largo: 6000, puertas: [] };
    const r = construirRespuestaAcomodo([area], consejo(12));
    expect(r.plan.colocacion.find((c) => c.id === 'mesa').layout_variant).toBeUndefined();
    expect(r.plan.colocacion.filter((c) => /HEAD/.test(String(c.side)))).toHaveLength(2);
    expect(r.status).toBe('PASS');
  });
});
