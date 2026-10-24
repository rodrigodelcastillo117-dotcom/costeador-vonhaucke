import { describe, it, expect } from 'vitest';
import { evaluarInvariantesAcomodo, derivarValidez } from './acomodoInvariantes.js';
// PARIDAD: el MISMO contrato del servidor que replicamos (recovery-core.js:156-172).
import { invariantesRelacionales } from '../../supabase/functions/acomodar-espacio-recovery/recovery-core.js';

// Payload canónico (mm) — dos áreas, un grupo operativo (ancla+silla) y una junta.
function payloadBase() {
  return {
    requested: 3,
    areas: [
      { nombre: 'OPERATIVA', ancho: 6000, largo: 3000 },
      { nombre: 'JUNTAS', ancho: 4000, largo: 3000 },
    ],
    piezas: [
      { id: 'a-1', w: 6000, d: 1200, functional_group_id: 'g1', relation_role: 'ANCHOR_WORKSTATION' },
      { id: 's-1', w: 600, d: 600, functional_group_id: 'g1', relation_role: 'WORK_SEAT' },
      { id: 'm-1', w: 1200, d: 1200, functional_group_id: 'g2', relation_role: 'ANCHOR_MEETING' },
    ],
  };
}
const planPASS = () => ({
  colocacion: [
    { id: 'a-1', area: 0, x: 0, y: 0, rot: 0 },
    { id: 's-1', area: 0, x: 0, y: 1500, rot: 0 },
    { id: 'm-1', area: 1, x: 0, y: 0, rot: 0 },
  ],
  render_ready: true,
  layoutSpec: { status: 'PASS', validation: { render_ready: true } },
});

const codes = (r) => r.issues.map((i) => i.code);

describe('acomodoInvariantes · PASS feliz (obj 11)', () => {
  it('todo colocado, en bounds, sin solape → PASS + render_ready', () => {
    const r = evaluarInvariantesAcomodo({ payload: payloadBase(), plan: planPASS() });
    expect(r.status).toBe('PASS');
    expect(r.render_ready).toBe(true);
    expect(r.placed).toBe(3);
    expect(r.unplaced).toEqual([]);
    expect(r.invariant_ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });
});

describe('acomodoInvariantes · PARTIAL nunca es PASS (obj 7)', () => {
  it('una pieza sin colocar → PARTIAL aunque el edge diga PASS', () => {
    const plan = planPASS();
    plan.colocacion = plan.colocacion.filter((c) => c.id !== 'm-1');  // falta la junta
    const r = evaluarInvariantesAcomodo({ payload: payloadBase(), plan });
    expect(r.status).toBe('PARTIAL');
    expect(r.render_ready).toBe(false);
    expect(r.unplaced).toEqual(['m-1']);
  });
});

describe('acomodoInvariantes · cross-check plan↔partidas (obj 14)', () => {
  it('fantasma: colocación con id desconocido → FAIL', () => {
    const plan = planPASS();
    plan.colocacion.push({ id: 'fantasma-9', area: 0, x: 100, y: 100, rot: 0 });
    const r = evaluarInvariantesAcomodo({ payload: payloadBase(), plan });
    expect(r.status).toBe('FAIL');
    expect(r.ghosts).toContain('fantasma-9');
    expect(codes(r)).toContain('GHOST_PLACEMENT');
  });
  it('duplicado: misma pieza colocada dos veces → FAIL', () => {
    const plan = planPASS();
    plan.colocacion.push({ id: 's-1', area: 0, x: 2000, y: 0, rot: 0 });
    const r = evaluarInvariantesAcomodo({ payload: payloadBase(), plan });
    expect(r.duplicates).toContain('s-1');
    expect(r.status).toBe('FAIL');
  });
  it('cobertura rota: requested != placed + unplaced → PLACEMENT_INVARIANT_BROKEN', () => {
    const payload = payloadBase(); payload.requested = 5; // mentira de cobertura
    const r = evaluarInvariantesAcomodo({ payload, plan: planPASS() });
    expect(codes(r)).toContain('PLACEMENT_INVARIANT_BROKEN');
    expect(r.invariant_ok).toBe(false);
    expect(r.status).toBe('FAIL');
  });
});

describe('acomodoInvariantes · geometría dura', () => {
  it('fuera de bounds → OUT_OF_BOUNDS FAIL', () => {
    const plan = planPASS();
    plan.colocacion = [{ id: 'a-1', area: 1, x: 0, y: 0, rot: 0 }, { id: 's-1', area: 1, x: 0, y: 1500 }, { id: 'm-1', area: 1, x: 0, y: 2500 }];
    // a-1 mide 6000 de ancho en un área de 4000 → se sale
    const r = evaluarInvariantesAcomodo({ payload: payloadBase(), plan });
    expect(codes(r)).toContain('OUT_OF_BOUNDS');
    expect(r.status).toBe('FAIL');
  });
  it('solape en la misma área → OVERLAP FAIL', () => {
    const plan = planPASS();
    plan.colocacion = [{ id: 'a-1', area: 0, x: 0, y: 0 }, { id: 's-1', area: 0, x: 0, y: 0 }, { id: 'm-1', area: 1, x: 0, y: 0 }];
    const r = evaluarInvariantesAcomodo({ payload: payloadBase(), plan });
    expect(codes(r)).toContain('OVERLAP');
    expect(r.status).toBe('FAIL');
  });
  it('choca con obstáculo → HITS_OBSTACLE FAIL', () => {
    const payload = payloadBase();
    payload.areas[0].obstaculos = [{ x: 0, y: 1400, w: 1000, h: 1000, tipo: 'columna' }];
    const r = evaluarInvariantesAcomodo({ payload, plan: planPASS() }); // s-1 en (0,1500)
    expect(codes(r)).toContain('HITS_OBSTACLE');
    expect(r.status).toBe('FAIL');
  });
  it('bloquea puerta → BLOCKS_DOOR FAIL', () => {
    const payload = payloadBase();
    payload.areas[0].puertas = [{ x: 0, y: 1400, ancho: 900 }];
    const r = evaluarInvariantesAcomodo({ payload, plan: planPASS() }); // s-1 en (0,1500) cae en el barrido
    expect(codes(r)).toContain('BLOCKS_DOOR');
    expect(r.status).toBe('FAIL');
  });
});

describe('acomodoInvariantes · multi-zona (obj 6/14)', () => {
  it('dependiente en zona distinta a su ancla → DEPENDENT_WRONG_ZONE FAIL', () => {
    const plan = planPASS();
    plan.colocacion = [{ id: 'a-1', area: 0, x: 0, y: 0 }, { id: 's-1', area: 1, x: 0, y: 0 }, { id: 'm-1', area: 1, x: 2000, y: 0 }];
    const r = evaluarInvariantesAcomodo({ payload: payloadBase(), plan });
    expect(codes(r)).toContain('DEPENDENT_WRONG_ZONE');
    expect(r.status).toBe('FAIL');
  });
});

describe('acomodoInvariantes · zonas/anclas por IDs estables (audit G)', () => {
  // DOS zonas operativas con el MISMO modelo; identidad por anchor_instance_id/zone_id.
  const payloadDual = () => ({
    requested: 4,
    areas: [
      { nombre: 'OP A', zone_id: 'OP A', ancho: 8000, largo: 4000 },
      { nombre: 'OP B', zone_id: 'OP B', ancho: 8000, largo: 4000 },
    ],
    piezas: [
      { id: 'opA-1', w: 6000, d: 1200, relation_role: 'ANCHOR_WORKSTATION', anchor_instance_id: 'instA', functional_group_id: 'gA', zone_id: 'OP A' },
      { id: 'winA-1', w: 600, d: 600, relation_role: 'WORK_SEAT', anchor_instance_id: 'instA', functional_group_id: 'gA', zone_id: 'OP A' },
      { id: 'opB-1', w: 6000, d: 1200, relation_role: 'ANCHOR_WORKSTATION', anchor_instance_id: 'instB', functional_group_id: 'gB', zone_id: 'OP B' },
      { id: 'winB-1', w: 600, d: 600, relation_role: 'WORK_SEAT', anchor_instance_id: 'instB', functional_group_id: 'gB', zone_id: 'OP B' },
    ],
  });
  const planBien = () => ({
    colocacion: [
      { id: 'opA-1', area: 0, x: 0, y: 0 }, { id: 'winA-1', area: 0, x: 0, y: 1500 },
      { id: 'opB-1', area: 1, x: 0, y: 0 }, { id: 'winB-1', area: 1, x: 0, y: 1500 },
    ],
    render_ready: true, layoutSpec: { status: 'PASS', validation: { render_ready: true } },
  });
  const cds = (r) => r.issues.map((i) => i.code);

  it('mismo modelo en dos zonas, cada quien en SU zona → PASS', () => {
    const r = evaluarInvariantesAcomodo({ payload: payloadDual(), plan: planBien() });
    expect(r.status).toBe('PASS');
  });
  it('dependiente de A en la zona de B → DEPENDENT_WRONG_ZONE', () => {
    const plan = planBien(); plan.colocacion.find((c) => c.id === 'winA-1').area = 1;
    const r = evaluarInvariantesAcomodo({ payload: payloadDual(), plan });
    expect(cds(r)).toContain('DEPENDENT_WRONG_ZONE');
    expect(r.status).toBe('FAIL');
  });
  it('ancla A colocada en el área cuya zona es OP B → ANCHOR_WRONG_ZONE', () => {
    const plan = planBien();
    // opA-1 (zone_id OP A) al área 1 (zona OP B); su dependiente lo sigue.
    plan.colocacion.find((c) => c.id === 'opA-1').area = 1;
    plan.colocacion.find((c) => c.id === 'winA-1').area = 1;
    const r = evaluarInvariantesAcomodo({ payload: payloadDual(), plan });
    expect(cds(r)).toContain('ANCHOR_WRONG_ZONE');
    expect(r.status).toBe('FAIL');
  });
  it('reordenar áreas rompe por zone_id, no por nombre/índice', () => {
    const payload = payloadDual();
    [payload.areas[0], payload.areas[1]] = [payload.areas[1], payload.areas[0]]; // swap zonas
    // El plan sigue poniendo opA-1 en índice 0, que ahora es zona OP B.
    const r = evaluarInvariantesAcomodo({ payload, plan: planBien() });
    expect(cds(r)).toContain('ANCHOR_WRONG_ZONE');
    expect(r.status).toBe('FAIL');
  });
  it('dos anclas con dependientes iguales: cruce → ambos DEPENDENT_WRONG_ZONE', () => {
    const plan = planBien();
    plan.colocacion.find((c) => c.id === 'winA-1').area = 1;
    plan.colocacion.find((c) => c.id === 'winB-1').area = 0;
    const r = evaluarInvariantesAcomodo({ payload: payloadDual(), plan });
    expect(r.issues.filter((i) => i.code === 'DEPENDENT_WRONG_ZONE')).toHaveLength(2);
  });

  it('GAP4: dos áreas con MISMO nombre y zone_id distinto NO se confunden', () => {
    // Ambas áreas se llaman 'OPERATIVA'; sólo zone_id las distingue.
    const payload = {
      requested: 2,
      areas: [
        { nombre: 'OPERATIVA', zone_id: 'ZA', ancho: 8000, largo: 4000 },
        { nombre: 'OPERATIVA', zone_id: 'ZB', ancho: 8000, largo: 4000 },
      ],
      piezas: [
        { id: 'a', w: 6000, d: 1200, relation_role: 'ANCHOR_WORKSTATION', anchor_instance_id: 'iA', zone_id: 'ZA' },
        { id: 'b', w: 6000, d: 1200, relation_role: 'ANCHOR_WORKSTATION', anchor_instance_id: 'iB', zone_id: 'ZB' },
      ],
    };
    // Correcto: a→área0(ZA), b→área1(ZB).
    const ok = evaluarInvariantesAcomodo({ payload, plan: { colocacion: [{ id: 'a', area: 0, x: 0, y: 0 }, { id: 'b', area: 1, x: 0, y: 0 }], layoutSpec: { status: 'PASS', validation: { render_ready: true } }, render_ready: true } });
    expect(ok.status).toBe('PASS');
    // Cruce: a (zone_id ZA) al área1 (nombre igual pero zone_id ZB) → mal, por zone_id.
    const mal = evaluarInvariantesAcomodo({ payload, plan: { colocacion: [{ id: 'a', area: 1, x: 0, y: 0 }, { id: 'b', area: 0, x: 0, y: 0 }], layoutSpec: { status: 'PASS', validation: { render_ready: true } }, render_ready: true } });
    expect(mal.issues.filter((i) => i.code === 'ANCHOR_WRONG_ZONE')).toHaveLength(2);
    expect(mal.status).toBe('FAIL');
  });
});

describe('derivarValidez · autoridad única (GAP 2)', () => {
  it('SÓLO PASS publica/valida', () => {
    const v = derivarValidez({ evaluacion: { status: 'PASS', render_ready: true }, programaListo: true });
    expect(v.layoutEspacialValidado).toBe(true);
    expect(v.layoutValidado).toBe(true);
    expect(v.publicable).toBe(true);
    expect(v.render_ready).toBe(true);
  });
  it('PARTIAL/REVIEW_REQUIRED/NEEDS_REVIEW NUNCA publican', () => {
    for (const status of ['PARTIAL', 'REVIEW_REQUIRED', 'NEEDS_REVIEW', 'FAIL']) {
      const v = derivarValidez({ evaluacion: { status, render_ready: false }, programaListo: true });
      expect(v.layoutEspacialValidado, status).toBe(false);
      expect(v.layoutValidado, status).toBe(false);
      expect(v.publicable, status).toBe(false);
    }
  });
  it('PASS pero programa incompleto → espacial validado pero NO publicable', () => {
    const v = derivarValidez({ evaluacion: { status: 'PASS', render_ready: true }, programaListo: false });
    expect(v.layoutEspacialValidado).toBe(true);
    expect(v.layoutValidado).toBe(false);
  });
  it('sin evaluación (borrador local) → nada validado', () => {
    const v = derivarValidez({ evaluacion: null, programaListo: true });
    expect(v.render_ready).toBe(false);
    expect(v.layoutEspacialValidado).toBe(false);
  });
});

describe('acomodoInvariantes · verify-first vs edge + repair', () => {
  it('nunca más verde que el edge: edge PARTIAL → no PASS aunque geometría ok', () => {
    const plan = planPASS();
    plan.layoutSpec.status = 'PARTIAL';
    plan.render_ready = false; plan.layoutSpec.validation.render_ready = false;
    const r = evaluarInvariantesAcomodo({ payload: payloadBase(), plan });
    expect(r.status).toBe('PARTIAL');
    expect(r.render_ready).toBe(false);
  });
  it('no confía en render_ready del edge: edge dice PASS+ready pero falta pieza → PARTIAL', () => {
    const plan = planPASS(); plan.colocacion.pop(); // quita m-1 pero el edge sigue diciendo PASS/ready
    const r = evaluarInvariantesAcomodo({ payload: payloadBase(), plan });
    expect(r.render_ready).toBe(false);
    expect(r.status).toBe('PARTIAL');
  });
  it('repair agotado con falla → NEEDS_REVIEW (no render_ready)', () => {
    const plan = planPASS();
    plan.colocacion.push({ id: 'fantasma-9', area: 0, x: 0, y: 0 });
    const r = evaluarInvariantesAcomodo({ payload: payloadBase(), plan, opts: { repairAgotado: true } });
    expect(r.status).toBe('NEEDS_REVIEW');
    expect(r.render_ready).toBe(false);
  });
});

// Prueba de Rodrigo 2026-10-19 (cotización 3354): "un mueble se sale de su cuarto («p-1792455947285-3-1»)". La credenza
// Eclipse 2100 × 600 girada 90° quedó en x 4400, y 0 de la OFICINA de 5000 × 5000: PEGADA al muro derecho y al de arriba,
// dentro del cuarto (el servidor la aprobó). La revisión de la pantalla probaba las esquinas EXACTAS contra el polígono y
// un punto sobre el muro contaba como "fuera".
describe('pieza pegada al muro no "se sale de su cuarto"', () => {
  const oficina = { nombre: 'OFICINA DIRECCIÓN', ancho: 5000, largo: 5000, poly: [[0, 0], [5000, 0], [5000, 5000], [0, 5000]] };
  const credenza = { id: 'cred', nombre: 'Eclipse Credenza baja 2.10 × 0.60 m', w: 2100, d: 600, relation_role: 'SUPPORT_STORAGE', standalone: true };
  const issuesDe = (x, y, rot) => evaluarInvariantesAcomodo({ payload: { areas: [oficina], piezas: [credenza] }, plan: { colocacion: [{ id: 'cred', area: 0, x, y, rot }] } }).issues;
  it('girada 90° pegada al muro derecho y al de arriba: dentro', () => {
    expect(issuesDe(4400, 0, 90).some((i) => i.code === 'OUT_OF_BOUNDS')).toBe(false);
  });
  it('pegada a la esquina inferior derecha sin girar: dentro', () => {
    expect(issuesDe(2900, 4400, 0).some((i) => i.code === 'OUT_OF_BOUNDS')).toBe(false);
  });
  it('si de verdad se sale 1 cm, sí se marca', () => {
    expect(issuesDe(4410, 0, 90).some((i) => i.code === 'OUT_OF_BOUNDS')).toBe(true);
  });
});

// E2E prod 2026-10-20 (cotización 4048): 54 WIN en UN grupo libre (`fg:libre:open`, sin anchor_instance_id)
// para 5 bancas en dos open spaces. Se comparaba cada silla contra la ÚLTIMA banca del grupo y las bien
// puestas en el otro cuarto salían DEPENDENT_WRONG_ZONE ("una silla/guarda en otro cuarto que su mueble").
describe('acomodoInvariantes · grupo con varias anclas en varios cuartos', () => {
  const payload = () => ({
    requested: 4,
    areas: [{ nombre: 'OPEN 1', ancho: 8000, largo: 4000 }, { nombre: 'OPEN 2', ancho: 8000, largo: 4000 }],
    piezas: [
      { id: 'b1', w: 6000, d: 1200, relation_role: 'ANCHOR_WORKSTATION', functional_group_id: 'fg:libre:open' },
      { id: 'b2', w: 6000, d: 1200, relation_role: 'ANCHOR_WORKSTATION', functional_group_id: 'fg:libre:open' },
      { id: 'w1', w: 600, d: 600, relation_role: 'WORK_SEAT', functional_group_id: 'fg:libre:open' },
      { id: 'w2', w: 600, d: 600, relation_role: 'WORK_SEAT', functional_group_id: 'fg:libre:open' },
    ],
  });
  const plan = (w1Area = 0) => ({
    colocacion: [
      { id: 'b1', area: 0, x: 0, y: 0 }, { id: 'w1', area: w1Area, x: 0, y: 1500 },
      { id: 'b2', area: 1, x: 0, y: 0 }, { id: 'w2', area: 1, x: 0, y: 1500 },
    ],
    render_ready: true, layoutSpec: { status: 'PASS', validation: { render_ready: true } },
  });
  const cds = (r) => r.issues.map((i) => i.code);

  it('cada silla junto a una banca del grupo en SU cuarto → sin WRONG_ZONE ni DETACHED', () => {
    const r = evaluarInvariantesAcomodo({ payload: payload(), plan: plan() });
    expect(cds(r)).not.toContain('DEPENDENT_WRONG_ZONE');
    expect(cds(r)).not.toContain('DEPENDENT_DETACHED');
    expect(r.status).toBe('PASS');
  });
  it('silla en un cuarto SIN ninguna banca del grupo → DEPENDENT_WRONG_ZONE', () => {
    const p = payload(); p.areas.push({ nombre: 'SALA', ancho: 4000, largo: 4000 });
    const r = evaluarInvariantesAcomodo({ payload: p, plan: plan(2) });
    expect(cds(r)).toContain('DEPENDENT_WRONG_ZONE');
  });
});

// ============================================================================
//  ACOM01 · DEPENDENT_DETACHED en PARIDAD con el servidor (recovery-core.js:156-172).
//  Datos con convención de PRODUCCIÓN (kit-solver): dependiente.anchor_instance_id === id
//  del ancla. Antes el cliente NUNCA fallaba por distancia (rect con h undefined → NaN) y
//  medía contra "la más cercana del cuarto", no contra la ancla DECLARADA. Aquí se verifica:
//  medir el rect REAL, SIEMPRE contra la ancla declarada, límite 1200 EXACTO, y mismos
//  códigos/motivo que invariantesRelacionales() del servidor.
// ============================================================================
describe('acomodoInvariantes · ACOM01 DEPENDENT_DETACHED (paridad servidor)', () => {
  const AREA = (extra = {}) => ({ nombre: 'OPEN', zone_id: 'Z', ancho: 20000, largo: 10000, ...extra });
  const BANCA = (id, extra = {}) => ({ id, w: 6000, d: 1200, relation_role: 'ANCHOR_WORKSTATION', zone_id: 'Z', ...extra });
  const DESK = (id, extra = {}) => ({ id, w: 1800, d: 800, relation_role: 'ANCHOR_DESK', zone_id: 'Z', ...extra });
  const SILLA = (id, anc, extra = {}) => ({ id, w: 600, d: 600, relation_role: 'WORK_SEAT', anchor_instance_id: anc, zone_id: 'Z', ...extra });
  const ev = (piezas, colocacion, areas = [AREA()]) =>
    evaluarInvariantesAcomodo({ payload: { requested: piezas.length, areas, piezas }, plan: { colocacion } });
  const detached = (r) => r.issues.filter((i) => i.code === 'DEPENDENT_DETACHED');

  it('1 · silla pegada a SU banca (≤1200, misma área) → PASS, sin DETACHED', () => {
    // banca en (0,0): x[0,6000] y[0,1200]. silla en (0,1500): dy=300 ≤ 1200.
    const r = ev([BANCA('b1'), SILLA('s1', 'b1')], [
      { id: 'b1', area: 0, x: 0, y: 0, rot: 0 },
      { id: 's1', area: 0, x: 0, y: 1500, rot: 0 },
    ]);
    expect(detached(r)).toHaveLength(0);
    expect(r.status).toBe('PASS');
  });

  it('2 · silla de OTRA banca (pegada a b2 pero declarada a b1) → DETACHED FAIL', () => {
    // b1 x[0,6000]; silla pegada a b2 en (8000,1500): a b1 dx=2000 → >1200. NUNCA "buscar otra ancla".
    const r = ev([BANCA('b1'), BANCA('b2'), SILLA('s1', 'b1')], [
      { id: 'b1', area: 0, x: 0, y: 0, rot: 0 },
      { id: 'b2', area: 0, x: 8000, y: 0, rot: 0 },
      { id: 's1', area: 0, x: 8000, y: 1500, rot: 0 },
    ]);
    expect(detached(r)).toHaveLength(1);
    expect(detached(r)[0].id).toBe('s1');
    expect(r.status).toBe('FAIL');
  });

  it('3 · silla en OTRO cuarto que su banca → DETACHED FAIL', () => {
    const r = ev([BANCA('b1'), SILLA('s1', 'b1')], [
      { id: 'b1', area: 0, x: 0, y: 0, rot: 0 },
      { id: 's1', area: 1, x: 0, y: 0, rot: 0 },
    ], [AREA(), AREA({ nombre: 'OPEN2' })]);
    expect(detached(r)).toHaveLength(1);
    expect(r.status).toBe('FAIL');
  });

  it("4 · ancla DECLARADA no colocada → DETACHED motivo 'ancla no colocada'", () => {
    // b1 existe en piezas pero NO en la colocación.
    const r = ev([BANCA('b1'), SILLA('s1', 'b1')], [
      { id: 's1', area: 0, x: 0, y: 1500, rot: 0 },
    ]);
    const d = detached(r);
    expect(d).toHaveLength(1);
    expect(d[0].motivo).toBe('ancla no colocada');
    expect(r.status).toBe('FAIL');
  });

  it("5 · ancla inexistente (anchor_instance_id apunta a nada) → DETACHED 'ancla no colocada'", () => {
    const r = ev([BANCA('b1'), SILLA('s1', 'fantasma')], [
      { id: 'b1', area: 0, x: 0, y: 0, rot: 0 },
      { id: 's1', area: 0, x: 0, y: 1500, rot: 0 },
    ]);
    const d = detached(r);
    expect(d).toHaveLength(1);
    expect(d[0].motivo).toBe('ancla no colocada');
    expect(r.status).toBe('FAIL');
  });

  it('6 · visitante JUSTO dentro del límite (dist = 1200) → PASS', () => {
    // escritorio x[0,1800] y[0,800]. visitante en (0,2000): dy = 2000-800 = 1200 (inclusivo).
    const r = ev([DESK('d1'), { id: 'v1', w: 600, d: 600, relation_role: 'VISITOR_SEAT', anchor_instance_id: 'd1', zone_id: 'Z' }], [
      { id: 'd1', area: 0, x: 0, y: 0, rot: 0 },
      { id: 'v1', area: 0, x: 0, y: 2000, rot: 0 },
    ]);
    expect(detached(r)).toHaveLength(0);
    expect(r.status).toBe('PASS');
  });

  it('7 · visitante JUSTO fuera del límite (dist = 1201) → DETACHED FAIL', () => {
    const r = ev([DESK('d1'), { id: 'v1', w: 600, d: 600, relation_role: 'VISITOR_SEAT', anchor_instance_id: 'd1', zone_id: 'Z' }], [
      { id: 'd1', area: 0, x: 0, y: 0, rot: 0 },
      { id: 'v1', area: 0, x: 0, y: 2001, rot: 0 }, // dy = 1201 > 1200
    ]);
    expect(detached(r)).toHaveLength(1);
    expect(r.status).toBe('FAIL');
  });

  it('8 · gaveta junto a SU escritorio (≤1200) → PASS', () => {
    // escritorio y[0,800]; gaveta en (0,900): dy=100 (adyacente, sin solape → sólo probamos el vínculo).
    const r = ev([DESK('d1'), { id: 'g1', w: 400, d: 500, relation_role: 'UNDERDESK_STORAGE', anchor_instance_id: 'd1', zone_id: 'Z' }], [
      { id: 'd1', area: 0, x: 0, y: 0, rot: 0 },
      { id: 'g1', area: 0, x: 0, y: 900, rot: 0 },
    ]);
    expect(detached(r)).toHaveLength(0);
    expect(r.status).toBe('PASS');
  });

  it('9 · gaveta contra OTRO escritorio (declarada a d1, pegada a d2) → DETACHED FAIL', () => {
    const r = ev([DESK('d1'), DESK('d2'), { id: 'g1', w: 400, d: 500, relation_role: 'UNDERDESK_STORAGE', anchor_instance_id: 'd1', zone_id: 'Z' }], [
      { id: 'd1', area: 0, x: 0, y: 0, rot: 0 },
      { id: 'd2', area: 0, x: 6000, y: 0, rot: 0 },
      { id: 'g1', area: 0, x: 6000, y: 900, rot: 0 }, // a d1: dx = 6000-1800 = 4200 > 1200
    ]);
    expect(detached(r)).toHaveLength(1);
    expect(detached(r)[0].id).toBe('g1');
    expect(r.status).toBe('FAIL');
  });

  it('10 · varias bancas del MISMO producto: cada silla a SU banca declarada → PASS', () => {
    const r = ev([BANCA('b1'), BANCA('b2'), SILLA('s1', 'b1'), SILLA('s2', 'b2')], [
      { id: 'b1', area: 0, x: 0, y: 0, rot: 0 },
      { id: 'b2', area: 0, x: 8000, y: 0, rot: 0 },
      { id: 's1', area: 0, x: 0, y: 1500, rot: 0 },    // junto a b1
      { id: 's2', area: 0, x: 8000, y: 1500, rot: 0 }, // junto a b2
    ]);
    expect(detached(r)).toHaveLength(0);
    expect(r.status).toBe('PASS');
  });

  it('11 · reordenar piezas/colocación NO cambia el ownership (mismo veredicto)', () => {
    const piezas = [BANCA('b1'), BANCA('b2'), SILLA('s1', 'b1')];
    const coloc = [
      { id: 'b1', area: 0, x: 0, y: 0, rot: 0 },
      { id: 'b2', area: 0, x: 8000, y: 0, rot: 0 },
      { id: 's1', area: 0, x: 8000, y: 1500, rot: 0 }, // pegada a b2, declarada a b1 → DETACHED
    ];
    const antes = detached(ev(piezas, coloc)).map((i) => `${i.id}|${i.code}`).sort();
    const r2 = ev([...piezas].reverse(), [...coloc].reverse());
    const despues = detached(r2).map((i) => `${i.id}|${i.code}`).sort();
    expect(antes).toEqual(['s1|DEPENDENT_DETACHED']);
    expect(despues).toEqual(antes); // la identidad es por id del ancla, no por orden ni cercanía
  });

  it('12 · CERO falsos PASS: ningún escenario desprendido devuelve PASS', () => {
    const escenarios = [
      // silla lejísimos de su banca (misma área)
      [[BANCA('b1'), SILLA('s', 'b1')], [{ id: 'b1', area: 0, x: 0, y: 0 }, { id: 's', area: 0, x: 0, y: 6000 }]],
      // silla en otra área
      [[BANCA('b1'), SILLA('s', 'b1')], [{ id: 'b1', area: 0, x: 0, y: 0 }, { id: 's', area: 1, x: 0, y: 0 }], [AREA(), AREA({ nombre: 'X' })]],
      // ancla no colocada
      [[BANCA('b1'), SILLA('s', 'b1')], [{ id: 's', area: 0, x: 0, y: 1500 }]],
      // ancla inexistente
      [[SILLA('s', 'nada')], [{ id: 's', area: 0, x: 0, y: 1500 }]],
    ];
    for (const [piezas, coloc, areas] of escenarios) {
      const r = ev(piezas, coloc, areas);
      expect(r.status, JSON.stringify(coloc)).not.toBe('PASS');
      expect(detached(r).length, JSON.stringify(coloc)).toBeGreaterThan(0);
    }
  });

  it('13 · LEGACY (sólo functional_group_id, sin anchor_instance_id) lejos → DETACHED marcado inferida:true', () => {
    const piezas = [
      { id: 'b1', w: 6000, d: 1200, relation_role: 'ANCHOR_WORKSTATION', functional_group_id: 'g', zone_id: 'Z' },
      { id: 's1', w: 600, d: 600, relation_role: 'WORK_SEAT', functional_group_id: 'g', zone_id: 'Z' },
    ];
    const r = ev(piezas, [
      { id: 'b1', area: 0, x: 0, y: 0, rot: 0 },
      { id: 's1', area: 0, x: 0, y: 6000, rot: 0 }, // dy = 6000-1200 = 4800 > 1200
    ]);
    const d = detached(r);
    expect(d).toHaveLength(1);
    expect(d[0].inferida).toBe(true); // no esconde que el dueño se INFIRIÓ por grupo (no declarado)
    expect(r.status).toBe('FAIL');
  });

  it('14 · LEGACY dentro de rango → sin DETACHED (goldens no se voltean)', () => {
    const piezas = [
      { id: 'b1', w: 6000, d: 1200, relation_role: 'ANCHOR_WORKSTATION', functional_group_id: 'g', zone_id: 'Z' },
      { id: 's1', w: 600, d: 600, relation_role: 'WORK_SEAT', functional_group_id: 'g', zone_id: 'Z' },
    ];
    const r = ev(piezas, [
      { id: 'b1', area: 0, x: 0, y: 0, rot: 0 },
      { id: 's1', area: 0, x: 0, y: 1500, rot: 0 }, // dy = 300
    ]);
    expect(detached(r)).toHaveLength(0);
    expect(r.status).toBe('PASS');
  });

  it('15 · PARIDAD byte-for-byte: MISMO fixture por el servidor y por el cliente → MISMO conjunto de códigos', () => {
    // Convención de producción: dependiente.anchor_instance_id === id del ancla.
    const piezas = [
      { id: 'deskA', w: 1800, d: 800, relation_role: 'ANCHOR_DESK', zone_id: 'Z' },
      { id: 'seatOK', w: 600, d: 600, relation_role: 'WORK_SEAT', anchor_instance_id: 'deskA', zone_id: 'Z' },   // ≤1200 → OK
      { id: 'seatFar', w: 600, d: 600, relation_role: 'WORK_SEAT', anchor_instance_id: 'deskA', zone_id: 'Z' },  // >1200 → DETACHED
      { id: 'seatGhost', w: 600, d: 600, relation_role: 'WORK_SEAT', anchor_instance_id: 'noExiste', zone_id: 'Z' }, // ancla no colocada
      { id: 'stor', w: 900, d: 450, relation_role: 'SUPPORT_STORAGE', zone_id: 'Z' },                             // suelto → exento (VH-096)
      { id: 'orph', w: 600, d: 600, relation_role: 'VISITOR_SEAT', zone_id: 'Z' },                               // sin ancla ni grupo → UNASSIGNED
    ];
    const colocacion = [
      { id: 'deskA', area: 0, x: 0, y: 0, rot: 0 },        // x[0,1800] y[0,800]
      { id: 'seatOK', area: 0, x: 0, y: 1000, rot: 0 },    // dy = 200 ≤ 1200
      { id: 'seatFar', area: 0, x: 5000, y: 0, rot: 0 },   // dx = 3200 > 1200
      { id: 'seatGhost', area: 0, x: 10000, y: 0, rot: 0 },
      { id: 'stor', area: 0, x: 0, y: 3000, rot: 0 },
      { id: 'orph', area: 0, x: 0, y: 5000, rot: 0 },
    ];
    const norm = (arr) => arr.map((i) => `${i.id}|${i.code}`).sort();
    const REL = new Set(['DEPENDENT_DETACHED', 'DEPENDENT_UNASSIGNED']);

    const servidor = invariantesRelacionales(piezas, colocacion);
    const cliente = evaluarInvariantesAcomodo({
      payload: { requested: piezas.length, areas: [AREA({ ancho: 30000, largo: 12000 })], piezas },
      plan: { colocacion },
    }).issues.filter((i) => REL.has(i.code));

    // El servidor sólo emite DEPENDENT_*; el cliente los emite idénticos (mismos id+code).
    expect(norm(cliente)).toEqual(norm(servidor));
    expect(norm(servidor)).toEqual(['orph|DEPENDENT_UNASSIGNED', 'seatFar|DEPENDENT_DETACHED', 'seatGhost|DEPENDENT_DETACHED'].sort());
  });

  // ---- Regresión del E2E acomodoP02 (navegador real) --------------------------------------------
  // El cliente corre sobre las piezas del PROGRAMA (pre-solver): el dependiente trae un token de
  // REQUERIMIENTO (anchor_instance_id = 'inst:req:…') que NO es un id de colocación, y comparte
  // functional_group_id con su ancla. El servidor sólo ve las piezas ya REESCRITAS por el kit-solver
  // (anchor = placement id), así que el cliente no puede resolver el token como placement; debe caer a
  // la inferencia por grupo (vínculo compartido), NO declarar 'ancla no colocada'. Antes de este fix el
  // cliente marcaba DEPENDENT_DETACHED falso y el layout válido NO persistía (E2E rojo).
  const BANCA_FG = (id, fg) => ({ id, w: 6000, d: 1200, relation_role: 'ANCHOR_WORKSTATION', functional_group_id: fg, zone_id: 'Z' });
  const SILLA_TOK = (id, tok, fg) => ({ id, w: 600, d: 600, relation_role: 'WORK_SEAT', anchor_instance_id: tok, functional_group_id: fg, zone_id: 'Z' });

  it('16 · token pre-solver (inst:req) NO resoluble + MISMO functional_group_id, silla en rango → PASS (vínculo por grupo, sin DETACHED)', () => {
    const r = ev(
      [BANCA_FG('b-1', 'fg:req:OPERATIVA:operativo:0:#0'),
       SILLA_TOK('w-1', 'inst:req:OPERATIVA:operativo:0:#0', 'fg:req:OPERATIVA:operativo:0:#0'),
       SILLA_TOK('w-2', 'inst:req:OPERATIVA:operativo:0:#0', 'fg:req:OPERATIVA:operativo:0:#0')],
      [{ id: 'b-1', area: 0, x: 0, y: 0, rot: 0 },
       { id: 'w-1', area: 0, x: 0, y: 1500, rot: 0 },     // dy = 1500-1200 = 300 ≤ 1200
       { id: 'w-2', area: 0, x: 2000, y: 1500, rot: 0 }], // dentro del bench en x, dy=300
    );
    expect(detached(r)).toHaveLength(0);
    expect(r.status).toBe('PASS');
  });

  it('17 · token pre-solver NO resoluble + MISMO grupo, silla LEJOS del ancla del grupo → DETACHED inferida:true', () => {
    const r = ev(
      [BANCA_FG('b-1', 'g'), SILLA_TOK('w-1', 'inst:req:g', 'g')],
      [{ id: 'b-1', area: 0, x: 0, y: 0, rot: 0 },
       { id: 'w-1', area: 0, x: 0, y: 6000, rot: 0 }],    // dy = 6000-1200 = 4800 > 1200
    );
    const d = detached(r);
    expect(d).toHaveLength(1);
    expect(d[0].id).toBe('w-1');
    expect(d[0].inferida).toBe(true);
    expect(r.status).toBe('FAIL');
  });

  it('18 · token pre-solver NO resoluble y SIN grupo → DETACHED "ancla no colocada" (no se infiere de la nada)', () => {
    const r = ev(
      [{ id: 'b-1', w: 6000, d: 1200, relation_role: 'ANCHOR_WORKSTATION', zone_id: 'Z' },
       { id: 'w-1', w: 600, d: 600, relation_role: 'WORK_SEAT', anchor_instance_id: 'inst:req:huerfano', zone_id: 'Z' }],
      [{ id: 'b-1', area: 0, x: 0, y: 0, rot: 0 }, { id: 'w-1', area: 0, x: 0, y: 1500, rot: 0 }],
    );
    const d = detached(r);
    expect(d).toHaveLength(1);
    expect(d[0].motivo).toBe('ancla no colocada');
    expect(r.status).toBe('FAIL');
  });
});
