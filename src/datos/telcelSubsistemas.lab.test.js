// COSTEAR 100 · LABORATORIO TELCEL por subsistema (C-CO-320R).
// Clasifica los 4 módulos METAL reales con el CONTRATO DE SUBSISTEMAS y verifica:
//  (a) cobertura total (0 líneas sin clasificar),
//  (b) la suma de material por subsistema = el target del workbook (la clasificación
//      no pierde ni duplica dinero),
//  (c) la separación de UBICACIÓN ECONÓMICA (fábrica vs compra-venta vs proyecto),
//  (d) el hallazgo real: la "MADERA PARA EMBALAJE" de Torre cae en PROYECTO, no en
//      fábrica — el workbook la había sumado dentro del material del módulo.
// Datos: materiales + costoLinea del golden telcelCCO320R (workbook real Von Haucke).
import { describe, it, expect } from 'vitest';
import { subsistemaDePieza, SUBSISTEMAS } from './subsistemas.js';

const UBIC = Object.fromEntries(SUBSISTEMAS.map((s) => [s.clave, s.ubicacion]));

const MODULOS = {
  Horizontal: { target: 4483.13, mats: [
    ['LAMINA NEGRA HOJA 3 X 10 CALIBRE 18 ACERO 1008 - LN18310', 1737.48],
    ['LAMINA NEGRA HOJA 4 X 10 CALIBRE 18 ACERO 1008 - LN18410', 661],
    ['LAMINA NEGRA HOJA 4 X 10 CALIBRE 18 ACERO 1008 - LN18410', 398.1],
    ['LAMINA NEGRA HOJA 4 X 10 CALIBRE 14 ACERO 1008 - LN14410', 47.62],
    ['PINTURA EN POLVO - PPH BLANCO 9016 TELCEL', 360.83],
    ['PINTURA EN POLVO - PPH AZUL TELCEL', 52.41],
    ['TIRA DE MADERA DE PINO DE SEGUNDA 5 CM X 3/4" X 250 CM - TMP534250', 303.55],
    ['TIRA DE MADERA DE PINO DE SEGUNDA 10 CM X 1 1/4" X 250 CM - TMP10114250', 144.21],
    ['TIRA DE MADERA DE PINO DE SEGUNDA 10 CM X 3/4" X 250 CM - TMP1034250', 777.93],
  ] },
  Torre: { target: 2966.15, mats: [
    ['LAMINA NEGRA HOJA 3 X 10 CALIBRE 20 ACERO 1008 - LN20310', 462.94],
    ['LAMINA NEGRA HOJA 3 X 10 CALIBRE 18 ACERO 1008 - LN18310', 1465.43],
    ['LAMINA NEGRA HOJA 3 X 10 CALIBRE 14 ACERO 1008 - LN14310', 46.54],
    ['TUBULAR INDUSTRIAL CUADRADO 1" CALIBRE 20 PIEZA DE 6000 mm - TC201', 16.05],
    ['LAMINA NEGRA HOJA 4 X 10 CALIBRE 20 ACERO 1008 - LN20410', 94.87],
    ['MADERA PARA EMBALAJE DE 1/2" 80 mm X 2500 mm - ME258EX', 212],
    ['PINTURA EN POLVO - PPH AZUL TELCEL', 162.23],
    ['PINTURA EN POLVO - PPH', 506.09],
  ] },
  Isla: { target: 3297.84, mats: [
    ["LAMINA NEGRA HOJA 4' X 8' CALIBRE 18 ACERO 1008 - LN1848", 351.31],
    ['LAMINA NEGRA HOJA 3 X 10 CALIBRE 18 ACERO 1008 - LN18310', 74.3],
    ['TUBULAR INDUSTRIAL CUADRADO 1" CALIBRE 18 PIEZA DE 6000 mm - TC181', 364.38],
    ["LAMINA NEGRA HOJA 4' X 8' CALIBRE 14 ACERO 1008 - LN4814ACE", 18.01],
    ['LAMINA NEGRA HOJA 3 X 8 CALIBRE 18 ACERO 1008 - LN1838', 361.23],
    ['LAMINA NEGRA HOJA 4 X 10 CALIBRE 18 ACERO 1008 - LN18410', 67.6],
    ['LAMINA NEGRA HOJA 3 X 8 CALIBRE 20 ACERO 1008 - LN2038', 135.47],
    ['PINTURA EN POLVO - PPH BLANCO 9016 TELCEL', 201.79],
    ['TIRA DE MADERA DE PINO DE SEGUNDA 5 CM X 3/4" X 250 CM - TMP534250', 426.87],
    ['TIRA DE MADERA DE PINO DE SEGUNDA 10 CM X 1 1/4" X 250 CM - TMP10114250', 203.03],
    ['TIRA DE MADERA DE PINO DE SEGUNDA 10 CM X 3/4" X 250 CM - TMP1034250', 1093.85],
  ] },
  Almacenamiento: { target: 3596.14, mats: [
    ['LAMINA NEGRA HOJA 3 X 8 CALIBRE 18 ACERO 1008 - LN1838', 722.46],
    ['LAMINA NEGRA HOJA 3 X 10 CALIBRE 18 ACERO 1008 - LN18310', 925.89],
    ["LAMINA NEGRA HOJA 4' X 8' CALIBRE 18 ACERO 1008 - LN1848", 286.9],
    ['LAMINA NEGRA HOJA 4 X 10 CALIBRE 18 ACERO 1008 - LN18410', 751.14],
    ['PINTURA EN POLVO - PPH BLANCO 9016 TELCEL', 367.67],
    ['PINTURA EN POLVO - PPH AZUL TELCEL', 37.44],
    ['BISAGRA BIDIMENSIONAL, MONTAJE SOBREPUESTO, ANGULO DE 110° - BIBI', 54.64],
    ['Superficie de trabajo, cubierta MDF 12mm una cara laminado blanco', 450],
  ] },
};

function desglose(mats) {
  const por = {}; let sin = 0, suma = 0;
  for (const [d, c] of mats) {
    const s = subsistemaDePieza({ nombre: d });
    if (!s) sin += 1; else por[s] = (por[s] || 0) + c;
    suma += c;
  }
  return { por, sin, suma };
}

describe('LAB TELCEL · cobertura y conservación de material por subsistema', () => {
  for (const [nombre, { target, mats }] of Object.entries(MODULOS)) {
    it(`${nombre}: 0 líneas sin clasificar y Σ(subsistemas) = target (${target})`, () => {
      const { por, sin, suma } = desglose(mats);
      expect(sin).toBe(0);                                   // cobertura total
      expect(Math.abs(suma - target)).toBeLessThanOrEqual(0.05);
      const sumaPor = Object.values(por).reduce((a, b) => a + b, 0);
      expect(Math.abs(sumaPor - target)).toBeLessThanOrEqual(0.05); // ni pierde ni duplica
    });
  }
});

describe('LAB TELCEL · ubicación económica y hallazgos', () => {
  it('todo el metal/pintura/madera de fábrica cae en subsistemas de ubicación "fabrica"', () => {
    const { por } = desglose(MODULOS.Horizontal.mats);
    for (const clave of Object.keys(por)) expect(UBIC[clave]).toBe('fabrica');
  });

  it('Almacenamiento: la bisagra es herrajes = compra-venta (separada de la fábrica)', () => {
    const { por } = desglose(MODULOS.Almacenamiento.mats);
    expect(por.herrajes).toBeCloseTo(54.64, 2);
    expect(UBIC.herrajes).toBe('compra_venta');
    // El grueso del módulo es estructura (fábrica).
    expect(por.estructura).toBeGreaterThan(por.paneleria);
  });

  it('HALLAZGO: la "MADERA PARA EMBALAJE" de Torre cae en PROYECTO, no en fábrica', () => {
    // El workbook la sumó dentro del material del módulo; por ubicación económica
    // inequívoca pertenece a la partida de proyecto (no costo de fábrica).
    const { por } = desglose(MODULOS.Torre.mats);
    expect(por.embalaje_logistica).toBeCloseTo(212, 2);
    expect(UBIC.embalaje_logistica).toBe('proyecto');
  });

  it('las tiras de madera de pino (carpintería) ya se clasifican (antes quedaban fuera)', () => {
    const { por } = desglose(MODULOS.Isla.mats);
    expect(por.paneleria).toBeGreaterThan(1000); // 3 tiras de pino + ...
    expect(UBIC.paneleria).toBe('fabrica');
  });
});
