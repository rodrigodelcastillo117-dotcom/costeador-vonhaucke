// Catalogo de lamina desde catalogo_vigente: parseo + validacion fail-closed.
import { describe, it, expect } from 'vitest';
import { parseLaminaNombre, validarLaminaVigente, laminaDesdeVigente } from './catalogoLaminaVigente.js';

describe('catalogoLaminaVigente', () => {
  it('parseLaminaNombre: calibre, acero, acabado, formato', () => {
    const a = parseLaminaNombre('LAMINA NEGRA HOJA 3 X 10 CALIBRE 22 ACERO 1008');
    expect(a).toMatchObject({ calibre: 22, acero: 'negra', acabado: 'sin acabado' });
    expect(a.formato.nombre).toBe('3x10'); expect(a.formato.largoMM).toBe(3048); expect(a.formato.anchoMM).toBe(914);
    const b = parseLaminaNombre('LAMINA INOXIDABLE HOJA 4 X 10 CALIBRE 18 SATINADO P3 T-304');
    expect(b).toMatchObject({ calibre: 18, acero: 'inoxidable' });
    expect(b.acabado).toMatch(/SATINADO/);
    expect(b.formato.nombre).toBe('4x10');
    expect(parseLaminaNombre('PASADOR MODELO 36')).toBeNull();           // no es lamina
  });

  it('validarLaminaVigente: acepta fila completa, rechaza faltantes (fail-closed)', () => {
    const ok = validarLaminaVigente({ insumo_id: 'erp-ln22310', nombre: 'LAMINA NEGRA HOJA 3 X 10 CALIBRE 22 ACERO 1008', precio: 326.59, precio_id: 8748, unidad_compra: 'hoja', vigente_desde: '2026-01-26', certificable: true, estatus_certificacion: 'CERTIFICADO', fuente: 'Compras · ERP' });
    expect(ok.ok).toBe(true);
    expect(ok.registro).toMatchObject({ insumo_id: 'erp-ln22310', calibre: 22, acero: 'negra', precio: 326.59, precio_id: 8748, unidad: 'hoja', certificable: true });

    expect(validarLaminaVigente({ insumo_id: 'x', nombre: 'LAMINA NEGRA HOJA 3 X 10 CALIBRE 22', precio: 100, unidad_compra: 'hoja', vigente_desde: '2026-01-01' }).motivos).toContain('sin precio_id (version)');
    expect(validarLaminaVigente({ insumo_id: 'x', nombre: 'LAMINA NEGRA HOJA 3 X 10 CALIBRE 22', precio: 100, precio_id: 1, unidad_compra: 'kg', vigente_desde: '2026-01-01' }).motivos).toContain('unidad != hoja (el costeo por fraccion exige hoja)');
    expect(validarLaminaVigente({ insumo_id: 'x', nombre: 'LAMINA NEGRA HOJA 3 X 10', precio: 100, precio_id: 1, unidad_compra: 'hoja', vigente_desde: '2026-01-01' }).motivos).toContain('sin calibre identificable');
    expect(validarLaminaVigente({ insumo_id: 'x', nombre: 'TUBULAR CUADRADO CAL 18', precio: 100, precio_id: 1, unidad_compra: 'hoja', vigente_desde: '2026-01-01' }).motivos).toContain('nombre no reconocible como lamina');
  });

  it('laminaDesdeVigente: separa validas de rechazadas', () => {
    const filas = [
      { insumo_id: 'erp-ln22310', nombre: 'LAMINA NEGRA HOJA 3 X 10 CALIBRE 22', precio: 326.59, precio_id: 8748, unidad_compra: 'hoja', vigente_desde: '2026-01-26', certificable: true },
      { insumo_id: 'erp-malo', nombre: 'LAMINA NEGRA HOJA 3 X 10 CALIBRE 22', precio: 0, precio_id: null, unidad_compra: 'hoja', vigente_desde: null }, // invalida
    ];
    const { lamina, rechazadas } = laminaDesdeVigente(filas);
    expect(lamina.length).toBe(1);
    expect(lamina[0].insumo_id).toBe('erp-ln22310');
    expect(rechazadas.length).toBe(1);
    expect(rechazadas[0].insumo_id).toBe('erp-malo');
    expect(rechazadas[0].motivos.length).toBeGreaterThan(0);
  });
});
