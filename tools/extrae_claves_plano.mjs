import { readFileSync, writeFileSync } from 'node:fs';
const DIR = '/tmp/claude-0/-home-user-costeador-vonhaucke/4ebe1775-de26-5cdd-8f53-1edeaa08f67a/scratchpad/planos_in';
const PLANOS = ['TELSVH120','TELSMG','TEVTSU','TEVHSU','TVCAC'];
// Token con forma de clave ERP (igual que el motor): >=2 letras y al menos un digito.
const RE = /\b([A-Z]{2,}[A-Z0-9/-]*[0-9][A-Z0-9/-]*)\b/g;
// Ruido conocido que tiene forma de clave pero no lo es (cotas, normas, fechas, etc.)
const RUIDO = /^(T-?304|P3|N1|LED|5050|4000K|AM-46|SJ-?5312|781|100W|DE|ESP|HOJA|NO|VP|IDP|DCC|ESP-?DCC)/;
const out = {};
for (const p of PLANOS) {
  let t = '';
  try { t = readFileSync(`${DIR}/${p}.txt`, 'utf8').toUpperCase(); } catch { out[p]=[]; continue; }
  const set = new Set();
  for (const m of t.matchAll(RE)) {
    const c = m[1];
    if (c.length < 3) continue;
    if (RUIDO.test(c)) continue;
    if (/^\d/.test(c)) continue;
    set.add(c);
  }
  out[p] = [...set].sort();
}
writeFileSync('/tmp/claude-0/-home-user-costeador-vonhaucke/4ebe1775-de26-5cdd-8f53-1edeaa08f67a/scratchpad/claves_por_plano.json', JSON.stringify(out,null,0));
for (const p of PLANOS) console.log(`${p}: ${out[p].length} claves -> ${out[p].slice(0,14).join(', ')}${out[p].length>14?' ...':''}`);
const union = [...new Set(Object.values(out).flat())].sort();
console.log(`\nUNION distinta: ${union.length} claves`);
writeFileSync('/tmp/claude-0/-home-user-costeador-vonhaucke/4ebe1775-de26-5cdd-8f53-1edeaa08f67a/scratchpad/claves_union.json', JSON.stringify(union));
