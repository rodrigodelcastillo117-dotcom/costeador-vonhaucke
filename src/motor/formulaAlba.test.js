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

  it('el VIDRIO compra-venta es cristal, pero el ACRÍLICO fabricado NO', () => {
    // El biombo/vidrio de compra-venta se queda en 1%/5%…
    expect(tipoAlba({ nombre: 'Biombo de cristal templado' })).toBe('cristal');
    expect(tipoAlba({ nombre: 'Vidrio 6mm' })).toBe('cristal');
    // …pero el acrílico "cristal"/traslúcido es material FABRICADO → general (20%).
    expect(tipoAlba({ nombre: 'ACRILICO CRISTAL 3mm' })).toBe('general');
    expect(tipoAlba({ nombre: 'ACRILICO TRASLUCIDO Z2 3mm' })).toBe('general');
  });
});

// Ancla de validación (audit 2026-10-01): el despiece REAL del Exhibidor Alpura
// (C-CO-517R, Rafa/Alba), bloque id_01 "componentes" (fabricado). Pasado por la
// fórmula del motor debe dar el MISMO costo de fabricación que la T.D.C. de Alba,
// al centavo. Es el "paso 1" (despiece real → motor, sin IA) de la validación.
describe('Exhibidor Alpura id_01: el motor cuadra con la T.D.C. real de Alba', () => {
  const ID01 = [
    ['PERFIL DE CANTO ABS 22mm', 618.58], ['MDF MELAMINA 16mm Walnut', 2594.49],
    ['LAMINA NEGRA cal 20', 470.17], ['PINTURA EN POLVO', 64.81], ['PIJA 8x5/8', 15.36],
    ['PIJA 8x1/2', 5.76], ['LAMINA NEGRA cal 14', 91.75], ['PULIDO REDONDO 1/4', 18.57],
    ['TUERCA 3/8', 3.54], ['MDF MELAMINA 25mm Walnut', 1935], ['LAMINADO PLASTICO 4x8', 162.96],
    ['PERFIL DE CANTO ABS 32mm', 205.3], ['TAQUETE 8', 48.3], ['TUERCA INSERTO 1/4', 29.04],
    ['TUBULAR REDONDO 3/4 cal18', 38.34], ['LAMINA NEGRA cal 12', 10.05], ['MDF NATURAL 16mm', 21.95],
    ['TORNILLO NIVELADOR 3/8', 249.78], ['ACRILICO CRISTAL 3mm', 428.4], ['ACRILICO TRASLUCIDO 3mm', 417.41],
    ['TORNILLO ALLEN 1/4', 14.4], ['PIJA 8x1 1/2', 14], ['PIJA FIJADORA 8x1/2', 2.2],
    ['PIJA 8x3/4', 9.5], ['empaque jgo', 225.99],
  ];
  it('id_01 fabricado: material 7695.65 → MO 1539.13 · GI 4617.39 · fab 13852.17', () => {
    let mat = 0, mo = 0, gi = 0;
    for (const [nombre, c] of ID01) {
      const r = costoAlba(c, tipoAlba({ nombre }));
      mat += c; mo += r.mo; gi += r.gi;
    }
    expect(mat).toBeCloseTo(7695.65, 1);
    expect(mo).toBeCloseTo(1539.13, 0);
    expect(gi).toBeCloseTo(4617.39, 0);
    expect(mat + mo + gi).toBeCloseTo(13852.17, 0);
  });

  // id_02 "logos + kit LED": COMPRA-VENTA (comprado ya hecho, MO 1% / GI 5%).
  it('id_02 compra-venta: material 4620 → MO 46.20 · GI 231 · fab 4897.20', () => {
    const ID02 = 4620; // logo 900 + impresion 348 + impresion 172 + kit LED 3200
    const r = costoAlba(ID02, 'compraventa');
    expect(r.mo).toBeCloseTo(46.20, 1);
    expect(r.gi).toBeCloseTo(231, 0);
    expect(r.fab).toBeCloseTo(4897.20, 0);
  });

  it('producto completo ENTCBCALP = id_01 + id_02 = fab 18749.37', () => {
    let f = 0;
    for (const [nombre, c] of ID01) f += costoAlba(c, tipoAlba({ nombre })).fab;
    f += costoAlba(4620, 'compraventa').fab;
    expect(f).toBeCloseTo(18749.37, 0);
  });
});
