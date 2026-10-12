import { describe, it, expect } from 'vitest';
import { construirCasos } from '../acomodo/casos.js';
import { resolverKits } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';
import { mensajeVendedor } from '../../supabase/functions/acomodar-espacio-recovery/opciones.js';
import { juzgar } from '../acomodo/judge.js';

// ============================================================================
//  P0.2c · BLOCK 4 · causalidad REAL del DEFECTO C. El "por qué" deriva del
//  invariante limitante; PROHIBIDO "falta superficie" cuando hay superficie de sobra.
// ============================================================================
const mk = (id, rol, w, d, extra = {}) => ({ id, relation_role: rol, w, d, functional_group_id: 'g', zone_id: 'OP', ...extra });
const ws = (cap, w) => [mk('b', 'ANCHOR_WORKSTATION', w, 1200, { user_capacity: cap }), ...Array.from({ length: cap }, (_, i) => mk('s' + i, 'WORK_SEAT', 600, 600))];

describe('P0.2c · BLOCK4 · causa real por el solver', () => {
  it('módulo más ANCHO que la zona (pero sobra superficie total) → ASPECT_RATIO, no superficie', () => {
    const piezas = ws(4, 6000);                                 // huella 6000×1800 = 10.8 m²
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 5000, largo: 4000 }]; // 20 m², pero 6000>5000
    const sol = resolverKits(areas, piezas);
    expect(sol.unplaced.length).toBeGreaterThan(0);
    const m = mensajeVendedor(areas, sol.piezas, sol, { resolver: resolverKits }).motivos[0];
    expect(m.invariante).toBe('ASPECT_RATIO');
    expect(m.texto).toMatch(/forma|ancho|fondo/i);
    expect(m.texto).not.toMatch(/necesita ~[\d.]+ m²/);         // nunca "falta superficie"
    expect(m.evidencia.haveM2).toBeGreaterThanOrEqual(m.evidencia.needM2);
  });

  it('puerta que tapa el frente → causa no-superficie', () => {
    const piezas = ws(4, 6000);
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 6500, largo: 1900, puertas: [{ x: 0, y: 0, ancho: 1800 }] }];
    const sol = resolverKits(areas, piezas);
    const m = mensajeVendedor(areas, sol.piezas, sol, { resolver: resolverKits }).motivos[0];
    expect(['DOOR', 'ASPECT_RATIO', 'CONTIGUOUS_SPACE']).toContain(m.invariante);  // nunca NO_SPACE falso
    expect(m.texto).not.toMatch(/necesita ~[\d.]+ m²/);
  });

  it('SWEEP: ningún motivo afirma "falta superficie" cuando haveM2 ≥ needM2 (todos los casos)', () => {
    for (const c of construirCasos()) {
      const sol = resolverKits(c.areas, c.piezas);
      const j = juzgar(c.areas, sol.piezas, sol.colocacion);
      if (j.status === 'PASS') continue;
      const msg = mensajeVendedor(c.areas, sol.piezas, sol, { resolver: resolverKits });
      for (const m of msg.motivos) {
        if (!m.evidencia) continue;
        if (m.evidencia.haveM2 >= m.evidencia.needM2) {
          expect(m.texto, `${c.nombre} / ${m.invariante}`).not.toMatch(/necesita ~[\d.]+ m²/);
        }
      }
    }
  });
});
