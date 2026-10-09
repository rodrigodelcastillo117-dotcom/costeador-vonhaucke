import { describe, it, expect } from 'vitest';
import { construirProductSpec, ESTADO_DATO } from './productSpec.js';
import { generarBOM, UNIDAD_CONSUMO } from './bomGenerator.js';

const specCubierta = () => construirProductSpec({
  nombre: 'Credenza',
  partes: [{ part_id: 'cub', nombre: 'Cubierta', cantidad: 1, w: 1200, d: 600, material: 'melamina', espesor_mm: 19, procedencia: 'MEASURED', confianza: 0.9 }],
});

describe('BOMGenerator · despiece determinista desde ProductSpec (ChatGPT §6)', () => {
  it('con material canónico + regla de merma → línea OK con consumo neto y bruto', () => {
    const bom = generarBOM(specCubierta(), {
      resolverMaterial: () => 'melamina-19',
      reglaMerma: () => 10,     // 10%
    });
    expect(bom.estado).toBe('COMPLETO');
    const l = bom.lineas[0];
    expect(l.unidad_consumo).toBe(UNIDAD_CONSUMO.AREA_M2);
    expect(l.consumo_neto_unitario).toBeCloseTo(0.72, 5);   // 1.2 × 0.6 m²
    expect(l.consumo_neto_total).toBeCloseTo(0.72, 5);      // × cantidad 1
    expect(l.consumo_bruto_total).toBeCloseTo(0.8, 5);      // 0.72 / 0.9
    expect(l.material_canonical_id).toBe('melamina-19');
    expect(l.estado).toBe(ESTADO_DATO.OK);
  });

  it('P0-8 CANTIDAD: 2 piezas de 1200×600 → consumo_neto_total 1.44 m² (no 0.72)', () => {
    const spec = construirProductSpec({ partes: [{ part_id: 'cub', cantidad: 2, w: 1200, d: 600, material: 'melamina', espesor_mm: 19, procedencia: 'MEASURED', confianza: 0.9 }] });
    const l = generarBOM(spec, { resolverMaterial: () => 'melamina-19', reglaMerma: () => 10 }).lineas[0];
    expect(l.consumo_neto_unitario).toBeCloseTo(0.72, 5);
    expect(l.consumo_neto_total).toBeCloseTo(1.44, 5);      // ← × cantidad 2
    expect(l.consumo_bruto_total).toBeCloseTo(1.6, 5);      // 1.44 / 0.9
  });

  it('P0-9 CONVERSION: compra≠costeo sin conversión → CONVERSION_FALTANTE → PENDING', () => {
    const bom = generarBOM(specCubierta(), {
      resolverMaterial: () => ({ id: 'melamina-19', unidad_compra: 'hoja' }),   // consumo m2 ≠ compra hoja, sin conversión
      reglaMerma: () => 10,
    });
    expect(bom.lineas[0].issues).toContain('CONVERSION_FALTANTE');
    expect(bom.lineas[0].estado).toBe(ESTADO_DATO.PENDING);
    // con conversión sí pasa
    const ok = generarBOM(specCubierta(), { resolverMaterial: () => ({ id: 'melamina-19', unidad_compra: 'hoja', conversion: 2.98 }), reglaMerma: () => 10 });
    expect(ok.lineas[0].issues).not.toContain('CONVERSION_FALTANTE');
  });

  it('SIN material canónico → línea PENDING (identidad es del resolver, no se inventa)', () => {
    const bom = generarBOM(specCubierta(), { reglaMerma: () => 10 });  // sin resolverMaterial
    expect(bom.lineas[0].estado).toBe(ESTADO_DATO.PENDING);
    expect(bom.lineas[0].issues).toContain('MATERIAL_SIN_CANONICO');
  });

  it('SIN regla de merma → consumo_bruto null + MERMA_SIN_REGLA (nunca merma mágica)', () => {
    const bom = generarBOM(specCubierta(), { resolverMaterial: () => 'melamina-19' });  // sin reglaMerma
    const l = bom.lineas[0];
    expect(l.consumo_neto_total).toBeCloseTo(0.72, 5);  // neto SÍ (geométrico)
    expect(l.consumo_bruto_total).toBeNull();            // bruto NO (sin regla)
    expect(l.issues).toContain('MERMA_SIN_REGLA');
    expect(l.estado).toBe(ESTADO_DATO.PENDING);
  });

  it('parte PENDING en el spec (sin espesor) → línea BOM PENDING', () => {
    const spec = construirProductSpec({ partes: [{ part_id: 'x', cantidad: 1, material: 'melamina', w: 1200, d: 600 }] }); // sin espesor
    const bom = generarBOM(spec, { resolverMaterial: () => 'm', reglaMerma: () => 10 });
    expect(bom.lineas[0].issues.some((i) => i.startsWith('PARTE_'))).toBe(true);
    expect(bom.lineas[0].estado).toBe(ESTADO_DATO.PENDING);
  });

  it('DETERMINISTA: mismo spec + mismas reglas → mismo BOM', () => {
    const opts = { resolverMaterial: () => 'melamina-19', reglaMerma: () => 10 };
    expect(generarBOM(specCubierta(), opts)).toEqual(generarBOM(specCubierta(), opts));
  });

  it('spec sin partes → PRELIMINAR', () => {
    expect(generarBOM(construirProductSpec({ partes: [] })).estado).toBe('PRELIMINAR');
  });

  it('RED-TEAM HIGH: merma FUERA DE RANGO (negativa o ≥100) → MERMA_INVALIDA + PENDING (no se traga)', () => {
    for (const mala of [-5, 100, 120]) {
      const bom = generarBOM(specCubierta(), { resolverMaterial: () => 'melamina-19', reglaMerma: () => mala });
      const l = bom.lineas[0];
      expect(l.issues, `merma ${mala}`).toContain('MERMA_INVALIDA');
      expect(l.consumo_bruto_total).toBeNull();
      expect(l.estado).toBe(ESTADO_DATO.PENDING);
      expect(bom.estado).toBe('PRELIMINAR');            // NUNCA COMPLETO con merma inválida
    }
  });

  it('RED-TEAM: merma 0% válida → bruto = neto (sin merma), línea OK', () => {
    const bom = generarBOM(specCubierta(), { resolverMaterial: () => 'melamina-19', reglaMerma: () => 0 });
    expect(bom.lineas[0].consumo_bruto_total).toBeCloseTo(0.72, 5);
    expect(bom.lineas[0].estado).toBe(ESTADO_DATO.OK);
  });
});
