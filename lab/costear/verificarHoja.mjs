// Uso: node lab/costear/verificarHoja.mjs <hoja.json> <8-dto-servidor.json> [más dto...]
import fs from 'node:fs';
import { compararConHoja, componentesDeDto } from '../../e2e/hojaControl.js';
const [hojaP, ...dtos] = process.argv.slice(2);
const hoja = JSON.parse(fs.readFileSync(hojaP, 'utf8'));
for (const p of dtos) {
  const r = compararConHoja(componentesDeDto(JSON.parse(fs.readFileSync(p, 'utf8'))), hoja);
  console.log(`\n== ${p}\n   ${JSON.stringify(r.resumen)}`);
  for (const f of r.filas) if (f.estado !== 'PASS') console.log(`   ${f.estado.padEnd(6)} ${f.clave.padEnd(18)} ${f.motivos.join(' · ')}`);
  for (const s of r.sobran) console.log(`   SOBRA${s.permitido ? ' (permitido)' : ''}  ${s.nombre} [${s.insumoId}]`);
}
