// Costo de operacion (MO): tiempo+tarifa, preparacion por lote, fail-closed, AUTORIDAD real (p3).
import { describe, it, expect, beforeEach } from 'vitest';
import { costoOperacion, cargarEstandar, limpiarEstandares, costoManoObraRouting, normalizarEstandar, autoridadDesdeListas } from './costoOperacion.js';

// Autoridad de prueba: Direccion real; un vendedor y una cuenta no-humana NO aprueban.
const AUT = autoridadDesdeListas({
  permitidos: [{ email: 'rodrigo@vh.mx', rol: 'direccion' }, { email: 'vendedor@vh.mx', rol: 'vendedor' }],
  noHumanas: ['qa-bot@vh.mx'],
});
// estado:'aprobado' = hecho escrito por el servidor (como insumo_precios.estado). Sin el, no carga.
const STD = { centro: 'metalmecánica', op: 'corte_lamina', tiempo_proceso_min: 1, tarifa_mxn_min: 10, lote_piezas: 1, version: 'v1', vigente_desde: '2026-01-01', aprobado_por: 'rodrigo@vh.mx', estado: 'aprobado' };

describe('costoOperacion — autoridad y contrato', () => {
  beforeEach(() => limpiarEstandares());

  it('sin estandar: PENDIENTE, no inventa numero', () => {
    const r = costoOperacion({ centro: 'metalmecánica', op: 'corte_lamina', piezas: 2 });
    expect(r.estado).toBe('PENDIENTE_ESTANDAR');
    expect(r.costo_mxn).toBeNull();
  });

  it('P3: un autorizado:true del cliente NO prueba nada; exige aprobador autoritativo', () => {
    // bare autorizado:true sin aprobador -> rechazado
    expect(() => cargarEstandar({ ...STD, aprobado_por: undefined, autorizado: true }, { autoridad: AUT })).toThrow(/sin aprobador/);
    // aprobador que no es Direccion (vendedor) -> rechazado
    expect(() => cargarEstandar({ ...STD, aprobado_por: 'vendedor@vh.mx' }, { autoridad: AUT })).toThrow(/NO autorizado/);
    // aprobador desconocido -> rechazado
    expect(() => cargarEstandar({ ...STD, aprobado_por: 'nadie@vh.mx' }, { autoridad: AUT })).toThrow(/NO autorizado/);
    // cuenta no-humana (aunque este en permitidos) -> rechazada
    expect(() => cargarEstandar({ ...STD, aprobado_por: 'qa-bot@vh.mx' }, { autoridad: AUT })).toThrow(/NO autorizado/);
    // sin autoridad (default cerrada) -> rechazado aunque el aprobador sea real
    expect(() => cargarEstandar({ ...STD })).toThrow(/NO autorizado/);
    // APROBADOR real de Direccion + autoridad -> carga, con rol y autorizado DERIVADO
    const g = cargarEstandar({ ...STD }, { autoridad: AUT });
    expect(g.aprobado_por).toBe('rodrigo@vh.mx');
    expect(g.rol_aprobador).toBe('direccion');
    expect(g.autorizado).toBe(true);
  });

  it('36432bb: un aprobador NOMBRADO sin hecho de servidor (estado!=aprobado) NO carga', () => {
    // El aprobador es Direccion real, pero el servidor NO registro la aprobacion -> rechazado.
    expect(() => cargarEstandar({ ...STD, estado: undefined }, { autoridad: AUT })).toThrow(/sin aprobacion registrada por el servidor/);
    expect(() => cargarEstandar({ ...STD, estado: 'propuesto' }, { autoridad: AUT })).toThrow(/sin aprobacion registrada por el servidor/);
  });

  it('36432bb p2: un estandar SUMINISTRADO directamente NUNCA es oficial/autorizado', () => {
    // Aunque el objeto cliente traiga autorizado:true Y estado:'aprobado', no prueba nada.
    const r = costoOperacion({ centro: 'metalmecánica', op: 'corte_lamina', piezas: 1,
      estandar: { ...STD, autorizado: true, estado: 'aprobado', tiempo_proceso_min: 1, tarifa_mxn_min: 10 } });
    expect(r.costo_mxn).toBe(10);            // calcula como REFERENCIA
    expect(r.estado).toBe('REFERENCIA');     // nunca AUTORIZADA desde un objeto cliente
    expect(r.oficial).toBe(false);
    expect(r.origen).toBe('suministrado');
    expect(r.parametros.autorizado).toBe(false);
  });

  it('P3: exige unidades, version y vigencia', () => {
    expect(() => cargarEstandar({ ...STD, tarifa_mxn_min: 0 }, { autoridad: AUT })).toThrow(/unidades invalidas/);
    expect(() => cargarEstandar({ ...STD, tiempo_proceso_min: undefined }, { autoridad: AUT })).toThrow(/unidades invalidas/);
    expect(() => cargarEstandar({ ...STD, version: undefined }, { autoridad: AUT })).toThrow(/sin version/);
    expect(() => cargarEstandar({ ...STD, vigente_desde: undefined }, { autoridad: AUT })).toThrow(/sin vigencia/);
  });

  it('P3: un estandar con vigencia expirada no se usa (fail-closed)', () => {
    cargarEstandar({ ...STD, centro: 'corte', op: 'c', vigente_desde: '2020-01-01', vigente_hasta: '2021-01-01' }, { autoridad: AUT });
    const r = costoOperacion({ centro: 'corte', op: 'c', piezas: 1 });
    expect(r.estado).toBe('PENDIENTE_ESTANDAR');
    expect(r.costo_mxn).toBeNull();
  });

  it('con estandar aprobado: preparacion/lote + tiempo×tarifa×piezas + adicionales', () => {
    cargarEstandar({ ...STD, tiempo_preparacion_min: 30, tiempo_proceso_min: 2, tarifa_mxn_min: 10, costos_adicionales_mxn: 3, lote_piezas: 10, fuente: 'Ingenieria' }, { autoridad: AUT });
    const r = costoOperacion({ centro: 'metalmecánica', op: 'corte_lamina', piezas: 5, lote: 10 });
    expect(r.estado).toBe('AUTORIZADA');
    expect(r.desglose.preparacion_imputada_mxn).toBe(150);
    expect(r.desglose.proceso_mxn).toBe(100);
    expect(r.desglose.adicionales_mxn).toBe(15);
    expect(r.costo_mxn).toBe(265);
    expect(r.parametros.version).toBe('v1');
  });

  it('normalizarEstandar convierte $/hora a $/min', () => {
    expect(normalizarEstandar({ centro: 'x', op: 'y', tarifa_mxn_hora: 600, tiempo_proceso_min: 1 }).tarifa_mxn_min).toBe(10);
  });

  it('costoManoObraRouting: null si falta algun estandar; total si todos aprobados', () => {
    const ops = [{ centro: 'metalmecánica', op: 'corte_lamina' }, { centro: 'pintura', op: 'pintura' }];
    expect(costoManoObraRouting(ops, { piezas: 1 }).mano_obra_mxn).toBeNull();
    cargarEstandar({ ...STD }, { autoridad: AUT });
    cargarEstandar({ ...STD, centro: 'pintura', op: 'pintura', tiempo_proceso_min: 2 }, { autoridad: AUT });
    const r1 = costoManoObraRouting(ops, { piezas: 1 });
    expect(r1.completa).toBe(true);
    expect(r1.mano_obra_mxn).toBe(10 + 20);
  });
});
