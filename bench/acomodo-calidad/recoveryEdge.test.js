import { describe, it, expect } from 'vitest';
import { construirRespuestaAcomodo } from '../../supabase/functions/acomodar-espacio-recovery/recoveryPipeline.js';
import { resolverKits } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';
import { juzgarSemantico } from '../../supabase/functions/acomodar-espacio-recovery/semanticPlacementJudge.js';

// ============================================================================
//  P0.2c · BLOCK 5 · EDGE-LEVEL (sin deploy). Certifica que el GANADOR del pipeline
//  multi-candidato es el que SALE en layoutSpec/render_ready/status, y que el gate
//  semántico sobre el ganador bloquea render_ready cuando corresponde.
// ============================================================================
const mk = (id, rol, w, d, extra = {}) => ({ id, relation_role: rol, w, d, functional_group_id: 'g', zone_id: 'OP', ...extra });
const df8 = () => [
  mk('b', 'ANCHOR_WORKSTATION', 6000, 1400, { user_capacity: 8, placement_profile: { topology: 'DOUBLE_FACE', provenance: 'USER_CONFIRMED', version: 'PP_V1' } }),
  ...Array.from({ length: 8 }, (_, i) => mk('s' + i, 'WORK_SEAT', 600, 600)),
];

describe('P0.2c · BLOCK 5 · edge emite el GANADOR (center/PASS), no el row/FAIL', () => {
  it('el default row FALLA semánticamente, pero el edge devuelve la colocación center PASS', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 7000, largo: 4000 }];
    // Referencia: el solver determinista (row) por sí solo falla el juez semántico.
    const row = resolverKits(areas, df8());
    expect(juzgarSemantico(areas, row.piezas, row.colocacion).status).toBe('FAIL');

    // El edge usa el pipeline multi → debe salir el ganador 'center' con PASS.
    const resp = construirRespuestaAcomodo(areas, df8());
    expect(resp.seleccion.ganador_orden).toBe('center');
    expect(resp.layoutSpec.seleccion.ganador_orden).toBe('center');
    expect(resp.layoutSpec.validation.semantic_gate.sem_status).toBe('PASS');
    expect(resp.layoutSpec.validation.semantic_gate.semFail).toBe(0);

    // Lo que SALE en layoutSpec.placements ES el ganador (semantic PASS), no el row.
    const sem = juzgarSemantico(areas, resp.plan.piezas, resp.layoutSpec.placements);
    expect(sem.status).toBe('PASS');
    expect(resp.metodo).toBe('kit-solver-multi-v1');
    // (render_ready depende además del validador duro de recovery-core, que aplica
    // circulación entre asientos del propio bench; eso es pre-existente y ajeno a BLOCK5.)
  });

  it('si NINGÚN candidato logra PASS semántico, render_ready=false y status NEEDS_SEMANTIC_REVIEW', () => {
    // Cuarto tan alto como el bench doble cara (2600 mm): cabe completo, pero ambas
    // filas de sillas quedan contra los muros en TODA colocación → todos los candidatos
    // quedan en FAIL semántico. El gate bloquea render_ready.
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 6200, largo: 2600 }];
    const resp = construirRespuestaAcomodo(areas, df8());
    expect(resp.layoutSpec.placed).toBe(9);                    // cabe completo…
    expect(resp.layoutSpec.validation.semantic_gate.semFail).toBeGreaterThan(0); // …pero sin acceso
    expect(resp.seleccion.metrics.candidates_evaluated).toBe(5);  // exploró TODOS (ninguno PASS)
    expect(resp.render_ready).toBe(false);
    expect(resp.status).toBe('NEEDS_SEMANTIC_REVIEW');
  });

  it('caso limpio (escritorio privado): edge PASS, render_ready=true, corte adaptativo en #0', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'privado', ancho: 4000, largo: 4000 }];
    const piezas = [
      mk('b', 'ANCHOR_DESK', 1600, 800, { user_capacity: 1, placement_profile: { topology: 'DESK', provenance: 'CATALOG', version: 'PP_V1' } }),
      mk('s0', 'EXECUTIVE_SEAT', 600, 600),
    ];
    const resp = construirRespuestaAcomodo(areas, piezas);
    expect(resp.seleccion.ganador_orden).toBe('row');          // default ya es óptimo
    expect(resp.render_ready).toBe(true);
    expect(resp.status).toBe('PASS');
    expect(resp.seleccion.metrics.candidates_evaluated).toBe(1);  // corte adaptativo: no explora de más
  });
});
