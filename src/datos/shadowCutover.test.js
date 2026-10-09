import { describe, it, expect } from 'vitest';
import { INSUMOS_SEMILLA, mapaInsumos, FUENTE_ERP } from './insumos.js';
import { ESTADO_PRECIO } from './precioProvenance.js';
import { shadowResolverInsumo, reporteShadowCatalogo, CAUSA_SHADOW } from './shadowCutover.js';

const CAT = mapaInsumos(INSUMOS_SEMILLA);
const HOY = '2026-10-09';

describe('SHADOW MOTOR CUTOVER · legacy vs canónico (ChatGPT §8)', () => {
  it('CATÁLOGO REAL: CERO diferencias numéricas → cutover SEGURO (no cambia números)', () => {
    const rep = reporteShadowCatalogo(CAT, { hoy: HOY });
    expect(rep.total).toBeGreaterThan(200);
    expect(rep.diferenciasNumericas).toBe(0);     // el número resuelto == legacy
    expect(rep.sinDiferenciaNumericaActual).toBe(true);
  });

  it('el reporte dice cuántos insumos quedarían como costo NO oficial (gate de procedencia)', () => {
    const rep = reporteShadowCatalogo(CAT, { hoy: HOY });
    // Hay provisionales (sin fuente) y reales sin fecha → bloquean costo oficial.
    expect(rep.bloqueanOficial).toBeGreaterThan(0);
    expect(rep.bloqueanOficial).toBeLessThan(rep.total);   // pero NO todos
  });

  it('un insumo del catálogo con precio real fechado: igual y NO bloquea oficial', () => {
    const f = shadowResolverInsumo('melamina-19', CAT['melamina-19'], { hoy: HOY });
    expect(f.igual).toBe(true);
    expect(f.causa).toBe(CAUSA_SHADOW.SIN_DIFERENCIA);
    expect(f.estado).toBe(ESTADO_PRECIO.REAL_OBSERVED_DATED);
    expect(f.bloqueaCostoOficial).toBe(false);
  });

  it('un precio CAPTURADO a mano: mismo número, pero provisional (bloquea oficial)', () => {
    const insManual = { precio: 600, precioBase: 544, actualizado: HOY, unidad: 'hoja', nombre: 'Melamina', fuente: 'Compras, lista del 2026-08-14' };
    const f = shadowResolverInsumo('melamina-19', insManual, { hoy: HOY });
    expect(f.legacy).toBe(600);
    expect(f.canonico).toBe(600);                 // mismo número
    expect(f.igual).toBe(true);
    expect(f.causa).toBe(CAUSA_SHADOW.CAPTURADO_A_MANO);
    expect(f.bloqueaCostoOficial).toBe(true);     // pero NO autentica → no oficial
  });

  it('un insumo ERP sin fecha: igual, estado UNDATED, bloquea oficial', () => {
    const f = shadowResolverInsumo('erp-x', { precio: 123, unidad: 'pz', fuente: FUENTE_ERP }, { hoy: HOY });
    expect(f.igual).toBe(true);
    expect(f.estado).toBe(ESTADO_PRECIO.REAL_OBSERVED_UNDATED);
    expect(f.bloqueaCostoOficial).toBe(true);
  });

  it('DETERMINISTA: mismo catálogo → mismo reporte', () => {
    expect(reporteShadowCatalogo(CAT, { hoy: HOY })).toEqual(reporteShadowCatalogo(CAT, { hoy: HOY }));
  });
});
