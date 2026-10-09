import { describe, it, expect } from 'vitest';
import { FUENTES } from './evidencia.js';
import { ESTADO_DATO, parteSpec, construirProductSpec, validarProductSpec, conflictoDimension } from './productSpec.js';

describe('ProductSpec · contrato Product Intelligence (ChatGPT §5)', () => {
  it('parte completa (material + espesor + cantidad) → OK', () => {
    const p = parteSpec({ part_id: 'cub-1', nombre: 'Cubierta', cantidad: 1, w: 1200, d: 600, material: 'melamina', espesor_mm: 19, procedencia: 'MEASURED', confianza: 0.9 });
    expect(p.estado).toBe(ESTADO_DATO.OK);
    expect(p.issues).toEqual([]);
  });

  it('material AUSENTE → PENDING (no se inventa)', () => {
    const p = parteSpec({ part_id: 'x', cantidad: 1, espesor_mm: 19 });
    expect(p.estado).toBe(ESTADO_DATO.PENDING);
    expect(p.issues).toContain('FALTA_MATERIAL');
  });

  it('material AMBIGUO (varias opciones, ninguna elegida) → PENDING', () => {
    const p = parteSpec({ part_id: 'x', cantidad: 1, espesor_mm: 19, material_opciones: ['melamina blanca', 'melamina color'] });
    expect(p.estado).toBe(ESTADO_DATO.PENDING);
    expect(p.issues).toContain('MATERIAL_AMBIGUO');
  });

  it('ESPESOR no visible (y requerido) → PENDING, NO un default invisible', () => {
    const p = parteSpec({ part_id: 'x', cantidad: 1, material: 'melamina' });
    expect(p.estado).toBe(ESTADO_DATO.PENDING);
    expect(p.issues).toContain('FALTA_ESPESOR');
    expect(p.espesor_mm).toBeNull();            // no se rellenó con 16/18/19
  });

  it('RED-TEAM: espesor 0 o whitespace → PENDING (0 mm es imposible, no se acepta)', () => {
    expect(parteSpec({ part_id: 'x', cantidad: 1, material: 'melamina', espesor_mm: 0 }).issues).toContain('FALTA_ESPESOR');
    expect(parteSpec({ part_id: 'x', cantidad: 1, material: 'melamina', espesor_mm: '   ' }).issues).toContain('FALTA_ESPESOR');
  });

  it('pieza que NO requiere espesor (herraje): no pide espesor/dimensiones', () => {
    const p = parteSpec({ part_id: 'h1', nombre: 'Bisagra', cantidad: 2, material: 'acero', requiere_espesor: false, procedencia: 'CATALOG', confianza: 0.9 });
    expect(p.estado).toBe(ESTADO_DATO.OK);
  });

  it('P0-10: material+espesor+cantidad pero SIN dimensiones/procedencia/confianza → PENDING', () => {
    const p = parteSpec({ part_id: 'x', cantidad: 1, material: 'melamina', espesor_mm: 19 }); // sin w/d, sin procedencia, sin confianza
    expect(p.estado).toBe(ESTADO_DATO.PENDING);
    expect(p.issues).toContain('FALTA_DIMENSIONES');
    expect(p.issues).toContain('PROCEDENCIA_DESCONOCIDA');
    expect(p.issues).toContain('FALTA_CONFIANZA');
  });

  it('cantidad inválida (0/negativa) → PENDING', () => {
    expect(parteSpec({ part_id: 'x', cantidad: 0, material: 'm', espesor_mm: 19 }).issues).toContain('CANTIDAD_INVALIDA');
  });

  it('DIMENSIÓN inconsistente entre vistas → CONFLICT (no se elige en silencio)', () => {
    const c = conflictoDimension('w', [
      { valor: 1200, fuente: FUENTES.VISIBLE_EN_PLANO, origen: 'planta' },
      { valor: 1250, fuente: FUENTES.VISIBLE_EN_PLANO, origen: 'corte' },
    ]);
    expect(c.estado).toBe(ESTADO_DATO.CONFLICT);
    expect(c.contradiccion).toBeTruthy();
  });

  it('construirProductSpec detecta conflictos de vistas y los expone', () => {
    const spec = construirProductSpec({
      nombre: 'Credenza',
      partes: [{ part_id: 'cub', cantidad: 1, material: 'melamina', espesor_mm: 19 }],
      vistas_dimensiones: { w: [{ valor: 1200, fuente: FUENTES.VISIBLE_EN_PLANO }, { valor: 1400, fuente: FUENTES.VISIBLE_EN_PLANO }] },
    });
    expect(spec.conflictos.length).toBe(1);
    expect(spec.conflictos[0].campo).toBe('w');
  });

  it('validarProductSpec: con pendientes/conflictos → PRELIMINAR (no oficial)', () => {
    const spec = construirProductSpec({ partes: [{ part_id: 'x', cantidad: 1 }] }); // sin material/espesor
    const v = validarProductSpec(spec);
    expect(v.ok).toBe(false);
    expect(v.estado).toBe('PRELIMINAR');
    expect(v.partesPendientes.length).toBe(1);
  });

  it('validarProductSpec: todo OK → COMPLETO', () => {
    const spec = construirProductSpec({ partes: [{ part_id: 'cub', cantidad: 1, w: 1200, d: 600, material: 'melamina', espesor_mm: 19, procedencia: 'MEASURED', confianza: 0.9 }] });
    const v = validarProductSpec(spec);
    expect(v.ok).toBe(true);
    expect(v.estado).toBe('COMPLETO');
  });

  it('spec SIN partes → PRELIMINAR con SIN_PARTES', () => {
    const v = validarProductSpec(construirProductSpec({ partes: [] }));
    expect(v.issues).toContain('SIN_PARTES');
  });
});
