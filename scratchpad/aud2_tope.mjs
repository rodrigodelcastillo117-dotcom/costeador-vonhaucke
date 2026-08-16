// AUDITORÍA 2 · EL TOPE DE 25. ¿Cuál lección se cae, y quién decide?
// Se prueba el código REAL (aprendizaje.js) contra la tabla REAL. Todo lo que se
// inserta lleva "PRUEBA-AUDITORIA" y se desactiva al final.
import { anotar, cargarAprendizajes, aprendizajesTexto, aprendizajes, olvidar } from '../src/datos/aprendizaje.js';

const MARCA = 'PRUEBA-AUDITORIA';
const creadas = [];

console.log('── 1. GUARDAS DE anotar(): lección vacía / basura ─────────────────');
for (const [etiq, texto] of [['vacía ""', ''], ['solo espacios', '   '], ['null', null], ['undefined', undefined], ['basura', `${MARCA} asdkjh ñlk 123 ???`]]) {
  const r = await anotar({ tipo: 'aclaracion', texto });
  console.log(`   ${etiq.padEnd(16)} → ${r ? 'GUARDÓ id ' + r.id : 'rechazada (null)'}`);
  if (r) creadas.push(r.id);
}

console.log('\n── 2. ¿se recorta a 600 caracteres al guardar? ────────────────────');
const larga = `${MARCA} ` + 'x'.repeat(5000);
const rl = await anotar({ tipo: 'aclaracion', texto: larga });
if (rl) { creadas.push(rl.id); console.log(`   mandé ${larga.length} caracteres → guardó ${rl.texto.length}`); }
else console.log('   no guardó');

console.log('\n── 3. ¿la repetición suma "veces" en vez de duplicar? ─────────────');
const rep = `${MARCA} el vendedor siempre lo cambia a Río`;
const a1 = await anotar({ tipo: 'aclaracion', texto: rep });
const a2 = await anotar({ tipo: 'aclaracion', texto: rep });
const a3 = await anotar({ tipo: 'aclaracion', texto: rep });
if (a1) creadas.push(a1.id);
console.log(`   3 veces la misma → id ${a1?.id} / ${a2?.id} / ${a3?.id}   veces=${a3?.veces}`);
console.log(`   ${a1?.id === a3?.id ? '✓ sumó, no duplicó' : '🔴 duplicó filas'}`);

console.log('\n── 4. EL TOPE: 30 lecciones, ¿cuáles 25 llegan al prompt? ─────────');
for (let i = 1; i <= 30; i++) {
  const r = await anotar({ tipo: 'aclaracion', texto: `${MARCA} lección número ${String(i).padStart(2, '0')} de relleno` });
  if (r) creadas.push(r.id);
}
await cargarAprendizajes();
const vivas = aprendizajes();
const txt = aprendizajesTexto();
console.log(`   lecciones activas en la base : ${vivas.length}`);
console.log(`   lecciones que van al prompt  : ${txt.length}`);
const nums = txt.map((t) => (t.match(/lección número (\d+)/) || [])[1]).filter(Boolean).map(Number).sort((a, b) => a - b);
console.log(`   números de relleno que SÍ van : ${nums.join(',')}`);
const faltan = Array.from({ length: 30 }, (_, i) => i + 1).filter((n) => !nums.includes(n));
console.log(`   números que se CAYERON        : ${faltan.join(',') || '(ninguno)'}`);
console.log(`   la que tiene veces=${a3?.veces} (repetida) ¿va? : ${txt.some((t) => t.includes('lo cambia a Río')) ? 'SÍ (primera)' : 'NO'}`);
console.log(`   orden real del prompt (3 primeras):`);
txt.slice(0, 3).forEach((t) => console.log('      ' + t.slice(0, 100)));

console.log('\n── 5. LIMPIEZA: desactivar todo lo de la prueba ───────────────────');
await cargarAprendizajes();
const mias = aprendizajes().filter((a) => String(a.texto).includes(MARCA));
for (const m of mias) await olvidar(m.id);
await cargarAprendizajes();
const quedan = aprendizajes().filter((a) => String(a.texto).includes(MARCA));
console.log(`   desactivadas: ${mias.length}   quedan activas con la marca: ${quedan.length}`);
console.log(`   total activas ahora: ${aprendizajes().length}`);
