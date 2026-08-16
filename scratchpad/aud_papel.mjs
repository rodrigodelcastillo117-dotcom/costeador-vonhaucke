// CONTRA EL PAPEL. El BANCO tiene 218 renglones con PRECIO DE LISTA REAL de
// presupuestos cerrados. Aquí se costea con la app el mueble equivalente y se
// reporta el % de error, línea por línea.
import { LINEAS_REG, configDesde, costearConfig } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';
import { BANCO } from '../src/datos/banco.js';

const estado = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT };
const pesos = (n) => '$' + Math.round(n).toLocaleString('es-MX');

// Mapa: línea del banco -> ruta del generador
const RUTA = { 'App LT': 'applt', App: 'app', 'Río': 'rio', Modulor: 'modulor', Mox: 'mox', Luna: 'luna',
  Cirque: 'cirque', Alba: 'alba', Eclipse: 'eclipse', 'Ergonova 4': 'ergo4', Accents: 'accents',
  Feather: 'feather', Flex: 'flex', 'Vía': 'via', Spine: 'spine', Anteo: 'anteo', Tetris: 'tetris',
  'Arlequín': 'arlequin', Pac: 'pac', 'Work Lounge': 'worklounge', Pebble: 'pebble', 'Privacy 4': 'privacy4' };

// Qué producto del generador corresponde a cada categoría del banco
const PROD = [
  [/bench doble|módulo operativo|modulo operativo/i, ['banca_doble', 'bench_recto_doble', 'bench', 'banca']],
  [/escritorio/i, ['escritorio', 'banca_sencilla']],
  [/mesa de juntas|mesa juntas/i, ['mesa_juntas', 'mesajuntas']],
  [/mesa circular/i, ['mesa_circular', 'olga']],
  [/archivero/i, ['archivero_h', 'archivero', 'archivero_lateral']],
  [/credenza/i, ['credenza']],
  [/gaveta|rodante/i, ['rodante', 'gaveta']],
];

function medidas(b) {
  const m = String(b.medidas || '').match(/(\d+)\s*×\s*(\d+)/);
  return m ? { largoMM: +m[1], fondoMM: +m[2] } : {};
}

const filas = [];
for (const b of BANCO) {
  const ruta = RUTA[b.linea]; if (!ruta || !LINEAS_REG[ruta]) continue;
  const cand = PROD.find(([re]) => re.test(b.nombre + ' ' + (b.descripcion || '')))?.[1] || [];
  const L = LINEAS_REG[ruta];
  const prod = cand.map((id) => L.productos.find((p) => p.id === id)).find(Boolean);
  if (!prod) continue;
  const md = medidas(b);
  const sel = { ...md };
  if (b.usuarios) sel.usuarios = b.usuarios;
  // Las bancas dobles del papel dan el LARGO TOTAL de la corrida; el generador
  // pide el módulo. Se divide entre las columnas.
  if (b.usuarios && md.largoMM && /doble|1200|1500/.test(String(md.fondoMM))) {
    const cols = Math.max(1, Math.round(b.usuarios / 2));
    if (md.largoMM / cols >= 900) sel.largoMM = Math.round(md.largoMM / cols);
  } else if (b.usuarios && md.largoMM && md.fondoMM && md.fondoMM <= 750) {
    if (md.largoMM / b.usuarios >= 900) sel.largoMM = Math.round(md.largoMM / b.usuarios);
  }
  let r; try { r = costearConfig(estado, ruta, prod.id, configDesde(prod, sel), 1); } catch { r = null; }
  if (!r || !(r.precioUnitario > 0)) continue;
  const err = (r.precioUnitario / b.precio - 1) * 100;
  filas.push({ ruta, prod: prod.id, b, app: r.precioUnitario, err, real: r.precioReal, sel, nombre: r.nombre });
}

filas.sort((a, b) => Math.abs(b.err) - Math.abs(a.err));
console.log(`Comparados ${filas.length} renglones de papel contra lo que cotiza la app.\n`);
console.log('   error   papel        app        línea.producto            renglón del presupuesto');
for (const f of filas) {
  console.log(`   ${(f.err > 0 ? '+' : '') + f.err.toFixed(0).padStart(5)}%  ${pesos(f.b.precio).padStart(9)}  ${pesos(f.app).padStart(9)}  ${(f.ruta + '.' + f.prod).padEnd(24)} ${f.real ? '[PAPEL] ' : ''}${f.b.nombre} ${f.b.medidas || ''} ${f.b.usuarios ? f.b.usuarios + 'u' : ''} (${f.b.fuente})`);
}

// resumen por línea
console.log('\n### RESUMEN POR LÍNEA (error absoluto mediano)');
const porL = {};
for (const f of filas) (porL[f.ruta] ??= []).push(Math.abs(f.err));
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
for (const [ruta, es] of Object.entries(porL).sort((a, b) => med(a[1]) - med(b[1]))) {
  console.log(`   ${ruta.padEnd(12)} n=${String(es.length).padStart(3)}  MAE mediano ${med(es).toFixed(0)}%   peor ${Math.max(...es).toFixed(0)}%`);
}
