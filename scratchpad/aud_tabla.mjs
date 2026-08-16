import { LINEAS_REG, configDesde, costearConfig } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';
import { PRECIOS_VENTA } from '../src/datos/preciosVenta.js';
import { BANCO } from '../src/datos/banco.js';
import { FACTOR_LINEA, AJUSTE_PRODUCTO, OBJETIVO_LINEA } from '../src/datos/factoresLinea.js';
const estado = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT };
const pesos = (n) => '$' + Math.round(n).toLocaleString('es-MX');
const RUTA = { 'App LT':'applt', App:'app', 'Río':'rio', Modulor:'modulor', Mox:'mox', Luna:'luna', Cirque:'cirque',
  Alba:'alba', Eclipse:'eclipse', 'Ergonova 4':'ergo4', Accents:'accents', Feather:'feather', Flex:'flex',
  'Vía':'via', Spine:'spine', Anteo:'anteo', Tetris:'tetris', 'Arlequín':'arlequin', Pac:'pac',
  'Work Lounge':'worklounge', Pebble:'pebble', 'Privacy 4':'privacy4', 'TeamSpace II':'teamspace2',
  'Eclipse Drift':'drift', Drift:'drift' };
const pb = {}, bk = {};
for (const r of PRECIOS_VENTA) pb[r.linea] = (pb[r.linea]||0)+1;
for (const b of BANCO) { const r = RUTA[b.linea]; if (r) bk[r] = (bk[r]||0)+1; }
console.log('| línea | prods | filas price-book | renglones banco | factor | ajustes | confianza |');
console.log('|---|---|---|---|---|---|---|');
for (const [ruta,L] of Object.entries(LINEAS_REG)) {
  const nAj = Object.keys(AJUSTE_PRODUCTO).filter(k=>k.startsWith(ruta+'.')).length;
  const f = FACTOR_LINEA[ruta];
  const conf = pb[ruta] ? 'ANCLA DE PAPEL' : (bk[ruta] ? 'papel indirecto (banco)' : (f ? 'sólo modelo + factor' : 'SÓLO MODELO, sin nada'));
  console.log(`| ${L.titulo} (${ruta}) | ${L.productos.length} | ${pb[ruta]||0} | ${bk[ruta]||0} | ${f?f.toFixed(3):'1.000'} | ${nAj} | ${conf} |`);
}
// dinero del bench
console.log('\n### DINERO DEL DESAJUSTE DEL BENCH (100 puestos)');
const P=(r,p,s)=>{const pr=LINEAS_REG[r]?.productos.find(x=>x.id===p);return pr?costearConfig(estado,r,p,configDesde(pr,s),1):null;};
const ref = P('applt','banca_doble',{largoMM:1200,usuarios:2}).precioUnitario/2;
const B = { app:['banca_doble',{largoMM:1200,usuarios:2},2], via:['banca_doble',{},2], rio:['bench_recto_doble',{usuarios:'2'},2],
  feather:['bench_doble',{},2], flex:['banca_doble',{},2], alba:['bench',{},2], cirque:['banca',{},2] };
let tot=0;
for (const [ruta,[prod,sel,u]] of Object.entries(B)) {
  const r=P(ruta,prod,sel); const porU=r.precioUnitario/u; const obj=OBJETIVO_LINEA?.[ruta];
  const deb=(obj??1)*ref; const dif=(porU-deb)*100; tot+=dif;
  console.log(`   ${ruta.padEnd(9)} objetivo ${pesos(deb).padStart(8)}/puesto · cotiza ${pesos(porU).padStart(9)} → ${pesos(dif).padStart(11)} de más en 100 puestos (${((porU/deb-1)*100).toFixed(0)}%)`);
}
