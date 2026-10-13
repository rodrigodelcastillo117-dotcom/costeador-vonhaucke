// Gate del laboratorio de planos: lee tabla.<fn>.json y falla si baja un número que no debe bajar.
// Duros: áreas, m², puestos, puertas, columnas, envolvente, sin errores. Tolerantes: asientos (≥ n-1), tipo, barridos.
import fs from 'node:fs';
const f = process.argv[2]; if (!f || !fs.existsSync(f)) { console.error('uso: node gate.mjs tabla.json'); process.exit(2); }
const tabla = JSON.parse(fs.readFileSync(f, 'utf8'));
const frac = (s) => { const m = String(s || '').match(/^(\d+)\/(\d+)$/); return m ? [Number(m[1]), Number(m[2])] : null; };
let fallas = 0;
for (const t of tabla) {
  const pf = [];
  if (t.error) pf.push(`error ${t.error}`);
  for (const k of ['areas', 'm2', 'puestos', 'puertas', 'columnas']) { const v = frac(t[k]); if (!v || v[0] !== v[1]) pf.push(`${k} ${t[k]}`); }
  const a = frac(t.asientos); if (!a || a[0] < a[1] - 1) pf.push(`asientos ${t.asientos}`);
  if (t.envolvente && t.envolvente !== '✓') pf.push(`envolvente ${t.envolvente}`);
  if (pf.length) { fallas++; console.log(`✗ ${t.nombre}: ${pf.join(' · ')}`); } else console.log(`✓ ${t.nombre}`);
}
console.log(fallas ? `\nGATE: ${fallas} plano(s) por debajo del estándar` : '\nGATE: todos los planos cumplen');
process.exit(fallas ? 1 : 0);
