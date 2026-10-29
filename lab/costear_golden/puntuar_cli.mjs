// Corre el scorer sobre una extracción grabada vs la verdad del HDM.
// Uso: node lab/costear_golden/puntuar_cli.mjs [extraccion.json]
import { readFileSync } from 'node:fs';
import { puntuar } from './scorer.mjs';

const dir = new URL('./', import.meta.url);
const verdad = JSON.parse(readFileSync(new URL('telsvh120_verdad.json', dir), 'utf8'));
const extFile = process.argv[2] || 'baseline_extraccion_salalimpia.json';
const ext = JSON.parse(readFileSync(new URL(extFile, dir), 'utf8'));
const items = ext.items || ext;
const incluirProceso = process.argv.includes('--proceso');

const r = puntuar(verdad, items, { incluirProceso });

console.log(`\n== ${r.mueble} · extracción: ${extFile} ==`);
console.log(`roles de la verdad (sin 'otro'): ${r.total_roles_verdad}`);
console.log(`roles DETECTADOS: ${r.roles_detectados}  ⇒ recall_roles = ${r.recall_roles}`);
console.log(`roles OMITIDOS (${r.roles_omitidos.length}): ${r.roles_omitidos.join(', ')}`);
console.log(`roles INVENTADOS / ausentes de este HDM (${r.roles_inventados.length}): ${r.roles_inventados.join(', ')}`);
console.log(`conteo por rol correcto: ${r.conteo_roles_ok}/${r.total_roles_verdad}`);
console.log(`material OK: ${r.material_ok}  | material MAL: ${r.material_mal}`);
console.log(`piezas (suma conteos) — verdad: ${r.piezas_verdad}  extracción: ${r.piezas_extraccion}`);
console.log(`\ndetalle por rol (esperado→extraído, conteo_ok, material_ok):`);
for (const d of r.detalle) {
  console.log(`  ${d.detectado ? '✓' : '✗'} ${d.rol.padEnd(20)} ${String(d.esperado).padStart(3)}→${String(d.extraido).padStart(3)}  conteo:${d.conteo_ok ? 'ok ' : 'no '} material:${d.material_ok === null ? '—' : d.material_ok ? 'ok' : 'MAL'}`);
}
