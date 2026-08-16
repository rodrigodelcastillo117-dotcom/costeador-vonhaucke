// ¿La jerarquía que dictó Rodrigo se cumple en TODAS las familias, o sólo en la
// que se usó para calibrar? El factor de línea es UNO y se aplica a los 24
// productos, pero se despejó midiendo un escritorio.
import { LINEAS_REG, costearConfig } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';
import { OBJETIVO_LINEA } from '../src/datos/factoresLinea.js';

const est = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT, piezas: {} };

// Un producto "comparable" por familia: se busca por lo que hace, no por su id,
// porque cada línea nombra distinto.
const FAMILIAS = {
  bench: /banca|bench/i,
  escritorio: /^escritorio$|escritorio(?! en l)/i,
  juntas: /junta/i,
  guarda: /credenza|archivero|guarda|librero/i,
};

function primerProducto(reg, re) {
  return (reg.productos || []).find((p) => re.test(p.id) || re.test(p.nombre || ''));
}

// Precio POR PUESTO en bench (para que 6u y 2u sean comparables) y por pieza en
// el resto.
function medir(ruta, fam, re) {
  const reg = LINEAS_REG[ruta];
  const prod = primerProducto(reg, re);
  if (!prod) return null;
  const sel = {};
  if (prod.largos) sel.largoMM = prod.largos.includes(1200) ? 1200 : prod.largos[0];
  if (prod.fondos) sel.fondoMM = prod.fondos[0];
  if (prod.usuarios) sel.usuarios = prod.usuarios.includes(6) ? 6 : prod.usuarios[prod.usuarios.length - 1];
  for (const s of prod.selects || []) {
    const ids = s.opciones.map((o) => o.id);
    if (s.key === 'usuarios') sel[s.key] = ids.includes('6') ? '6' : ids[ids.length - 1];
    else if (s.key === 'largo') sel[s.key] = ids.includes('1200') ? '1200' : ids[0];
    else sel[s.key] = ids[0];
  }
  const r = costearConfig(est, ruta, prod.id, sel, 1);
  if (!r || !r.precioUnitario) return null;
  const u = Number(sel.usuarios) || 1;
  return { precio: fam === 'bench' ? r.precioUnitario / u : r.precioUnitario, prod: prod.id, papel: r.precioReal };
}

const rutas = Object.keys(LINEAS_REG);
const base = {};
for (const [fam, re] of Object.entries(FAMILIAS)) base[fam] = medir('applt', fam, re);

console.log('Múltiplo REAL contra App LT, por familia. (obj) = lo que dice OBJETIVO_LINEA\n');
console.log('LÍNEA        obj    bench   escrit.  juntas  guarda');
const filas = [];
for (const ruta of rutas) {
  const obj = OBJETIVO_LINEA[ruta];
  const cel = [];
  const r = { ruta, obj };
  for (const [fam, re] of Object.entries(FAMILIAS)) {
    const m = medir(ruta, fam, re);
    const v = m && base[fam] ? m.precio / base[fam].precio : null;
    r[fam] = v;
    cel.push(v ? (v.toFixed(2) + (m.papel ? '*' : ' ')).padStart(8) : '       —');
  }
  filas.push(r);
  console.log(`${ruta.padEnd(12)} ${(obj ? obj.toFixed(2) : ' —  ').padStart(4)} ${cel.join('')}`);
}
console.log('\n* = ese precio sale de un presupuesto real, no del modelo.');
console.log('\nDESVIACIÓN contra el objetivo (cuántas veces se pasa):');
for (const f of filas) {
  if (!f.obj) continue;
  const d = [];
  for (const fam of Object.keys(FAMILIAS)) if (f[fam]) d.push(`${fam} ${(f[fam] / f.obj).toFixed(2)}×`);
  const peor = Math.max(...Object.keys(FAMILIAS).map((fam) => (f[fam] ? f[fam] / f.obj : 0)));
  if (peor > 1.35 || peor < 0.75) console.log(`  ⚠️ ${f.ruta.padEnd(12)} ${d.join(' · ')}`);
}
