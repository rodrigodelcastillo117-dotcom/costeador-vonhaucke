// PARIDAD · factores por clave (producto_maestro.factor_mo/factor_gif) en el MOTOR del servidor.
// Cierra el gap: costearBOM (cliente) ya usa los factores por clave (Telcel 0.10/0.25 = ×1.35,
// Alpura/Copete 0.20/0.60 = ×1.80); ahora calcular() (servidor) también → mismo producto = mismo
// costo por COSTEAR/COCREAR/COTIZAR. Aditivo: sin factores, la fórmula de Alba no cambia.
import { describe, it, expect } from 'vitest';
import { calcular, PARAMETROS_DEFAULT } from './calculo.js';

const INS = {
  'metal-x': { id: 'metal-x', nombre: 'Lamina metal X', seccion: 'metal', unidad: 'pza', precio: 1000, clase: 'directa', formato: null, fraccion: false, mermaCorte: 0 },
};
const par = { ...PARAMETROS_DEFAULT };
const pieza = (extra) => ({ componentes: [{ nombre: 'cuerpo', insumoId: 'metal-x', cantidad: 1 }], ...extra });

describe('factores por clave en calcular() = paridad con costearBOM', () => {
  it('Telcel 0.10/0.25 → MO 10% material, GIF 25% material, costo fab = material ×1.35', () => {
    const r = calcular(pieza({ factor_mo: 0.10, factor_gif: 0.25 }), 1, INS, par);
    expect(r.materialTotal).toBeCloseTo(1000, 6);
    expect(r.manoObra).toBeCloseTo(100, 6);          // 1000 × 0.10
    expect(r.indirectosFabrica).toBeCloseTo(250, 6); // 1000 × 0.25
    expect(r.costoFabricacion).toBeCloseTo(1350, 6); // ×1.35
    expect(r.factoresPorClave).toEqual({ factor_mo: 0.10, factor_gif: 0.25 });
  });

  it('Alpura/Copete 0.20/0.60 → costo fab = material ×1.80', () => {
    const r = calcular(pieza({ factor_mo: 0.20, factor_gif: 0.60 }), 1, INS, par);
    expect(r.manoObra).toBeCloseTo(200, 6);
    expect(r.indirectosFabrica).toBeCloseTo(600, 6);
    expect(r.costoFabricacion).toBeCloseTo(1800, 6);
  });

  it('factor_gif=0 es válido (no se cae a Alba): MO sí, GIF cero', () => {
    const r = calcular(pieza({ factor_mo: 0.10, factor_gif: 0 }), 1, INS, par);
    expect(r.manoObra).toBeCloseTo(100, 6);
    expect(r.indirectosFabrica).toBeCloseTo(0, 6);
    expect(r.factoresPorClave).toEqual({ factor_mo: 0.10, factor_gif: 0 });
  });

  it('SIN factores → fórmula de Alba intacta (default no cambió)', () => {
    const r = calcular(pieza(), 1, INS, par);
    expect(r.factoresPorClave).toBeNull();
    // Alba metal ≠ Telcel ×1.35: el default NO quedó pisado por el camino nuevo.
    expect(r.costoFabricacion).not.toBeCloseTo(1350, 3);
    expect(r.manoObra).toBeGreaterThan(0);
  });

  it('horas medidas mandan sobre los factores por clave', () => {
    const conHoras = calcular(pieza({ factor_mo: 0.10, factor_gif: 0.25, modoManoObra: 'horas', horas: { pm: 2 } }), 1, INS, par);
    // En modo horas, la MO sale de las horas, no de material×0.10.
    expect(conHoras.factoresPorClave).toBeNull();
    expect(conHoras.modoManoObra).toBe('horas');
  });
});
