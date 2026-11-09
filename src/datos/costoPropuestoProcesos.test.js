// ============================================================================
//  COSTO PROPUESTO POR PROCESOS — invariantes de HONESTIDAD.
//  Verifica que: (1) nunca es certificable; (2) sin tarifas, la MO no se inventa
//  (queda pendiente + pregunta por operación); (3) la lámina es cota inferior
//  (cara mayor) con base ERP + merma; (4) con tarifa de referencia se costea
//  pero sigue no certificable y marcada REFERENCIA; (5) el material resuelto no
//  se toca.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { costoPropuesto, areaCaraMayorM2, REF_LAMINA_MXN_M2, REF_MERMA_PCT } from './costoPropuestoProcesos.js';

const FAB = [
  { clave: 'CUE', cantidad: 1, dims_mm: [1200, 865, 600] },
  { clave: 'CF', cantidad: 1, dims_mm: [1106, 828, 13] },
  { clave: 'SOC', cantidad: 2, dims_mm: [500, 48, 40] },
];
const OPS = [
  { op: 'corte', nombre: 'Corte', centro: 'metalmecánica' },
  { op: 'doblez', nombre: 'Doblez', centro: 'metalmecánica' },
  { op: 'pintura', nombre: 'Pintura', centro: 'pintura' },
  { op: 'ensamble', nombre: 'Ensamble', centro: 'ensamble' },
];

describe('costoPropuestoProcesos — honestidad', () => {
  it('areaCaraMayorM2 = cara mayor (cota inferior), en m²', () => {
    expect(areaCaraMayorM2([1200, 865, 600])).toBeCloseTo((1200 * 865) / 1e6, 4); // 1.038
    expect(areaCaraMayorM2([500, 48, 40])).toBeCloseTo((500 * 48) / 1e6, 4);       // 0.024
    expect(areaCaraMayorM2([100])).toBeNull();
  });

  it('SIN tarifas: nunca certificable, MO NO se inventa (pendiente + pregunta por operación)', () => {
    const r = costoPropuesto({ fabricadas: FAB, operaciones: OPS, materialResueltoMxn: 4693.9 });
    expect(r.certificable).toBe(false);
    expect(r.mano_obra.mxn).toBeNull();
    expect(r.mano_obra.completa).toBe(false);
    expect(r.total_propuesto_mxn).toBeNull();                 // sin MO no hay total
    // una pregunta por cada operación sin tarifa
    for (const op of OPS) expect(r.preguntas_ingenieria.some((q) => q.includes(op.nombre))).toBe(true);
    // material resuelto intacto + lámina como cota
    expect(r.material.resuelto_erp_mxn).toBe(4693.9);
    expect(r.material.lamina_propuesta_mxn_cota).toBeGreaterThan(0);
    expect(r.material.total_floor_mxn).toBe(+(4693.9 + r.material.lamina_propuesta_mxn_cota).toFixed(2));
  });

  it('lámina = cara mayor × cantidad × $/m² × (1+merma), base ERP declarada', () => {
    const r = costoPropuesto({ fabricadas: [{ clave: 'CUE', cantidad: 1, dims_mm: [1200, 865, 600] }], operaciones: [] });
    const esperado = +(1.038 * 1 * REF_LAMINA_MXN_M2.valor * (1 + REF_MERMA_PCT.valor)).toFixed(2);
    expect(r.material.lamina_propuesta_mxn_cota).toBeCloseTo(esperado, 1);
    expect(r.material.detalle_lamina[0].estado).toBe('PROPUESTA_COTA_INFERIOR');
    expect(REF_LAMINA_MXN_M2.autorizado).toBe(false);
  });

  it('CON tarifa de referencia: costea MO pero sigue no certificable y marcada REFERENCIA', () => {
    const tarifas = {
      'metalmecánica': { mxn: 30, autorizado: false, fuente: 'ref' },
      'pintura': { mxn: 60, autorizado: false, fuente: 'ref' },
      'ensamble': { mxn: 50, autorizado: false, fuente: 'ref' },
    };
    const r = costoPropuesto({ fabricadas: FAB, operaciones: OPS, tarifas, materialResueltoMxn: 100 });
    expect(r.certificable).toBe(false);
    expect(r.mano_obra.completa).toBe(true);
    expect(r.mano_obra.mxn).toBe(30 + 30 + 60 + 50);          // corte+doblez(metal) + pintura + ensamble
    expect(r.total_propuesto_mxn).toBe(+(r.material.total_floor_mxn + r.mano_obra.mxn).toFixed(2));
    expect(r.mano_obra.detalle.every((d) => d.estado === 'REFERENCIA')).toBe(true);
  });

  it('pieza fabricada sin dims: no inventa área, emite pregunta', () => {
    const r = costoPropuesto({ fabricadas: [{ clave: 'X', cantidad: 1, dims_mm: [] }], operaciones: [] });
    expect(r.material.detalle_lamina[0].estado).toBe('SIN_DIMS');
    expect(r.preguntas_ingenieria.some((q) => q.includes('X'))).toBe(true);
  });
});
