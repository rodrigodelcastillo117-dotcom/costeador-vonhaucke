// AUDITORÍA 2 · ¿mejoró la consistencia (la peor nota: 3/10)?
// El MISMO pedido de la auditoría anterior, 5 veces, textual e idéntico,
// ahora CON las 4 reglas de 'cotizacion' que sí viajan desde hoy.
// Se corre también SIN reglas para saber si la mejora (si la hay) es de ellas.
import { cotizar, money, enParalelo, REGLAS_REALES } from './aud2_lib.mjs';
import { writeFileSync } from 'node:fs';

const PEDIDO = '20 lugares de trabajo en bench App LT de 1.20';
const N = 5;

const tandas = [
  { nombre: 'CON reglas (como hoy en producción)', reglas: REGLAS_REALES },
  { nombre: 'SIN reglas (como estaba ayer)', reglas: null },
];

const salida = {};
for (const t of tandas) {
  const r = await enParalelo(
    Array.from({ length: N }, () => () => cotizar({ texto: PEDIDO, reglas: t.reglas })),
    5,
  );
  salida[t.nombre] = r;
  const totales = r.filter((x) => x.ok).map((x) => x.total);
  const min = Math.min(...totales), max = Math.max(...totales);
  console.log('\n████ ' + t.nombre);
  console.log(`PEDIDO: "${PEDIDO}"  ×${N}`);
  r.forEach((x, k) => {
    if (!x.ok) return console.log(`  ${k + 1}) ERROR ${x.error}`);
    console.log(`  ${k + 1}) ${money(x.total).padStart(10)}  ·  ${x.renglones.map((y) => `${y.nombre} ×${y.cantidad} ${money(y.imp)}`).join('  |  ')}`);
    if (x.preguntas.length) console.log(`      preguntó: ${x.preguntas.join(' / ')}`);
    if (x.inventados.length) console.log(`      ⚠ INVENTADO: ${x.inventados.join(' / ')}`);
  });
  console.log(`  → rango ${money(min)} … ${money(max)}  =  ${(max / min).toFixed(2)}×   (spread ${money(max - min)})`);

  // ¿de dónde sale el ruido?
  const sillas = r.filter((x) => x.ok).map((x) => x.renglones.filter((y) => /silla|sill[oó]n/i.test(y.nombre)).map((y) => `${y.nombre}@${y.unit}`).join('+') || '—');
  const gavetas = r.filter((x) => x.ok).map((x) => (x.renglones.some((y) => /gaveta|archivero|cajon/i.test(y.nombre)) ? 'SÍ' : 'no'));
  const bench = r.filter((x) => x.ok).map((x) => x.renglones.filter((y) => y.origen === 'linea').map((y) => `${y.cantidad}×${(y.nombre.match(/(\d+) usuarios/) || [])[1] || '?'}u`).join('+'));
  console.log(`     eje silla   : ${[...new Set(sillas)].length} variantes → ${[...new Set(sillas)].join('  ||  ')}`);
  console.log(`     eje gaveta  : ${gavetas.join(' ')}`);
  console.log(`     eje armado  : ${[...new Set(bench)].join('  ||  ')}`);
}

writeFileSync(new URL('./aud2_consistencia.json', import.meta.url), JSON.stringify(salida, null, 1));
console.log('\nlisto');
