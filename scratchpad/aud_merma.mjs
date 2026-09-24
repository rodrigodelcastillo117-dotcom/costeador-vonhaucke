import { LINEAS_REG, configDesde } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { calcular, PARAMETROS_DEFAULT } from '../src/motor/calculo.js';
const INS = mapaInsumos(INSUMOS_SEMILLA);
const g = LINEAS_REG['applt'].generar(configDesde(LINEAS_REG['applt'].productos.find(p=>p.id==='escritorio'), {}));
for (const n of [1, 5, 10, 30]) {
  const r = calcular(g, n, INS, PARAMETROS_DEFAULT);
  const pctM = (r.desperdicio / r.materialTotal * 100);
  console.log(`lote ${String(n).padStart(2)}: costo/u $${r.costoUnitario.toFixed(0)}  merma ${pctM.toFixed(0)}%`);
}
console.log('\n-- desglose merma por insumo (lote 1) --');
const r1 = calcular(g, 1, INS, PARAMETROS_DEFAULT);
for (const d of r1.detalleInsumos) if ((d.desperdicio||0) > 20) console.log(`  ${d.nombre.padEnd(30)} desp $${d.desperdicio.toFixed(0)} (${(d.pct||0).toFixed(0)}%)`);
