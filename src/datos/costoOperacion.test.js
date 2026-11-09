// Costo de operacion (MO): tiempo+tarifa, preparacion por lote, fail-closed, import de estandares.
import { describe, it, expect, beforeEach } from 'vitest';
import { costoOperacion, cargarEstandar, limpiarEstandares, costoManoObraRouting, normalizarEstandar } from './costoOperacion.js';

describe('costoOperacion — contrato tiempo+tarifa', () => {
  beforeEach(() => limpiarEstandares());

  it('sin estandar: PENDIENTE, no inventa numero, declara el dato que falta', () => {
    const r = costoOperacion({ centro: 'metalmecánica', op: 'corte_lamina', piezas: 2 });
    expect(r.estado).toBe('PENDIENTE_ESTANDAR');
    expect(r.costo_mxn).toBeNull();
    expect(r.pregunta).toMatch(/Tiempo estandar/);
  });

  it('rechaza cargar un estandar NO autorizado o incompleto', () => {
    expect(() => cargarEstandar({ centro: 'pintura', op: 'pintura', tiempo_proceso_min: 5, tarifa_mxn_min: 1, autorizado: false })).toThrow(/NO autorizado/);
    expect(() => cargarEstandar({ centro: 'pintura', op: 'pintura', tarifa_mxn_min: 1, autorizado: true })).toThrow(/incompleto/);
  });

  it('con estandar autorizado: aplica preparacion/lote + tiempo×tarifa×piezas + adicionales', () => {
    cargarEstandar({ centro: 'metalmecánica', op: 'corte_lamina', tiempo_preparacion_min: 30, tiempo_proceso_min: 2,
      tarifa_mxn_min: 10, costos_adicionales_mxn: 3, lote_piezas: 10, version: 'v1', fuente: 'Ingenieria', autorizado: true });
    const r = costoOperacion({ centro: 'metalmecánica', op: 'corte_lamina', piezas: 5, lote: 10 });
    // prep/pieza = 30*10/10 = 30 ; proceso/pieza = 2*10 = 20 ; adic = 3 => unit 53 ; x5 = 265
    expect(r.estado).toBe('AUTORIZADA');
    expect(r.desglose.preparacion_imputada_mxn).toBe(150);   // 30 x 5
    expect(r.desglose.proceso_mxn).toBe(100);                // 20 x 5
    expect(r.desglose.adicionales_mxn).toBe(15);             // 3 x 5
    expect(r.costo_mxn).toBe(265);
    expect(r.parametros.version).toBe('v1');
  });

  it('normalizarEstandar convierte $/hora a $/min', () => {
    const n = normalizarEstandar({ centro: 'x', op: 'y', tarifa_mxn_hora: 600, tiempo_proceso_min: 1, autorizado: true });
    expect(n.tarifa_mxn_min).toBe(10);
  });

  it('costoManoObraRouting: null si falta algun estandar; total si todos cargados', () => {
    const ops = [{ centro: 'metalmecánica', op: 'corte_lamina' }, { centro: 'pintura', op: 'pintura' }];
    const r0 = costoManoObraRouting(ops, { piezas: 1 });
    expect(r0.mano_obra_mxn).toBeNull();
    expect(r0.completa).toBe(false);
    expect(r0.faltantes.length).toBe(2);
    cargarEstandar({ centro: 'metalmecánica', op: 'corte_lamina', tiempo_proceso_min: 1, tarifa_mxn_min: 10, lote_piezas: 1, autorizado: true });
    cargarEstandar({ centro: 'pintura', op: 'pintura', tiempo_proceso_min: 2, tarifa_mxn_min: 10, lote_piezas: 1, autorizado: true });
    const r1 = costoManoObraRouting(ops, { piezas: 1 });
    expect(r1.completa).toBe(true);
    expect(r1.mano_obra_mxn).toBe(10 + 20);
  });
});
