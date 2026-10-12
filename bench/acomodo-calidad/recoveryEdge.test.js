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
    // GAP20: la circulación intra-kit ya NO marca CIRCULATION_TIGHT entre sillas del
    // mismo bench → el ganador PASS es PUBLICABLE end-to-end.
    expect((resp.layoutSpec.validation.issues || []).filter((i) => i.code === 'CIRCULATION_TIGHT').length).toBe(0);
    expect(resp.render_ready).toBe(true);
    expect(resp.status).toBe('PASS');
  });

  it('GAP29 · MEETING 10 (4+4+1+1): row FALLA, multi elige center PASS y el edge lo publica', () => {
    const areas = [{ nombre: 'JU', zone_id: 'JU', tipo: 'juntas', ancho: 6000, largo: 4000 }];
    const meeting10 = () => [
      mk('m', 'ANCHOR_MEETING', 3000, 1200, { user_capacity: 10, placement_profile: { topology: 'MEETING_TABLE', provenance: 'CATALOG', version: 'PP_V1' } }),
      ...Array.from({ length: 10 }, (_, i) => mk('s' + i, 'MEETING_SEAT', 600, 600)),
    ];
    const row = resolverKits(areas, meeting10());
    expect(juzgarSemantico(areas, row.piezas, row.colocacion).status).toBe('FAIL');  // default contra el muro
    const resp = construirRespuestaAcomodo(areas, meeting10());
    expect(resp.seleccion.ganador_orden).toBe('center');
    expect(resp.layoutSpec.validation.semantic_gate.sem_status).toBe('PASS');
    expect(resp.render_ready).toBe(true);
    // distribución canónica 4+4+1+1 en la salida real.
    const sides = {};
    for (const c of resp.layoutSpec.placements.filter((c) => c.side)) sides[c.side] = (sides[c.side] || 0) + 1;
    expect(sides).toEqual({ A: 4, B: 4, HEAD_A: 1, HEAD_B: 1 });
  });

  it('GAP34 · hard+semantic PASS pero QUALITY REVIEW → render_ready=false (fail-closed)', () => {
    // bench doble cara 8 con pasillos de acceso APRETADOS (<600 mm en ambos lados):
    // semántica PASS (acceso >0) pero calidad baja → quality_status REVIEW_REQUIRED.
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 7000, largo: 3000 }];
    const resp = construirRespuestaAcomodo(areas, df8());
    expect(resp.layoutSpec.validation.semantic_gate.sem_status).toBe('PASS');
    expect(resp.seleccion.ganador_eval.quality_status).toBe('REVIEW_REQUIRED');
    expect(resp.render_ready).toBe(false);
    expect(resp.status).toBe('QUALITY_REVIEW_REQUIRED');
  });

  it('GAP18 · topología UNKNOWN → REVIEW_REQUIRED → JAMÁS render_ready', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 4000, largo: 4000 }];
    const unk = [
      mk('b', 'ANCHOR_WORKSTATION', 3000, 1200, { user_capacity: 2 }),   // SIN placement_profile → UNKNOWN
      mk('s0', 'WORK_SEAT', 600, 600), mk('s1', 'WORK_SEAT', 600, 600),
    ];
    const resp = construirRespuestaAcomodo(areas, unk);
    expect(resp.layoutSpec.validation.semantic_gate.sem_status).toBe('REVIEW_REQUIRED');
    expect(resp.render_ready).toBe(false);
    expect(resp.status).toBe('NEEDS_SEMANTIC_REVIEW');
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
