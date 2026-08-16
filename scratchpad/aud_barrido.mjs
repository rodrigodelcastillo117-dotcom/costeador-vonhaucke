// BARRIDO COMPLETO: 24 líneas × todos sus productos × todas sus medidas.
// Ordena por $/m2 de huella y por $/pieza, y enseña las DOS colas.
import { LINEAS_REG, configDesde, costearConfig, footprintDe } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';
import { factorDeLinea, FACTOR_LINEA } from '../src/datos/factoresLinea.js';

const estado = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT };
const pesos = (n) => '$' + Math.round(n).toLocaleString('es-MX');
const filas = [];

function variantes(p) {
  const out = [];
  const largos = p.largos?.length ? p.largos : [null];
  const usuarios = p.usuarios?.length ? p.usuarios : [null];
  const diam = p.diametros?.length ? p.diametros : [null];
  for (const L of largos) for (const U of usuarios) for (const D of diam) {
    const v = {};
    if (L != null) v.largoMM = L;
    if (U != null) v.usuarios = U;
    if (D != null) v.diametroMM = D;
    out.push(v);
  }
  return out.slice(0, 40);
}

for (const [ruta, L] of Object.entries(LINEAS_REG)) {
  for (const p of L.productos || []) {
    for (const v of variantes(p)) {
      let r; try { r = costearConfig(estado, ruta, p.id, configDesde(p, v), 1); } catch { r = null; }
      if (!r || !(r.precioUnitario > 0)) { filas.push({ ruta, linea: L.titulo, prod: p.id, nombre: '(no costeó)', v, roto: true }); continue; }
      const m2 = (r.w / 1000) * (r.d / 1000);
      filas.push({
        ruta, linea: L.titulo, prod: p.id, nombre: r.nombre, v,
        precio: r.precioUnitario, costo: r.costoUnitario, m2,
        pm2: m2 > 0 ? r.precioUnitario / m2 : null,
        real: r.precioReal, factor: factorDeLinea(ruta, p.id),
        margen: r.precioUnitario > 0 ? (1 - r.costoUnitario / r.precioUnitario) * 100 : null,
      });
    }
  }
}

const ok = filas.filter((f) => !f.roto);
console.log(`Costeadas ${ok.length} configuraciones (${filas.length - ok.length} no costearon) en ${Object.keys(LINEAS_REG).length} líneas\n`);

const rotas = filas.filter((f) => f.roto);
if (rotas.length) {
  console.log('### ✗ NO COSTEARON');
  for (const f of rotas) console.log(`   ${f.ruta}.${f.prod} ${JSON.stringify(f.v)}`);
  console.log();
}

const show = (t, arr) => {
  console.log(`\n### ${t}`);
  for (const f of arr) {
    console.log(`  ${String(f.pm2 ? pesos(f.pm2) : '—').padStart(10)}/m2 ${pesos(f.precio).padStart(10)} ${f.m2.toFixed(2).padStart(6)}m2 ${(f.real ? 'PAPEL' : '     ')} ${(f.ruta + '.' + f.prod).padEnd(30)} ${String(f.nombre).slice(0, 46)}`);
  }
};
const conM2 = ok.filter((f) => f.pm2 > 0).sort((a, b) => b.pm2 - a.pm2);
show('COLA ALTA · $/m2 (los 20 más caros por metro cuadrado)', conM2.slice(0, 20));
show('COLA BAJA · $/m2 (los 20 más baratos por metro cuadrado)', conM2.slice(-20).reverse());

const porPza = [...ok].sort((a, b) => b.precio - a.precio);
show('COLA ALTA · $/pieza', porPza.slice(0, 15));
show('COLA BAJA · $/pieza', porPza.slice(-15).reverse());

// --- Comparación cruzada: guardas vs cubiertas de trabajo -------------------
console.log('\n### ¿UN ARCHIVERO MÁS CARO QUE UN ESCRITORIO? (dentro de la MISMA línea)');
const porLinea = {};
for (const f of ok) (porLinea[f.ruta] ??= []).push(f);
for (const [ruta, fs] of Object.entries(porLinea)) {
  const esGuarda = (f) => /archiv|credenz|libr|gavet|caj|guard|pedest|locker|almac/i.test(f.prod);
  const esTrabajo = (f) => /escritorio|bench|banca|estacion|mesa_trabajo|operativ/i.test(f.prod);
  const g = fs.filter(esGuarda), t = fs.filter(esTrabajo);
  if (!g.length || !t.length) continue;
  const gMax = g.reduce((a, b) => (b.precio > a.precio ? b : a));
  const tMin = t.reduce((a, b) => (b.precio < a.precio ? b : a));
  if (gMax.precio > tMin.precio * 1.5) {
    console.log(`  ${ruta}: guarda ${gMax.prod} ${pesos(gMax.precio)} vs trabajo ${tMin.prod} ${pesos(tMin.precio)}  (${(gMax.precio / tMin.precio).toFixed(1)}×)`);
  }
}

// --- Margen reportado -------------------------------------------------------
console.log('\n### MARGEN QUE REPORTA LA APP (1 − costo/precio)');
const margenes = {};
for (const f of ok) (margenes[f.ruta] ??= []).push(f.margen);
for (const [ruta, ms] of Object.entries(margenes)) {
  const min = Math.min(...ms), max = Math.max(...ms);
  console.log(`  ${ruta.padEnd(12)} ${min.toFixed(1)}% … ${max.toFixed(1)}%   factorLinea=${(FACTOR_LINEA[ruta] ?? 1).toFixed(3)}`);
}

// --- $/m2 promedio por línea (¿respeta el orden comercial?) -----------------
console.log('\n### $/m2 MEDIANO POR LÍNEA (orden comercial que fijó Rodrigo: App LT < Feather < Flex < Vía < App < Río < Alba < Cirque < Luna)');
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const tabla = Object.entries(porLinea).map(([ruta, fs]) => {
  const v = fs.filter((f) => f.pm2 > 0).map((f) => f.pm2);
  return { ruta, n: fs.length, med: v.length ? med(v) : 0 };
}).sort((a, b) => a.med - b.med);
for (const t of tabla) console.log(`  ${pesos(t.med).padStart(10)}/m2  ${t.ruta.padEnd(12)} (${t.n} configs)`);
