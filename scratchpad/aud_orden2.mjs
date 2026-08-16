// ORDEN COMERCIAL, bien medido: comparar ESCRITORIO contra ESCRITORIO y
// BENCH contra BENCH. El factor de línea se calibró sobre UN producto; hay que
// ver contra cuál cierra y contra cuáles no.
import { LINEAS_REG, configDesde, costearConfig } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT, calcular, precioVenta } from '../src/motor/calculo.js';
import { OBJETIVO_LINEA, FACTOR_LINEA, AJUSTE_PRODUCTO } from '../src/datos/factoresLinea.js';
import { precioDeLista } from '../src/datos/preciosVenta.js';

const insumos = mapaInsumos(INSUMOS_SEMILLA);
const estado = { insumos, parametros: PARAMETROS_DEFAULT };
const pesos = (n) => '$' + Math.round(n).toLocaleString('es-MX');
const P = (ruta, prod, sel) => {
  const p = LINEAS_REG[ruta]?.productos.find((x) => x.id === prod);
  return p ? costearConfig(estado, ruta, prod, configDesde(p, sel), 1) : null;
};
// Precio del MODELO puro de App LT (sin escalera por usuario ni price-book)
function modeloAppLT(prod, sel) {
  const L = LINEAS_REG.applt; const p = L.productos.find((x) => x.id === prod);
  const g = L.generar(configDesde(p, sel));
  const par = { ...PARAMETROS_DEFAULT, modeloCosteo: 'intelisis', usarCostoPorArea: true, ...(g.parModelo || {}) };
  const r = calcular({ nombre: g.nombre, componentes: g.componentes, horas: g.horas, modoManoObra: g.modoManoObra, modeloCosteo: 'intelisis' }, 1, insumos, par);
  return precioDeLista(precioVenta(r.costoUnitario, par).lista);
}

const refEscModelo = modeloAppLT('escritorio', {});
const refEscApp = P('applt', 'escritorio', {}).precioUnitario;
const refBenchModelo = modeloAppLT('banca_doble', { largoMM: 1200, usuarios: 2 }) / 2;
const refBenchApp = P('applt', 'banca_doble', { largoMM: 1200, usuarios: 2 }).precioUnitario / 2;

console.log('### LA REFERENCIA (App LT)');
console.log(`   escritorio      modelo ${pesos(refEscModelo)}   la app cotiza ${pesos(refEscApp)}   (${(refEscApp / refEscModelo).toFixed(2)}× — cae al MODELO)`);
console.log(`   bench $/puesto  modelo ${pesos(refBenchModelo)}   la app cotiza ${pesos(refBenchApp)}   (${(refBenchApp / refBenchModelo).toFixed(2)}× — cae a la ESCALERA POR USUARIO)`);
console.log('   ⚠️ App LT no se cotiza igual a sí misma según el producto: el escritorio va por modelo');
console.log('      y la banca por papel. Los FACTOR_LINEA se despejaron contra el MODELO.\n');

const ESC = { app: 'escritorio', via: 'escritorio', rio: 'bench_recto_sencillo', feather: 'escritorio',
  flex: 'escritorio', alba: 'escritorio', cirque: 'escritorio', luna: 'escritorio' };
const BENCH = { app: ['banca_doble', { largoMM: 1200, usuarios: 2 }, 2], via: ['banca_doble', {}, 2],
  rio: ['bench_recto_doble', { usuarios: '2' }, 2], feather: ['bench_doble', {}, 2],
  flex: ['banca_doble', {}, 2], alba: ['bench', {}, 2], cirque: ['banca', {}, 2] };

console.log('### A) CONTRA EL ESCRITORIO (el producto sobre el que se calibró el factor)');
console.log('   línea      objetivo   medido   precio       veredicto');
for (const [ruta, prod] of Object.entries(ESC)) {
  const r = P(ruta, prod, {}); if (!r) { console.log(`   ${ruta}: sin producto`); continue; }
  const m = r.precioUnitario / refEscApp;
  const obj = OBJETIVO_LINEA[ruta];
  console.log(`   ${ruta.padEnd(10)} ${obj.toFixed(2).padStart(7)}  ${m.toFixed(2).padStart(7)}×  ${pesos(r.precioUnitario).padStart(10)}   ${Math.abs(m / obj - 1) < 0.15 ? '✓ cierra' : '✗ FUERA por ' + ((m / obj - 1) * 100).toFixed(0) + '%'}`);
}

console.log('\n### B) CONTRA EL BENCH, $/puesto (donde App LT ya cotiza por PAPEL)');
console.log('   línea      objetivo   medido   $/puesto     veredicto');
for (const [ruta, [prod, sel, u]] of Object.entries(BENCH)) {
  const r = P(ruta, prod, sel); if (!r) { console.log(`   ${ruta}: sin producto`); continue; }
  const porU = r.precioUnitario / u;
  const m = porU / refBenchApp;
  const obj = OBJETIVO_LINEA[ruta];
  console.log(`   ${ruta.padEnd(10)} ${obj.toFixed(2).padStart(7)}  ${m.toFixed(2).padStart(7)}×  ${pesos(porU).padStart(10)}   ${Math.abs(m / obj - 1) < 0.15 ? '✓ cierra' : '✗ FUERA por +' + ((m / obj - 1) * 100).toFixed(0) + '%'}`);
}

console.log('\n### C) EL FACTOR SE CALIBRÓ EN UN PRODUCTO Y SE APLICA A TODOS');
console.log('   Para cada línea con factor, se mide cada producto contra el equivalente');
console.log('   de App LT y se compara con el objetivo de la línea.\n');
const EQUIV = { escritorio: 'escritorio', banca_doble: 'banca_doble', bench_doble: 'banca_doble',
  bench: 'banca_doble', banca: 'banca_doble', mesa_juntas: 'mesa_juntas', mesajuntas: 'mesa_juntas',
  escritorio_l: 'escritorio', bench_sencillo: 'banca_sencilla', banca_sencilla: 'banca_sencilla',
  bench_recto_doble: 'banca_doble', bench_recto_sencillo: 'banca_sencilla', estacion: 'banca_doble',
  mesa_circular: 'mesa_circular', olga: 'mesa_circular', mesa_trabajo: 'escritorio' };
for (const ruta of Object.keys(OBJETIVO_LINEA)) {
  if (ruta === 'applt') continue;
  const obj = OBJETIVO_LINEA[ruta];
  const L = LINEAS_REG[ruta];
  const filas = [];
  for (const p of L.productos) {
    const eq = EQUIV[p.id]; if (!eq) continue;
    const mine = P(ruta, p.id, {}); const theirs = P('applt', eq, {});
    if (!mine || !theirs) continue;
    const m = mine.precioUnitario / theirs.precioUnitario;
    filas.push({ id: p.id, eq, m, precio: mine.precioUnitario, ref: theirs.precioUnitario, aj: AJUSTE_PRODUCTO[`${ruta}.${p.id}`] ?? 1 });
  }
  if (!filas.length) continue;
  console.log(`   ${ruta}  objetivo ${obj.toFixed(2)}×  factor ${FACTOR_LINEA[ruta]}`);
  for (const f of filas) {
    const des = ((f.m / obj - 1) * 100);
    console.log(`      ${f.id.padEnd(22)} vs applt.${f.eq.padEnd(16)} ${f.m.toFixed(2).padStart(6)}×  ${pesos(f.precio).padStart(10)} vs ${pesos(f.ref).padStart(10)}  ${Math.abs(des) < 20 ? '✓' : (des > 0 ? '✗ +' : '✗ ') + des.toFixed(0) + '%'}${f.aj !== 1 ? ` [ajuste ${f.aj}]` : ''}`);
  }
}
