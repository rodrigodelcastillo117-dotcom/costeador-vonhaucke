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
//  2026-10-13 (VH-183): la regla de tablero de Producción es inclusiva en 1.50 m, como cobra Intelisis; se movieron 4
//  escritorios con piezas de exactamente 1500 mm (comentario en cada fila).
//  2026-10-13 (D2, firmado por Dirección): el tubular de acero se costea por fracción de tramo + merma de corte, como
//  Intelisis; bajan las 10 familias con PTR. El perfil de aluminio sigue por tramo entero (no está en la firma).
//  2026-10-14 (merma D2 autorizada por Dirección, motor 2026-10-14b): el tubular de acero usa 6.94 % de merma de corte (la
//  ficha del PTR curado decía 5 % sin documento). Suben las 10 familias con PTR entre +0.03 % y +0.98 % de costo.
// ============================================================================
import { describe, it, expect, beforeAll } from 'vitest';

// [ruta, producto, costoUnitario, precioUnitario]
const MATRIZ = [
  ['applt', 'escritorio', 2967.34, 6409.45],   // 14-oct merma D2 6.94 % (antes 2962.06) · D2: PTR por fracción de tramo · VH-183: cubierta 1500×600 = ½ hoja (antes 1 hoja por la rejilla)
  ['app', 'escritorio', 3264.07, 7050.40],   // 14-oct merma D2 6.94 % (antes 3258.27) · D2: PTR por fracción de tramo · VH-183: cubierta 1500×600 = ½ hoja
  ['via', 'escritorio', 2949.51, 5899.01],
  ['rio', 'bench_recto_sencillo', 2580.67, 5161.35],   // 14-oct merma D2 6.94 % (antes 2579.91) · D2: PTR por fracción de tramo
  ['feather', 'escritorio', 2641.06, 5282.12],   // 14-oct merma D2 6.94 % (antes 2615.35) · D2: PTR por fracción de tramo · VH-183: cubierta 1500×600 = ½ hoja
  ['cirque', 'escritorio', 5326.25, 10652.51],   // 14-oct merma D2 6.94 % (antes 5303.47) · D2: PTR por fracción de tramo
  ['spine', 'ducto', 1356.79, 2713.57],
  ['ergo4', 'banca_sencilla', 5176.87, 10353.75],   // 14-oct merma D2 6.94 % (antes 5170.95) · D2: PTR por fracción de tramo
  ['alba', 'escritorio', 4297.82, 8595.64],
  ['eclipse', 'escritorio', 12580.56, 27220.00],
  ['drift', 'escritorio', 2926.38, 5852.76],   // 14-oct merma D2 6.94 % (antes 2916.21) · D2: PTR por fracción de tramo
  ['luna', 'escritorio', 8809.16, 17618.33],   // VH-183: faldón 1500×320 = ½ hoja por regla (antes ⅓ por rejilla)
  ['flex', 'escritorio', 2695.40, 5390.81],   // 14-oct merma D2 6.94 % (antes 2678.55) · D2: PTR por fracción de tramo
  ['anteo', 'escritorio', 30777.62, 61555.25],   // 14-oct merma D2 6.94 % (antes 30748.75) · D2: PTR por fracción de tramo
  ['mox', 'rodante', 1486.11, 3210.00],
  ['modulor', 'gaveta', 1365.38, 2730.75],
  ['tetris', 'sofa', 3305.56, 5250.00],
  ['arlequin', 'pouf', 652.63, 1305.26],
  ['pac', 'sillon', 2253.44, 4506.89],
  ['worklounge', 'tank', 1999.17, 3998.34],
  ['pebble', 'mesa', 740.94, 1481.88],   // 14-oct merma D2 6.94 % (antes 738.96) · D2: PTR por fracción de tramo
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
