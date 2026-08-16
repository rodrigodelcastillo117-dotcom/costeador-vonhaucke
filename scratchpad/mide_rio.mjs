// Mide Río contra su ancla real del papel, y de paso contra App LT en la MISMA
// geometría. Ancla: 226060050, bench doble 4800×1200 8 usuarios = $4,654/puesto
// de precio de lista (neto). En precio 2 (bruta) = 4654/0.6 = $7,757/puesto.
import { costearConfig } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';

// OJO: el motor quiere un MAPA id→insumo, no el arreglo. Con el arreglo el
// material sale en 0 y todo parece gratis.
const estado = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT };
const CASOS = [
  ['rio',   'bench_curvo_doble', { usuarios: '8', largo: '1200', biombo: 'PT' }, 8, 'Río CURVO doble 8u  ← ancla'],
  ['rio',   'bench_curvo_doble', { usuarios: '6', largo: '1200', biombo: 'PT' }, 6, 'Río CURVO doble 6u @1.20'],
  ['rio',   'bench_curvo_doble', { usuarios: '10', largo: '1200', biombo: 'PT' }, 10, 'Río CURVO doble 10u @1.20'],
  ['rio',   'bench_recto_doble', { usuarios: '8', largo: '1200', biombo: 'PT' }, 8, 'Río recto doble 8u (comparación)'],
  ['applt', 'banca_doble', { largoMM: 1200, fondoMM: 1200, usuarios: 6, biombo: 'cristal' }, 6, 'App LT doble 6u @1.20'],
];
console.log('                                 costo    precio    $/puesto  origen');
for (const [ruta, prod, cfg, u, eti] of CASOS) {
  const r = costearConfig(estado, ruta, prod, cfg, 1);
  if (!r) { console.log(`${eti.padEnd(30)} → no se pudo costear`); continue; }
  console.log(`${eti.padEnd(30)} $${String(Math.round(r.costoUnitario)).padStart(7)} $${String(Math.round(r.precioUnitario)).padStart(8)} $${String(Math.round(r.precioUnitario / u)).padStart(8)}  ${r.precioReal ? 'papel' : 'modelo'}`);
}
console.log('\nANCLA de papel: Río doble @1.20 = $7,757/puesto en precio 2 ($4,654 de lista).');
console.log('ANCLA de papel: App LT doble @1.20 = $4,889/puesto en precio 2 ($2,933 de lista).');
