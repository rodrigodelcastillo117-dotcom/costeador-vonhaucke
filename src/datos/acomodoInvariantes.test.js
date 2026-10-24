import { describe, it, expect } from 'vitest';
import { evaluarInvariantesAcomodo, derivarValidez } from './acomodoInvariantes.js';

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

// D · DEPENDENT_DETACHED: antes el rect del ancla salía con h = r.d (undefined) → distancia NaN → nunca fallaba.
// Se mide borde a borde contra el dueño que asignó el solver o, sin él, contra el ancla MÁS CERCANA del grupo.
describe('acomodoInvariantes · dependiente desprendido de su ancla (D)', () => {
  const sala = { nombre: 'OPERATIVA', ancho: 8000, largo: 8000 };
  const bench = (id, extra = {}) => ({ id, w: 6000, d: 1200, functional_group_id: 'fg:op', relation_role: 'ANCHOR_WORKSTATION', ...extra });
  const silla = (id, extra = {}) => ({ id, w: 600, d: 600, functional_group_id: 'fg:op', relation_role: 'WORK_SEAT', ...extra });
  const evaluar = (piezas, colocacion) => evaluarInvariantesAcomodo({ payload: { areas: [sala], piezas }, plan: { colocacion } });
  const desprendidos = (r) => r.issues.filter((i) => i.code === 'DEPENDENT_DETACHED');

  it('silla a 300 mm del bench → no se marca', () => {
    const r = evaluar([bench('b1'), silla('s1')], [{ id: 'b1', area: 0, x: 0, y: 0 }, { id: 's1', area: 0, x: 0, y: 1500 }]);
    expect(desprendidos(r)).toHaveLength(0);
    expect(r.status).toBe('PASS');
  });

  it('silla a 1.5 m del bench → DEPENDENT_DETACHED y FAIL', () => {
    const r = evaluar([bench('b1'), silla('s1')], [{ id: 'b1', area: 0, x: 0, y: 0 }, { id: 's1', area: 0, x: 0, y: 2700 }]);
    expect(desprendidos(r)).toEqual([expect.objectContaining({ id: 's1', severity: 'fail', distanciaMM: 1500, limiteMM: 1200 })]);
    expect(r.status).toBe('FAIL');
    expect(r.render_ready).toBe(false);
  });

  it('exactamente a 1.2 m es el límite: no se marca', () => {
    const r = evaluar([bench('b1'), silla('s1')], [{ id: 'b1', area: 0, x: 0, y: 0 }, { id: 's1', area: 0, x: 0, y: 2400 }]);
    expect(desprendidos(r)).toHaveLength(0);
  });

  it('girada 90°: el rect usa la huella rotada, no la de catálogo', () => {
    // Bench girado ocupa x 0..1200, y 0..6000; silla a 300 mm de su lado largo.
    const r = evaluar([bench('b1'), silla('s1')], [{ id: 'b1', area: 0, x: 0, y: 0, rot: 90 }, { id: 's1', area: 0, x: 1500, y: 2000 }]);
    expect(desprendidos(r)).toHaveLength(0);
  });

  it('dos benches del mismo grupo en la sala: cada silla se mide contra el MÁS CERCANO, no contra el último', () => {
    // b1 arriba (y 0..1200) con su silla; b2 abajo (y 3600..4800) con la suya. b1 es la última ancla colocada:
    // medir la silla de b2 contra b1 daría 3.7 m y bloquearía un acomodo correcto (caso real: cotización 757).
    const r = evaluar(
      [bench('b1'), bench('b2'), silla('s1'), silla('s2')],
      [{ id: 'b2', area: 0, x: 0, y: 3600 }, { id: 's2', area: 0, x: 0, y: 4900 }, { id: 's1', area: 0, x: 0, y: 1300 }, { id: 'b1', area: 0, x: 0, y: 0 }],
    );
    expect(desprendidos(r)).toHaveLength(0);
    expect(r.status).toBe('PASS');
  });

  it('flujo real: la silla trae anchor_instance_id de partida y el ancla no → igual se mide (antes el bloque no corría)', () => {
    const piezas = [bench('b1'), silla('s1', { anchor_instance_id: 'inst:req:OPERATIVA:operativo:0:#0' })];
    const lejos = evaluar(piezas, [{ id: 'b1', area: 0, x: 0, y: 0 }, { id: 's1', area: 0, x: 0, y: 3000 }]);
    expect(desprendidos(lejos)).toEqual([expect.objectContaining({ id: 's1', distanciaMM: 1800 })]);
    const cerca = evaluar(piezas, [{ id: 'b1', area: 0, x: 0, y: 0 }, { id: 's1', area: 0, x: 0, y: 1300 }]);
    expect(desprendidos(cerca)).toHaveLength(0);
  });

  it('manda el dueño que asignó el solver (colocacion.anchor_instance_id) aunque otro bench quede más cerca', () => {
    const piezas = [bench('b1'), bench('b2'), silla('s1', { anchor_instance_id: 'inst:op' })];
    const colocacion = [{ id: 'b1', area: 0, x: 0, y: 0 }, { id: 'b2', area: 0, x: 0, y: 5000 }];
    const deB1 = evaluar(piezas, [...colocacion, { id: 's1', area: 0, x: 0, y: 1300, anchor_instance_id: 'b1' }]);
    expect(desprendidos(deB1)).toHaveLength(0);
    const deB2 = evaluar(piezas, [...colocacion, { id: 's1', area: 0, x: 0, y: 1300, anchor_instance_id: 'b2' }]);
    expect(desprendidos(deB2)).toEqual([expect.objectContaining({ id: 's1', distanciaMM: 3100 })]);
  });

  it('dueño del solver en otra área → DEPENDENT_DETACHED', () => {
    const r = evaluarInvariantesAcomodo({
      payload: { areas: [sala, { nombre: 'OTRA', ancho: 4000, largo: 4000 }], piezas: [bench('b1'), silla('s1', { anchor_instance_id: 'inst:op' })] },
      plan: { colocacion: [{ id: 'b1', area: 0, x: 0, y: 0 }, { id: 's1', area: 1, x: 0, y: 0, anchor_instance_id: 'b1' }] },
    });
    expect(desprendidos(r)).toEqual([expect.objectContaining({ id: 's1', distanciaMM: null })]);
  });

  it('respeta la tolerancia declarada por la pieza (silla de visita 2.6 m)', () => {
    const visita = silla('v1', { relation_role: 'VISITOR_SEAT', max_anchor_distance_mm: 2600 });
    const a2m = evaluar([bench('b1'), visita], [{ id: 'b1', area: 0, x: 0, y: 0 }, { id: 'v1', area: 0, x: 0, y: 3200 }]);
    expect(desprendidos(a2m)).toHaveLength(0);
    const a28 = evaluar([bench('b1'), visita], [{ id: 'b1', area: 0, x: 0, y: 0 }, { id: 'v1', area: 0, x: 0, y: 4000 }]);
    expect(desprendidos(a28)).toEqual([expect.objectContaining({ id: 'v1', distanciaMM: 2800, limiteMM: 2600 })]);
  });

  it('una tolerancia declarada menor que 1.2 m no endurece el piso de 1.2 m', () => {
    const r = evaluar([bench('b1'), silla('s1', { max_anchor_distance_mm: 900 })], [{ id: 'b1', area: 0, x: 0, y: 0 }, { id: 's1', area: 0, x: 0, y: 2300 }]);
    expect(desprendidos(r)).toHaveLength(0);
  });

  it('guarda de piso suelta (SUPPORT_STORAGE sin dueño) es su propio kit: no se ata al escritorio (VH-096)', () => {
    const credenza = { id: 'c1', w: 1600, d: 500, functional_group_id: 'fg:op', relation_role: 'SUPPORT_STORAGE' };
    const r = evaluar([bench('b1'), credenza], [{ id: 'b1', area: 0, x: 0, y: 0 }, { id: 'c1', area: 0, x: 0, y: 7000 }]);
    expect(desprendidos(r)).toHaveLength(0);
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
