// 1) ¿Se respeta el ORDEN COMERCIAL que fijó Rodrigo? Se mide PRECIO POR PUESTO
//    en el bench/banca doble más comparable de cada línea (no $/m2, que depende
//    de la huella y la huella está rota en varias líneas).
// 2) ¿Cuánto mueve el FACTOR_LINEA? Precio con y sin factor.
// 3) SALTO dentro del MISMO producto entre configs con papel y sin papel.
import { LINEAS_REG, configDesde, costearConfig, footprintDe } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';
import { FACTOR_LINEA, AJUSTE_PRODUCTO, OBJETIVO_LINEA } from '../src/datos/factoresLinea.js';

const estado = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT };
const pesos = (n) => '$' + Math.round(n).toLocaleString('es-MX');

// Producto tipo "bench/banca doble" de cada línea, con 2 puestos donde se pueda.
const BENCH = {
  applt: ['banca_doble', { largoMM: 1200, usuarios: 2 }, 2],
  app: ['banca_doble', { largoMM: 1200, usuarios: 2 }, 2],
  via: ['banca_doble', {}, null],
  rio: ['bench_recto_doble', { usuarios: '2' }, 2],
  feather: ['banca_doble', {}, null],
  flex: ['banca_doble', {}, null],
  alba: ['bench', {}, null],
  cirque: ['banca', {}, null],
  luna: ['escritorio', {}, 1],
};

console.log('### PRECIO POR PUESTO del bench doble de cada línea (objetivo vs medido)\n');
console.log('   línea        objetivo  medido   $/puesto     precio     puestos  producto');
const base = {};
const filas = [];
for (const [ruta, [prod, sel, u]] of Object.entries(BENCH)) {
  const L = LINEAS_REG[ruta]; const p = L?.productos.find((x) => x.id === prod);
  if (!p) { console.log(`   ${ruta}: no existe el producto ${prod}`); continue; }
  const cfg = configDesde(p, sel);
  const r = costearConfig(estado, ruta, prod, cfg, 1);
  if (!r) { console.log(`   ${ruta}: no costeó`); continue; }
  const puestos = u ?? Number(cfg.usuarios) ?? 2;
  filas.push({ ruta, prod, precio: r.precioUnitario, puestos, porU: r.precioUnitario / puestos, real: r.precioReal, nombre: r.nombre });
}
const ref = filas.find((f) => f.ruta === 'applt')?.porU || 1;
for (const f of filas) {
  const obj = OBJETIVO_LINEA[f.ruta];
  const mult = f.porU / ref;
  const flag = obj && Math.abs(mult / obj - 1) > 0.25 ? '  ✗ FUERA' : '';
  console.log(`   ${f.ruta.padEnd(12)} ${(obj ? obj.toFixed(2) : '  — ').padStart(7)}  ${mult.toFixed(2).padStart(6)}×  ${pesos(f.porU).padStart(9)}  ${pesos(f.precio).padStart(10)}  ${String(f.puestos).padStart(6)}  ${f.prod}${f.real ? ' [PAPEL]' : ''}${flag}`);
}

// ---- 2. cuánto mueve el factor de línea, producto por producto -------------
console.log('\n\n### EFECTO DEL FACTOR DE LÍNEA (precio con factor ÷ precio sin factor)');
console.log('   El factor se calibró sobre UN escritorio/bench y se aplica a TODOS los productos.\n');
for (const [ruta, fl] of Object.entries(FACTOR_LINEA)) {
  if (Math.abs(fl - 1) < 0.02) continue;
  const L = LINEAS_REG[ruta];
  console.log(`   ${ruta}  factorLinea=${fl}`);
  for (const p of L.productos) {
    const aj = AJUSTE_PRODUCTO[`${ruta}.${p.id}`] ?? 1;
    const r = costearConfig(estado, ruta, p.id, configDesde(p, {}), 1);
    if (!r) continue;
    const efectivo = fl * aj;
    const sinFactor = r.precioReal ? null : r.precioUnitario / efectivo;
    console.log(`      ${p.id.padEnd(22)} ×${efectivo.toFixed(2).padStart(5)}  ${sinFactor ? `${pesos(sinFactor).padStart(10)} → ` : '            '}${pesos(r.precioUnitario).padStart(10)}${r.precioReal ? '  [PAPEL: el factor no aplica]' : ''}`);
  }
}

// ---- 3. salto dentro del mismo producto ------------------------------------
console.log('\n\n### SALTO DENTRO DEL MISMO PRODUCTO (configs con papel vs configs con modelo)');
for (const [ruta, L] of Object.entries(LINEAS_REG)) {
  for (const p of L.productos) {
    const sel = p.selects?.[0];
    if (!sel) continue;
    const rs = [];
    for (const o of sel.opciones) {
      const r = costearConfig(estado, ruta, p.id, configDesde(p, { [sel.key]: o.id }), 1);
      if (r) rs.push({ o: o.id, precio: r.precioUnitario, real: r.precioReal });
    }
    const conP = rs.filter((x) => x.real), sinP = rs.filter((x) => !x.real);
    if (!conP.length || !sinP.length) continue;
    const minP = Math.min(...conP.map((x) => x.precio)), maxM = Math.max(...sinP.map((x) => x.precio));
    if (minP / maxM > 1.5 || maxM / minP > 1.5) {
      console.log(`\n   ✗ ${ruta}.${p.id}  (select '${sel.key}')`);
      for (const x of rs) console.log(`        ${x.o.padEnd(18)} ${pesos(x.precio).padStart(10)}  ${x.real ? 'PAPEL' : 'modelo'}`);
      console.log(`        → el mismo mueble salta ${(Math.max(minP, maxM) / Math.min(minP, maxM)).toFixed(1)}× según el modelo que elijas`);
    }
  }
}
