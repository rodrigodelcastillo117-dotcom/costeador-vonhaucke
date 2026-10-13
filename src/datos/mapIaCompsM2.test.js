import { describe, it, expect } from 'vitest';
import { mapIaComps } from './mapIaComps.js';
import { calcular } from '../motor/calculo.js';

// A/B lab 2026-10-13 · mesa de centro: la IA leyó bien la cubierta de cristal 1000×600 pero la expresó como
// "0.2 de hoja" sobre un material que se vende por m² (sin formato). El costo quedaba incompleto (P0-02).
const insumos = {
  'cristal-templado': { id: 'cristal-templado', nombre: 'Cristal templado 9 mm', seccion: 'cristal', clase: 'directa', unidad: 'm2', precio: 1000 },
  'melamina-16': { id: 'melamina-16', nombre: 'Melamina 16 mm', seccion: 'cubiertas', clase: 'directa', unidad: 'hoja', precio: 600, formato: { tipo: 'tablero', medida: 2.9768 }, fraccion: true },
  'lamina-x': { id: 'lamina-x', nombre: 'Lámina especial', seccion: 'metal', clase: 'directa', unidad: 'hoja', precio: 500 },
};
const pieza = (insumoId, extra = {}) => ({ piezas: [{ nombre: 'Cubierta', insumoId, material_solicitado: insumos[insumoId].nombre, material_match: 'EXACT', forma: 'area', largoMM: 1000, anchoMM: 600, cantidad: 1, hojas: 0.2, ...extra }] });

describe('IA → BOM · material por m² sin formato usa el área, no la fracción de hoja', () => {
  it('cristal por m² con 1000×600: sin `hojas`, la fracción de la IA sólo se conserva para mostrarla', () => {
    const [c] = mapIaComps(pieza('cristal-templado'), insumos);
    expect(c.hojas).toBeUndefined();
    // Si la política lo deja como CANDIDATO (falta evidencia), tampoco se queda la fracción de hoja.
    const [cand] = mapIaComps(pieza('cristal-templado', { material_solicitado: 'Cubierta' }), insumos);
    expect(cand.candidate_insumo_id).toBe('cristal-templado');
    expect(cand.hojas).toBeUndefined();
    expect(c.iaHojas).toBe(0.2);
    const r = calcular({ componentes: [{ ...c, material_confirmado: true }], modoManoObra: 'porcentaje' }, 1, insumos, {});
    expect(r.componentesIgnorados || []).toHaveLength(0);
    expect(r.materialTotal).toBeCloseTo(600, 2);   // 0.6 m² × $1,000
  });
  it('sin cambios donde no aplica: tablero con formato (lo decide el motor) y hoja sin formato ni m² (sigue bloqueado por P0-02)', () => {
    expect(mapIaComps(pieza('melamina-16'), insumos)[0].iaHojas).toBe(0.2);   // tablero: el motor decide la hoja (sin cambio)
    const [l] = mapIaComps(pieza('lamina-x'), insumos);
    expect(l.hojas).toBe(0.2);
    const r = calcular({ componentes: [{ ...l, material_confirmado: true }], modoManoObra: 'porcentaje' }, 1, insumos, {});
    expect(JSON.stringify(r.componentesIgnorados)).toMatch(/falta la hoja de referencia/);
  });
});
