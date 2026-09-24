import { LINEAS_REG, configDesde } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { calcular, PARAMETROS_DEFAULT } from '../src/motor/calculo.js';

const INS = mapaInsumos(INSUMOS_SEMILLA);
const par = { ...PARAMETROS_DEFAULT };
const fantasmas = new Map();   // insumoId inexistente -> [linea/prod]
const ceros = [];              // producto con costo 0
const mermaAlta = [];          // desperdicio > 50%
const compCero = [];           // componente con costo 0 (insumo existe pero $0)
let total = 0;

for (const [ruta, L] of Object.entries(LINEAS_REG)) {
  for (const prod of L.productos || []) {
    let g;
    try { g = L.generar(configDesde(prod, {})); } catch (e) { continue; }
    total++;
    for (const c of g.componentes || []) {
      if (c.insumoId && !INS[c.insumoId]) {
        if (!fantasmas.has(c.insumoId)) fantasmas.set(c.insumoId, []);
        fantasmas.get(c.insumoId).push(`${ruta}/${prod.id}`);
      }
    }
    const r = calcular(g, 1, INS, par);
    if (!(r.costoUnitario > 0)) ceros.push(`${ruta}/${prod.id} = $${r.costoUnitario}`);
    const pctMerma = r.materialTotal > 0 ? (r.desperdicio / r.materialTotal) * 100 : 0;
    if (pctMerma > 50) mermaAlta.push(`${ruta}/${prod.id}  merma ${pctMerma.toFixed(0)}%  (mat $${r.materialTotal.toFixed(0)}, desp $${r.desperdicio.toFixed(0)})`);
  }
}

console.log(`Productos auditados: ${total}\n`);
console.log(`== INSUMOS FANTASMA (referenciados pero NO existen -> cuestan $0 en silencio): ${fantasmas.size} ==`);
for (const [id, usos] of fantasmas) console.log(`  ${id}  <- ${[...new Set(usos)].slice(0,6).join(', ')}${usos.length>6?` (+${usos.length-6})`:''}`);
console.log(`\n== PRODUCTOS EN $0: ${ceros.length} ==`);
ceros.slice(0,20).forEach(x=>console.log('  '+x));
console.log(`\n== MERMA > 50% (posible pieza que no cabe / nesteo malo): ${mermaAlta.length} ==`);
mermaAlta.slice(0,25).forEach(x=>console.log('  '+x));
