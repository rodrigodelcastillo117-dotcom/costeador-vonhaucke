// AUDITORÍA 2 · OCHO PROYECTOS COMPLETOS, de ocho tipos distintos.
// Cada renglón que Voni arma DESDE UNA LÍNEA (paramétrico) se compara contra la
// ancla de PAPEL más parecida del banco (mismo producto, mismas medidas, mismos
// usuarios) y se reporta el % de error. Los renglones de banco no se comparan:
// SON el papel.
import { cotizar, money, enParalelo, REGLAS_REALES, ESTADO } from './aud2_lib.mjs';
import { BANCO } from '../src/datos/banco.js';
import { writeFileSync } from 'node:fs';

const PROYECTOS = [
  { n: '1 · CALL CENTER', t: 'Call center de 60 posiciones en bench de 1.20 m con biombo divisor, silla operativa económica, y una sala de juntas para 8. Presupuesto ajustado.' },
  { n: '2 · CORPORATIVO', t: 'Piso corporativo: 40 estaciones operativas en bench de 1.50, 6 oficinas privadas con escritorio ejecutivo en L y credenza, sala de consejo para 14, y recepción.' },
  { n: '3 · DESPACHO CHICO', t: 'Despacho de abogados chico: 4 escritorios ejecutivos de 1.80 con credenza, una mesa de juntas para 6, y un archivero por escritorio.' },
  { n: '4 · COWORKING', t: 'Coworking de 30 lugares en bench abierto de 1.20, 4 cabinas telefónicas, 2 mesas altas para 6 y una sala de juntas para 10.' },
  { n: '5 · CLÍNICA', t: 'Clínica: recepción con mostrador, 8 consultorios con escritorio de 1.50 y 2 sillas de visita cada uno, sala de espera de 20 lugares y un archivero por consultorio.' },
  { n: '6 · ESCUELA', t: 'Escuela: 3 aulas de 30 alumnos con mesa y silla individual, sala de maestros para 12 con mesa de juntas, y 6 escritorios administrativos de 1.20.' },
  { n: '7 · RETAIL', t: 'Tienda retail: mostrador de caja, 2 escritorios de 1.20 para la trastienda, 4 bancos altos, un archivero y una mesa de juntas chica para 4.' },
  { n: '8 · HOME OFFICE', t: '15 kits de home office: un escritorio de 1.20, una silla operativa y una gaveta rodante por persona.' },
];

const res = await enParalelo(PROYECTOS.map((p) => async () => ({ p, r: await cotizar({ texto: p.t, reglas: REGLAS_REALES }) })), 4);

// ── ancla de papel para un renglón de línea ────────────────────────────────
const LINEA_DE = { applt: 'App LT', app: 'App', rio: 'Río', cirque: 'Cirque', modulor: 'Modulor', mox: 'Mox', luna: 'Luna', eclipse: 'Eclipse', accents: 'Accents', pebble: 'Pebble', pac: 'Pac', alba: 'Alba', via: 'Vía', feather: 'Feather', spine: 'Spine', flex: 'Flex', anteo: 'Anteo', tetris: 'Tetris', arlequin: 'Arlequín', worklounge: 'Work Lounge', privacy4: 'Privacy 4', teamspace2: 'Teamspace 2', ergo4: 'Ergonova 4', drift: 'Drift' };
const usuariosDe = (nombre) => { const m = String(nombre).match(/(\d+)\s*usuarios?/i); return m ? +m[1] : null; };
const medidaDe = (nombre) => { const m = String(nombre).match(/([\d.]+)\s*×\s*([\d.]+)\s*m/); return m ? { l: Math.round(+m[1] * 1000), f: Math.round(+m[2] * 1000) } : null; };

function ancla(r) {
  const linea = LINEA_DE[r.ruta]; if (!linea) return null;
  const u = usuariosDe(r.nombre), md = medidaDe(r.nombre);
  let cand = BANCO.filter((b) => b.linea === linea);
  if (!cand.length) return null;
  if (u != null) { const c2 = cand.filter((b) => b.usuarios === u); if (c2.length) cand = c2; }
  if (md) {
    const c3 = cand.filter((b) => { const m = String(b.medidas || '').match(/(\d+)\s*×\s*(\d+)/); return m && Math.abs(+m[1] - md.l) <= 150 && Math.abs(+m[2] - md.f) <= 150; });
    if (c3.length) cand = c3;
  }
  // el más cercano en precio, para no acusar de error una elección de configuración
  cand.sort((a, b) => Math.abs(a.precio - r.unit) - Math.abs(b.precio - r.unit));
  return cand[0] || null;
}

let totalApp = 0, totalPapel = 0, comparados = 0, sinAncla = 0;
const errores = [];
const salida = [];

for (const { p, r } of res) {
  console.log('\n████ ' + p.n);
  console.log('  pedido: ' + p.t);
  if (!r.ok) { console.log('  ERROR: ' + r.error); continue; }
  console.log(`  TOTAL app: ${money(r.total)}   (${r.renglones.length} renglones)`);
  console.log('  ' + '-'.repeat(112));
  console.log('  ' + 'renglón'.padEnd(50) + 'cant'.padStart(5) + 'unit app'.padStart(12) + 'ancla papel'.padStart(13) + 'error'.padStart(9) + '  ancla usada');
  for (const x of r.renglones) {
    if (x.origen === 'banco') {
      console.log('  ' + ('[PAPEL] ' + x.nombre).slice(0, 50).padEnd(50) + String(x.cantidad).padStart(5) + money(x.unit).padStart(12) + '—'.padStart(13) + 'es papel'.padStart(9));
      totalApp += x.imp; totalPapel += x.imp;
      continue;
    }
    const a = ancla(x);
    totalApp += x.imp;
    if (!a) { sinAncla++; console.log('  ' + x.nombre.slice(0, 50).padEnd(50) + String(x.cantidad).padStart(5) + money(x.unit).padStart(12) + 'sin ancla'.padStart(13) + '—'.padStart(9)); continue; }
    const err = (x.unit / a.precio - 1) * 100;
    comparados++; errores.push(Math.abs(err)); totalPapel += a.precio * x.cantidad;
    console.log('  ' + x.nombre.slice(0, 50).padEnd(50) + String(x.cantidad).padStart(5) + money(x.unit).padStart(12) + money(a.precio).padStart(13) + ((err >= 0 ? '+' : '') + err.toFixed(0) + '%').padStart(9) + '  ' + a.id);
    salida.push({ proy: p.n, renglon: x.nombre, cant: x.cantidad, unitApp: x.unit, ancla: a.id, unitPapel: a.precio, err });
  }
  if (r.preguntas.length) console.log('  preguntó: ' + r.preguntas.join(' / '));
  if (r.noEncontrado.length) console.log('  ⚠ noEncontrado: ' + r.noEncontrado.join(' / '));
  if (r.inventados.length) console.log('  🔴 INVENTADO: ' + r.inventados.join(' / '));
}

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
console.log('\n\n████ CONTRA EL PAPEL, EN CONJUNTO');
console.log(`  renglones de línea comparados : ${comparados}   (sin ancla: ${sinAncla})`);
console.log(`  error absoluto MEDIANO        : ${med(errores).toFixed(0)}%`);
console.log(`  error absoluto PEOR           : ${Math.max(...errores, 0).toFixed(0)}%`);
console.log(`  suma app                      : ${money(totalApp)}`);
console.log(`  suma con precios de papel     : ${money(totalPapel)}`);
console.log(`  desviación global             : ${((totalApp / totalPapel - 1) * 100).toFixed(1)}%`);
console.log(`  0 productos inventados        : ${res.every((x) => !x.r.inventados?.length) ? 'SÍ ✓' : 'NO 🔴'}`);

writeFileSync(new URL('./aud2_proyectos.json', import.meta.url), JSON.stringify({ res, salida }, null, 1));
console.log('\nlisto');
