import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolverKits, resolverKitsMulti, certificarKit, mejorCandidato } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';
import { construirRespuestaAcomodo } from '../../supabase/functions/acomodar-espacio-recovery/recoveryPipeline.js';
import { juzgarSemantico } from '../../supabase/functions/acomodar-espacio-recovery/semanticPlacementJudge.js';
import { evaluarRecovery } from '../../supabase/functions/acomodar-espacio-recovery/recovery-core.js';

// ============================================================================
//  COT-P0-027b · RESCATE (Parte XI §1-§4). Fixture = request REAL del navegador
//  (E2E Torre Sur PDF, 2026-10-10 15:17:44Z, edge v6). Respuesta grabada: ganador
//  `center` 15/22 QUALITY_REVIEW_REQUIRED, con 4 estrategias en 22/22 pero FAIL
//  semántico (sillas contra el muro) → GAP18 prefería la parcial.
//
//  Tres mecanismos demostrados (baseline reproducido byte-equivalente sobre 572694d):
//   1. el conjunto legal del solver ignoraba el acceso de las sillas (ACTIVE_SIDE_BLOCKED)
//   2. la "búsqueda con backtracking" era primer-ajuste voraz (nunca movía un kit previo)
//   3. el ranking comparaba PASS>REVIEW antes que la completitud: no colocar las piezas
//      de topología desconocida "limpiaba" el review y ganaba con menos piezas
//  + 027e (credenza 2100×200 → 600) y 027c (STORAGE con frente) para el mismo caso.
// ============================================================================
const FIX = JSON.parse(readFileSync('bench/acomodo-calidad/fixtures/torre-sur-pdf-request.json', 'utf8'));
// La huella de la credenza viaja corregida (027e, fix cliente); el resto es el request real.
const piezasReales = () => FIX.piezas.map((p) => (/Credenza baja 2\.10 × 0\.60/.test(p.nombre) ? { ...p, d: 600 } : p));
const mk = (id, rol, w, d, extra = {}) => ({ id, relation_role: rol, w, d, functional_group_id: 'g', zone_id: 'OP', ...extra });
const df8 = () => [
  mk('b', 'ANCHOR_WORKSTATION', 6000, 1400, { user_capacity: 8, placement_profile: { topology: 'DOUBLE_FACE', provenance: 'USER_CONFIRMED', version: 'PP_V1' } }),
  ...Array.from({ length: 8 }, (_, i) => mk('s' + i, 'WORK_SEAT', 600, 600)),
];

describe('COT-P0-027b · Torre Sur (request real) → 22/22 sin sillas contra el muro', () => {
  it('fixture: es el request real y su respuesta grabada era 15/22 por center', () => {
    expect(FIX.piezas).toHaveLength(22);
    expect(FIX.grabado).toMatchObject({ status: 'QUALITY_REVIEW_REQUIRED', ganador_orden: 'center', placed: 15 });
    expect(FIX.grabado.por_candidato.filter((c) => c.placed === 22 && c.sem_status === 'FAIL')).toHaveLength(4);
  });

  it('RED→GREEN: el pipeline del edge coloca las 22 piezas, semántica PASS, 0 duros, publicable', () => {
    const r = construirRespuestaAcomodo(FIX.areas, piezasReales());
    const sel = r.seleccion;
    expect(sel.ganador_eval.placed, JSON.stringify(sel.por_candidato)).toBe(22);
    expect(r.no_cupieron).toEqual([]);
    expect(r.unassigned).toEqual([]);
    expect(sel.ganador_eval.hardOk).toBe(true);
    expect(sel.ganador_eval.sem_status).toBe('PASS');
    const sem = juzgarSemantico(FIX.areas, r.plan.piezas, r.plan.colocacion);
    expect(sem.issues.filter((i) => i.severity === 'fail')).toEqual([]);
    expect(sem.issues.filter((i) => /BLOCKED_BY/.test(i.code))).toEqual([]);
    const er = evaluarRecovery(FIX.areas, r.plan.piezas, r.plan.colocacion, { requested: 22 });
    expect((er.issues || []).filter((i) => i.severity === 'fail')).toEqual([]);
    expect(sel.publicable).toBe(true);
    expect(r.render_ready).toBe(true);
    expect(r.status).toBe('PASS');
    // Ningún candidato completo pierde contra una parcial.
    expect(sel.por_candidato.filter((c) => c.placed === 22).length).toBeGreaterThanOrEqual(4);
  });

  it('los dos benches de 4 quedan en el área operativa con acceso > 0 en ambas filas (máximo físico 400 mm en 3.2 m)', () => {
    const r = construirRespuestaAcomodo(FIX.areas, piezasReales());
    const op = FIX.areas.findIndex((a) => a.tipo === 'open');
    const benches = r.plan.colocacion.filter((c) => /-1-[12]$/.test(c.id));
    expect(benches).toHaveLength(2);
    for (const b of benches) expect(b.area).toBe(op);
    const benchIds = new Set(benches.map((b) => String(b.id)));
    const sillas = r.plan.colocacion.filter((c) => benchIds.has(String(c.anchor_instance_id)) && (c.side === 'A' || c.side === 'B'));
    expect(sillas).toHaveLength(8);
    const H = FIX.areas[op].largo;
    for (const s of sillas) {
      const acceso = s.facing === 'DOWN' ? s.y : H - (s.y + 600);
      expect(acceso, `${s.id} ${s.side}`).toBeGreaterThan(0);
    }
  });

  it('027c: credenza y archivero son anclas STORAGE (topología conocida, frente con holgura), no UNKNOWN', () => {
    const r = construirRespuestaAcomodo(FIX.areas, piezasReales());
    const guardado = r.plan.colocacion.filter((c) => /-(3|11)-1$/.test(c.id));
    expect(guardado).toHaveLength(2);
    for (const g of guardado) {
      expect(g.topology).toBe('STORAGE');
      expect(['UP', 'DOWN', 'LEFT', 'RIGHT']).toContain(g.facing);
    }
    const sem = juzgarSemantico(FIX.areas, r.plan.piezas, r.plan.colocacion);
    expect(sem.issues.filter((i) => i.code === 'SEMANTIC_PROFILE_UNKNOWN')).toEqual([]);
    expect(sem.issues.filter((i) => /STORAGE_FRONT_BLOCKED/.test(i.code))).toEqual([]);
  });

  it('determinismo: dos corridas dan el mismo ganador y la misma colocación', () => {
    const a = construirRespuestaAcomodo(FIX.areas, piezasReales());
    const b = construirRespuestaAcomodo(FIX.areas, piezasReales());
    expect(a.seleccion.ganador_orden).toBe(b.seleccion.ganador_orden);
    expect(JSON.stringify(a.plan.colocacion)).toBe(JSON.stringify(b.plan.colocacion));
  });
});

describe('COT-P0-027b · mecanismos aislados', () => {
  it('1 · ACCESO en el conjunto legal: el camino determinista nunca deja un lado activo contra el muro', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 7000, largo: 4000 }];
    const sol = resolverKits(areas, df8());
    const sem = juzgarSemantico(areas, sol.piezas, sol.colocacion);
    expect(sem.issues.filter((i) => /BLOCKED_BY/.test(i.code))).toEqual([]);
    expect(sol.unplaced).toEqual([]);
    expect(sol.busqueda).toMatchObject({ completa: true, fase: 1 });
  });

  it('2 · BÚSQUEDA COMPLETA: dos benches de 4 en 8000×3200 → el multi coloca los 10 (la parcial no gana)', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 8000, largo: 3200 }];
    const bench = (g) => [
      mk('b' + g, 'ANCHOR_WORKSTATION', 3000, 1200, { functional_group_id: g, user_capacity: 4, placement_profile: { topology: 'DOUBLE_FACE', provenance: 'CATALOG', version: 'PP_V1' } }),
      ...Array.from({ length: 4 }, (_, i) => mk(`s${g}_${i}`, 'WORK_SEAT', 600, 600, { functional_group_id: g })),
    ];
    const m = resolverKitsMulti(areas, [...bench('g1'), ...bench('g2')]);
    expect(m.seleccion.ganador_eval.placed).toBe(10);
    expect(m.unplaced).toEqual([]);
    expect(m.seleccion.por_candidato.filter((c) => c.placed === 10).length).toBeGreaterThanOrEqual(3);
  });

  it('3 · RANKING: 22/22 REVIEW_REQUIRED gana a 15/22 PASS (no se "limpia" el review dejando piezas fuera); GAP18 intacto', () => {
    const completo = { idx: 0, orden: 'row', eval: { hardOk: true, hard_issues: 0, placed: 22, sem_status: 'REVIEW_REQUIRED', semRank: 1, semFail: 0, semReview: 2, quality: 74 } };
    const parcial = { idx: 1, orden: 'center', eval: { hardOk: true, hard_issues: 0, placed: 15, sem_status: 'PASS', semRank: 2, semFail: 0, semReview: 0, quality: 54 } };
    expect(mejorCandidato(completo, parcial)).toBe(completo);
    expect(mejorCandidato(parcial, completo)).toBe(completo);
    const fail20 = { idx: 0, orden: 'row', eval: { hardOk: true, hard_issues: 0, placed: 20, sem_status: 'FAIL', semRank: 0, semFail: 4, semReview: 0, quality: 95 } };
    const pass19 = { idx: 1, orden: 'center', eval: { hardOk: true, hard_issues: 0, placed: 19, sem_status: 'PASS', semRank: 2, semFail: 0, semReview: 0, quality: 80 } };
    expect(mejorCandidato(fail20, pass19)).toBe(pass19);
  });

  it('4 · ORIENTACIÓN 180°: dos filas SINGLE_FACE en 4600 mm → la segunda gira con las sillas hacia el pasillo', () => {
    // banco dif05: 2 benches cap 6 (9000×1200 + sillas) en 9000×4600. Con 0/90 la segunda
    // fila sólo cabía con las sillas contra el muro inferior (ilegal); con 180° se enfrentan.
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 9000, largo: 4600 }];
    const ws = (g) => [
      mk('b' + g, 'ANCHOR_WORKSTATION', 9000, 1200, { functional_group_id: g, user_capacity: 6, placement_profile: { topology: 'SINGLE_FACE', provenance: 'CATALOG', version: 'PP_V1' } }),
      ...Array.from({ length: 6 }, (_, i) => mk(`s${g}_${i}`, 'WORK_SEAT', 600, 600, { functional_group_id: g })),
    ];
    const sol = resolverKits(areas, [...ws('g1'), ...ws('g2')]);
    expect(sol.unplaced).toEqual([]);
    const rots = new Set(sol.colocacion.filter((c) => /^b/.test(c.id)).map((c) => c.kit_rot));
    expect(rots).toEqual(new Set([0, 180]));
    for (const c of sol.colocacion) expect([0, 90]).toContain(c.rot);   // los validadores sólo leen 0/90
    const sem = juzgarSemantico(areas, sol.piezas, sol.colocacion);
    expect(sem.issues.filter((i) => /BLOCKED_BY/.test(i.code))).toEqual([]);
  });
});

describe('COT-P0-027b · VEREDICTO de búsqueda (tres estados no equivalentes)', () => {
  it('NO_CABE_DEMOSTRADO: cuarto de 2600 mm de fondo para un bench doble cara → sillas sin acceso posible (causa ACCESS probada)', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 6200, largo: 2600 }];
    const sol = resolverKits(areas, df8());
    expect(sol.busqueda.completa).toBe(false);
    expect(sol.busqueda.exhaustiva).toBe(true);
    expect(sol.unplaced).toHaveLength(1);
    const cert = sol.unplaced[0].certificado;
    expect(cert.partial_certificate.full_kit_cause).toBe('ACCESS');
    expect(cert.partial_certificate.full_kit_proven).toBe(true);
  });
  it('NO_CABE_DEMOSTRADO vs NO_SE_ENCONTRO_SOLUCION: misma geometría con presupuesto agotado NO afirma imposibilidad', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 5000, largo: 4000 }];
    const sol = resolverKits(areas, df8());                 // 6000 no cabe en 5000: ASPECT_RATIO probado
    expect(sol.unplaced[0].certificado.veredicto).toBe('NO_CABE_DEMOSTRADO');
    const kit = sol._cert_ctx.kitsByAnchor.get('b');
    const agotado = certificarKit(kit, areas, { budgetExhausted: true, nodos: 1, busqueda: { completa: false, exhaustiva: false } });
    expect(agotado.veredicto).toBe('NO_SE_ENCONTRO_SOLUCION');
  });
  it('INFORMACION_INSUFICIENTE: cuarto sin dimensiones o pieza sin huella → nunca "imposible"', () => {
    const sinDims = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open' }];
    const sol = resolverKits(sinDims, df8());
    expect(sol.unplaced).toHaveLength(1);
    expect(sol.unplaced[0].certificado.veredicto).toBe('INFORMACION_INSUFICIENTE');
    const sinHuella = [mk('b', 'ANCHOR_DESK', undefined, undefined, { user_capacity: 1, placement_profile: { topology: 'DESK', provenance: 'CATALOG', version: 'PP_V1' } }), mk('s0', 'EXECUTIVE_SEAT', 600, 600)];
    const areas = [{ nombre: 'P', zone_id: 'OP', tipo: 'privado', ancho: 1200, largo: 1200 }];   // no cabe ni el default
    const sol2 = resolverKits(areas, sinHuella);
    expect(sol2.unplaced).toHaveLength(1);
    expect(sol2.unplaced[0].certificado.veredicto).toBe('INFORMACION_INSUFICIENTE');
  });
});
