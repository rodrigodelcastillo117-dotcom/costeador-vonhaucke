// ============================================================================
//  MATRIZ GOLDEN POR FAMILIA (audit: "suite golden, cada familia, una regresión
//  rompe CI"). Fija el costo y el precio de UN producto representativo de CADA
//  línea con los parámetros por defecto, tal como el costeo LIVE (client-side) los
//  calcula hoy (estado verificado 2026-10-04). Si un cambio futuro mueve el costo
//  de cualquier familia aunque sea un peso, esta prueba lo caza.
//
//  Cómo se generó: `costearItem(estado, {ruta, producto, cantidad:1, seleccion:[]})`
//  con INSUMOS_SEMILLA + PARAMETROS_DEFAULT. Para re-generar tras un cambio
//  INTENCIONAL del método, correr el mismo barrido y actualizar los números con
//  su explicación (igual que los golden de Alba/Alpura).
// ============================================================================
import { describe, it, expect, beforeAll } from 'vitest';

// [ruta, producto, costoUnitario, precioUnitario]
const MATRIZ = [
  ['applt', 'escritorio', 3703.77, 8000.14],
  ['app', 'escritorio', 4074.15, 8800.16],
  ['via', 'escritorio', 2949.51, 5899.01],
  ['rio', 'bench_recto_sencillo', 2933.35, 5866.70],
  ['feather', 'escritorio', 3577.91, 7155.81],
  ['cirque', 'escritorio', 5840.78, 11681.57],
  ['spine', 'ducto', 1356.79, 2713.57],
  ['ergo4', 'banca_sencilla', 5244.35, 10488.71],
  ['alba', 'escritorio', 4297.82, 8595.64],
  ['eclipse', 'escritorio', 12580.56, 27220.00],
  ['drift', 'escritorio', 3172.15, 6344.30],
  ['luna', 'escritorio', 8630.48, 17260.97],
  ['flex', 'escritorio', 2824.12, 5648.25],
  ['anteo', 'escritorio', 31605.94, 63211.88],
  ['mox', 'rodante', 1486.11, 3210.00],
  ['modulor', 'gaveta', 1365.38, 2730.75],
  ['tetris', 'sofa', 3305.56, 5250.00],
  ['arlequin', 'pouf', 652.63, 1305.26],
  ['pac', 'sillon', 2253.44, 4506.89],
  ['worklounge', 'tank', 1999.17, 3998.34],
  ['pebble', 'mesa', 938.54, 1877.08],
  ['accents', 'acrilico', 309.36, 618.72],
  ['teamspace2', 'soporte', 1553.70, 3107.40],
  ['privacy4', 'muro', 3627.41, 7254.83],
  ['ecoacustic', 'panel_liso', 1880.00, 3760.00],
];

describe('Matriz golden de costeo por familia', () => {
  let costearItem, estado;
  beforeAll(async () => {
    const ln = await import('../datos/lineas.js');
    const ins = await import('../datos/insumos.js');
    const mc = await import('./calculo.js');
    costearItem = ln.costearItem;
    estado = { insumos: ins.mapaInsumos(ins.INSUMOS_SEMILLA), parametros: mc.PARAMETROS_DEFAULT, piezas: {} };
  });

  for (const [ruta, producto, costoEsperado, precioEsperado] of MATRIZ) {
    it(`${ruta}/${producto} — costo ${costoEsperado} · precio ${precioEsperado}`, () => {
      const r = costearItem(estado, { ruta, producto, cantidad: 1, seleccion: [] });
      expect(r, `${ruta}/${producto} no devolvió resultado`).toBeTruthy();
      // Todo dinero debe ser finito (audit P1-08).
      expect(Number.isFinite(r.costoUnitario)).toBe(true);
      expect(Number.isFinite(r.precioUnitario)).toBe(true);
      // Fijo al peso (±0.5) — una regresión del método lo rompe.
      expect(r.costoUnitario).toBeCloseTo(costoEsperado, 0);
      expect(r.precioUnitario).toBeCloseTo(precioEsperado, 0);
    });
  }
});
