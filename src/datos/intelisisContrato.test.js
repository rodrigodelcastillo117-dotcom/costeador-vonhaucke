import { describe, it, expect } from 'vitest';
import {
  INTELISIS_SOURCES,
  normalizarMaterialIntelisis,
  normalizarUnidadIntelisis,
  precioSupabaseDesdeIntelisis,
  resumirLoteIntelisis,
} from './intelisisContrato.js';

const bueno = {
  clave_erp: 'MVLMAG01280800',
  descripcion: 'AGLOMERADO MELAMINA DOS CARAS 4x8 28 mm',
  proveedor: 'Proveedor ERP',
  unidad_compra: 'hoja',
  unidad_consumo: 'm2',
  factor_conversion: 2.9768,
  precio_compra: '1,335.60',
  moneda: 'MXN',
  fecha_ultima_compra: '2026-08-07',
  orden_compra: 'OC-12345',
};

const normal = (raw = bueno, opts = {}) =>
  normalizarMaterialIntelisis(raw, {
    source: INTELISIS_SOURCES.SQL,
    snapshotId: 'snap-20261006-001',
    ...opts,
  });

describe('Intelisis v1 · contrato canónico fail-closed', () => {
  it('normaliza aliases de unidad sin inventar conversiones no-identidad', () => {
    expect(normalizarUnidadIntelisis('PIEZAS')).toBe('pza');
    expect(normalizarUnidadIntelisis('metros cuadrados')).toBe('m2');
    expect(normalizarUnidadIntelisis('unidad-rara')).toBeNull();
  });

  it('acepta un registro trazable y completo con enums reales de Supabase', () => {
    const r = normal(bueno);
    expect(r.costeable).toBe(true);
    expect(r.precio_compra).toBe(1335.6);
    expect(r.unidad_compra).toBe('hoja');
    expect(r.unidad_consumo).toBe('m2');
    expect(r.factor_conversion).toBe(2.9768);
    expect(r.evidence_status).toBe('documentada');
    expect(r.confidence).toBe('alta');
    expect(r.issues).toEqual([]);
  });

  it('acepta formatos numéricos MX/US comunes sin aceptar texto libre', () => {
    expect(normal({ ...bueno, precio_compra: '$1,335.60' }).precio_compra).toBe(1335.6);
    expect(normal({ ...bueno, precio_compra: '1.335,60' }).precio_compra).toBe(1335.6);
    expect(normal({ ...bueno, precio_compra: '1335,60' }).precio_compra).toBe(1335.6);
    expect(normal({ ...bueno, precio_compra: 'MXN 1335.60' }).costeable).toBe(false);
  });

  it('bloquea precio sin evidencia aunque venga de Intelisis real', () => {
    const r = normal({ ...bueno, orden_compra: '' });
    expect(r.costeable).toBe(false);
    expect(r.issues).toContain('MISSING_EVIDENCE');
    expect(r.evidence_status).toBe('sin_evidencia');
    expect(r.confidence).toBe('baja');
  });

  it('bloquea unidad distinta sin factor de conversión', () => {
    const r = normal({ ...bueno, factor_conversion: '' });
    expect(r.costeable).toBe(false);
    expect(r.issues).toContain('MISSING_CONVERSION');
  });

  it('usa factor 1 sólo para identidad de unidades', () => {
    const r = normal({
      ...bueno,
      unidad_compra: 'pza',
      unidad_consumo: '',
      factor_conversion: '',
    });
    expect(r.costeable).toBe(true);
    expect(r.unidad_consumo).toBe('pza');
    expect(r.factor_conversion).toBe(1);
  });

  it('no adivina fechas ambiguas ni permite fechas calendario imposibles', () => {
    expect(normal({ ...bueno, fecha_ultima_compra: '08/07/2026' }).issues)
      .toContain('INVALID_OR_AMBIGUOUS_DATE');
    expect(normal({ ...bueno, fecha_ultima_compra: '2026-02-30' }).issues)
      .toContain('INVALID_OR_AMBIGUOUS_DATE');
    expect(normal({ ...bueno, fecha_ultima_compra: '2026-13-01' }).issues)
      .toContain('INVALID_OR_AMBIGUOUS_DATE');
  });

  it('moneda es obligatoria y v1 bloquea EUR hasta tener FX por moneda', () => {
    expect(normal({ ...bueno, moneda: '' }).issues).toContain('MISSING_CURRENCY');
    expect(normal({ ...bueno, moneda: 'EUR' }).issues).toContain('UNSUPPORTED_CURRENCY');
    expect(normal({ ...bueno, moneda: 'USD' }).costeable).toBe(false);
    const usd = normal({ ...bueno, moneda: 'USD', tipo_cambio_mxn: 17.5 });
    expect(usd.costeable).toBe(true);
    expect(usd.precio_mxn).toBeCloseTo(23373, 6);
  });

  it('requiere snapshot/batch para reproducibilidad', () => {
    const r = normalizarMaterialIntelisis(bueno, {
      source: INTELISIS_SOURCES.API,
      snapshotId: '',
    });
    expect(r.costeable).toBe(false);
    expect(r.issues).toContain('MISSING_SNAPSHOT');
  });

  it('no admite costo cero, negativo o texto corrupto', () => {
    expect(normal({ ...bueno, precio_compra: 0 }).costeable).toBe(false);
    expect(normal({ ...bueno, precio_compra: -1 }).costeable).toBe(false);
    expect(normal({ ...bueno, precio_compra: 'MXN 100' }).costeable).toBe(false);
  });

  it('requiere mapeo explícito ERP→insumo interno antes de escribir', () => {
    const r = normal(bueno);
    expect(() => precioSupabaseDesdeIntelisis(r)).toThrow('MISSING_INTERNAL_INSUMO_ID');
    const p = precioSupabaseDesdeIntelisis(r, {
      insumoId: 'melamina-28',
      unidadCosteoInterna: 'm2',
    });
    expect(p.insumo_id).toBe('melamina-28');
    expect(p.estado).toBe('propuesto');
    expect(p.requiere_validacion_compras).toBe(true);
    expect(p.confidence).toBe('alta');
    expect(p.evidence_status).toBe('documentada');
    expect(p.propiedades.clave_erp).toBe('MVLMAG01280800');
    expect(p.propiedades.moneda).toBe('MXN');
    expect(p.propiedades.moneda_origen).toBe('MXN');
    expect(p.propiedades.precio_origen).toBe(1335.6);
    expect(p.propiedades.snapshot_id).toBe('snap-20261006-001');
  });

  it('bloquea discrepancia entre unidad ERP y unidad canónica interna', () => {
    const r = normal(bueno);
    expect(() => precioSupabaseDesdeIntelisis(r, {
      insumoId: 'melamina-28',
      unidadCosteoInterna: 'kg',
    })).toThrow('ERP_INTERNAL_UNIT_MISMATCH');
  });

  it('bloquea discrepancia entre TC y costo MXN del ERP', () => {
    const r = normal({
      ...bueno,
      moneda: 'USD',
      tipo_cambio_mxn: 17.5,
      costo_mxn: 999,
    });
    expect(r.costeable).toBe(false);
    expect(r.issues).toContain('FX_COST_MISMATCH');
  });

  it('jamás convierte un registro bloqueado a precio de Supabase', () => {
    const malo = normal({ ...bueno, moneda: 'EUR' });
    expect(malo.costeable).toBe(false);
    expect(() => precioSupabaseDesdeIntelisis(malo, { insumoId: 'x' }))
      .toThrow('INTELISIS_RECORD_NOT_COSTABLE');
  });

  it('resume cobertura y causas del lote', () => {
    const lote = [
      normal(bueno),
      normal({ ...bueno, orden_compra: '' }),
      normal({ ...bueno, unidad_compra: '???' }),
      normal({ ...bueno, clave_erp: 'OTRO' }),
    ];
    expect(resumirLoteIntelisis(lote)).toMatchObject({
      total: 4,
      costeables: 2,
      bloqueados: 2,
      cobertura_pct: 50,
    });
  });
});
