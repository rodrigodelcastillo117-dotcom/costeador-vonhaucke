import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calcular, costeoEmitible, PARAMETROS_DEFAULT } from '../motor/calculo.js';
import { limpiarAlmacen } from '../almacen.js';

// ============================================================================
//  FINAL PRODUCT COMPLETION · regresiones de los P0 arreglados en esta rama.
// ============================================================================

// --- silent P0-1: material DIMENSIONAL sin medida NO se costea con número fantasma ---
describe('motor · pieza dimensional SIN medida → PENDIENTE, nunca costo fantasma (silent P0-1)', () => {
  // tablero: material de ÁREA (formato + fraccion). Un PTR (lineal) NO tiene fraccion.
  const INS = {
    'tablero': { nombre: 'Tablero melamina', seccion: 'cubiertas', clase: 'directa', precio: 544, formato: { medida: 2.98 }, fraccion: true },
    'ptr': { nombre: 'PTR cal.14', seccion: 'metal', clase: 'directa', precio: 45, unidad: 'm', formato: { medida: 6 } }, // sin fraccion → lineal por cantidad
  };
  const run = (comp) => calcular({ piezas: 1, componentes: [comp] }, 1, INS, PARAMETROS_DEFAULT);

  it('pieza forma:area 0×0 (sin cotas) + cantidad 1 → componentesIgnorados "falta medida", NO cuesta, NO emitible', () => {
    const r = run({ nombre: 'Lateral', insumoId: 'tablero', forma: 'area', largoMM: 0, anchoMM: 0, cantidad: 1, piezas: 1 });
    expect(r.componentesIgnorados.some((x) => /falta medida/i.test(x))).toBe(true);
    expect(r.materialTotal).toBe(0);
    expect(costeoEmitible(r).emitible).toBe(false);   // antes salía emitible con m² fantasma
  });

  it('pieza forma:area sin dimensiones y cantidad 0 → tampoco $0 "emitible"', () => {
    const r = run({ nombre: 'Lateral', insumoId: 'tablero', forma: 'area', cantidad: 0, piezas: 1 });
    expect(r.componentesIgnorados.length).toBeGreaterThan(0);
    expect(costeoEmitible(r).emitible).toBe(false);
  });

  it('pieza forma:area CON medida real sí cuesta (no se rompe el caso bueno)', () => {
    const r = run({ nombre: 'Lateral', insumoId: 'tablero', forma: 'area', largoMM: 1200, anchoMM: 600, cantidad: 1, piezas: 1 });
    expect(r.materialTotal).toBeGreaterThan(0);
    expect(r.componentesIgnorados.length).toBe(0);
  });

  it('pieza forma:area por HOJAS directas sí cuesta', () => {
    const r = run({ nombre: 'Lateral', insumoId: 'tablero', forma: 'area', hojas: 0.8, cantidad: 1, piezas: 1 });
    expect(r.materialTotal).toBeGreaterThan(0);
  });

  it('BOM de línea (sin forma:area) costeado por cantidad NO se ve afectado (golden intacto)', () => {
    // un tablero sin marca forma:area y sin cotas conserva su costeo por cantidad (como lineas.js).
    const r = run({ nombre: 'Panel línea', insumoId: 'tablero', cantidad: 2, piezas: 1 });
    expect(r.componentesIgnorados.length).toBe(0);
  });

  it('PTR (lineal, por cantidad en metros) NO se ve afectado por el guard de medida', () => {
    const r = run({ nombre: 'Poste', insumoId: 'ptr', cantidad: 10, piezas: 1 });
    expect(r.materialTotal).toBeGreaterThan(0);
    expect(r.componentesIgnorados.length).toBe(0);
  });
});

// --- security P1-2: limpiarAlmacen borra el blob persistido (seller-safe en logout) ---
describe('almacen · limpiarAlmacen borra el estado persistido (P1-2 seller-safe)', () => {
  beforeEach(() => {
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      _store: store,
    });
  });

  it('removeItem de la clave del almacén', () => {
    localStorage.setItem('costeador-vonhaucke-v1', JSON.stringify({ insumos: { x: { precio: 999, proveedor: 'ACME' } } }));
    expect(localStorage.getItem('costeador-vonhaucke-v1')).not.toBeNull();
    expect(limpiarAlmacen()).toBe(true);
    expect(localStorage.getItem('costeador-vonhaucke-v1')).toBeNull();   // costos ya no persisten
  });
});
