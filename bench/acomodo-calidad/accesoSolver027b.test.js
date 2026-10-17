import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolverKits, resolverKitsMulti, certificarKit, mejorCandidato } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';
import { construirRespuestaAcomodo } from '../../supabase/functions/acomodar-espacio-recovery/recoveryPipeline.js';
import { juzgarSemantico, STORAGE_FRONT_MIN_MM } from '../../supabase/functions/acomodar-espacio-recovery/semanticPlacementJudge.js';
import { evaluarRecovery } from '../../supabase/functions/acomodar-espacio-recovery/recovery-core.js';

// ============================================================================
//  COT-P0-027b / 027c · el solver dejaba muebles fuera sin razón física.
//  Fixture = request REAL del navegador (E2E Torre Sur PDF, 2026-10-10 15:17:44Z).
//  Sobre c8dd2b3 (lo desplegado como acomodar-espacio-recovery v10) ese request da
//  15/22: gana `center`, que deja fuera el segundo bench, la credenza y el archivero.
//
//  Causas demostradas:
//   1. el conjunto legal del solver no exigía acceso a las sillas → los candidatos completos
//      salían con sillas pegadas al muro (FAIL semántico) y ganaba el incompleto (GAP18)
//   2. la "búsqueda con backtracking" era primer-ajuste voraz: nunca movía un kit ya colocado
//   3. el ranking comparaba PASS>REVIEW antes que la completitud
//   4. un cuarto infactible mandaba a TODOS los cuartos al primer-ajuste
//   5. 1 m de pasillo también entre dos muebles de guardado lado a lado (donde nadie camina)
// ============================================================================
const FIX = JSON.parse(readFileSync('bench/acomodo-calidad/fixtures/torre-sur-pdf-request.json', 'utf8'));
// La huella de la credenza viaja corregida (2100×600; el request real traía d:200 por COT-P1-027e).
const piezasReales = () => FIX.piezas.map((p) => (/Credenza baja 2\.10 × 0\.60/.test(p.nombre) ? { ...p, d: 600 } : p));
// Mismo plano con la puerta del despacho CONFIRMADA sin invadir (se quita la reserva conservadora).
const areasPuertaConfirmada = () => FIX.areas.map((a) => (a.tipo === 'privado' ? { ...a, puertas: [] } : a));
const mk = (id, rol, w, d, extra = {}) => ({ id, relation_role: rol, w, d, functional_group_id: 'g', zone_id: 'OP', ...extra });
const df8 = () => [
  mk('b', 'ANCHOR_WORKSTATION', 6000, 1400, { user_capacity: 8, placement_profile: { topology: 'DOUBLE_FACE', provenance: 'USER_CONFIRMED', version: 'PP_V1' } }),
  ...Array.from({ length: 8 }, (_, i) => mk('s' + i, 'WORK_SEAT', 600, 600)),
];
const duros = (areas, r) => (evaluarRecovery(areas, r.plan.piezas, r.plan.colocacion, { requested: r.plan.piezas.length }).issues || []).filter((i) => i.severity === 'fail');
const rectDe = (c, p) => { const g = c.rot === 90; return { x: c.x, y: c.y, w: g ? p.d : p.w, d: g ? p.w : p.d }; };

describe('Torre Sur (request real) · lo que cabe se coloca; lo que no, se demuestra y se explica', () => {
  it('fixture: es el request real y su respuesta grabada era 15/22 por center', () => {
    expect(FIX.piezas).toHaveLength(22);
    expect(FIX.grabado).toMatchObject({ ganador_orden: 'center', placed: 15 });
  });

  it('RED→GREEN: 21/22 (antes 15/22) — los dos benches, sus 8 sillas, juntas, recepción, escritorio y archivero', () => {
    const r = construirRespuestaAcomodo(FIX.areas, piezasReales());
    const sel = r.seleccion;
    expect(sel.ganador_eval.placed, JSON.stringify(sel.por_candidato)).toBe(21);
    for (const c of sel.por_candidato) expect(c.placed, c.orden).toBe(21);          // TODAS las estrategias, no sólo una
    expect(r.unassigned).toEqual([]);
    expect(sel.ganador_eval.hardOk).toBe(true);
    expect(duros(FIX.areas, r)).toEqual([]);
    const sem = juzgarSemantico(FIX.areas, r.plan.piezas, r.plan.colocacion);
    expect(sem.issues.filter((i) => /BLOCKED_BY/.test(i.code))).toEqual([]);         // ninguna silla ni frente contra el muro
    // los dos benches quedan en el área operativa con sus 4 sillas cada uno
    const op = FIX.areas.findIndex((a) => a.tipo === 'open');
    const benches = r.plan.colocacion.filter((c) => /-1-[12]$/.test(c.id));
    expect(benches.map((b) => b.area)).toEqual([op, op]);
    const ids = new Set(benches.map((b) => String(b.id)));
    expect(r.plan.colocacion.filter((c) => ids.has(String(c.anchor_instance_id)))).toHaveLength(8);
  });

  it('lo único que no cabe es la credenza: DEMOSTRADO (búsqueda exhaustiva) y explicado por la puerta sin confirmar', () => {
    const r = construirRespuestaAcomodo(FIX.areas, piezasReales());
    expect(r.no_cupieron).toHaveLength(1);
    const u = r.no_cupieron[0];
    expect(String(u.anchorId)).toMatch(/-3-1$/);                                     // la credenza
    expect(u.certificado.primary_cause).toBe('INTER_KIT_CONSTRAINT');
    expect(u.certificado.veredicto).toBe('NO_CABE_DEMOSTRADO');                      // no "no se encontró"
    expect(u.certificado.puerta_sin_confirmar).toEqual({ zonas: ['OFICINA CEO'], cabe_sin_reserva: true });
    const texto = r.mensaje_vendedor.motivos.map((m) => m.texto).join(' ');
    expect(texto).toMatch(/Se probaron todas las combinaciones/);
    expect(texto).toMatch(/Confirma el giro de la puerta/);
    expect(r.render_ready).toBe(false);                                              // parcial ≠ publicable
    expect(r.status).not.toBe('PASS');
  });

  it('con la puerta del despacho confirmada: 22/22, PASS, publicable — credenza y archivero con el frente libre', () => {
    const areas = areasPuertaConfirmada();
    const r = construirRespuestaAcomodo(areas, piezasReales());
    expect(r.seleccion.ganador_eval.placed, JSON.stringify(r.seleccion.por_candidato)).toBe(22);
    expect(r.no_cupieron).toEqual([]);
    expect(duros(areas, r)).toEqual([]);
    expect(r.status).toBe('PASS');
    expect(r.render_ready).toBe(true);
    const byId = new Map(r.plan.piezas.map((p) => [String(p.id), p]));
    const guardado = r.plan.colocacion.filter((c) => /-(3|11)-1$/.test(c.id));
    expect(guardado).toHaveLength(2);
    const ceo = areas[guardado[0].area];
    for (const g of guardado) {
      expect(g.topology).toBe('STORAGE');
      const R = rectDe(g, byId.get(String(g.id)));
      const frente = g.facing === 'UP' ? ceo.largo - (R.y + R.d) : g.facing === 'DOWN' ? R.y : g.facing === 'RIGHT' ? R.x : ceo.ancho - (R.x + R.w);
      expect(frente, `${g.id} frente`).toBeGreaterThanOrEqual(STORAGE_FRONT_MIN_MM);
    }
  });

  it('determinismo: dos corridas dan el mismo ganador y la misma colocación', () => {
    const a = construirRespuestaAcomodo(FIX.areas, piezasReales());
    const b = construirRespuestaAcomodo(FIX.areas, piezasReales());
    expect(a.seleccion.ganador_orden).toBe(b.seleccion.ganador_orden);
    expect(JSON.stringify(a.plan.colocacion)).toBe(JSON.stringify(b.plan.colocacion));
  });
});

describe('mecanismos aislados', () => {
  it('1 · ACCESO en el conjunto legal: el camino determinista nunca deja un lado activo contra el muro', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 7000, largo: 4000 }];
    const sol = resolverKits(areas, df8());
    const sem = juzgarSemantico(areas, sol.piezas, sol.colocacion);
    expect(sem.issues.filter((i) => /BLOCKED_BY/.test(i.code))).toEqual([]);
    expect(sol.unplaced).toEqual([]);
    expect(sol.busqueda).toMatchObject({ completa: true, fase: 1 });
  });

  it('2 · BÚSQUEDA COMPLETA: dos benches de 4 en 8000×3200 → todas las estrategias colocan los 10', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 8000, largo: 3200 }];
    const bench = (g) => [
      mk('b' + g, 'ANCHOR_WORKSTATION', 3000, 1200, { functional_group_id: g, user_capacity: 4, placement_profile: { topology: 'DOUBLE_FACE', provenance: 'CATALOG', version: 'PP_V1' } }),
      ...Array.from({ length: 4 }, (_, i) => mk(`s${g}_${i}`, 'WORK_SEAT', 600, 600, { functional_group_id: g })),
    ];
    const m = resolverKitsMulti(areas, [...bench('g1'), ...bench('g2')]);
    expect(m.unplaced).toEqual([]);
    for (const c of m.seleccion.por_candidato) expect(c.placed, c.orden).toBe(10);
  });

  it('3 · RANKING: completo en REVIEW gana a incompleto en PASS; GAP18 intacto (PASS gana a FAIL con más piezas)', () => {
    const completo = { idx: 0, orden: 'row', eval: { hardOk: true, hard_issues: 0, placed: 22, sem_status: 'REVIEW_REQUIRED', semRank: 1, semFail: 0, semReview: 2, quality: 74 } };
    const parcial = { idx: 1, orden: 'center', eval: { hardOk: true, hard_issues: 0, placed: 15, sem_status: 'PASS', semRank: 2, semFail: 0, semReview: 0, quality: 54 } };
    expect(mejorCandidato(completo, parcial)).toBe(completo);
    expect(mejorCandidato(parcial, completo)).toBe(completo);
    const fail20 = { idx: 0, orden: 'row', eval: { hardOk: true, hard_issues: 0, placed: 20, sem_status: 'FAIL', semRank: 0, semFail: 4, semReview: 0, quality: 95 } };
    const pass19 = { idx: 1, orden: 'center', eval: { hardOk: true, hard_issues: 0, placed: 19, sem_status: 'PASS', semRank: 2, semFail: 0, semReview: 0, quality: 80 } };
    expect(mejorCandidato(fail20, pass19)).toBe(pass19);
  });

  it('4 · ORIENTACIÓN 180°: dos filas de una cara en 4600 mm → la segunda gira con las sillas hacia el pasillo', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 9000, largo: 4600 }];
    const ws = (g) => [
      mk('b' + g, 'ANCHOR_WORKSTATION', 9000, 1200, { functional_group_id: g, user_capacity: 6, placement_profile: { topology: 'SINGLE_FACE', provenance: 'CATALOG', version: 'PP_V1' } }),
      ...Array.from({ length: 6 }, (_, i) => mk(`s${g}_${i}`, 'WORK_SEAT', 600, 600, { functional_group_id: g })),
    ];
    const sol = resolverKits(areas, [...ws('g1'), ...ws('g2')]);
    expect(sol.unplaced).toEqual([]);
    expect(new Set(sol.colocacion.filter((c) => /^b/.test(c.id)).map((c) => c.kit_rot))).toEqual(new Set([0, 180]));
    for (const c of sol.colocacion) expect([0, 90]).toContain(c.rot);   // los validadores sólo leen 0/90
    expect(juzgarSemantico(areas, sol.piezas, sol.colocacion).issues.filter((i) => /BLOCKED_BY/.test(i.code))).toEqual([]);
  });

  it('5 · POR CUARTO: un despacho que no admite todo NO degrada el área operativa', () => {
    // despacho de 2.4 × 2.4 con escritorio + credenza (imposible) y un área operativa holgada con 2 benches
    const areas = [
      { nombre: 'DESPACHO', zone_id: 'DESPACHO', tipo: 'privado', ancho: 2400, largo: 2400 },
      { nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 8000, largo: 3200 },
    ];
    const bench = (g) => [
      mk('b' + g, 'ANCHOR_WORKSTATION', 3000, 1200, { functional_group_id: g, user_capacity: 4, placement_profile: { topology: 'DOUBLE_FACE', provenance: 'CATALOG', version: 'PP_V1' } }),
      ...Array.from({ length: 4 }, (_, i) => mk(`s${g}_${i}`, 'WORK_SEAT', 600, 600, { functional_group_id: g })),
    ];
    const despacho = [
      mk('desk', 'ANCHOR_DESK', 1600, 800, { functional_group_id: 'gd', zone_id: 'DESPACHO' }),
      mk('exec', 'EXECUTIVE_SEAT', 600, 600, { functional_group_id: 'gd', zone_id: 'DESPACHO' }),
      mk('cred', 'SUPPORT_STORAGE', 1800, 600, { functional_group_id: 'gs', zone_id: 'DESPACHO' }),
    ];
    const m = resolverKitsMulti(areas, [...despacho, ...bench('g1'), ...bench('g2')]);
    for (const c of m.seleccion.por_candidato) expect(c.placed, `${c.orden}: los 10 del área operativa + lo que cabe del despacho`).toBeGreaterThanOrEqual(12);
    const colocadas = new Set(m.colocacion.map((c) => String(c.id)));
    for (const id of ['bg1', 'bg2']) expect(colocadas.has(id), id).toBe(true);
    expect(m.busqueda.por_ancla.bg1).toEqual({ completa: true, exhaustiva: false });
  });

  it('6 · GUARDADO ADOSADO: credenza y archivero comparten muro sin pasillo entre ellos; cada frente conserva su espacio', () => {
    const areas = [{ nombre: 'P', zone_id: 'P', tipo: 'privado', ancho: 3000, largo: 2000 }];
    const piezas = [
      mk('cred', 'SUPPORT_STORAGE', 1800, 600, { functional_group_id: 'gs', zone_id: 'P' }),
      mk('arch', 'SUPPORT_STORAGE', 900, 450, { functional_group_id: 'gs2', zone_id: 'P' }),
    ];
    const r = construirRespuestaAcomodo(areas, piezas);
    expect(r.plan.colocacion).toHaveLength(2);                 // con 1 m obligatorio entre ambos no cabrían en 3.0 m de muro
    expect(duros(areas, r)).toEqual([]);                       // el validador duro acepta el adosado (hueco 0)
    const byId = new Map(r.plan.piezas.map((p) => [String(p.id), p]));
    const [a, b] = r.plan.colocacion.map((c) => rectDe(c, byId.get(String(c.id))));
    expect(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.d && a.y + a.d > b.y).toBe(false);   // sin encime
    for (const c of r.plan.colocacion) expect(c.topology).toBe('STORAGE');
    expect(juzgarSemantico(areas, r.plan.piezas, r.plan.colocacion).issues.filter((i) => /STORAGE_FRONT/.test(i.code))).toEqual([]);
  });

  it('7 · FRENTE DE GUARDADO: un archivero no se coloca con el frente a menos de 600 mm del muro; va con el respaldo al muro', () => {
    const areas = [{ nombre: 'P', zone_id: 'P', tipo: 'privado', ancho: 2000, largo: 1400 }];
    const r = construirRespuestaAcomodo(areas, [mk('arch', 'SUPPORT_STORAGE', 900, 450, { functional_group_id: 'gs', zone_id: 'P' })]);
    expect(r.plan.colocacion).toHaveLength(1);
    const c = r.plan.colocacion[0]; const R = rectDe(c, r.plan.piezas[0]);
    const frente = c.facing === 'UP' ? 1400 - (R.y + R.d) : c.facing === 'DOWN' ? R.y : c.facing === 'RIGHT' ? R.x : 2000 - (R.x + R.w);
    const respaldo = c.facing === 'UP' ? R.y : c.facing === 'DOWN' ? 1400 - (R.y + R.d) : c.facing === 'RIGHT' ? 2000 - (R.x + R.w) : R.x;
    expect(frente).toBeGreaterThanOrEqual(STORAGE_FRONT_MIN_MM);
    expect(respaldo).toBe(0);
    // cuarto donde NINGUNA orientación deja 600 mm de frente → no se coloca y se dice por qué (acceso)
    const chico = [{ nombre: 'P', zone_id: 'P', tipo: 'privado', ancho: 1000, largo: 900 }];
    const r2 = construirRespuestaAcomodo(chico, [mk('arch', 'SUPPORT_STORAGE', 900, 450, { functional_group_id: 'gs', zone_id: 'P' })]);
    expect(r2.plan.colocacion).toHaveLength(0);
    expect(r2.no_cupieron[0].certificado.primary_cause).toBe('ACCESS');
    expect(r2.no_cupieron[0].certificado.veredicto).toBe('NO_CABE_DEMOSTRADO');
  });
});

describe('VEREDICTO de búsqueda (tres estados que no son equivalentes)', () => {
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
  it('NO_SE_ENCONTRO_SOLUCION: la misma geometría con presupuesto agotado NO afirma imposibilidad', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 5000, largo: 4000 }];
    const sol = resolverKits(areas, df8());                 // 6000 no cabe en 5000: ASPECT_RATIO probado
    expect(sol.unplaced[0].certificado.veredicto).toBe('NO_CABE_DEMOSTRADO');
    const kit = sol._cert_ctx.kitsByAnchor.get('b');
    const agotado = certificarKit(kit, areas, { budgetExhausted: true, nodos: 1, busqueda: { completa: false, exhaustiva: false } });
    expect(agotado.veredicto).toBe('NO_SE_ENCONTRO_SOLUCION');
  });
  it('INFORMACION_INSUFICIENTE: cuarto sin dimensiones o pieza sin huella → nunca "imposible"', () => {
    const sol = resolverKits([{ nombre: 'OP', zone_id: 'OP', tipo: 'open' }], df8());
    expect(sol.unplaced).toHaveLength(1);
    expect(sol.unplaced[0].certificado.veredicto).toBe('INFORMACION_INSUFICIENTE');
    const sinHuella = [mk('b', 'ANCHOR_DESK', undefined, undefined, { user_capacity: 1, placement_profile: { topology: 'DESK', provenance: 'CATALOG', version: 'PP_V1' } }), mk('s0', 'EXECUTIVE_SEAT', 600, 600)];
    const sol2 = resolverKits([{ nombre: 'P', zone_id: 'OP', tipo: 'privado', ancho: 1200, largo: 1200 }], sinHuella);
    expect(sol2.unplaced).toHaveLength(1);
    expect(sol2.unplaced[0].certificado.veredicto).toBe('INFORMACION_INSUFICIENTE');
  });
});
