// AUDITORÍA 2 · EL MISMO MUEBLE A DOS PRECIOS EN EL MISMO DÍA.
// En el proyecto COWORKING la "Banca doble APP LT 1.20 · 12 usuarios" salió en
// $33,840 (0% contra el papel). En el CALL CENTER, el mismo renglón salió en
// $89,840 (+164%). El pedido sólo decía "con biombo divisor". ¿Qué opción vale
// $56,000? Se costea el mismo producto encendiendo una opción a la vez.
import { LINEAS_REG, configDesde, costearConfig } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';

const estado = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT, piezas: {} };
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

const L = LINEAS_REG.applt;
const prod = L.productos.find((p) => p.id === 'banca_doble');
console.log('PRODUCTO: applt / banca_doble');
console.log('params :', JSON.stringify(Object.fromEntries(Object.entries({
  largos: prod.largos, fondos: prod.fondos, usuarios: prod.usuarios, biombo: prod.biombo,
}).filter(([, v]) => v))));
console.log('selects:', (prod.selects || []).map((s) => `${s.key}=[${s.opciones.map((o) => o.id).join('|')}]`).join('  '));
console.log('checks :', (prod.checks || []).map((c) => c.key).join('  '));
console.log('');

const base = { largoMM: 1200, usuarios: 12 };
const cuesta = (sel) => {
  try { const r = costearConfig(estado, 'applt', 'banca_doble', configDesde(prod, { ...base, ...sel }), 1); return r?.precioUnitario || 0; }
  catch (e) { return NaN; }
};

const b = cuesta({});
console.log(`BASE (1.20 m, 12 usuarios, todo por omisión) = ${money(b)}   ← lo que salió en COWORKING`);
console.log('');
console.log('una opción a la vez:');

const pruebas = [];
for (const s of prod.selects || []) for (const o of s.opciones) pruebas.push([`${s.key} = ${o.id}`, { [s.key]: o.id }]);
for (const c of prod.checks || []) pruebas.push([`✓ ${c.key}`, { [c.key]: true }]);
if (prod.biombo) for (const v of ['cristal', 'melamina']) pruebas.push([`biombo = ${v}`, { biombo: v }]);

const filas = pruebas.map(([n, sel]) => ({ n, p: cuesta(sel) })).filter((f) => f.p > 0);
filas.sort((a, b2) => b2.p - a.p);
for (const f of filas) {
  const d = f.p - b;
  console.log(`   ${f.n.padEnd(34)} ${money(f.p).padStart(11)}   ${(d >= 0 ? '+' : '') + money(d)}  ${d === 0 ? '← NO COBRA NADA' : `(${((f.p / b - 1) * 100).toFixed(0)}%)`}`);
}

console.log('');
const gratis = filas.filter((f) => f.p === b);
console.log(`OPCIONES QUE NO MUEVEN EL PRECIO NI UN PESO: ${gratis.length} de ${filas.length}`);
if (gratis.length) console.log('   ' + gratis.map((f) => f.n).join(' · '));

// la combinación que reproduce los $89,840
console.log('');
console.log('¿QUÉ COMBINACIÓN LLEGA A $89,840?');
const combos = [
  ['biombo cristal', { biombo: 'cristal' }],
  ['biombo cristal + eléctrico', { biombo: 'cristal', electrico: true }],
  ['fondo 1500', { fondoMM: 1500 }],
  ['todos los checks', Object.fromEntries((prod.checks || []).map((c) => [c.key, true]))],
  ['todos los checks + biombo cristal', { ...Object.fromEntries((prod.checks || []).map((c) => [c.key, true])), biombo: 'cristal' }],
];
for (const [n, sel] of combos) { const p = cuesta(sel); console.log(`   ${n.padEnd(34)} ${money(p).padStart(11)}  ${Math.abs(p - 89840) < 1200 ? ' ← ES ÉSTA' : ''}`); }
