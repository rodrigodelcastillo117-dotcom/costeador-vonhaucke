// La app debe escupir el PRECIO DE LISTA (precio 2 − 40%), que es el que
// Von Haucke cobra. Se contrasta contra los presupuestos que lo imprimen tal cual.
import { LINEAS_REG, configDesde, costearConfig } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';
const estado = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT };

// [ruta, producto, seleccion, precio de lista REAL, fuente]
const anclas = [
  ['applt', 'banca_sencilla', { largoMM: 1200, fondoMM: 600, usuarios: 2, biombo: 'pet' }, 15700, 'pptx 2508040 (2u)'],
  ['applt', 'banca_doble', { largoMM: 1200, fondoMM: 1200, usuarios: 6, biombo: 'pet' }, 17600, '226030134 Mixue 6u'],
  ['applt', 'banca_doble', { largoMM: 1200, fondoMM: 1200, usuarios: 8, biombo: 'pet' }, 23340, '226030134 Mixue 8u'],
  ['applt', 'mesa_juntas', { largoMM: 2400, fondoMM: 1200 }, 13780, '226050047 (1 caja; la fila del price-book trae 2)'],
  ['modulor', 'archivero_h', { modelo: 'cajones120izq' }, 9460, '226060050 archivero 1.20'],
  ['modulor', 'archivero_h', { modelo: 'puertas90' }, 7230, '226030134 y 225120019'],
  ['mox', 'rodante', { frentes: 'melamina', tapa: 'melamina' }, 3210, '226030018 gaveta'],
];
let n = 0, suma = 0;
for (const [ruta, pid, sel, real, fuente] of anclas) {
  const p = LINEAS_REG[ruta].productos.find((x) => x.id === pid);
  const r = costearConfig(estado, ruta, pid, configDesde(p, sel), 1);
  const got = Math.round(r.precioUnitario);
  const err = (got - real) / real;
  n++; suma += Math.abs(err);
  const sig = Math.abs(err) <= 0.15 ? '✓' : '✗';
  console.log(`${sig} ${ruta}/${pid.padEnd(16)} app $${String(got).padStart(7)}  real $${String(real).padStart(7)}  ` +
    `${(err * 100 >= 0 ? '+' : '')}${(err * 100).toFixed(1)}%   ${fuente}`);
}
console.log(`\nError absoluto medio: ${(suma / n * 100).toFixed(1)}%  sobre ${n} anclas`);
