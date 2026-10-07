import { describe, it, expect } from 'vitest';
import { resolverKits, certificarKit } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';
import { mensajeVendedor } from '../../supabase/functions/acomodar-espacio-recovery/opciones.js';

// ============================================================================
//  P0.2c · GAP17 · CERTIFICADO DE FALLO (instrumentación pura). Fixtures de CAUSA
//  EXACTA A-I: cada una afirma el primary_cause PROBADO + su evidencia medida.
//  El certificado NO cambia selección/PASS-FAIL; sólo describe el porqué.
// ============================================================================
const mk = (id, rol, w, d, extra = {}) => ({ id, relation_role: rol, w, d, functional_group_id: extra.g || 'g', zone_id: extra.z || 'OP', ...extra });
const ws = (cap, w, g = 'g', z = 'OP') => [mk('b' + g, 'ANCHOR_WORKSTATION', w, 1200, { user_capacity: cap, g, z }), ...Array.from({ length: cap }, (_, i) => mk('s' + g + i, 'WORK_SEAT', 600, 600, { g, z }))];
const certDe = (areas, piezas) => {
  const sol = resolverKits(areas, piezas);
  const u = (sol.unplaced || []).find((x) => x.certificado);
  return { sol, cert: u && u.certificado };
};

describe('P0.2c · GAP17 · fixtures de causa exacta', () => {
  it('A · ASPECT_RATIO: módulo más ancho que la zona, con superficie de sobra', () => {
    const { cert } = certDe([{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 5000, largo: 4000 }], ws(4, 6000));
    expect(cert.primary_cause).toBe('ASPECT_RATIO');
    expect(cert.secondary_causes).not.toContain('NO_SPACE');
    expect(cert.dimensional_fit.any_fits_dims).toBe(false);
    expect(cert.dimensional_fit.haveM2).toBeGreaterThanOrEqual(cert.dimensional_fit.needM2); // superficie alcanza; falla la forma
  });

  it('B · MULTI_CONSTRAINT: no entra por dimensión Y la superficie total no alcanza', () => {
    const { cert } = certDe([{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 3000, largo: 3000 }], ws(4, 6000));
    expect(cert.primary_cause).toBe('MULTI_CONSTRAINT');
    expect(cert.secondary_causes).toEqual(expect.arrayContaining(['ASPECT_RATIO', 'NO_SPACE']));
    expect(cert.dimensional_fit.needM2).toBeGreaterThan(cert.dimensional_fit.haveM2);
  });

  it('C · DOOR: entra por dimensión pero el barrido de la puerta bloquea todo frente', () => {
    const { cert } = certDe([{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 6100, largo: 1900, puertas: [{ x: 0, y: 0, ancho: 6000 }] }], ws(4, 6000));
    expect(cert.primary_cause).toBe('DOOR');
    expect(cert.dimensional_fit.any_fits_dims).toBe(true);
    expect(cert.dimensional_fit.any_fits_with_doors).toBe(false);
    expect(cert.rejected_by.DOOR).toBeGreaterThan(0);
  });

  it('D · OBSTACLE: una columna ocupa el único punto donde cabría el módulo', () => {
    const { cert } = certDe([{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 6100, largo: 1900, obstaculos: [{ x: 3000, y: 900, w: 100, h: 100 }] }], ws(4, 6000));
    expect(cert.primary_cause).toBe('OBSTACLE');
    expect(cert.dimensional_fit.any_fits_dims).toBe(true);
    expect(cert.rejected_by.OBSTACLE).toBeGreaterThan(0);
  });

  it('E · CONTIGUOUS_SPACE: cabe solo, pero dos estaciones fragmentan el espacio', () => {
    const { cert } = certDe([{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 7000, largo: 3000 }], [...ws(4, 6000, 'g1'), ...ws(4, 6000, 'g2')]);
    expect(cert.primary_cause).toBe('CONTIGUOUS_SPACE');
    expect(cert.dimensional_fit.any_fits_with_doors).toBe(true);           // cabe aislado
    expect(cert.dimensional_fit.haveM2).toBeGreaterThan(cert.dimensional_fit.needM2);
    expect((cert.rejected_by.OVERLAP || 0) + (cert.rejected_by.AISLE || 0)).toBeGreaterThan(0);
  });

  it('F · una imposibilidad REAL no se etiqueta como presupuesto agotado', () => {
    const { cert } = certDe([{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 5000, largo: 4000 }], ws(4, 6000));
    expect(cert.search_exhausted).toBe(true);                // exploró todo (no hubo timeout)
    expect(cert.evidence.budget_exhausted).toBe(false);
    expect(cert.primary_cause).not.toBe('SEARCH_BUDGET_EXHAUSTED');
  });

  it('G · SEARCH_BUDGET_EXHAUSTED (17.2): timeout sin imposibilidad geométrica → NO imposible', () => {
    const kitStub = { base: { w: 1000, d: 1000, piezas: [] }, zonas: [0], _rej: { OVERLAP: 3 } };
    const cert = certificarKit(kitStub, [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 5000, largo: 5000 }], { budgetExhausted: true, nodos: 200001 });
    expect(cert.primary_cause).toBe('SEARCH_BUDGET_EXHAUSTED');
    expect(cert.dimensional_fit.any_fits_dims).toBe(true);   // geométricamente SÍ cabría
    expect(cert.search_exhausted).toBe(false);
    expect(cert.evidence.budget_exhausted).toBe(true);
  });

  it('H (17.5) · todas las zonas permitidas quedan representadas en el certificado', () => {
    const areas = [
      { nombre: 'OP1', zone_id: 'OP1', tipo: 'open', ancho: 5000, largo: 4000 },
      { nombre: 'OP2', zone_id: 'OP2', tipo: 'open', ancho: 5000, largo: 4000 },
    ];
    // ancla sin zone_id → ambas zonas 'open' son permitidas
    const piezas = ws(4, 6000).map((p) => ({ ...p, zone_id: undefined }));
    const { cert } = certDe(areas, piezas);
    expect(cert.permitted_areas.length).toBe(2);
    expect(cert.permitted_areas.map((a) => a.zone)).toEqual(expect.arrayContaining(['OP1', 'OP2']));
  });

  it('I · el histograma rejected_by y nodes_used reflejan la búsqueda real', () => {
    const { cert } = certDe([{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 6100, largo: 1900, obstaculos: [{ x: 3000, y: 900, w: 100, h: 100 }] }], ws(4, 6000));
    expect(Object.keys(cert.rejected_by).length).toBeGreaterThan(0);
    expect(cert.nodes_used).toBeGreaterThan(0);
  });
});

describe('P0.2c · GAP17 · el mensaje al vendedor consume la causa PROBADA', () => {
  it('ASPECT_RATIO: el texto habla de forma/dimensión, nunca "necesita ~X m²"', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 5000, largo: 4000 }];
    const piezas = ws(4, 6000);
    const sol = resolverKits(areas, piezas);
    const m = mensajeVendedor(areas, sol.piezas, sol, { resolver: resolverKits }).motivos[0];
    expect(m.invariante).toBe('ASPECT_RATIO');
    expect(m.texto).toMatch(/forma|ancho|fondo/i);
    expect(m.texto).not.toMatch(/necesita ~[\d.]+ m²/);
    expect(m.evidencia.primary_cause).toBe('ASPECT_RATIO');
  });

  it('SEARCH_BUDGET_EXHAUSTED (17.2): el mensaje pide revisión, no afirma imposibilidad', () => {
    const areas = [{ nombre: 'OP', zone_id: 'OP', tipo: 'open', ancho: 5000, largo: 5000 }];
    const anc = mk('bX', 'ANCHOR_WORKSTATION', 1000, 1000, { user_capacity: 1 });
    const certificado = certificarKit({ base: { w: 1000, d: 1000, piezas: [] }, zonas: [0], _rej: {} }, areas, { budgetExhausted: true, nodos: 200001 });
    const sol = { unplaced: [{ anchorId: 'bX', piezas: ['bX'], invariante: 'NO_SPACE', certificado }], unassigned: [] };
    const m = mensajeVendedor(areas, [anc], sol, {}).motivos[0];
    expect(m.invariante).toBe('SEARCH_BUDGET_EXHAUSTED');
    expect(m.texto).toMatch(/revisi[oó]n manual|no es una imposibilidad/i);
  });
});
