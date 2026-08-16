// Valida huellaReal() contra las medidas REALES del presupuesto 226030018
// (las mismas anclas que se usaron para calibrar el precio de App LT).
import { huellaReal, tipoDe } from '../src/datos/espacio.js';

// [nombre generado, w del despiece, d del despiece, largo×fondo REAL esperado]
const ANCLAS = [
  ['Banca sencilla APP LT 1.20 · 1 usuarios', 1200, 600, 1200, 600],
  ['Banca sencilla APP LT 1.20 · 2 usuarios', 1200, 600, 2400, 600],
  ['Banca sencilla APP LT 1.20 · 3 usuarios', 1200, 600, 3600, 600],
  ['Banca doble APP LT 1.05 · 4 usuarios', 1050, 1200, 2100, 1200],
  ['Banca doble APP LT 1.05 · 8 usuarios', 1050, 1200, 4200, 1200],
  // Feather declara fondo por hilera (0.60): el bench doble sí duplica.
  ['Feather · Bench doble 4 puestos 1.20 m', 1200, 600, 2400, 1200],
  // Ergonova declara fondo de bench completo (1.23): NO debe duplicar.
  ['Ergonova 4 · Banca doble 2 puestos 0.90 m', 900, 1230, 900, 1230],
  // Un escritorio suelto no se toca.
  ['Escritorio APP LT 1.50 × 0.60', 1500, 600, 1500, 600],
];

let malos = 0;
for (const [nombre, w, d, expW, expD] of ANCLAS) {
  const tipo = tipoDe({ nombre });
  const [gw, gd] = huellaReal(nombre, w, d, tipo);
  const ok = gw === expW && gd === expD;
  if (!ok) malos++;
  console.log(`${ok ? '✓' : '✗'} ${nombre.padEnd(44)} [${tipo}] → ${gw}×${gd}  (esperado ${expW}×${expD})`);
}
console.log(malos === 0 ? '\nTODAS LAS ANCLAS DE MEDIDA CUADRAN' : `\n${malos} ANCLA(S) MAL`);
process.exit(malos ? 1 : 0);
