// El factor de familia llega al FLUJO REAL: bomDesdeDespiece (puente del mueble nuevo) carga
// la familia, el preview cos_fab_calculado usa su factor, y al costear con costearBOM se aplica.
// Un mueble nuevo sin hoja propia deja de caer al genérico ×1.8. Sin inventar: familia desconocida
// o ausente ⇒ sin factor de familia (honesto). Guardar sigue exigiendo factores explícitos.
import { describe, it, expect } from 'vitest';
import { bomDesdeDespiece, listoParaGuardar } from './productoMaestroDesdeDespiece.js';
import { costearBOM } from './productoMaestro.js';

const insumos = { lam: { nombre: 'Lámina negra', unidad: 'hoja', seccion: 'metal' } };
// Despiece confirmado del motor: 1 línea costeable, material = 1000.
const despiece = () => [{ insumoId: 'lam', desc: 'Lámina negra', unidad: 'hoja', precio: 500, costo: 1000, unidades: 2 }];

describe('bomDesdeDespiece · carga la familia para el mueble nuevo', () => {
  it('familia TELCEL sin factor propio ⇒ preview ×1.35 y familia en el BOM', () => {
    const bom = bomDesdeDespiece(despiece(), insumos, { clave: 'NUEVO-1', familia: 'TELCEL' });
    expect(bom.familia).toBe('TELCEL');
    expect(bom.factores_fuente).toBe('familia');
    expect(bom.material_real).toBeCloseTo(1000, 2);
    expect(bom.cos_fab_calculado).toBeCloseTo(1350, 2);   // 1000 × (1 + 0.10 + 0.25)
    expect(bom.factor_mo).toBeNull();                      // el factor por-clave NO se inventa
    expect(bom.factor_gif).toBeNull();
  });

  it('SIN familia y sin factores ⇒ preview null (honesto, no inventa)', () => {
    const bom = bomDesdeDespiece(despiece(), insumos, { clave: 'NUEVO-2' });
    expect(bom.familia).toBeNull();
    expect(bom.factores_fuente).toBeNull();
    expect(bom.cos_fab_calculado).toBeNull();
  });

  it('familia desconocida ⇒ sin factor de familia (no inventa)', () => {
    const bom = bomDesdeDespiece(despiece(), insumos, { clave: 'NUEVO-3', familia: 'FANTASMA' });
    expect(bom.factores_fuente).toBeNull();
    expect(bom.cos_fab_calculado).toBeNull();
  });

  it('factor POR CLAVE explícito gana sobre la familia', () => {
    const bom = bomDesdeDespiece(despiece(), insumos, { clave: 'NUEVO-4', familia: 'TELCEL', factorMo: 0.20, factorGif: 0.50 });
    expect(bom.factores_fuente).toBe('clave');
    expect(bom.cos_fab_calculado).toBeCloseTo(1700, 2);    // 1000 × (1 + 0.20 + 0.50)
    expect(bom.factor_mo).toBe(0.20);
  });
});

describe('flujo real completo · puente → costearBOM', () => {
  it('bomDesdeDespiece(familia) ⇒ costearBOM aplica el factor de familia', () => {
    const bom = bomDesdeDespiece(despiece(), insumos, { clave: 'NUEVO-5', familia: 'TELCEL' });
    const r = costearBOM(bom, {});
    expect(r.factoresFuente).toBe('familia');
    expect(r.costoFabricacion).toBeCloseTo(1350, 2);
  });
});

describe('gobernanza · la familia es preview, no sustituye el factor para GUARDAR', () => {
  it('un BOM con solo factor de familia (factor_mo null) NO está listo para guardar', () => {
    const bom = bomDesdeDespiece(despiece(), insumos, { clave: 'NUEVO-6', familia: 'TELCEL' });
    const v = listoParaGuardar(bom);
    expect(v.ok).toBe(false);
    expect(v.errores.join(' ')).toMatch(/factores/i);   // sigue exigiendo factores explícitos de la clave
  });
});
