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

describe('P0.2c · DEFECTO A (baseline) · workstation = todas las sillas de UN lado', () => {
  it('BASELINE: bench cap 8 → las 8 sillas caen en un solo lado (dy único)', () => {
    const anchor = mk('b', 'ANCHOR_WORKSTATION', 12000, 1200, { user_capacity: 8 });
    const sillas = Array.from({ length: 8 }, (_, i) => mk('s' + i, 'WORK_SEAT', 600, 600));
    const k = componerKit(anchor, sillas, []);
    const seats = k.piezas.filter((p) => p.rol === 'WORK_SEAT');
    const ladosDistintos = new Set(seats.map((p) => p.dy)).size;
    // DEFECTO: 1 solo lado. REQUERIDO P0.2c (DOUBLE_FACE confirmado): 2 lados (4+4).
    expect(seats.length).toBe(8);
    expect(ladosDistintos).toBe(1);          // ← baseline defectuoso (debería ser 2)
  });
});

describe('P0.2c · DEFECTO B (baseline) · juntas no conoce topología canónica', () => {
  it('BASELINE: mesa cap 10 ancha (w=5000) → 7+3, sin cabeceras (no 4+4+1+1)', () => {
    const anchor = mk('m', 'ANCHOR_MEETING', 5000, 1200, { user_capacity: 10 });
    const sillas = Array.from({ length: 10 }, (_, i) => mk('s' + i, 'MEETING_SEAT', 600, 600));
    const k = componerKit(anchor, sillas, []);
    const seats = k.piezas.filter((p) => p.rol === 'MEETING_SEAT');
    const SEAT = 600, d = 1200;
    const top = seats.filter((p) => p.dy < SEAT).length;
    const bottom = seats.filter((p) => p.dy >= SEAT + d).length;
    const lados = seats.length - top - bottom;
    // DEFECTO: 7+3, 0 cabeceras. REQUERIDO P0.2c (MEETING_TABLE): 4+4+1+1.
    expect([top, bottom, lados]).toEqual([7, 3, 0]);   // ← baseline defectuoso
  });
});

describe('P0.2c · DEFECTO C (baseline) · explicación de m² causalmente contradictoria', () => {
  it('BASELINE: NO_SPACE con haveM2 > needM2 todavía produce explicación de superficie', () => {
    // Mesa 2400×1200 (huella ~8.6 m²) "no cupo" en un área de 30 m² → el motivo
    // menciona m² aunque hay superficie de sobra. Eso es lo que P0.2c debe eliminar.
    const piezas = [mk('m', 'ANCHOR_MEETING', 2400, 1200, { functional_group_id: 'g', zone_id: 'JUNTAS' })];
    const areas = [{ nombre: 'JUNTAS', zone_id: 'JUNTAS', tipo: 'juntas', ancho: 6000, largo: 5000 }]; // 30 m²
    const sol = { unplaced: [{ anchorId: 'm', piezas: ['m'], invariante: 'NO_SPACE' }], unassigned: [] };
    const msg = mensajeVendedor(areas, piezas, sol);      // sin resolver: sólo el motivo
    const motivo = (msg.motivos[0] || {}).texto || '';
    // DEFECTO: el texto habla de m² (necesita ~8.6 / tiene ~30), contradictorio.
    expect(motivo).toMatch(/m²/);
    const need = Number((motivo.match(/necesita ~([\d.]+)/) || [])[1]);
    const have = Number((motivo.match(/tiene ~([\d.]+)/) || [])[1]);
    expect(need).toBeLessThan(have);   // ← contradicción que P0.2c debe prohibir
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
