// Área J · R-03 (causa raíz): una respuesta `ok:true` de analizar-mueble con piezas vacías o mal formadas
// reemplazaba el despiece de la persona por uno vacío (Costeador.jsx · analizarDescripcion) o reventaba con
// "(…).map is not a function". Ver e2e/resiliencia.e2e.js escenario 3.
import { describe, it, expect } from 'vitest';
import { mapIaComps, propuestaConPiezas } from './mapIaComps.js';

describe('propuestaConPiezas / mapIaComps ante basura de la IA', () => {
  it('sin piezas utilizables → false (no se reemplaza el despiece)', () => {
    expect(propuestaConPiezas({ piezas: [] })).toBe(false);
    expect(propuestaConPiezas({ piezas: '[{"nombre":"Cubierta"}]' })).toBe(false);
    expect(propuestaConPiezas({ piezas: [null, 3, 'x', []] })).toBe(false);
    expect(propuestaConPiezas({})).toBe(false);
    expect(propuestaConPiezas(null)).toBe(false);
  });
  it('con al menos una pieza objeto → true', () => {
    expect(propuestaConPiezas({ piezas: [{ nombre: 'Cubierta', largoMM: 1200, anchoMM: 600, cantidad: 1 }] })).toBe(true);
  });
  it('mapIaComps no revienta con piezas en texto y descarta renglones que no son objeto', () => {
    expect(mapIaComps({ piezas: 'basura' })).toEqual([]);
    const r = mapIaComps({ piezas: [null, 'x', { nombre: 'Cubierta', material_solicitado: 'MDF 16 mm', largoMM: 1200, anchoMM: 600, cantidad: 1 }] });
    expect(r).toHaveLength(1);
    expect(r[0].nombre).toBe('Cubierta');
  });
});
