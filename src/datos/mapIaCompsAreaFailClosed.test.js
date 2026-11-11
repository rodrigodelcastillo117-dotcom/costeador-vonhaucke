// IA → BOM, rama ÁREA: una cantidad EXPLÍCITA inválida (0/negativa) o una geometría incompleta NO se
// coaccionan a "1 pieza costeable" — serían material inventado. La guarda BLN-09 existía solo en la rama
// lineal; aquí se replica para área (el `z.cantidad || 1` escondía el 0 del motor y del validador).
import { describe, it, expect } from 'vitest';
import { mapIaComps } from './mapIaComps.js';

const insumos = {
  'cristal-templado': { id: 'cristal-templado', nombre: 'Cristal templado 9 mm', seccion: 'cristal', clase: 'directa', unidad: 'm2', precio: 1000 },
};
// Pieza de área por m² (sin 'hojas'), 1200×600.
const areaPieza = (extra = {}) => ({ piezas: [{ nombre: 'Cubierta', insumoId: 'cristal-templado', material_solicitado: 'Cristal templado 9 mm', material_match: 'EXACT', forma: 'area', largoMM: 1200, anchoMM: 600, cantidad: 2, ...extra }] });

describe('mapIaComps área · fail-closed BLN-09', () => {
  it('cantidad=0 EXPLÍCITA ⇒ iaIncoherencia (no se costea como 1)', () => {
    const [c] = mapIaComps(areaPieza({ cantidad: 0 }), insumos);
    expect(c.iaIncoherencia).toBeTruthy();
    expect(c.iaIncoherencia.campo).toBe('cantidadPiezas');
  });

  it('cantidad negativa ⇒ iaIncoherencia', () => {
    const [c] = mapIaComps(areaPieza({ cantidad: -3 }), insumos);
    expect(c.iaIncoherencia).toBeTruthy();
  });

  it('cantidad AUSENTE ⇒ sin incoherencia (default 1, mínimo veraz de la geometría)', () => {
    const [c] = mapIaComps(areaPieza({ cantidad: undefined }), insumos);
    expect(c.iaIncoherencia).toBeFalsy();
    expect(c.piezas).toBe(1);
  });

  it('geometría incompleta (anchoMM ausente, largoMM presente) ⇒ iaIncoherencia', () => {
    const [c] = mapIaComps(areaPieza({ anchoMM: undefined }), insumos);
    expect(c.iaIncoherencia).toBeTruthy();
    expect(c.iaIncoherencia.campo).toBe('geometriaArea');
  });

  it('geometría completa + cantidad válida ⇒ sin incoherencia (sin regresión)', () => {
    const [c] = mapIaComps(areaPieza({ cantidad: 2 }), insumos);
    expect(c.iaIncoherencia).toBeFalsy();
  });
});
