// ============================================================================
//  PRECISION DEL MOTOR — corre el motor SIN inyectar cos_fab_real y mide el error
//  firmado por capa, contra el historico como REFERENCIA (no como entrada).
//  (Auditoria P1 de validacion: distinguir ANCLADO vs CALCULADO INDEPENDIENTE.)
//
//  Hallazgo medido: la capa de MATERIAL la reproduce EXACTA (el BOM suma material_real).
//  La capa MO/GIF NO: el motor usa factores GENERICOS (POLITICA_VH 0.20/0.50 -> x1.80),
//  pero cada mueble real se costeo con factores CALIBRADOS distintos. => el motor
//  independiente SOBRECOSTEA 0%..+63%. cos_fab_real es un ANCLA, no una reproduccion.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { costearBOM } from './costeoDesdeBOM.js';
import { medirError } from './validacionCosteo.js';

// Datos reales (producto_maestro). suma_bom == material_real (verificado en vivo).
const MUEBLES = [
  { clave: 'COPETE-CAB-516R',    material_real: 460.57,   cos_fab_real: 829.01,   fmo: 0.199991, fgif: 0.599974 },
  { clave: 'ENTCBCALP',          material_real: 12315.65, cos_fab_real: 18749.37, fmo: 0.128725, fgif: 0.393677 },
  { clave: 'TELCEL-MOD-ALMACEN', material_real: 3596.14,  cos_fab_real: 4854.78,  fmo: 0.10,     fgif: 0.25 },
  { clave: 'TELCEL-VH-HORIZONTAL', material_real: 4483.13, cos_fab_real: 6052.22, fmo: 0.10,     fgif: 0.25 },
  { clave: 'TELCEL-VH-ISLA',     material_real: 3297.84,  cos_fab_real: 4452.07,  fmo: 0.10,     fgif: 0.25 },
  { clave: 'TELCEL-VH-TORRE',    material_real: 2966.15,  cos_fab_real: 3277.60,  fmo: 0.10,     fgif: 0.005 },
];

describe('precision del motor (independiente, sin inyectar cos_fab_real)', () => {
  it('capa MATERIAL: el motor la reproduce EXACTA desde el BOM', () => {
    for (const m of MUEBLES) {
      // BOM = una linea fab con el material real (equivalente a sumar el BOM; todo fab).
      const r = costearBOM([{ nombre: m.clave, costo: m.material_real, seccion: 'metal' }]);
      expect(r.material).toBeCloseTo(m.material_real, 2);   // 0% error en material
    }
  });

  it('capa MO/GIF + TOTAL: el motor con factores genericos NO iguala el historico (se mide, no se finge)', () => {
    const tabla = [];
    for (const m of MUEBLES) {
      const r = costearBOM([{ nombre: m.clave, costo: m.material_real, seccion: 'metal' }]);
      const err = medirError(r.costo_total, m.cos_fab_real);   // historico como REFERENCIA
      tabla.push({ clave: m.clave, motor: Math.round(r.costo_total), real: m.cos_fab_real,
        error_pct: err.error_pct, signo: err.signo });
    }
    // eslint-disable-next-line no-console
    console.table(tabla);
    // El motor por defecto da material x1.80. Solo COPETE (factores ~0.20/0.60) cuadra;
    // los demas SOBRECOSTEAN. Se LOCKEA el hecho medido:
    const copete = tabla.find((t) => t.clave === 'COPETE-CAB-516R');
    expect(Math.abs(copete.error_pct)).toBeLessThan(1);        // ~0% (factores por defecto ≈ reales)
    const torre = tabla.find((t) => t.clave === 'TELCEL-VH-TORRE');
    expect(torre.error_pct).toBeGreaterThan(50);               // +63%: motor generico sobrecostea
    const vitrinas = tabla.filter((t) => /HORIZONTAL|ISLA|ALMACEN/.test(t.clave));
    for (const v of vitrinas) expect(v.error_pct).toBeGreaterThan(25);  // +33%
  });

  it('VEREDICTO de validacion: cos_fab_real es ANCLA, no paridad calculada', () => {
    // El motor NO reproduce cos_fab_real independientemente (salvo COPETE). Por tanto los
    // muebles del concurso que usan cos_fab_real estan ANCLADOS, no CALCULADOS con paridad.
    const r = costearBOM([{ nombre: 'TELCEL-VH-HORIZONTAL', costo: 4483.13, seccion: 'metal' }]);
    expect(r.costo_total).not.toBeCloseTo(6052.22, 0);   // motor != historico -> no es paridad
    expect(r.costo_total).toBeCloseTo(4483.13 * 1.80, 1);
  });
});
