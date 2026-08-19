import { describe, it, expect } from 'vitest';
import { costoAlba, tipoAlba } from './formulaAlba.js';

// Los renglones EXACTOS del T.D.C. de Alba ("ejemplo bench sencillo con guardas",
// hoja REG-DCC-IDP-031). Cada uno: material → MO → GI → fab. Si la fórmula cuadra
// con éstos al centavo, el costeador cuadra con el área.
const EJEMPLO = [
  { clave: 'ATCUBS44ABS', tipo: 'cubierta', mat: 381.84, mo: 57.28, gi: 171.84, fab: 610.96 },
  { clave: 'ATBIOCRT4',   tipo: 'cristal',  mat: 717.67, mo: 7.18,  gi: 35.88,  fab: 760.73 },
  { clave: 'ATOM3',       tipo: 'metal',    mat: 46.67,  mo: 9.33,  gi: 27.99,  fab: 83.99 },
  { clave: 'ATACM',       tipo: 'metal',    mat: 91.12,  mo: 18.22, gi: 54.66,  fab: 164.00 },
  { clave: 'ATRICDS4',    tipo: 'metal',    mat: 214.61, mo: 42.92, gi: 128.76, fab: 386.29 },
  { clave: 'ATPU2M',      tipo: 'metal',    mat: 280.11, mo: 56.02, gi: 168.06, fab: 504.19 },
  { clave: 'MOGRCTC2LJ',  tipo: 'metal',    mat: 1838.08, mo: 367.62, gi: 1102.86, fab: 3308.56 },
  { clave: 'MOAPC4L',     tipo: 'metal',    mat: 1707.75, mo: 341.55, gi: 1024.65, fab: 3073.95 },
];

describe('costoAlba reproduce el T.D.C. real de Alba al centavo', () => {
  for (const e of EJEMPLO) {
    it(`${e.clave} (${e.tipo}): mat ${e.mat} → fab ${e.fab}`, () => {
      const r = costoAlba(e.mat, e.tipo);
      expect(r.mo).toBeCloseTo(e.mo, 1);
      expect(r.gi).toBeCloseTo(e.gi, 1);
      expect(r.fab).toBeCloseTo(e.fab, 1);
    });
  }

  it('metal: GI = 3 × MO (los indirectos van sobre la mano de obra)', () => {
    const r = costoAlba(1000, 'metal');
    expect(r.mo).toBe(200);      // 20%
    expect(r.gi).toBe(600);      // 3 × MO
    expect(r.fab).toBe(1800);
  });

  it('cubierta: MO 15% (proceso menor)', () => {
    expect(costoAlba(1000, 'cubierta').mo).toBe(150);
  });

  it('cristal: MO 1% y GI 5% del material (compra-venta)', () => {
    const r = costoAlba(1000, 'cristal');
    expect(r.mo).toBe(10);
    expect(r.gi).toBe(50);
    expect(r.fab).toBe(1060);
  });

  it('clasifica los tipos por sección/nombre', () => {
    expect(tipoAlba({ seccion: 'cubiertas' })).toBe('cubierta');
    expect(tipoAlba({ nombre: 'Omega para cubierta', seccion: 'metal' })).toBe('metal');
    expect(tipoAlba({ nombre: 'Biombo divisor de cristal' })).toBe('cristal');
    expect(tipoAlba({ nombre: 'Cubierta rectangular melamina', seccion: 'cubiertas' })).toBe('cubierta');
  });
});
