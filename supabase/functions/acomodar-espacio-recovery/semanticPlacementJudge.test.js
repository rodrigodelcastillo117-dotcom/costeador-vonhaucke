import { describe, it, expect } from 'vitest';
import { juzgarSemantico } from './semanticPlacementJudge.js';
import { construirRespuestaAcomodo } from './recoveryPipeline.js';

// ============================================================================
//  RESCATE 2026-10-10 · E2E Torre Sur (3 rutas, payloads reales en e2e/evidence):
//  (a) KIT_FUNCTIONAL_RELATION_BROKEN ×2: las 2 CONCERTO (VISITOR_SEAT) en el escritorio
//      privado — el juez sólo aceptaba EXECUTIVE_SEAT. Regla de la casa: 2 visitas por privado.
//  (b) La respuesta no traía los CÓDIGOS semánticos (sólo conteos) → "NEEDS_SEMANTIC_REVIEW"
//      sin explicación (COT-P0-028).
//  Fuente vendorizada = lo que se desplegará; la edge activa sigue con la regla vieja.
// ============================================================================
const AREAS = [{ nombre: 'OFICINA CEO', tipo: 'privado', ancho: 4000, largo: 3200 }];
const PRIVADO = [
  { id: 'desk', w: 2100, d: 900, relation_role: 'ANCHOR_DESK', functional_group_id: 'g', user_capacity: 3 },
  { id: 'alpha', w: 600, d: 600, relation_role: 'EXECUTIVE_SEAT', functional_group_id: 'g' },
  { id: 'conc-1', w: 600, d: 600, relation_role: 'VISITOR_SEAT', functional_group_id: 'g' },
  { id: 'conc-2', w: 600, d: 600, relation_role: 'VISITOR_SEAT', functional_group_id: 'g' },
];

describe('juez semántico · privado con directiva + visitas', () => {
  it('RED→GREEN: las sillas de visita en el escritorio privado NO rompen la relación del kit', () => {
    const r = construirRespuestaAcomodo(AREAS, PRIVADO);
    const col = r.plan.colocacion;
    expect(col.map((c) => c.id).sort()).toEqual(['alpha', 'conc-1', 'conc-2', 'desk']);
    const sem = juzgarSemantico(AREAS, r.plan.piezas, col);
    const rotos = sem.issues.filter((i) => i.code === 'KIT_FUNCTIONAL_RELATION_BROKEN');
    expect(rotos, JSON.stringify(rotos)).toEqual([]);
    // una silla OPERATIVA en el escritorio privado sí sigue siendo relación rota
    const piezasMal = PRIVADO.map((p) => (p.id === 'conc-2' ? { ...p, relation_role: 'WORK_SEAT' } : p));
    const r2 = construirRespuestaAcomodo(AREAS, piezasMal);
    const sem2 = juzgarSemantico(AREAS, r2.plan.piezas, r2.plan.colocacion);
    expect(sem2.issues.some((i) => i.code === 'KIT_FUNCTIONAL_RELATION_BROKEN' && i.id === 'conc-2')).toBe(true);
  });
  it('COT-P0-028: la respuesta expone los CÓDIGOS semánticos del ganador (no sólo conteos)', () => {
    const r = construirRespuestaAcomodo(AREAS, [{ id: 'cre', w: 2100, d: 600, relation_role: 'ANCHOR_STORAGE' }]);   // topología desconocida → revisión
    const issues = r.layoutSpec.validation.semantic_issues;
    expect(Array.isArray(issues)).toBe(true);
    expect(issues.some((i) => i.code === 'SEMANTIC_PROFILE_UNKNOWN' && i.severity === 'review' && i.anchor === 'cre')).toBe(true);
  });
});
