import { describe, it, expect, vi } from 'vitest';
import { resolverAcomodo } from './acomodoOrquestador.js';
import { evaluarInvariantesAcomodo } from './acomodoInvariantes.js';
import { construirPayloadAcomodo } from './acomodoPayload.js';

// ============================================================================
//  P0.2 · GOLDEN ADVERSARIAL (obj 13/14). Escena exigida por la auditoría:
//  2 áreas operativas · 2 anclas distintas · WIN + gavetas · 1 sala de juntas ·
//  1 privado · 1 puerta · 1 obstáculo · 1 pieza movida a mano · reload.
//  Verifica: cero duplicados, cero fuera de bounds, cero cruces de puerta/obstáculo,
//  dependientes en la zona de SU ancla, cantidades exactas (gavetas van bajo
//  escritorio → NO ocupan piso), y que el reload CONSERVA lo manual.
//  Determinista, sin edge vivo, sin deploy (CERTIFICADO AHORA).
// ============================================================================

// FloorSpec (metros). idx: 0=OPERATIVA A, 1=OPERATIVA B (puerta+obstáculo),
// 2=JUNTAS, 3=PRIVADO.
const AREAS_M = [
  { nombre: 'OPERATIVA A', tipo: 'open', ancho: 8, largo: 4 },
  { nombre: 'OPERATIVA B', tipo: 'open', ancho: 8, largo: 4,
    puertas: [{ x: 0, y: 0, ancho: 0.9 }],
    obstaculos: [{ x: 7, y: 3, w: 0.5, h: 0.5, tipo: 'columna' }] },
  { nombre: 'JUNTAS', tipo: 'juntas', ancho: 5, largo: 4 },
  { nombre: 'PRIVADO', tipo: 'privado', ancho: 4, largo: 4 },
];

// Programa CONFIRMADO. Gavetas incluidas a propósito: deben quedar fuera del piso.
const PARTIDAS = [
  { id: 'a-op', nombre: 'Bench operativo', cantidad: 1, w: 6000, d: 1200, relation_role: 'ANCHOR_WORKSTATION', functional_group_id: 'gA', requirement_id: 'reqA', zone_id: 'OPERATIVA A' },
  { id: 'a-win', nombre: 'Silla operativa WIN', cantidad: 2, relation_role: 'WORK_SEAT', functional_group_id: 'gA', zone_id: 'OPERATIVA A' },
  { id: 'a-gav', nombre: 'Gaveta pedestal', cantidad: 2, relation_role: 'UNDERDESK_STORAGE', functional_group_id: 'gA' },
  { id: 'b-op', nombre: 'Bench operativo', cantidad: 1, w: 6000, d: 1200, relation_role: 'ANCHOR_WORKSTATION', functional_group_id: 'gB', requirement_id: 'reqB', zone_id: 'OPERATIVA B' },
  { id: 'b-win', nombre: 'Silla operativa WIN', cantidad: 2, relation_role: 'WORK_SEAT', functional_group_id: 'gB', zone_id: 'OPERATIVA B' },
  { id: 'j-mesa', nombre: 'Mesa de juntas', cantidad: 1, w: 2400, d: 1200, relation_role: 'ANCHOR_MEETING', functional_group_id: 'gJ', zone_id: 'JUNTAS' },
  // 'Silla SONATA' (no la palabra "juntas" en el nombre): tipoDe la clasifica
  // como asiento 600×600, no como mesa. El rol de junta vive en relation_role.
  { id: 'j-silla', nombre: 'Silla SONATA', cantidad: 2, relation_role: 'MEETING_SEAT', functional_group_id: 'gJ', zone_id: 'JUNTAS' },
  { id: 'p-esc', nombre: 'Escritorio privado dirección', cantidad: 1, w: 1800, d: 800, relation_role: 'ANCHOR_DESK', functional_group_id: 'gP', zone_id: 'PRIVADO' },
  { id: 'p-silla', nombre: 'Silla directiva ALPHA', cantidad: 1, relation_role: 'EXECUTIVE_SEAT', functional_group_id: 'gP', zone_id: 'PRIVADO' },
];

// Plan CORRECTO (mm). a-win-2 movida a mano por el usuario.
const planCorrecto = () => ({
  colocacion: [
    { id: 'a-op-1', area: 0, x: 0, y: 0, rot: 0 },
    { id: 'a-win-1', area: 0, x: 0, y: 1500, rot: 0 },
    { id: 'a-win-2', area: 0, x: 2000, y: 1500, rot: 0, manual: true },
    { id: 'b-op-1', area: 1, x: 0, y: 1500, rot: 0 },            // libra el barrido de puerta (y≥1500)
    { id: 'b-win-1', area: 1, x: 0, y: 3000, rot: 0 },
    { id: 'b-win-2', area: 1, x: 1000, y: 3000, rot: 0 },        // libra obstáculo en x7000
    { id: 'j-mesa-1', area: 2, x: 0, y: 0, rot: 0 },
    { id: 'j-silla-1', area: 2, x: 0, y: 1500, rot: 0 },
    { id: 'j-silla-2', area: 2, x: 700, y: 1500, rot: 0 },
    { id: 'p-esc-1', area: 3, x: 0, y: 0, rot: 0 },
    { id: 'p-silla-1', area: 3, x: 0, y: 1000, rot: 0 },
  ],
  render_ready: true,
  layoutSpec: { status: 'PASS', validation: { render_ready: true } },
});

describe('GOLDEN adversarial P0.2 · plan correcto', () => {
  it('cantidades exactas: gavetas NO ocupan piso (van bajo escritorio)', () => {
    const payload = construirPayloadAcomodo({ partidas: PARTIDAS, areasM: AREAS_M });
    expect(payload.ok).toBe(true);
    const ids = payload.piezas.map((p) => p.id);
    expect(ids.some((id) => id.startsWith('a-gav'))).toBe(false);  // gavetas excluidas
    expect(payload.requested).toBe(11);                             // 2 benches+4 WIN+1 mesa+2 sillas+1 esc+1 silla
  });

  it('PASS end-to-end: cero fantasmas/duplicados, dentro de bounds, dependientes en su zona', async () => {
    const solve = vi.fn(async () => planCorrecto());
    const r = await resolverAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, solve });
    expect(r.status).toBe('PASS');
    expect(r.render_ready).toBe(true);
    expect(r.evaluacion.placed).toBe(11);
    expect(r.evaluacion.ghosts).toEqual([]);
    expect(r.evaluacion.duplicates).toEqual([]);
    expect(r.evaluacion.unplaced).toEqual([]);
    expect(r.evaluacion.issues).toHaveLength(0);
    expect(r.trace).toHaveLength(1);
  });

  it('reload (obj 12 + 9): conserva lo movido a mano, NO re-resuelve', async () => {
    const solve1 = vi.fn(async () => planCorrecto());
    const primera = await resolverAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, solve: solve1 });
    // "reload": el plan persistido (con hashes + manual) regresa como planGuardado.
    const planGuardado = primera.plan;
    const solveQueMueve = vi.fn(async () => ({ ...planCorrecto(),
      colocacion: planCorrecto().colocacion.map((c) => (c.id === 'a-win-2' ? { ...c, x: 9999, y: 9999 } : c)) }));
    const segunda = await resolverAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, solve: solveQueMueve, planGuardado });
    expect(segunda.conservadoManual).toBe(true);
    expect(solveQueMueve).not.toHaveBeenCalled();
    const aWin2 = segunda.plan.colocacion.find((c) => c.id === 'a-win-2');
    expect(aWin2.x).toBe(2000);   // intacta
    expect(aWin2.y).toBe(1500);
  });
});

describe('GOLDEN adversarial P0.2 · variantes que DEBEN fallar', () => {
  const payload = () => construirPayloadAcomodo({ partidas: PARTIDAS, areasM: AREAS_M });
  const evalPlan = (mut) => {
    const plan = planCorrecto(); mut(plan); return evaluarInvariantesAcomodo({ payload: payload(), plan });
  };

  it('duplicado → FAIL', () => {
    const r = evalPlan((p) => p.colocacion.push({ id: 'a-win-1', area: 0, x: 3000, y: 1500 }));
    expect(r.status).toBe('FAIL');
    expect(r.duplicates).toContain('a-win-1');
  });
  it('fuera de bounds → FAIL', () => {
    const r = evalPlan((p) => { p.colocacion.find((c) => c.id === 'b-op-1').area = 3; });
    expect(r.status).toBe('FAIL');
    expect(r.issues.map((i) => i.code)).toContain('OUT_OF_BOUNDS');   // bench 6000 en privado 4000
  });
  it('cruza puerta → FAIL', () => {
    const r = evalPlan((p) => { p.colocacion.find((c) => c.id === 'b-win-1').y = 0; });  // cae en el barrido de la puerta
    expect(r.status).toBe('FAIL');
    expect(r.issues.map((i) => i.code)).toContain('BLOCKS_DOOR');
  });
  it('choca obstáculo → FAIL', () => {
    const r = evalPlan((p) => { const c = p.colocacion.find((x) => x.id === 'b-win-2'); c.x = 7000; c.y = 3000; });
    expect(r.status).toBe('FAIL');
    expect(r.issues.map((i) => i.code)).toContain('HITS_OBSTACLE');
  });
  it('dependiente fuera de la zona de su ancla → FAIL', () => {
    const r = evalPlan((p) => { p.colocacion.find((c) => c.id === 'a-win-1').area = 1; });  // silla de A en área B
    expect(r.status).toBe('FAIL');
    expect(r.issues.map((i) => i.code)).toContain('DEPENDENT_WRONG_ZONE');
  });
  it('pieza faltante → PARTIAL (nunca PASS)', () => {
    const r = evalPlan((p) => { p.colocacion = p.colocacion.filter((c) => c.id !== 'p-silla-1'); });
    expect(r.status).toBe('PARTIAL');
    expect(r.render_ready).toBe(false);
    expect(r.unplaced).toEqual(['p-silla-1']);
  });
});
