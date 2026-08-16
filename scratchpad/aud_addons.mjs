// ¿El camino de Voni (costearItem) cobra los add-ons? La pantalla
// CosteadorLinea sí los cobra (partidas aparte). costearItem no los devuelve.
import { LINEAS_REG, configDesde, costearItem, costearConfig } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';
import { addonsAppLT, electricoLista } from '../src/datos/applt.js';
import { precioDeLista } from '../src/datos/preciosVenta.js';

const estado = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT };
const pesos = (n) => '$' + Math.round(n).toLocaleString('es-MX');

const p = LINEAS_REG.applt.productos.find((x) => x.id === 'banca_doble');
console.log('checks de applt.banca_doble:', (p.checks || []).map((c) => c.key));
console.log('selects:', (p.selects || []).map((s) => s.key));

for (const cfgIn of [{ largoMM: 1200, usuarios: 8 }, { largoMM: 1200, usuarios: 8, electrico: true }]) {
  const item = { ruta: 'applt', producto: 'banca_doble', cantidad: 1,
    seleccion: Object.entries(cfgIn).map(([clave, valor]) => ({ clave, valor })) };
  const r = costearItem(estado, item);
  const cfg = configDesde(p, cfgIn);
  const g = LINEAS_REG.applt.generar(cfg);
  const ad = g.addons || [];
  const totAd = ad.reduce((s, a) => s + precioDeLista(a.lista) * (a.cantidad || 1), 0);
  console.log(`\ncfg=${JSON.stringify(cfgIn)}`);
  console.log(`   config resuelta electrico=${cfg.electrico} gavetas=${cfg.gavetas}`);
  console.log(`   costearItem (Voni)  precioUnitario = ${pesos(r.precioUnitario)}   claves devueltas: ${Object.keys(r).filter((k) => /addon/i.test(k)).length ? 'trae addons' : 'NO trae addons'}`);
  console.log(`   el generador declara ${ad.length} add-on(s) por ${pesos(totAd)}: ${ad.map((a) => a.nombre).join(' | ') || '—'}`);
  if (ad.length && !Object.keys(r).some((k) => /addon/i.test(k))) {
    console.log(`   ✗ Voni pierde ${pesos(totAd)} (${((totAd / r.precioUnitario) * 100).toFixed(0)}% del módulo)`);
  }
}

// ¿gavetas llega por costearItem?
console.log('\n### ¿la gaveta llega por el camino de Voni?');
const item = { ruta: 'applt', producto: 'banca_doble', cantidad: 1,
  seleccion: [{ clave: 'largoMM', valor: 1200 }, { clave: 'usuarios', valor: 8 }, { clave: 'gavetas', valor: 8 }] };
const r = costearItem(estado, item);
console.log('   config.gavetas =', r.config.gavetas, '→', r.config.gavetas ? 'sí' : '✗ se pierde: configDesde no copia `gavetas`');
console.log('   addonsAppLT con gavetas:8 →', addonsAppLT({ producto: 'banca_doble', usuarios: 8, gavetas: 8 }).map((a) => `${a.nombre} x${a.cantidad} = ${pesos(precioDeLista(a.lista) * a.cantidad)}`).join(' | '));

// eléctrico: contra el papel
console.log('\n### SISTEMA ELÉCTRICO contra el papel 226030018 (columna Desc. 40% impresa)');
const PAPEL = [['banca_sencilla', 1, 3030, 1818], ['banca_sencilla', 2, 4230, 2538], ['banca_sencilla', 3, 5430, 3258],
  ['banca_doble', 4, 5230, 3138], ['banca_doble', 8, 8630, 5178]];
for (const [prod, u, bruta, neto] of PAPEL) {
  const l = electricoLista(prod, u);
  console.log(`   ${prod} ${u}u: app bruta ${pesos(l)} (papel ${pesos(bruta)})  neto ${pesos(precioDeLista(l))} (papel ${pesos(neto)})  ${Math.abs(l - bruta) < 1 ? '✓' : '✗'}`);
}
