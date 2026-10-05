import { describe, it, expect } from 'vitest';
import { estimadoDisenoCocrear } from './estimadoDiseno.js';

const INSUMOS = {
  'pet-acustico': { nombre: 'PET acustico 9 mm (corte a medida)', precio: 1051, unidad: 'm2', fuente: 'ERP' },
};
const intent = (over = {}) => ({ capacidad_personas: 8, caracteristicas: [], ...over });

describe('estimadoDisenoCocrear · nivel intermedio honesto', () => {
  it('con acústica estima PET con precio REAL y marca lo demás pendiente', () => {
    const e = estimadoDisenoCocrear(intent({ caracteristicas: ['acustica', 'electrificacion_integrada', 'jardinera_integrada'] }), INSUMOS);
    expect(e.disponible).toBe(true);
    const pet = e.items.find((i) => i.insumoId === 'pet-acustico');
    expect(pet).toBeTruthy();
    expect(pet.precioUnit).toBe(1051);         // precio real, no inventado
    expect(pet.subtotal).toBe(Math.round(8 * 0.5 * 1051));
    expect(e.total).toBe(pet.subtotal);
    // Pendientes nombrados, NUNCA en $0
    expect(e.pendientes).toEqual(expect.arrayContaining([
      expect.stringMatching(/Electrificación/),
      expect.stringMatching(/Jardinera/),
      expect.stringMatching(/Estructura/),
      expect.stringMatching(/Mano de obra/),
    ]));
  });

  it('NUNCA inventa $0: sin PET en catálogo, acústica queda pendiente (no $0)', () => {
    const e = estimadoDisenoCocrear(intent({ caracteristicas: ['acustica'] }), {});
    expect(e.disponible).toBe(false);
    expect(e.total).toBe(0);
    expect(e.items).toHaveLength(0);
    expect(e.pendientes).toEqual(expect.arrayContaining([expect.stringMatching(/Panel acústico/)]));
  });

  it('cobertura refleja la proporción de partidas con número real', () => {
    const e = estimadoDisenoCocrear(intent({ caracteristicas: ['acustica'] }), INSUMOS);
    // 1 item estimado vs (Estructura + Mano de obra) pendientes = 1/3
    expect(e.coberturaPct).toBe(Math.round((1 / 3) * 100));
    expect(e.confianza).toBe('baja');
  });

  it('el área escala con la capacidad', () => {
    const a = estimadoDisenoCocrear(intent({ capacidad_personas: 4, caracteristicas: ['divisores'] }), INSUMOS);
    const b = estimadoDisenoCocrear(intent({ capacidad_personas: 12, caracteristicas: ['divisores'] }), INSUMOS);
    expect(b.total).toBeGreaterThan(a.total);
  });

  it('sin características acústicas no hay estimable (pero pendientes sí existen)', () => {
    const e = estimadoDisenoCocrear(intent({ caracteristicas: [] }), INSUMOS);
    expect(e.disponible).toBe(false);
    expect(e.pendientes.length).toBeGreaterThan(0);
  });

  it('no explota con intent nulo ni insumos vacíos', () => {
    expect(() => estimadoDisenoCocrear(null)).not.toThrow();
    const e = estimadoDisenoCocrear(null, {});
    expect(e.nivel).toBe('ESTIMADO_DISENO');
  });
});
