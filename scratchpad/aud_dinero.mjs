// CUÁNTO DINERO MUEVE CADA HALLAZGO, sobre un proyecto realista de 100 puestos
// + guardas + sala de juntas, del tamaño de los presupuestos reales.
import { LINEAS_REG, configDesde, costearConfig, costearItem } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT, calcular } from '../src/motor/calculo.js';
import { precioDeLista } from '../src/datos/preciosVenta.js';

const insumos = mapaInsumos(INSUMOS_SEMILLA);
const estado = { insumos, parametros: PARAMETROS_DEFAULT };
const pesos = (n) => '$' + Math.round(n).toLocaleString('es-MX');
const P = (ruta, prod, sel, n = 1) => {
  const p = LINEAS_REG[ruta].productos.find((x) => x.id === prod);
  return costearConfig(estado, ruta, prod, configDesde(p, sel), n);
};

console.log('=========================================================================');
console.log(' HALLAZGO 1 · la referencia se movió: App LT cotiza a 0.831× su modelo,');
console.log('   pero los FACTOR_LINEA de las otras 23 líneas se despejaron contra el');
console.log('   modelo. Efecto sobre un proyecto de 100 puestos.');
console.log('=========================================================================\n');
const DRIFT = 1 / 0.831;
for (const [ruta, prod, sel, u] of [
  ['app', 'banca_doble', { largoMM: 1200, usuarios: 2 }, 2],
  ['rio', 'bench_recto_doble', { usuarios: '2' }, 2],
  ['feather', 'bench_doble', {}, 2],
  ['flex', 'banca_doble', {}, 2],
  ['alba', 'bench', {}, 2],
  ['cirque', 'banca', {}, 2],
]) {
  const r = P(ruta, prod, sel); if (!r) continue;
  const porU = r.precioUnitario / u;
  const corregido = porU / DRIFT;
  console.log(`   ${ruta.padEnd(9)} ${pesos(porU).padStart(9)}/puesto → corregido ${pesos(corregido).padStart(9)}   ` +
    `sobre 100 puestos = ${pesos((porU - corregido) * 100)} de más`);
}

console.log('\n=========================================================================');
console.log(' HALLAZGO 2 · Voni (costearItem) pierde los add-ons del módulo');
console.log('=========================================================================\n');
const item = (sel) => costearItem(estado, { ruta: 'applt', producto: 'banca_doble', cantidad: 1,
  seleccion: Object.entries(sel).map(([clave, valor]) => ({ clave, valor })) });
const conEl = item({ largoMM: 1200, usuarios: 8, electrico: true });
const pApp = LINEAS_REG.applt.productos.find((x) => x.id === 'banca_doble');
const gEl = LINEAS_REG.applt.generar(configDesde(pApp, { largoMM: 1200, usuarios: 8, electrico: true }));
const perdido = (gEl.addons || []).reduce((s, a) => s + precioDeLista(a.lista) * (a.cantidad || 1), 0);
console.log(`   módulo 8u con eléctrico: Voni cotiza ${pesos(conEl.precioUnitario)}, la pantalla cotiza ${pesos(conEl.precioUnitario + perdido)}`);
console.log(`   diferencia ${pesos(perdido)} por módulo (${((perdido / conEl.precioUnitario) * 100).toFixed(0)}%)`);
console.log(`   proyecto de 96 puestos (12 módulos de 8u) = ${pesos(perdido * 12)} sin cobrar`);
console.log(`   + gavetas: 'gavetas' ni siquiera llega a la config por costearItem (${pesos(precioDeLista(5350))} c/u)`);
console.log(`     96 gavetas = ${pesos(precioDeLista(5350) * 96)} sin cobrar`);

console.log('\n=========================================================================');
console.log(' HALLAZGO 3 · el margen que reporta la app (50%) no lleva gastos de');
console.log('   operación. En la cascada clásica gastosOperacion = 0 SIEMPRE.');
console.log('=========================================================================\n');
console.log('   línea.producto            precio      costo rep.  margen rep.  costo+30%GO  margen REAL');
for (const [ruta, prod] of [['eclipse', 'mesa_juntas'], ['modulor', 'credenza'], ['pac', 'sillon'],
  ['worklounge', 'spoon'], ['accents', 'pizarron'], ['privacy4', 'muro'], ['drift', 'pad_gabinete'],
  ['spine', 'cubierta'], ['ergo4', 'escritorio'], ['tetris', 'sofa']]) {
  const L = LINEAS_REG[ruta]; const p = L?.productos.find((x) => x.id === prod); if (!p) continue;
  const r = P(ruta, prod, {}); if (!r) continue;
  const mrep = (1 - r.costoUnitario / r.precioUnitario) * 100;
  const cGO = r.costoUnitario * (1 + PARAMETROS_DEFAULT.gastosOperacionPct / 100);
  const mreal = (1 - cGO / r.precioUnitario) * 100;
  console.log(`   ${(ruta + '.' + prod).padEnd(24)} ${pesos(r.precioUnitario).padStart(10)} ${pesos(r.costoUnitario).padStart(11)} ${mrep.toFixed(1).padStart(10)}% ${pesos(cGO).padStart(12)} ${mreal.toFixed(1).padStart(11)}% ${mreal < 40 ? ' ✗ < mínimo 40%' : ''}`);
}
console.log('\n   (sólo vale para las líneas con factorLinea = 1: en las calibradas el');
console.log('    costo reportado ya viene inflado por el factor y no es el real.)');

console.log('\n=========================================================================');
console.log(' HALLAZGO 4 · mermaCorte es LETRA MUERTA en los 21 insumos fraccion:true');
console.log('=========================================================================\n');
const frac = INSUMOS_SEMILLA.filter((i) => i.fraccion);
console.log(`   insumos fraccion:true con mermaCorte>0: ${frac.filter((i) => i.mermaCorte > 0).length}/${frac.length}`);
console.log('   ' + frac.filter((i) => i.mermaCorte > 0).map((i) => `${i.id}:${i.mermaCorte}%`).join('  '));
let sinM = 0, conM = 0;
const insM = { ...insumos };
for (const i of frac) insM[i.id] = { ...i, formato: { ...i.formato, medida: i.formato.medida / (1 + i.mermaCorte / 100) } };
for (const [ruta, L] of Object.entries(LINEAS_REG)) for (const p of L.productos) {
  const g = L.generar(configDesde(p, {}));
  const pz = { nombre: g.nombre, componentes: g.componentes, horas: g.horas, modoManoObra: g.modoManoObra, modeloCosteo: g.modeloCosteo, factorDirecta: g.factorDirecta, factorIndirecta: g.factorIndirecta };
  const par = g.modeloCosteo === 'intelisis' ? { ...PARAMETROS_DEFAULT, modeloCosteo: 'intelisis', usarCostoPorArea: true, ...(g.parModelo || {}) } : PARAMETROS_DEFAULT;
  sinM += calcular(pz, 1, insumos, par).materialTotal;
  conM += calcular(pz, 1, insM, par).materialTotal;
}
console.log(`   material de todo el catálogo (1 pza c/u):  hoy ${pesos(sinM)}   honrando mermaCorte ${pesos(conM)}  (+${((conM / sinM - 1) * 100).toFixed(1)}%)`);

console.log('\n=========================================================================');
console.log(' HALLAZGO 5 · modulor.archivero_h: el mismo mueble salta 3× según modelo');
console.log('=========================================================================\n');
const pm = LINEAS_REG.modulor.productos.find((x) => x.id === 'archivero_h');
const sel = pm.selects.find((s) => s.key === 'modelo');
for (const o of sel.opciones) {
  const r = P('modulor', 'archivero_h', { modelo: o.id });
  console.log(`   ${o.id.padEnd(16)} ${pesos(r.precioUnitario).padStart(10)}  ${r.precioReal ? 'PAPEL ' : 'modelo'}`);
}
const cj = P('modulor', 'archivero_h', { modelo: 'cajones75' }).precioUnitario;
const pu = P('modulor', 'archivero_h', { modelo: 'puertas75' }).precioUnitario;
console.log(`\n   El de 0.75 con CAJONES (${pesos(cj)}) sale a ${(cj / pu * 100).toFixed(0)}% del de 0.75 con PUERTAS (${pesos(pu)}),`);
console.log('   y en la realidad los cajones cuestan MÁS que las puertas (correderas + frentes).');
console.log(`   Diferencia por pieza: ${pesos(pu - cj)}. En un proyecto de 40 archiveros: ${pesos((pu - cj) * 40)}.`);
