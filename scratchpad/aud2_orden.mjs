// AUDITORÍA 2 · ¿QUÉ DECIDE cuando dos lecciones se contradicen: el orden o las
// "veces"? Importa porque aprendizajesTexto() ORDENA por veces DESC — pone la
// más corregida PRIMERA. Si la que gana es la ÚLTIMA, el orden está al revés.
import { cotizar, money, enParalelo, REGLAS_REALES } from './aud2_lib.mjs';

const CIRQUE = '· Cuando pidan "lugares de trabajo en bench" sin decir línea, el vendedor siempre lo cambia a Cirque. Usa Cirque desde el principio.';
const APPLT = '· Cuando pidan "lugares de trabajo en bench" sin decir línea, NUNCA uses Cirque: el vendedor siempre lo baja a App LT. Usa App LT.';
const veces = (l, n) => l + ` (te lo han corregido ${n} veces)`;
const P = '10 lugares de trabajo en bench';

const CASOS = [
  { n: 'O1 · Cirque 1º · AppLT 2º            (empate de veces)', ap: [CIRQUE, APPLT] },
  { n: 'O2 · AppLT 1º · Cirque 2º            (empate de veces)', ap: [APPLT, CIRQUE] },
  { n: 'O3 · Cirque×9 1º · AppLT×1 2º   ← lo que produce el sort real', ap: [veces(CIRQUE, 9), APPLT] },
  { n: 'O4 · AppLT×9 1º · Cirque×1 2º   ← lo que produce el sort real', ap: [veces(APPLT, 9), CIRQUE] },
];

const res = await enParalelo(CASOS.map((c) => async () => ({ c, r: await cotizar({ texto: P, reglas: REGLAS_REALES, aprendizajes: c.ap }) })), 4);
for (const { c, r } of res) {
  const l = r.ok ? [...new Set(r.renglones.filter((x) => x.origen === 'linea').map((x) => x.ruta))].join('+') : 'ERROR';
  console.log(`${c.n}\n     → ganó ${l.toUpperCase().padEnd(8)} ${r.ok ? money(r.total) : r.error}`);
}
console.log('\nSi O3 gana APPLT y O4 gana CIRQUE, manda el ORDEN (la ÚLTIMA gana)');
console.log('y el sort por veces está AL REVÉS: pone la más corregida donde pierde.');
