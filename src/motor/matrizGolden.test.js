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
//  2026-11-03 (HERRAJES → compra-venta, autorizado por Rodrigo del Castillo, Dirección): las jaladeras/bisagras/correderas/
//  chapas/niveladores (sección 'herrajes') se COMPRAN ya hechas y solo se instalan → pasan a compra-venta (MO 1 % / GI 5 %),
//  igual que el cristal. BAJAN 16 familias con herrajería entre −0.1 % y −4.64 % (nunca suben). La labor de instalación real
//  se recupera en el renglón de proyecto "Maniobras" (3 %) y, con orden, en las horas. 9 familias sin herrajes no cambian.
// ============================================================================
import { describe, it, expect, beforeAll } from 'vitest';

// [ruta, producto, costoUnitario, precioUnitario]
const MATRIZ = [
  ['applt', 'escritorio', 2967.34, 6409.45],   // 14-oct merma D2 6.94 % (antes 2962.06) · D2: PTR por fracción de tramo · VH-183: cubierta 1500×600 = ½ hoja (antes 1 hoja por la rejilla)
  ['app', 'escritorio', 3264.07, 7050.40],   // 14-oct merma D2 6.94 % (antes 3258.27) · D2: PTR por fracción de tramo · VH-183: cubierta 1500×600 = ½ hoja
  ['via', 'escritorio', 2901.85, 5803.71],   // 03-nov herrajes→compra-venta (antes 2949.51, −1.62 %)
  ['rio', 'bench_recto_sencillo', 2580.67, 5161.35],   // 14-oct merma D2 6.94 % (antes 2579.91) · D2: PTR por fracción de tramo
  ['feather', 'escritorio', 2631.14, 5262.29],   // 14-oct merma D2 6.94 % · D2: PTR fracción · VH-183: cubierta ½ hoja · 03-nov herrajes→compra-venta (antes 2641.06, −0.38 %)
  ['cirque', 'escritorio', 5288.02, 10576.05],   // 14-oct merma D2 6.94 % · D2: PTR fracción · 03-nov herrajes→compra-venta (antes 5326.25, −0.72 %)
  ['spine', 'ducto', 1342.88, 2685.75],   // 03-nov herrajes→compra-venta (antes 1356.79, −1.03 %)
  ['ergo4', 'banca_sencilla', 5171.47, 10342.95],   // 14-oct merma D2 6.94 % · D2: PTR fracción · 03-nov herrajes→compra-venta (antes 5176.87, −0.1 %)
  ['alba', 'escritorio', 4217.10, 8434.21],   // 03-nov herrajes→compra-venta (antes 4297.82, −1.88 %)
  ['eclipse', 'escritorio', 12580.56, 27220.00],
  ['drift', 'escritorio', 2849.19, 5698.37],   // 14-oct merma D2 6.94 % · D2: PTR fracción · 03-nov herrajes→compra-venta (antes 2926.38, −2.64 %)
  ['luna', 'escritorio', 8797.03, 17594.05],   // VH-183: faldón 1500×320 = ½ hoja · 03-nov herrajes→compra-venta (antes 8809.16, −0.14 %)
  ['flex', 'escritorio', 2645.24, 5290.47],   // 14-oct merma D2 6.94 % · D2: PTR fracción · 03-nov herrajes→compra-venta (antes 2695.40, −1.86 %)
  ['anteo', 'escritorio', 30691.30, 61382.61],   // 14-oct merma D2 6.94 % · D2: PTR fracción · 03-nov herrajes→compra-venta (antes 30777.62, −0.28 %)
  ['mox', 'rodante', 1486.11, 3210.00],
  ['modulor', 'gaveta', 1302.04, 2604.08],   // 03-nov herrajes→compra-venta (antes 1365.38, −4.64 %)
  ['tetris', 'sofa', 3305.56, 5250.00],
  ['arlequin', 'pouf', 647.23, 1294.46],   // 03-nov herrajes→compra-venta (antes 652.63, −0.83 %)
  ['pac', 'sillon', 2248.04, 4496.09],   // 03-nov herrajes→compra-venta (antes 2253.44, −0.24 %)
  ['worklounge', 'tank', 1999.17, 3998.34],
  ['pebble', 'mesa', 740.94, 1481.88],   // 14-oct merma D2 6.94 % (antes 738.96) · D2: PTR por fracción de tramo
  ['accents', 'acrilico', 308.01, 616.02],   // 03-nov herrajes→compra-venta (antes 309.36, −0.44 %)
  ['teamspace2', 'soporte', 1542.90, 3085.80],   // 03-nov herrajes→compra-venta (antes 1553.70, −0.7 %)
  ['privacy4', 'muro', 3473.16, 6946.31],   // 03-nov herrajes→compra-venta (antes 3627.41, −4.25 %)
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
