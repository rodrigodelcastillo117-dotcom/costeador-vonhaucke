import { describe, it, expect } from 'vitest';
import { componerKit } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';
import { mensajeVendedor } from '../../supabase/functions/acomodar-espacio-recovery/opciones.js';
import { formatearMensajeVendedor } from '../../src/datos/mensajeAcomodo.js';

// ============================================================================
//  P0.2c · ARRANQUE OBLIGATORIO — reproduce/congela/documenta los defectos A–D
//  del BASELINE P0.2b. NO toca el juez ni los casos congelados de P0.2b.
//
//  A, B, C: afirman el comportamiento BASELINE (defectuoso) para CONGELARLO como
//  punto de partida medible. Cuando P0.2c los corrija, estas aserciones se
//  actualizan al comportamiento requerido (ANTES → DESPUÉS documentado).
//  D: pulido dentro de la capa G existente — YA corregido; afirma el DESPUÉS.
// ============================================================================
const mk = (id, rol, w, d, extra = {}) => ({ id, relation_role: rol, w, d, ...extra });

describe('P0.2c · DEFECTO A (DESPUÉS) · workstation DOUBLE_FACE = 4+4 enfrentados', () => {
  // ANTES (baseline P0.2b): bench cap 8 → las 8 sillas de UN solo lado (dy único),
  // geométricamente válido pero semánticamente incorrecto para un double-face.
  // DESPUÉS (P0.2c): con topología DOUBLE_FACE confirmada → 2 lados (A arriba /
  // B abajo), 4 y 4, cada silla con slot_id/side/facing. (NO se infiere de capacity.)
  it('DESPUÉS: bench cap 8 DOUBLE_FACE → 4 lado A + 4 lado B (enfrentados)', () => {
    // Regla USER_CONFIRMED de Rodrigo: "1 operativo para 8 personas" → DOUBLE_FACE.
    const anchor = mk('b', 'ANCHOR_WORKSTATION', 6000, 1200, { user_capacity: 8, topology: 'DOUBLE_FACE', topology_source: 'USER_CONFIRMED' });
    const sillas = Array.from({ length: 8 }, (_, i) => mk('s' + i, 'WORK_SEAT', 600, 600));
    const k = componerKit(anchor, sillas, []);
    const seats = k.piezas.filter((p) => p.rol === 'WORK_SEAT');
    expect(seats.length).toBe(8);
    expect(new Set(seats.map((p) => p.dy)).size).toBe(2);              // 2 lados
    expect(seats.filter((p) => p.side === 'A').length).toBe(4);
    expect(seats.filter((p) => p.side === 'B').length).toBe(4);
    expect(seats.every((p) => p.slot_id && p.facing)).toBe(true);     // slot + facing
  });
  it('control: workstation SIN topología declarada sigue SINGLE_FACE (no se inventa double-face)', () => {
    const anchor = mk('b', 'ANCHOR_WORKSTATION', 12000, 1200, { user_capacity: 8 });
    const sillas = Array.from({ length: 8 }, (_, i) => mk('s' + i, 'WORK_SEAT', 600, 600));
    const k = componerKit(anchor, sillas, []);
    const seats = k.piezas.filter((p) => p.rol === 'WORK_SEAT');
    expect(new Set(seats.map((p) => p.dy)).size).toBe(1);             // un lado (conservador)
    expect(seats.every((p) => p.side === 'FRONT')).toBe(true);
  });
});

describe('P0.2c · DEFECTO B (DESPUÉS) · juntas topología canónica 4+4+1+1', () => {
  // ANTES (baseline): mesa cap 10 ancha (w=5000) → 7+3, sin cabeceras.
  // DESPUÉS (P0.2c): MEETING_TABLE → 4 lado A + 4 lado B + 1 cabecera A + 1 cabecera B.
  it('DESPUÉS: mesa cap 10 → 4 + 4 + 2 cabeceras (4+4+1+1)', () => {
    const anchor = mk('m', 'ANCHOR_MEETING', 5000, 1200, { user_capacity: 10 });
    const sillas = Array.from({ length: 10 }, (_, i) => mk('s' + i, 'MEETING_SEAT', 600, 600));
    const k = componerKit(anchor, sillas, []);
    const seats = k.piezas.filter((p) => p.rol === 'MEETING_SEAT');
    expect(seats.filter((p) => p.side === 'A').length).toBe(4);
    expect(seats.filter((p) => p.side === 'B').length).toBe(4);
    expect(seats.filter((p) => p.side === 'HEAD_A').length).toBe(1);
    expect(seats.filter((p) => p.side === 'HEAD_B').length).toBe(1);
  });
});

describe('P0.2c · DEFECTO C (DESPUÉS, BLOCK4) · nunca "falta superficie" si have ≥ need', () => {
  // ANTES (baseline): NO_SPACE con área 30 m² y necesidad ~8.6 m² decía igual
  // "necesita ~8.6 m² y tiene ~30 m²" (contradictorio). DESPUÉS: el motivo deriva
  // de la causa real (CONTIGUOUS_SPACE) y JAMÁS afirma falta de superficie.
  it('NO_SPACE con haveM2 > needM2 → motivo causal (no superficie), con evidencia', () => {
    const piezas = [mk('m', 'ANCHOR_MEETING', 2400, 1200, { functional_group_id: 'g', zone_id: 'JUNTAS' })];
    const areas = [{ nombre: 'JUNTAS', zone_id: 'JUNTAS', tipo: 'juntas', ancho: 6000, largo: 5000 }]; // 30 m²
    const sol = { unplaced: [{ anchorId: 'm', piezas: ['m'], invariante: 'NO_SPACE' }], unassigned: [] };
    const m = mensajeVendedor(areas, piezas, sol).motivos[0];
    expect(m.texto).not.toMatch(/necesita ~[\d.]+ m²/);       // no "falta superficie"
    expect(['CONTIGUOUS_SPACE', 'ASPECT_RATIO']).toContain(m.invariante);
    expect(m.evidencia.haveM2).toBeGreaterThan(m.evidencia.needM2);  // había superficie de sobra
  });
});

describe('P0.2c · DEFECTO D (DESPUÉS) · microcoherencia de presentación', () => {
  it('D1: el formatter NO antepone "• " (una sola viñeta con el <li>)', () => {
    const r = formatearMensajeVendedor({ hay_pendientes: true, pendientes: [{ rol: 'WORK_SEAT', n: 1, texto: '1 silla operativa' }], motivos: [], opciones: [] });
    expect(r.queNoCupo).toEqual(['1 silla operativa']);
    expect(r.queNoCupo[0].startsWith('•')).toBe(false);
  });
  it('D2: singular/plural correcto de "puesto" (nunca "1 puesto(s)")', async () => {
    const { resolverKits } = await import('../../supabase/functions/acomodar-espacio-recovery/kit-solver.js');
    const piezas = [
      mk('b', 'ANCHOR_WORKSTATION', 6000, 1200, { functional_group_id: 'g', zone_id: 'OP', user_capacity: 4 }),
      ...Array.from({ length: 4 }, (_, i) => mk('s' + i, 'WORK_SEAT', 600, 600, { functional_group_id: 'g', zone_id: 'OP' })),
      ...Array.from({ length: 4 }, (_, i) => mk('g' + i, 'UNDERDESK_STORAGE', 400, 500, { functional_group_id: 'g', zone_id: 'OP' })),
    ];
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 2000, largo: 2000 }];
    const sol = { unplaced: [{ anchorId: 'b', piezas: piezas.map((p) => p.id), invariante: 'OUT_OF_BOUNDS' }], unassigned: [] };
    const msg = mensajeVendedor(areas, piezas, sol, { resolver: resolverKits });
    const texto = msg.opciones.map((o) => o.texto).join(' | ');
    expect(texto).not.toMatch(/puesto\(s\)/);
    expect(texto).toMatch(/1 puesto\b/);   // singular correcto
  });
});
