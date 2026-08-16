// ¿El price-book nuevo SÍ cambia lo que cotiza la app, y sólo donde debe?
import { LINEAS_REG, configDesde, costearConfig } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';
const estado = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT };

const casos = [
  ['modulor', 'archivero_h', { modelo: 'puertas90' }, 7230],
  ['modulor', 'archivero_h', { modelo: 'cajones120izq' }, 9460],
  ['modulor', 'archivero_h', { modelo: 'cajones120der' }, 9460],
  ['mox', 'rodante', { frentes: 'melamina', tapa: 'melamina' }, 3210],
  // control: NO debe moverse (no hay fila para estos)
  ['modulor', 'archivero_h', { modelo: 'corrediza150' }, null],
  ['mox', 'rodante', { frentes: 'lamina', tapa: 'metal' }, null],
  ['modulor', 'armario', {}, null],
];
let mal = 0;
for (const [ruta, pid, sel, esperado] of casos) {
  const p = LINEAS_REG[ruta].productos.find((x) => x.id === pid);
  const cfg = configDesde(p, sel);
  const r = costearConfig(estado, ruta, pid, cfg, 1);
  const got = Math.round(r.precioUnitario);
  const ok = esperado == null ? true : got === esperado;
  if (!ok) mal++;
  console.log(`${ok ? '✓' : '✗'} ${ruta}/${pid} ${JSON.stringify(sel).padEnd(42)} $${String(got).padStart(7)}` +
    (esperado ? `  (precio de lista real $${esperado})` : '  (modelo — sin ancla, no debe clavarse)'));
}
console.log(mal === 0 ? '\n✅ el price-book manda donde hay ancla y no toca lo demás' : `\n❌ ${mal} mal`);
