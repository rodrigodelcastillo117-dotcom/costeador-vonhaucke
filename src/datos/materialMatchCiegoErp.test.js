// Regresiones de la PRUEBA CIEGA contra el ERP (lab/costear/ciego_erp, 2026-10-13). Textos tal cual los escribió la IA
// (analizar-mueble-rc, Opus 5.5) para componentes reales de Intelisis; nombres de catálogo reales.
import { describe, it, expect } from 'vitest';
import { familiaDeMaterial, clasificarMaterial, MATCH } from './materialMatch.js';

describe('VH-181 · el objeto manda sobre su acabado', () => {
  it('biombo ATBIOCRT5: el soporte metálico con pintura es un soporte, no pintura', () => {
    expect(familiaDeMaterial('Soporte tipo clamp/escuadra metálica línea APPS LT, acabado pintura en polvo')).toBe('herraje_soporte');
  });
  it('pintura mencionada como acabado de algo sin material base → sin familia (pendiente), nunca pintura', () => {
    expect(familiaDeMaterial('Base metálica pintura electrostática')).toBe('');
  });
  it('lo que sí es pintura sigue siendo pintura; el material base nombrado primero sigue mandando', () => {
    expect(familiaDeMaterial('Pintura en polvo blanco RAL 9016')).toBe('pintura_polvo');
    expect(familiaDeMaterial('Acabado pintura electrostática negra')).toBe('pintura_polvo');
    expect(familiaDeMaterial('Lámina cal 18, acabado pintura negra')).toBe('metal_lamina');
    expect(familiaDeMaterial('MDF lacado blanco')).toBe('mdf');
  });
});

describe('VH-182 · canto más ancho que el tablero (Intelisis: 28 mm → PEABS32, 16 mm → PEABS22)', () => {
  it('cubierta 28 mm con el curado canto-abs-32 (lo que propuso la app en el lab): compatible, no crítico', () => {
    const r = clasificarMaterial({ solicitado: 'Canto ABS para cubierta 28 mm (ancho no especificado)', insumoId: 'canto-abs-32', insumoNombre: 'Perfil de canto ABS 32 mm Walnut' });
    expect(r.clase).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
  });
  it('el artículo ERP PEABS32 es canto (familia) y cubre el tablero de 28 mm', () => {
    expect(familiaDeMaterial('PERFIL DE CANTO ANCHO 32 mm ESPESOR 2 mm EN ABS - "PEABS32"')).toBe('tapacanto');
    const r = clasificarMaterial({ solicitado: 'Canto ABS para cubierta 28 mm (ancho no especificado)', insumoId: 'erp-peabs32', insumoNombre: 'PERFIL DE CANTO ANCHO 32 mm ESPESOR 2 mm EN ABS - "PEABS32"' });
    expect(r.clase).not.toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
  });
  it('faldón 16 mm con canto 22 mm: no es conflicto crítico', () => {
    const r = clasificarMaterial({ solicitado: 'Canto ABS para melamina 16 mm', insumoId: 'erp-peabs22', insumoNombre: 'PERFIL DE CANTO ANCHO 22 mm ESPESOR 2 mm EN ABS - "PEABS22"' });
    expect(r.clase).not.toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
  });
  it('un par SIN evidencia (tablero 28 con canto 22: no cubre el tablero) sigue siendo crítico', () => {
    const r = clasificarMaterial({ solicitado: 'Canto ABS para cubierta 28 mm', insumoId: 'canto-abs-22', insumoNombre: 'Perfil de canto ABS 22 mm Walnut' });
    expect(r.clase).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
  });
});
