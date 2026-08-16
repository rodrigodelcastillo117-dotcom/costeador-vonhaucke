// ¿Por qué el orden comercial no se cumple? Hipótesis: los FACTOR_LINEA se
// calcularon contra el App LT del MODELO, y después App LT se re-ancló a papel
// (escalera por usuario / price-book), que cotiza más barato. La referencia se
// movió y los factores no se recalcularon.
import { LINEAS_REG, configDesde, costearConfig } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT, calcular, precioVenta } from '../src/motor/calculo.js';
import { precioDeLista, precioPorUsuarioAppLT, buscarPrecioVenta } from '../src/datos/preciosVenta.js';

const insumos = mapaInsumos(INSUMOS_SEMILLA);
const estado = { insumos, parametros: PARAMETROS_DEFAULT };
const pesos = (n) => '$' + Math.round(n).toLocaleString('es-MX');

// Precio del MODELO puro de App LT (cascada intelisis), sin escalera ni papel.
function modeloPuroAppLT(prod, sel) {
  const L = LINEAS_REG.applt; const p = L.productos.find((x) => x.id === prod);
  const cfg = configDesde(p, sel);
  const g = L.generar(cfg);
  const par = { ...PARAMETROS_DEFAULT, modeloCosteo: 'intelisis', usarCostoPorArea: true, ...(g.parModelo || {}) };
  const r = calcular({ nombre: g.nombre, componentes: g.componentes, horas: g.horas, modoManoObra: g.modoManoObra, modeloCosteo: g.modeloCosteo }, 1, insumos, par);
  return { modelo: precioDeLista(precioVenta(r.costoUnitario, par).lista), cfg, costo: r.costoUnitario };
}

console.log('### App LT: lo que dice el MODELO vs lo que cotiza la app hoy\n');
console.log('   config                         modelo puro   app cotiza   ratio   origen');
const CASOS = [
  ['banca_doble', { largoMM: 1200, usuarios: 2 }],
  ['banca_doble', { largoMM: 1200, usuarios: 4 }],
  ['banca_doble', { largoMM: 1200, usuarios: 6 }],
  ['banca_doble', { largoMM: 1200, usuarios: 8 }],
  ['banca_doble', { largoMM: 1500, usuarios: 6 }],
  ['banca_sencilla', { largoMM: 1200, usuarios: 1 }],
  ['escritorio', {}],
];
let sumM = 0, sumA = 0;
for (const [prod, sel] of CASOS) {
  const mp = modeloPuroAppLT(prod, sel);
  const r = costearConfig(estado, 'applt', prod, mp.cfg, 1);
  if (!r) { console.log(`   ${prod} ${JSON.stringify(sel)}: no costeó`); continue; }
  const real = buscarPrecioVenta('applt', mp.cfg);
  const pu = !real ? precioPorUsuarioAppLT(mp.cfg) : null;
  const origen = real ? 'PAPEL' : (pu ? 'escalera/usuario' : 'modelo');
  sumM += mp.modelo; sumA += r.precioUnitario;
  console.log(`   ${(prod + ' ' + JSON.stringify(sel)).padEnd(30)} ${pesos(mp.modelo).padStart(11)} ${pesos(r.precioUnitario).padStart(12)}  ${(r.precioUnitario / mp.modelo).toFixed(2)}×  ${origen}`);
}
console.log(`\n   PROMEDIO: la app cotiza App LT a ${(sumA / sumM).toFixed(3)}× su propio modelo.`);
console.log('   Los FACTOR_LINEA de las otras 23 líneas se despejaron contra el MODELO (=1.00).');
console.log(`   → todas las demás líneas quedan infladas por 1/${(sumA / sumM).toFixed(3)} = ${(sumM / sumA).toFixed(3)}× de más.\n`);

// ---- Modulor archivero: el salto entre modelos con y sin papel -------------
console.log('\n### modulor.archivero_h — el mismo mueble según el MODELO que elijas');
const L = LINEAS_REG.modulor; const p = L.productos.find((x) => x.id === 'archivero_h');
const sel = (p.selects || []).find((s) => s.key === 'modelo');
if (sel) {
  for (const o of sel.opciones) {
    const cfg = configDesde(p, { modelo: o.id });
    const r = costearConfig(estado, 'modulor', 'archivero_h', cfg, 1);
    console.log(`   ${String(o.id).padEnd(18)} ${pesos(r.precioUnitario).padStart(10)}  ${r.precioReal ? 'PAPEL' : 'modelo'}   ${String(r.nombre).slice(0, 50)}`);
  }
}

// ---- Casos límite numéricos -------------------------------------------------
console.log('\n\n### CASOS LÍMITE (cantidad 0 / 1 / 1000)');
for (const [ruta, prod] of [['applt', 'banca_doble'], ['modulor', 'archivero_h'], ['cirque', 'escritorio'], ['pac', 'sillon']]) {
  const LL = LINEAS_REG[ruta]; const pp = LL?.productos.find((x) => x.id === prod);
  if (!pp) { console.log(`   ${ruta}.${prod}: no existe`); continue; }
  const cfg = configDesde(pp, {});
  const out = [];
  for (const n of [0, 1, 2, 10, 1000, -5, NaN, 1.5]) {
    let r; try { r = costearConfig(estado, ruta, prod, cfg, n); } catch (e) { out.push(`n=${n} EXCEPCIÓN ${e.message}`); continue; }
    if (!r) { out.push(`n=${n} null`); continue; }
    const mal = !Number.isFinite(r.precioUnitario) || !Number.isFinite(r.costoUnitario);
    out.push(`n=${String(n).padStart(5)}→cant ${String(r.cantidad).padStart(4)} pu=${pesos(r.precioUnitario)} costo=${pesos(r.costoUnitario)}${mal ? '  ✗ NO FINITO' : ''}`);
  }
  console.log(`   ${ruta}.${prod}`);
  for (const o of out) console.log('      ' + o);
}

// ---- margen: ¿los gastos de operación entran en el costo del modelo clásico? --
console.log('\n\n### GASTOS DE OPERACIÓN EN LA CASCADA');
for (const [ruta, prod] of [['applt', 'banca_doble'], ['cirque', 'escritorio'], ['modulor', 'credenza'], ['eclipse', 'mesa_juntas']]) {
  const LL = LINEAS_REG[ruta]; const pp = LL?.productos.find((x) => x.id === prod);
  if (!pp) continue;
  const cfg = configDesde(pp, {});
  const g = LL.generar(cfg);
  const esInt = g.modeloCosteo === 'intelisis';
  const par = esInt ? { ...PARAMETROS_DEFAULT, modeloCosteo: 'intelisis', usarCostoPorArea: true, ...(g.parModelo || {}) } : PARAMETROS_DEFAULT;
  const r = calcular({ nombre: g.nombre, componentes: g.componentes, horas: g.horas, modoManoObra: g.modoManoObra, modeloCosteo: g.modeloCosteo, factorDirecta: g.factorDirecta, factorIndirecta: g.factorIndirecta }, 1, insumos, par);
  const app = costearConfig(estado, ruta, prod, cfg, 1);
  const margenReportado = (1 - app.costoUnitario / app.precioUnitario) * 100;
  const gastosReales = r.gastosOperacion;
  const costoConGastos = esInt ? r.costoUnitario : r.costoUnitario * (1 + PARAMETROS_DEFAULT.gastosOperacionPct / 100);
  const margenReal = (1 - costoConGastos / app.precioUnitario) * 100;
  console.log(`   ${(ruta + '.' + prod).padEnd(24)} modelo=${esInt ? 'intelisis' : 'clásico  '}  gastosOperacion en costo=${pesos(gastosReales)}`);
  console.log(`      precio ${pesos(app.precioUnitario).padStart(10)}  costo que reporta ${pesos(app.costoUnitario).padStart(10)}  margen REPORTADO ${margenReportado.toFixed(1)}%`);
  console.log(`      costo + 30% gastos op ${pesos(costoConGastos).padStart(10)}  margen REAL ${margenReal.toFixed(1)}%  ${margenReal < PARAMETROS_DEFAULT.margenMinimo ? '✗ POR DEBAJO DEL MÍNIMO (40%)' : ''}`);
}
