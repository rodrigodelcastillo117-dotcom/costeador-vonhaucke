import { describe, it, expect } from 'vitest';
import {
  ESTADO_PRECIO, FUENTE_PRECIO, INTRINSECO,
  normalizarObservacionPrecio, confianzaObservacion,
} from './precioProvenance.js';
import {
  resolverPrecioCanonico, explicarPrecio, bloqueaCostoOficial, resolverCatalogoPrecios,
} from './canonicalPriceResolver.js';
import { observacionDesdeIntelisis, IntelisisPriceProvider } from './intelisisPriceProvider.js';

// Observación real de VH: la melamina EcoLegno del ejemplo de Rodrigo.
const COMPRA_544 = {
  canonical_insumo_id: 'melamina-ecolegno-19mm',
  precio: 544, moneda: 'MXN', unidad_compra: 'hoja', unidad_costeo: 'hoja',
  fuente: FUENTE_PRECIO.COMPRA_REAL, source_document: 'OC-2026-0918-ECO',
  source_date: '2026-09-18', supplier: 'EcoLegno', evidence: 'OC escaneada',
};
const HOY = '2026-10-08';

// ============================================================================
describe('precioProvenance · normalización y clasificación intrínseca', () => {
  it('compra real completa → intrínseco REAL, sin issues, utilizable', () => {
    const o = normalizarObservacionPrecio(COMPRA_544);
    expect(o.intrinseco).toBe(INTRINSECO.REAL);
    expect(o.issues).toEqual([]);
    expect(o.precioUtilizable).toBe(true);
  });

  it('precio AUSENTE → PENDING (nunca $0 como desconocido)', () => {
    const o = normalizarObservacionPrecio({ ...COMPRA_544, precio: undefined });
    expect(o.intrinseco).toBe(INTRINSECO.PENDING);
    expect(o.issues).toContain('SIN_PRECIO');
    expect(o.precio).toBeNull();          // NO 0
  });

  it('precio NULL explícito → precio null y PENDING (regresión num(null)≠0)', () => {
    const o = normalizarObservacionPrecio({ ...COMPRA_544, precio: null });
    expect(o.precio).toBeNull();          // NO 0 (Number(null)===0 sería el bug)
    expect(o.intrinseco).toBe(INTRINSECO.PENDING);
    expect(o.issues).toContain('SIN_PRECIO');
  });

  it('$0 sin evidencia real → inválido (PENDING); $0 con es_cero_real → utilizable', () => {
    expect(normalizarObservacionPrecio({ ...COMPRA_544, precio: 0 }).issues).toContain('PRECIO_CERO_SIN_EVIDENCIA');
    const real0 = normalizarObservacionPrecio({ ...COMPRA_544, precio: 0, es_cero_real: true });
    expect(real0.precioUtilizable).toBe(true);
  });

  it('unidad compra ≠ costeo sin conversión → issue (no confundir kg/hoja/m²/pieza)', () => {
    const o = normalizarObservacionPrecio({ ...COMPRA_544, unidad_compra: 'hoja', unidad_costeo: 'm2' });
    expect(o.issues).toContain('FALTA_CONVERSION_UNIDAD');
  });

  it('estimado sin documento → PROVISIONAL (no real)', () => {
    const o = normalizarObservacionPrecio({ canonical_insumo_id: 'x', precio: 100, unidad_compra: 'pz', fuente: FUENTE_PRECIO.PROVISIONAL });
    expect(o.intrinseco).toBe(INTRINSECO.PROVISIONAL);
  });

  it('confianza: compra real con doc/fecha/evidencia > provisional', () => {
    const real = normalizarObservacionPrecio(COMPRA_544);
    const prov = normalizarObservacionPrecio({ canonical_insumo_id: 'x', precio: 100, unidad_compra: 'pz', fuente: FUENTE_PRECIO.PROVISIONAL });
    expect(confianzaObservacion(real)).toBeGreaterThan(confianzaObservacion(prov));
  });
});

// ============================================================================
describe('CanonicalPriceResolver · selección determinista', () => {
  it('EJEMPLO RODRIGO: una compra real $544 → REAL_OBSERVED, no bloquea costo oficial', () => {
    const r = resolverPrecioCanonico('melamina-ecolegno-19mm', [COMPRA_544], { hoy: HOY });
    expect(r.estado).toBe(ESTADO_PRECIO.REAL_OBSERVED_DATED);
    expect(r.precio).toBe(544);
    expect(r.supplier).toBe('EcoLegno');
    expect(r.source_date).toBe('2026-09-18');
    expect(bloqueaCostoOficial(r)).toBe(false);
  });

  it('"¿por qué $544?" → explicación auditable con fuente, proveedor y fecha', () => {
    const r = resolverPrecioCanonico('melamina-ecolegno-19mm', [COMPRA_544], { hoy: HOY });
    const texto = explicarPrecio(r, 'Melamina EcoLegno 19 mm');
    expect(texto).toContain('Compra real');
    expect(texto).toContain('EcoLegno');
    expect(texto).toContain('544');
    expect(texto).toContain('/hoja');
    expect(texto).toMatch(/2026/);
  });

  it('NO asume "última compra = vigente eternamente": sin vigencia explícita es REAL_OBSERVED, no CURRENT_VERIFIED', () => {
    const r = resolverPrecioCanonico('melamina-ecolegno-19mm', [COMPRA_544], { hoy: HOY });
    expect(r.estado).not.toBe(ESTADO_PRECIO.CURRENT_VERIFIED);
    expect(r.estado).toBe(ESTADO_PRECIO.REAL_OBSERVED_DATED);
  });

  it('observación POSTERIOR gana; la anterior queda como HISTORICAL en alternativas', () => {
    const nueva = { ...COMPRA_544, precio: 562, source_date: '2026-10-05', source_document: 'OC-2026-1005-ECO' };
    const r = resolverPrecioCanonico('melamina-ecolegno-19mm', [COMPRA_544, nueva], { hoy: HOY });
    expect(r.precio).toBe(562);
    expect(r.source_date).toBe('2026-10-05');
    expect(r.alternativas[0]).toMatchObject({ estado: ESTADO_PRECIO.HISTORICAL, precio: 544 });
  });

  it('vigencia explícita que cubre hoy → CURRENT_VERIFIED y gana a una compra más reciente sin vigencia', () => {
    const verificado = { ...COMPRA_544, precio: 530, source_date: '2026-08-01', validity: '2026-12-31', source_document: 'LISTA-2026-H2' };
    const compraReciente = { ...COMPRA_544, precio: 544, source_date: '2026-09-18' };
    const r = resolverPrecioCanonico('melamina-ecolegno-19mm', [verificado, compraReciente], { hoy: HOY });
    expect(r.estado).toBe(ESTADO_PRECIO.CURRENT_VERIFIED);
    expect(r.precio).toBe(530);
  });

  it('vigencia VENCIDA → HISTORICAL y BLOQUEA costo oficial (ChatGPT #4), no REAL_OBSERVED', () => {
    const vencido = { ...COMPRA_544, precio: 500, source_date: '2025-01-01', validity: '2025-06-30', source_document: 'LISTA-2025' };
    const r = resolverPrecioCanonico('melamina-ecolegno-19mm', [vencido], { hoy: HOY });
    expect(r.estado).toBe(ESTADO_PRECIO.HISTORICAL);        // vigencia que ya pasó
    expect(r.bloqueaCostoOficial).toBe(true);
    // Pero si además hay una compra real SIN vigencia, ésa (real conocida) gana al vencido.
    const r2 = resolverPrecioCanonico('melamina-ecolegno-19mm', [vencido, COMPRA_544], { hoy: HOY });
    expect(r2.estado).toBe(ESTADO_PRECIO.REAL_OBSERVED_DATED);
    expect(r2.precio).toBe(544);
  });

  it('P0-B adversarial · vigencia MALFORMED → fail-closed HISTORICAL (no se asume vigente)', () => {
    const malformed = { ...COMPRA_544, precio: 500, source_date: '2026-09-01', validity: 'no-es-fecha', source_document: 'LISTA-X' };
    const r = resolverPrecioCanonico('melamina-ecolegno-19mm', [malformed], { hoy: HOY });
    expect(r.estado).toBe(ESTADO_PRECIO.HISTORICAL);        // vigencia ilegible ⇒ no confirma vigente
    expect(r.bloqueaCostoOficial).toBe(true);
  });

  it('P0-B adversarial · vigencia FUTURA (cubre hoy) → CURRENT_VERIFIED', () => {
    const futura = { ...COMPRA_544, precio: 520, source_date: '2026-09-01', validity: '2027-12-31', source_document: 'LISTA-FUT' };
    const r = resolverPrecioCanonico('melamina-ecolegno-19mm', [futura], { hoy: HOY });
    expect(r.estado).toBe(ESTADO_PRECIO.CURRENT_VERIFIED);
    expect(r.bloqueaCostoOficial).toBe(false);
  });

  it('P0-B adversarial · expired + current-verified → gana el vigente verificado', () => {
    const vencido = { ...COMPRA_544, precio: 500, source_date: '2026-01-01', validity: '2026-02-28', source_document: 'VIEJA' };
    const vigente = { ...COMPRA_544, precio: 540, source_date: '2026-08-01', validity: '2026-12-31', source_document: 'VIGENTE' };
    const r = resolverPrecioCanonico('melamina-ecolegno-19mm', [vencido, vigente], { hoy: HOY });
    expect(r.estado).toBe(ESTADO_PRECIO.CURRENT_VERIFIED);
    expect(r.precio).toBe(540);
  });

  it('P0-B adversarial · expired + newer REAL sin vigencia → gana el real conocido (DATED)', () => {
    const vencido = { ...COMPRA_544, precio: 500, source_date: '2025-01-01', validity: '2025-06-30', source_document: 'VIEJA' };
    const realNuevo = { ...COMPRA_544, precio: 560, source_date: '2026-10-01', source_document: 'OC-NUEVA' };
    const r = resolverPrecioCanonico('melamina-ecolegno-19mm', [vencido, realNuevo], { hoy: HOY });
    expect(r.estado).toBe(ESTADO_PRECIO.REAL_OBSERVED_DATED);
    expect(r.precio).toBe(560);
  });

  it('SIN observaciones utilizables → PENDING y BLOQUEA costo oficial (no inventa)', () => {
    const r = resolverPrecioCanonico('insumo-sin-precio', [
      { canonical_insumo_id: 'insumo-sin-precio', unidad_compra: 'pz', fuente: FUENTE_PRECIO.COMPRA_REAL, source_date: '2026-01-01' },
    ], { hoy: HOY });
    expect(r.estado).toBe(ESTADO_PRECIO.PENDING);
    expect(r.precio).toBeNull();
    expect(bloqueaCostoOficial(r)).toBe(true);
    expect(explicarPrecio(r)).toMatch(/no se emite costo oficial/i);
  });

  it('identidad EXACTA: observaciones de OTRO insumo no contaminan', () => {
    const otro = { ...COMPRA_544, canonical_insumo_id: 'otro-material', precio: 9999 };
    const r = resolverPrecioCanonico('melamina-ecolegno-19mm', [COMPRA_544, otro], { hoy: HOY });
    expect(r.precio).toBe(544);
  });

  it('provisional sólo si no hay nada real; marca que bloquea costo oficial', () => {
    const prov = { canonical_insumo_id: 'z', precio: 120, unidad_compra: 'pz', fuente: FUENTE_PRECIO.PROVISIONAL };
    const r = resolverPrecioCanonico('z', [prov], { hoy: HOY });
    expect(r.estado).toBe(ESTADO_PRECIO.PROVISIONAL);
    expect(bloqueaCostoOficial(r)).toBe(true);
  });

  it('resolverCatalogoPrecios agrupa por id y resuelve cada insumo', () => {
    const cat = resolverCatalogoPrecios([
      COMPRA_544,
      { canonical_insumo_id: 'z', precio: 120, unidad_compra: 'pz', fuente: FUENTE_PRECIO.PROVISIONAL },
    ], { hoy: HOY });
    expect(cat['melamina-ecolegno-19mm'].estado).toBe(ESTADO_PRECIO.REAL_OBSERVED_DATED);
    expect(cat['z'].estado).toBe(ESTADO_PRECIO.PROVISIONAL);
  });

  it('DETERMINISTA: mismas entradas → misma resolución', () => {
    const a = resolverPrecioCanonico('melamina-ecolegno-19mm', [COMPRA_544], { hoy: HOY });
    const b = resolverPrecioCanonico('melamina-ecolegno-19mm', [COMPRA_544], { hoy: HOY });
    expect(a).toEqual(b);
  });
});

// ============================================================================
describe('IntelisisPriceProvider · adapter de diseño (NO integrado)', () => {
  it('no está integrado y fetch() lanza ERP_NO_INTEGRADO (no finge datos)', async () => {
    expect(IntelisisPriceProvider.estaIntegrado()).toBe(false);
    await expect(IntelisisPriceProvider.fetch()).rejects.toThrow(/ERP_NO_INTEGRADO/);
  });

  it('produce el MISMO contrato de observación que consume el resolver', () => {
    const fila = { clave_erp: 'ECO-19', descripcion: 'Melamina EcoLegno 19mm', precio: 562, unidad_compra: 'hoja', vigencia: '2026-12-31', proveedor: 'EcoLegno', evidencia: 'INT-123' };
    const obs = observacionDesdeIntelisis(fila, () => 'melamina-ecolegno-19mm');
    expect(obs.canonical_insumo_id).toBe('melamina-ecolegno-19mm');
    expect(obs.fuente).toBe(FUENTE_PRECIO.INTELISIS);
    // El resolver lo consume SIN cambios: Intelisis con vigencia vigente → CURRENT_VERIFIED.
    const r = resolverPrecioCanonico('melamina-ecolegno-19mm', [obs], { hoy: HOY });
    expect(r.precio).toBe(562);
    expect(r.estado).toBe(ESTADO_PRECIO.CURRENT_VERIFIED);
  });

  it('Intelisis (autoritativo) gana a una compra real más antigua — sólo cambia el origen', () => {
    const filaInt = { clave_erp: 'ECO-19', precio: 562, unidad_compra: 'hoja', vigencia: '2026-12-31', proveedor: 'EcoLegno', evidencia: 'INT-123' };
    const obsInt = observacionDesdeIntelisis(filaInt, () => 'melamina-ecolegno-19mm');
    const r = resolverPrecioCanonico('melamina-ecolegno-19mm', [COMPRA_544, obsInt], { hoy: HOY });
    expect(r.precio).toBe(562);
    expect(r.fuente).toBe(FUENTE_PRECIO.INTELISIS);
  });
});
