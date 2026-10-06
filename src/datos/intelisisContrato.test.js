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

describe('Intelisis v1 · contrato canónico fail-closed', () => {
  it('normaliza aliases de unidad sin inventar conversiones', () => {
    expect(normalizarUnidadIntelisis('PIEZAS')).toBe('pza');
    expect(normalizarUnidadIntelisis('metros cuadrados')).toBe('m2');
    expect(normalizarUnidadIntelisis('unidad-rara')).toBeNull();
  });

  it('acepta un registro trazable y completo', () => {
    const r = normalizarMaterialIntelisis(bueno, {
      source: INTELISIS_SOURCES.SQL,
      snapshotId: 'snap-1',
    });
    expect(r.costeable).toBe(true);
    expect(r.precio_compra).toBe(1335.6);
    expect(r.unidad_compra).toBe('hoja');
    expect(r.unidad_consumo).toBe('m2');
    expect(r.factor_conversion).toBe(2.9768);
    expect(r.evidence_status).toBe('verified');
    expect(r.issues).toEqual([]);
  });

  it('bloquea precio sin evidencia aunque venga de Intelisis real', () => {
    const r = normalizarMaterialIntelisis({ ...bueno, orden_compra: '' });
    expect(r.costeable).toBe(false);
    expect(r.issues).toContain('MISSING_EVIDENCE');
  });

  it('bloquea unidad distinta sin factor de conversión', () => {
    const r = normalizarMaterialIntelisis({ ...bueno, factor_conversion: '' });
    expect(r.costeable).toBe(false);
    expect(r.issues).toContain('MISSING_CONVERSION');
  });

  it('no adivina fechas ambiguas de Excel', () => {
    const r = normalizarMaterialIntelisis({ ...bueno, fecha_ultima_compra: '08/07/2026' });
    expect(r.costeable).toBe(false);
    expect(r.issues).toContain('INVALID_OR_AMBIGUOUS_DATE');
  });

  it('no admite costo cero, negativo o texto corrupto', () => {
    expect(normalizarMaterialIntelisis({ ...bueno, precio_compra: 0 }).costeable).toBe(false);
    expect(normalizarMaterialIntelisis({ ...bueno, precio_compra: -1 }).costeable).toBe(false);
    expect(normalizarMaterialIntelisis({ ...bueno, precio_compra: 'MXN 100' }).costeable).toBe(false);
  });

  it('requiere mapeo explícito ERP→insumo interno antes de escribir', () => {
    const r = normalizarMaterialIntelisis(bueno);
    expect(() => precioSupabaseDesdeIntelisis(r)).toThrow('MISSING_INTERNAL_INSUMO_ID');
    const p = precioSupabaseDesdeIntelisis(r, { insumoId: 'melamina-28' });
    expect(p.insumo_id).toBe('melamina-28');
    expect(p.estado).toBe('propuesto');
    expect(p.requiere_validacion_compras).toBe(true);
    expect(p.propiedades.clave_erp).toBe('MVLMAG01280800');
  });

  it('jamás convierte un registro bloqueado a precio de Supabase', () => {
    const malo = normalizarMaterialIntelisis({ ...bueno, moneda: 'ABC' });
    expect(malo.costeable).toBe(false);
    expect(() => precioSupabaseDesdeIntelisis(malo, { insumoId: 'x' }))
      .toThrow('INTELISIS_RECORD_NOT_COSTABLE');
  });

  it('resume cobertura y causas del lote', () => {
    const lote = [
      normalizarMaterialIntelisis(bueno),
      normalizarMaterialIntelisis({ ...bueno, orden_compra: '' }),
      normalizarMaterialIntelisis({ ...bueno, unidad_compra: '???' }),
      normalizarMaterialIntelisis({ ...bueno, clave_erp: 'OTRO' }),
    ];
    expect(resumirLoteIntelisis(lote)).toMatchObject({
      total: 4,
      costeables: 2,
      bloqueados: 2,
      cobertura_pct: 50,
    });
  });
});
