import { describe, it, expect } from 'vitest';
import { evaluarInvariantesAcomodo } from './acomodoInvariantes.js';

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
