import { describe, it, expect } from 'vitest';
import { maxDistanceToAnchor, PISO_ANCLA_MM } from './acomodoVinculo.js';
// El MISMO fixture por el CLIENTE (agregador completo) y por el SERVIDOR (invariantesRelacionales del
// edge recovery): deben concluir EXACTAMENTE lo mismo para el vínculo dependiente→ancla. FINAL-100 decisión 3.
import { evaluarInvariantesAcomodo } from './acomodoInvariantes.js';
import { invariantesRelacionales } from '../../supabase/functions/acomodar-espacio-recovery/recovery-core.js';

const REL = new Set(['DEPENDENT_DETACHED', 'DEPENDENT_UNASSIGNED']);
const AREA = (extra = {}) => ({ nombre: 'OPEN', zone_id: 'Z', ancho: 30000, largo: 16000, ...extra });
const norm = (arr) => arr.filter((i) => REL.has(i.code)).map((i) => `${i.id}|${i.code}`).sort();

function clienteRel(piezas, colocacion, areas = [AREA()]) {
  return norm(evaluarInvariantesAcomodo({ payload: { requested: piezas.length, areas, piezas }, plan: { colocacion } }).issues);
}
const servidorRel = (piezas, colocacion) => norm(invariantesRelacionales(piezas, colocacion));

// Afirma PARIDAD cliente↔servidor y, si se da, el veredicto esperado.
function paridad(piezas, colocacion, { areas = [AREA()], esperado } = {}) {
  const cli = clienteRel(piezas, colocacion, areas);
  const srv = servidorRel(piezas, colocacion);
  expect(srv, 'servidor debe concluir igual que el cliente').toEqual(cli);
  if (esperado !== undefined) expect(cli, 'veredicto').toEqual([...esperado].sort());
  return cli;
}

// Helpers de piezas. Ancla en (0,0). deskA rect = {0,0,1800,800}.
const DESK = (id, extra = {}) => ({ id, w: 1800, d: 800, relation_role: 'ANCHOR_DESK', zone_id: 'Z', ...extra });
const SEAT = (id, anc, extra = {}) => ({ id, w: 600, d: 600, relation_role: 'VISITOR_SEAT', anchor_instance_id: anc, zone_id: 'Z', ...extra });
const co = (id, x, y, area = 0) => ({ id, area, x, y, rot: 0 });

describe('maxDistanceToAnchor · distancia específica del programa con piso 1200', () => {
  it('ausente → 1200', () => expect(maxDistanceToAnchor({})).toBe(1200));
  it('no finita → 1200', () => expect(maxDistanceToAnchor({ max_anchor_distance_mm: 'x' })).toBe(1200));
  it('menor que 1200 (900) → 1200', () => expect(maxDistanceToAnchor({ max_anchor_distance_mm: 900 })).toBe(1200));
  it('exactamente 1200 → 1200', () => expect(maxDistanceToAnchor({ max_anchor_distance_mm: 1200 })).toBe(1200));
  it('1400 → 1400', () => expect(maxDistanceToAnchor({ max_anchor_distance_mm: 1400 })).toBe(1400));
  it('2600 (silla de visita) → 2600', () => expect(maxDistanceToAnchor({ max_anchor_distance_mm: 2600 })).toBe(2600));
  it('3500 (credenza) → 3500', () => expect(maxDistanceToAnchor({ max_anchor_distance_mm: 3500 })).toBe(3500));
  it('PISO = 1200', () => expect(PISO_ANCLA_MM).toBe(1200));
});

describe('PARIDAD cliente↔servidor · vínculo dependiente→ancla (todos los casos de Dirección)', () => {
  it('ancla CORRECTA (visita a 2600 exacto de su escritorio) → PASS, sin issues', () => {
    paridad([DESK('dA'), SEAT('v', 'dA', { max_anchor_distance_mm: 2600 })],
      [co('dA', 0, 0), co('v', 0, 3400)], { esperado: [] }); // dy = 3400-800 = 2600
  });

  it('ancla EQUIVOCADA (declarada a dA, pegada a dB lejos de dA) → DETACHED', () => {
    paridad([DESK('dA'), DESK('dB'), SEAT('v', 'dA', { max_anchor_distance_mm: 2600 })],
      [co('dA', 0, 0), co('dB', 10000, 0), co('v', 10000, 1000)], { esperado: ['v|DEPENDENT_DETACHED'] });
  });

  it('ancla AUSENTE (sin anchor_instance_id ni grupo) → UNASSIGNED', () => {
    paridad([DESK('dA'), SEAT('v', undefined)],
      [co('dA', 0, 0), co('v', 0, 1500)], { esperado: ['v|DEPENDENT_UNASSIGNED'] });
  });

  it("ancla NO COLOCADA (declara dX, no está en la colocación) → DETACHED 'ancla no colocada'", () => {
    paridad([DESK('dA'), DESK('dX'), SEAT('v', 'dX', { max_anchor_distance_mm: 2600 })],
      [co('dA', 0, 0), co('v', 0, 1500)], { esperado: ['v|DEPENDENT_DETACHED'] });
  });

  it('OTRA HABITACIÓN (ancla en área 0, dependiente en área 1) → DETACHED', () => {
    paridad([DESK('dA'), SEAT('v', 'dA', { max_anchor_distance_mm: 2600 })],
      [co('dA', 0, 0, 0), co('v', 0, 0, 1)], { areas: [AREA(), AREA({ nombre: 'OPEN2' })], esperado: ['v|DEPENDENT_DETACHED'] });
  });

  it('FALLBACK 1199 (sin max declarado) → PASS', () => {
    paridad([DESK('dA'), { id: 'w', w: 600, d: 600, relation_role: 'WORK_SEAT', anchor_instance_id: 'dA', zone_id: 'Z' }],
      [co('dA', 0, 0), co('w', 0, 1999)], { esperado: [] }); // dy = 1999-800 = 1199
  });
  it('FALLBACK 1200 exacto → PASS', () => {
    paridad([DESK('dA'), { id: 'w', w: 600, d: 600, relation_role: 'WORK_SEAT', anchor_instance_id: 'dA', zone_id: 'Z' }],
      [co('dA', 0, 0), co('w', 0, 2000)], { esperado: [] }); // dy = 1200
  });
  it('FALLBACK 1201 → DETACHED', () => {
    paridad([DESK('dA'), { id: 'w', w: 600, d: 600, relation_role: 'WORK_SEAT', anchor_instance_id: 'dA', zone_id: 'Z' }],
      [co('dA', 0, 0), co('w', 0, 2001)], { esperado: ['w|DEPENDENT_DETACHED'] }); // dy = 1201
  });

  it('LÍMITE ESPECÍFICO 2600 exacto (silla de visita) → PASS', () => {
    paridad([DESK('dA'), SEAT('v', 'dA', { max_anchor_distance_mm: 2600 })],
      [co('dA', 0, 0), co('v', 0, 3400)], { esperado: [] }); // dy = 2600
  });
  it('2601 (silla de visita) → DETACHED', () => {
    paridad([DESK('dA'), SEAT('v', 'dA', { max_anchor_distance_mm: 2600 })],
      [co('dA', 0, 0), co('v', 0, 3401)], { esperado: ['v|DEPENDENT_DETACHED'] }); // dy = 2601
  });

  it('LÍMITE ESPECÍFICO 3500 exacto (credenza SUPPORT_STORAGE CON ancla) → PASS', () => {
    paridad([DESK('dA'), { id: 'cr', w: 1200, d: 500, relation_role: 'SUPPORT_STORAGE', anchor_instance_id: 'dA', max_anchor_distance_mm: 3500, zone_id: 'Z' }],
      [co('dA', 0, 0), co('cr', 0, 4300)], { esperado: [] }); // dy = 4300-800 = 3500
  });
  it('3501 (credenza) → DETACHED', () => {
    paridad([DESK('dA'), { id: 'cr', w: 1200, d: 500, relation_role: 'SUPPORT_STORAGE', anchor_instance_id: 'dA', max_anchor_distance_mm: 3500, zone_id: 'Z' }],
      [co('dA', 0, 0), co('cr', 0, 4301)], { esperado: ['cr|DEPENDENT_DETACHED'] }); // dy = 3501
  });

  it('MÚLTIPLES ANCLAS: cada silla a SU escritorio → PASS; la cruzada → DETACHED', () => {
    // dA en x[0,1800], dB en x[10000,11800]. v1→dA cerca de dA; v2→dB cerca de dB (PASS).
    paridad([DESK('dA'), DESK('dB'), SEAT('v1', 'dA', { max_anchor_distance_mm: 2600 }), SEAT('v2', 'dB', { max_anchor_distance_mm: 2600 })],
      [co('dA', 0, 0), co('dB', 10000, 0), co('v1', 0, 3000), co('v2', 10000, 3000)], { esperado: [] }); // ambas dy=2200
    paridad([DESK('dA'), DESK('dB'), SEAT('v1', 'dA', { max_anchor_distance_mm: 2600 }), SEAT('v2', 'dB', { max_anchor_distance_mm: 2600 })],
      [co('dA', 0, 0), co('dB', 10000, 0), co('v1', 10000, 3000), co('v2', 10000, 3000)],
      { esperado: ['v1|DEPENDENT_DETACHED'] }); // v1 lejísimos de dA
  });

  it('REORDER de piezas/colocación NO cambia el veredicto (paridad en ambos órdenes)', () => {
    const piezas = [DESK('dA'), DESK('dB'), SEAT('v', 'dA', { max_anchor_distance_mm: 2600 })];
    const coloc = [co('dA', 0, 0), co('dB', 10000, 0), co('v', 10000, 1000)]; // v lejos de dA → DETACHED
    const a = paridad(piezas, coloc, { esperado: ['v|DEPENDENT_DETACHED'] });
    const b = paridad([...piezas].reverse(), [...coloc].reverse(), { esperado: ['v|DEPENDENT_DETACHED'] });
    expect(b).toEqual(a);
  });

  it('SUPPORT_STORAGE SUELTA (sin ancla ni grupo) → EXENTA; silla suelta → UNASSIGNED', () => {
    paridad(
      [{ id: 'cr', w: 1200, d: 500, relation_role: 'SUPPORT_STORAGE', zone_id: 'Z' },
       { id: 'w', w: 600, d: 600, relation_role: 'WORK_SEAT', zone_id: 'Z' }],
      [co('cr', 0, 0), co('w', 5000, 5000)],
      { esperado: ['w|DEPENDENT_UNASSIGNED'] }); // credenza suelta exenta; silla suelta sin dueño
  });
});
