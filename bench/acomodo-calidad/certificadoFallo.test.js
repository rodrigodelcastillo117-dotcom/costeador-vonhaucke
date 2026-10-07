import { describe, it, expect } from 'vitest';
import { resolverKits, certificarKit } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';
import { mensajeVendedor } from '../../supabase/functions/acomodar-espacio-recovery/opciones.js';

// ============================================================================
//  P0.2c · GAP17 · CERTIFICADO DE FALLO (instrumentación pura). La causa se prueba
//  por CONTRAFÁCTICO (qué restricción, al quitarla, permite colocar), con BOUNDS y
//  POLYGON separados, POR ÁREA (sin sumar superficies), FULL vs MIN, partial_certificate,
//  presupuesto de diagnóstico PROPIO y marca PROVEN vs REVIEW. El certificado NO cambia
//  selección/PASS-FAIL; sólo describe el porqué.
// ============================================================================
const mk = (id, rol, w, d, extra = {}) => ({ id, relation_role: rol, w, d, functional_group_id: extra.g || 'g', zone_id: extra.z || 'OP', ...extra });
const ws = (cap, w, g = 'g', z = 'OP') => [mk('b' + g, 'ANCHOR_WORKSTATION', w, 1200, { user_capacity: cap, g, z }), ...Array.from({ length: cap }, (_, i) => mk('s' + g + i, 'WORK_SEAT', 600, 600, { g, z }))];
const certFull = (areas, piezas) => {
  const sol = resolverKits(areas, piezas);
  const u = (sol.unplaced || []).find((x) => x.certificado && x.certificado.permitted_areas);  // certificado COMPLETO
  return { sol, cert: u && u.certificado };
};

describe('P0.2c · GAP17 · causa exacta por contrafáctico', () => {
  it('A · ASPECT_RATIO: módulo más ancho que la zona, con superficie de sobra (PROVEN)', () => {
    const { cert } = certFull([{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 5000, largo: 4000 }], ws(4, 6000));
    expect(cert.primary_cause).toBe('ASPECT_RATIO');
    expect(cert.proven).toBe(true);
    expect(cert.secondary_causes).not.toContain('NO_SPACE');
    expect(cert.dimensional_fit.any_fits_bounds).toBe(false);
    expect(cert.dimensional_fit.haveM2).toBeGreaterThanOrEqual(cert.dimensional_fit.needM2); // superficie alcanza; falla la forma
  });

  it('B · MULTI_CONSTRAINT: no entra por dimensión Y la zona (por área) es muy chica', () => {
    const { cert } = certFull([{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 3000, largo: 3000 }], ws(4, 6000));
    expect(cert.primary_cause).toBe('MULTI_CONSTRAINT');
    expect(cert.secondary_causes).toEqual(expect.arrayContaining(['ASPECT_RATIO', 'NO_SPACE']));
    expect(cert.dimensional_fit.needM2).toBeGreaterThan(cert.dimensional_fit.haveM2); // haveM2 = MAYOR área individual
  });

  it('C · DOOR por CONTRAFÁCTICO: quitar la puerta permite colocar; con ella no', () => {
    const { cert } = certFull([{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 6100, largo: 1900, puertas: [{ x: 0, y: 0, ancho: 6000 }] }], ws(4, 6000));
    expect(cert.primary_cause).toBe('DOOR');
    expect(cert.dimensional_fit.any_fits_polygon).toBe(true);     // cabe ignorando puertas/obstáculos
    expect(cert.dimensional_fit.any_fits_full).toBe(false);
    const a = cert.permitted_areas[0];
    expect(a.counterfactual.no_doors).toBe(true);                 // sin puertas: cabe
  });

  it('D · OBSTACLE por CONTRAFÁCTICO: quitar la columna permite colocar', () => {
    const { cert } = certFull([{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 6100, largo: 1900, obstaculos: [{ x: 3000, y: 900, w: 100, h: 100 }] }], ws(4, 6000));
    expect(cert.primary_cause).toBe('OBSTACLE');
    expect(cert.permitted_areas[0].counterfactual.no_obstacles).toBe(true);
  });

  it('P · OUT_OF_POLYGON: cabe en BOUNDS pero el contorno real lo fragmenta', () => {
    const poly = [[0, 0], [8000, 0], [8000, 1000], [2000, 1000], [2000, 4000], [0, 4000]]; // "L" angosta
    const { cert } = certFull([{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 8000, largo: 4000, poly }], ws(4, 6000));
    expect(cert.primary_cause).toBe('OUT_OF_POLYGON');
    expect(cert.dimensional_fit.any_fits_bounds).toBe(true);
    expect(cert.dimensional_fit.any_fits_polygon).toBe(false);    // bounds sí, polígono no (separados)
  });

  it('E · INTER_KIT_CONSTRAINT: cabe aislado, pero dos estaciones fragmentan el espacio', () => {
    const { cert } = certFull([{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 7000, largo: 3000 }], [...ws(4, 6000, 'g1'), ...ws(4, 6000, 'g2')]);
    expect(cert.primary_cause).toBe('INTER_KIT_CONSTRAINT');
    expect(cert.proven).toBe(true);
    expect(cert.dimensional_fit.any_fits_full).toBe(true);        // cabe aislado
    expect((cert.rejected_by.OVERLAP || 0) + (cert.rejected_by.AISLE || 0)).toBeGreaterThan(0);
  });

  it('F · una imposibilidad REAL no se etiqueta como presupuesto agotado', () => {
    const { cert } = certFull([{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 5000, largo: 4000 }], ws(4, 6000));
    expect(cert.search_exhausted).toBe(true);
    expect(cert.evidence.budget_exhausted).toBe(false);
    expect(cert.primary_cause).not.toBe('SEARCH_BUDGET_EXHAUSTED');
    expect(cert.proven).toBe(true);
  });

  it('G · SEARCH_BUDGET_EXHAUSTED (17.2): timeout sin imposibilidad dura → REVIEW (proven=false)', () => {
    const kitStub = { base: { w: 1000, d: 1000, piezas: [] }, minimo: { w: 1000, d: 1000, piezas: [] }, dropMin: [], zonas: [0], _rej: { OVERLAP: 3 } };
    const cert = certificarKit(kitStub, [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 5000, largo: 5000 }], { budgetExhausted: true, nodos: 200001 });
    expect(cert.primary_cause).toBe('SEARCH_BUDGET_EXHAUSTED');
    expect(cert.proven).toBe(false);                              // NO imposibilidad comprobada
    expect(cert.dimensional_fit.any_fits_full).toBe(true);        // geométricamente SÍ cabría
    expect(cert.search_exhausted).toBe(false);
    expect(cert.evidence.budget_exhausted).toBe(true);
  });

  it('H (17.5) · todas las zonas permitidas quedan representadas (sin sumar superficies)', () => {
    const areas = [
      { nombre: 'OP1', zone_id: 'OP1', tipo: 'open', ancho: 5000, largo: 4000 },
      { nombre: 'OP2', zone_id: 'OP2', tipo: 'open', ancho: 5000, largo: 4000 },
    ];
    const piezas = ws(4, 6000).map((p) => ({ ...p, zone_id: undefined }));
    const { cert } = certFull(areas, piezas);
    expect(cert.permitted_areas.length).toBe(2);
    expect(cert.permitted_areas.map((a) => a.zone)).toEqual(expect.arrayContaining(['OP1', 'OP2']));
    expect(cert.dimensional_fit.haveM2).toBe(20);                 // MAYOR área individual (no 40 = suma)
  });

  it('I · histograma rejected_by y nodes_used reflejan la búsqueda real', () => {
    const { cert } = certFull([{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 6100, largo: 1900, obstaculos: [{ x: 3000, y: 900, w: 100, h: 100 }] }], ws(4, 6000));
    expect(Object.keys(cert.rejected_by).length).toBeGreaterThan(0);
    expect(cert.nodes_used).toBeGreaterThan(0);
  });

  it('MIN/PARTIAL: el kit completo no cabe pero el ancla sí → partial_certificate', () => {
    // Cuarto MUY BAJO (1300 mm): el tablero + gaveta entra, pero las sillas (frente
    // +600 mm) no → NO_SPACE_PARA_SILLAS con certificado PARCIAL (ancla colocable).
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 6200, largo: 1300 }];
    const piezas = [
      mk('b', 'ANCHOR_WORKSTATION', 6000, 1200, { user_capacity: 4, placement_profile: { topology: 'SINGLE_FACE', provenance: 'CATALOG', version: 'PP_V1' } }),
      ...Array.from({ length: 4 }, (_, i) => mk('s' + i, 'WORK_SEAT', 600, 600)),
      mk('gv', 'UNDERDESK_STORAGE', 400, 500),
    ];
    const sol = resolverKits(areas, piezas);
    const u = (sol.unplaced || []).find((x) => x.certificado);
    expect(u).toBeTruthy();
    expect(u.invariante).toBe('NO_SPACE_PARA_SILLAS');
    const pc = u.certificado.partial_certificate;
    expect(pc).toBeTruthy();
    expect(pc.anchor_placeable).toBe(true);
    expect(pc.minimum_fit).toBe(true);
    expect(Array.isArray(pc.dropped_dependents)).toBe(true);
    // GAP21: la CAUSA del kit completo está PROBADA por contrafáctico (NO "pasillo" por defecto).
    expect(pc.full_kit_cause).toBeTruthy();
    expect(['ASPECT_RATIO', 'NO_SPACE', 'MULTI_CONSTRAINT', 'DOOR', 'OBSTACLE', 'OUT_OF_POLYGON', 'INTER_KIT_CONSTRAINT']).toContain(pc.full_kit_cause);
    expect(pc.full_kit_proven).toBe(true);
    expect(pc.full_kit_evidence).toBeTruthy();
  });
});

describe('P0.2c · GAP17 · el mensaje al vendedor consume la causa PROBADA', () => {
  it('ASPECT_RATIO: el texto habla de forma/dimensión, nunca "necesita ~X m²"', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 5000, largo: 4000 }];
    const sol = resolverKits(areas, ws(4, 6000));
    const m = mensajeVendedor(areas, sol.piezas, sol, { resolver: resolverKits }).motivos[0];
    expect(m.invariante).toBe('ASPECT_RATIO');
    expect(m.texto).toMatch(/forma|ancho|fondo/i);
    expect(m.texto).not.toMatch(/necesita ~[\d.]+ m²/);
    expect(m.evidencia.primary_cause).toBe('ASPECT_RATIO');
  });

  it('INTER_KIT_CONSTRAINT: el texto dice que cabe solo pero no junto a los demás', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 7000, largo: 3000 }];
    const sol = resolverKits(areas, [...ws(4, 6000, 'g1'), ...ws(4, 6000, 'g2')]);
    const m = mensajeVendedor(areas, sol.piezas, sol, { resolver: resolverKits }).motivos.find((x) => x.invariante === 'INTER_KIT_CONSTRAINT');
    expect(m).toBeTruthy();
    expect(m.texto).toMatch(/solo|pasillo|bloques/i);
    expect(m.texto).not.toMatch(/necesita ~[\d.]+ m²/);
  });

  it('SEARCH_BUDGET_EXHAUSTED (17.2): el mensaje pide revisión, no afirma imposibilidad', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 5000, largo: 5000 }];
    const anc = mk('bX', 'ANCHOR_WORKSTATION', 1000, 1000, { user_capacity: 1 });
    const certificado = certificarKit({ base: { w: 1000, d: 1000, piezas: [] }, minimo: { w: 1000, d: 1000, piezas: [] }, dropMin: [], zonas: [0], _rej: {} }, areas, { budgetExhausted: true, nodos: 200001 });
    const sol = { unplaced: [{ anchorId: 'bX', piezas: ['bX'], invariante: 'NO_SPACE', certificado }], unassigned: [] };
    const m = mensajeVendedor(areas, [anc], sol, {}).motivos[0];
    expect(m.invariante).toBe('SEARCH_BUDGET_EXHAUSTED');
    expect(m.texto).toMatch(/revisi[oó]n manual|no es una imposibilidad/i);
  });
});
