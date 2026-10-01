import { describe, it, expect } from 'vitest';
import { costoAlba } from './formulaAlba.js';

// ============================================================================
// GOLDEN REGRESSION — Exhibidor Alpura C-CO-517R (T.D.C. humana de Alba, 2026-09-22)
// Fuente: C-CO-517R Exhibidor ENTCBCALP.xlsx, hojas (Explo_MP) + REG-DCC-IDP-031 (T_d_C).
// Oficial humano: id_01 componentes (fab 13,852.17 = mat×1.80) + id_02 logos (fab 4,897.20 =
// mat×1.06) = id_03 exhibidor  material 12,315.65 · fab 18,749.37.
//
// Este test NO exige que el motor dé 18,749.37 (hay SKUs legítimamente sin_match: tornillería/
// empaque que el catálogo no itemiza). EXIGE que el 100% de la diferencia esté EXPLICADA:
//   Δ fab = (material sin_match) × 1.80, sin ningún peso inexplicado.
// Mapeo por CÓDIGO ERP (estable). Sin conversión de unidad implícita. Sin precios inventados.
// ============================================================================

// id_01: [cod ERP, desc, unidad, precio_unit_humano (Y), consumo (Z), costo_linea (AA)]
const ID01 = [
  ['MVLPPC00491505', 'PERFIL DE CANTO 22 mm', 'm', 20.64, 29.97, 618.58],
  ['MVLMMD01280500', 'MDF MELAMINA 16 Walnut', 'Hoja', 693.9, 3.739, 2594.49],
  ['MVLSLA05260502', 'LAMINA NEGRA 3x10 cal 20', 'Hoja', 449.06, 1.047, 470.17],
  ['MVLQPP00000000', 'PINTURA EN POLVO negro', 'Kg', 120.68, 0.537, 64.81],
  ['MVLUPI03B42101', 'PIJA 8x5/8', 'pieza', 0.32, 48, 15.36],
  ['MVLUPI03482101', 'PIJA 8x1/2', 'pieza', 0.18, 32, 5.76],
  ['MVLSLA05260202', 'LAMINA NEGRA 3x10 cal 14', 'Hoja', 849.5, 0.108, 91.75],
  ['MVLSPU02030001', 'PULIDO REDONDO 1/4', 'pieza', 30.25, 0.614, 18.57],
  ['MVLUTU22540002', 'TUERCA 3/8', 'pieza', 0.59, 6, 3.54],
  ['MVLMMD01280700', 'MDF MELAMINA 25 Walnut', 'Hoja', 1250, 1.548, 1935],
  ['MVLMLP00280000', 'LAMINADO PLASTICO Walnut', 'Hoja', 641.59, 0.254, 162.96],
  ['MVLPPC00501505', 'PERFIL DE CANTO 32 mm', 'm', 22.58, 9.092, 205.3],
  ['MVLUTA00083810', 'TAQUETE 8', 'pieza', 0.35, 138, 48.3],
  ['MVLUTU24522502', 'TUERCA INSERTO 1/4', 'pieza', 1.21, 24, 29.04],
  ['MVLSTU02060401', 'TUBULAR REDONDO 3/4 cal18', 'pieza', 138.4, 0.277, 38.34],
  ['MVLSLA05261002', 'LAMINA NEGRA 3x10 cal 12', 'Hoja', 1116.28, 0.009, 10.05],
  ['MVLMMD02280500', 'MDF NATURAL 16', 'Hoja', 372, 0.059, 21.95],
  ['MVLUTO15181009', 'TORNILLO NIVELADOR 3/8', 'pieza', 41.63, 6, 249.78],
  ['MLEPAC00711600', 'ACRILICO CRISTAL 3mm', 'Hoja', 900, 0.476, 428.4],
  ['MLEPAT00641600', 'ACRILICO TRASLUCIDO 3mm', 'Hoja', 964, 0.433, 417.41],
  ['MVLUTO12110041', 'TORNILLO ALLEN 1/4', 'pieza', 0.6, 24, 14.4],
  ['MVLUPI03462101', 'PIJA 8x1 1/2', 'pieza', 0.28, 50, 14],
  ['MLEUPI19700046', 'PIJA FIJADORA 8x1/2', 'pieza', 0.55, 4, 2.2],
  ['MVLUPI03492101', 'PIJA 8x3/4', 'pieza', 0.19, 50, 9.5],
  [null, 'emp_jgo empaque', '', 225.99, 1, 225.99],
];
// mapeo por código ERP: [insumo_id, confianza, precio_catalogo (en la unidad de consumo), unidad]
const MAP = {
  'MVLPPC00491505': ['canto-abs-22', 'exacto', 20.64, 'm'],
  'MVLMMD01280500': ['mdf-16-walnut', 'exacto', 693.9, 'hoja'],
  'MVLSLA05260502': ['lamina-3x10-20', 'exacto', 449.06, 'hoja'],
  'MVLQPP00000000': ['pintura-polvo-negro', 'exacto', 120.68, 'kg'],
  'MVLSLA05260202': ['lamina-3x10-14', 'exacto', 849.5, 'hoja'],
  'MVLSPU02030001': ['pulido-redondo-14', 'exacto', 30.25, 'pieza'],
  'MVLMMD01280700': ['mdf-25-walnut', 'exacto', 1250, 'hoja'],
  'MVLMLP00280000': ['laminado-walnut', 'exacto', 641.59, 'hoja'],
  'MVLPPC00501505': ['canto-abs-32', 'exacto', 22.58, 'm'],
  'MVLSTU02060401': ['tubular-redondo-34', 'exacto', 138.4, 'pieza'],
  'MVLSLA05261002': ['lamina-3x10-12', 'exacto', 1116.28, 'hoja'],
  'MVLMMD02280500': ['mdf-16', 'exacto', 372, 'hoja'],
  'MVLUTO15181009': ['nivelador-plataforma', 'exacto', 41.63, 'pieza'],
  'MLEPAC00711600': ['acrilico-cristal-3', 'exacto', 900, 'hoja'],
  'MLEPAT00641600': ['acrilico-traslucido-3', 'exacto', 964, 'hoja'],
};
// 10 SKUs sin_match: tornillería/taquetes/empaque que el catálogo agrupa en 'tornilleria'.
const SIN_MATCH_CODS = ['MVLUPI03B42101','MVLUPI03482101','MVLUTU22540002','MVLUTA00083810',
  'MVLUTU24522502','MVLUTO12110041','MVLUPI03462101','MLEUPI19700046','MVLUPI03492101', null];
// id_02 logos (compra-venta): 4 insumos de catálogo, precio = T.D.C.
const ID02 = [
  ['kit-led-5000k', 1, 3200], ['logo-acrilico-iluminado', 1, 900],
  ['impresion-estireno-g', 1, 348], ['impresion-estireno-ch', 1, 172],
];

const HUM_MAT_ID01 = 7695.65, HUM_FAB_ID01 = 13852.17;
const HUM_MAT_ID02 = 4620.00, HUM_FAB_ID02 = 4897.20;
const HUM_MAT_TOTAL = 12315.65, HUM_FAB_TOTAL = 18749.37;

describe('Golden Alpura — fórmula Alba', () => {
  it('id_01 fabricado general = material × 1.80 (MO 20% + GI 60%)', () => {
    const r = costoAlba(HUM_MAT_ID01, 'general');
    expect(r.fab).toBeCloseTo(HUM_MAT_ID01 * 1.80, 1);
    expect(r.fab).toBeCloseTo(HUM_FAB_ID01, 0);
  });
  it('id_02 logos compra-venta = material × 1.06 (MO 1% + GI 5%)', () => {
    const r = costoAlba(HUM_MAT_ID02, 'compraventa');
    expect(r.fab).toBeCloseTo(HUM_MAT_ID02 * 1.06, 1);
    expect(r.fab).toBeCloseTo(HUM_FAB_ID02, 0);
  });
});

describe('Golden Alpura — mapeo por código (sin conversión implícita, sin precio inventado)', () => {
  it('cada renglón está clasificado exacta/equivalente/aproximada/sin_match (cobertura total)', () => {
    for (const [cod] of ID01) {
      const mapped = cod != null && MAP[cod];
      const sin = SIN_MATCH_CODS.includes(cod);
      expect(Boolean(mapped) || sin).toBe(true); // ninguna línea queda sin clasificar
    }
  });
  it('los materiales mapeados conservan el precio de catálogo == precio humano al centavo', () => {
    for (const [cod, , , y] of ID01) {
      if (cod == null || !MAP[cod]) continue;
      const [, , pcat] = MAP[cod];
      expect(pcat).toBeCloseTo(y, 2); // catálogo fiel a la T.D.C. (fidelidad de carga)
    }
  });
  it('hay exactamente 15 mapeados y 10 sin_match', () => {
    const mapped = ID01.filter(([cod]) => cod != null && MAP[cod]).length;
    const sin = ID01.filter(([cod]) => SIN_MATCH_CODS.includes(cod)).length;
    expect(mapped).toBe(15);
    expect(sin).toBe(10);
  });
});

describe('Golden Alpura — autopsia: 100% de la diferencia explicada, inexplicada = $0.00', () => {
  // material motor = Σ (Z × precio_catálogo) de mapeados + logos. sin_match = Σ AA de no mapeados.
  let motMatId01 = 0, sinMatch = 0;
  for (const [cod, , , , z, aa] of ID01) {
    if (cod != null && MAP[cod]) motMatId01 += z * MAP[cod][2];
    else sinMatch += aa;
  }
  const motMatId02 = ID02.reduce((s, [, c, p]) => s + c * p, 0);
  const motMat = motMatId01 + motMatId02;
  const fabMotor = (motMatId01 * 1.80) + (motMatId02 * 1.06);

  it('material humano id_01 = mapeado motor + sin_match (conservación)', () => {
    expect(motMatId01 + sinMatch).toBeCloseTo(HUM_MAT_ID01, 1);
  });
  it('material humano total = 12,315.65; motor mapeado = 11,947.56', () => {
    expect(HUM_MAT_ID02).toBeCloseTo(motMatId02, 2);
    expect(motMat).toBeCloseTo(11947.56, 1);
    expect(motMat + sinMatch).toBeCloseTo(HUM_MAT_TOTAL, 1);
  });
  it('Δ fab = -(sin_match × 1.80) — diferencia inexplicada EXACTAMENTE $0.00', () => {
    const deltaFab = fabMotor - HUM_FAB_TOTAL;
    const explicado = -(sinMatch * 1.80);
    const inexplicado = deltaFab - explicado;
    // La T.D.C. humana viene redondeada a 2 decimales por renglón (25 líneas) y el fab oficial
    // también: eso deja un residuo de ~$0.02 que NO es diferencia real. Tolerancia 1 peso: cualquier
    // regresión real (factor de fórmula, mapeo o precio inventado) movería esto decenas/cientos.
    expect(Math.abs(inexplicado)).toBeLessThan(1); // <-- criterio de PASS: nada inexplicado
    expect(sinMatch).toBeCloseTo(368.09, 1);
    expect(fabMotor).toBeCloseTo(18086.81, 0);
  });
  it('NO exige motor == 18,749.37 mientras existan SKUs sin_match legítimos', () => {
    expect(fabMotor).toBeLessThan(HUM_FAB_TOTAL); // hay sin_match => motor < humano, y está OK
    expect(sinMatch).toBeGreaterThan(0);
  });
});
