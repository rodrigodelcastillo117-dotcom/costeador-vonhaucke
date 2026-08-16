// ¿Qué tan lejos está la app del precio REAL del archivero Modulor?
// Ancla real: presupuesto 226010047 (15-ene-2026), archivero registro lateral
// 2 cajones + 1 entrepaño, 1200 × 582 × 448, lista bruta $17,120.
import { LINEAS_REG, configDesde, costearConfig } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';

const estado = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT };
const REAL = 17120;
const L = LINEAS_REG.modulor;
for (const pid of ['archivero_lateral', 'archivero_h', 'librero', 'armario', 'torre']) {
  const p = L.productos.find((x) => x.id === pid); if (!p) continue;
  const modelos = (p.selects?.find((s) => s.key === 'modelo')?.opciones.map((o) => o.id)) || [null];
  for (const m of modelos) {
    const cfg = configDesde(p, m ? { modelo: m } : {});
    const r = costearConfig(estado, 'modulor', pid, cfg, 1);
    if (!r) { console.log(`${pid}/${m}  — no costeó`); continue; }
    const lista = r.precioUnitario;
    console.log(`${pid.padEnd(18)} ${String(m).padEnd(12)} ${String(r.nombre).slice(0, 44).padEnd(46)} $${lista.toFixed(0).padStart(8)}   ${(REAL / lista).toFixed(2)}× por debajo`);
  }
}
console.log(`\nAncla real (lista bruta, 226010047): $${REAL}`);
