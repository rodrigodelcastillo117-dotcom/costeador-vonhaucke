// ============================================================================
//  PRUEBA DE ACEPTACIÓN INDEPENDIENTE · acomodador recovery (kit-solver).
//  Casos, verificador y testigos escritos FUERA de la sesión que programa el
//  solver. NO usa bench/acomodo/judge.js ni casos.js. NO editar estos archivos
//  para pasar la prueba: el revisor vuelve a correrlos desde su propia copia y
//  agrega casos nuevos que no se publican antes.
//
//  Uso (desde la raíz del repo, en la rama del solver):
//    git checkout origin/claude/project-thread-t6twi7 -- bench/acomodo-independiente
//    npx vite-node bench/acomodo-independiente/aceptacion.mjs
//  Sale con código 1 si algún criterio C1–C11 falla. Testigos: los casos marcados
//  "sí" tienen una solución armada por el revisor que pasa este verificador.
// ============================================================================
import { misCasos } from './casos.mjs';
import { verificar, revisarUso } from './verificador.mjs';
import { testigo } from './testigo.mjs';
import { resolverKits } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';
import { mensajeVendedor } from '../../supabase/functions/acomodar-espacio-recovery/opciones.js';
import { evaluarRecovery } from '../../supabase/functions/acomodar-espacio-recovery/recovery-core.js';
import { planearDeterminista } from '../../supabase/functions/acomodar-espacio/acomodo-core.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const canon = (col) => JSON.stringify([...col].map((c) => [String(c.id), c.area, c.x, c.y, c.rot]).sort());
const IMPOSIBLES = /^B(6|7|11|15) /;
const fallos = [];
const falla = (c, msg) => fallos.push(`${c}: ${msg}`);
const filas = [];

for (const c of misCasos()) {
  if (c.builderBug) continue;   // A9 es bug del builder (huellaReal), no del solver: se reporta aparte
  const runs = [];
  for (let i = 0; i < 3; i++) { const t = performance.now(); const r = resolverKits(clone(c.areas), clone(c.piezas)); runs.push({ r, ms: performance.now() - t }); }
  const r = runs[0].r;
  const v = verificar(c.areas, c.piezas, r.colocacion);
  const v9 = verificar(c.areas, c.piezas, (planearDeterminista(clone(c.areas), clone(c.piezas), {}) || {}).colocacion || []);
  const ms = Math.max(...runs.map((x) => x.ms));
  const dice = r.unplaced.length === 0 && r.unassigned.length === 0;
  const imposible = IMPOSIBLES.test(c.nombre);
  const factible = /^sí/.test(c.factible);
  filas.push(`${c.nombre.padEnd(52)} ${String(v.bien).padStart(3)}/${String(v.total).padEnd(3)} ${v.pass ? 'PASS' : '    '}  v9 ${v9.bien}/${v9.total}  ${Math.round(ms)} ms ${JSON.stringify(v.codes)}`);

  // C1 factible ⇒ PASS con el verificador independiente (testigo existe en todos los "sí")
  if (factible && !v.pass) falla(c.nombre, `C1 factible y no PASS (${v.bien}/${v.total}) ${JSON.stringify(v.codes)}`);
  // C2 cero PASS falso
  if (dice && !v.pass) falla(c.nombre, `C2 PASS FALSO: el solver dice completo y el verificador encuentra ${JSON.stringify(v.codes)} faltan=${v.faltan.length}`);
  // C3 cero piezas perdidas sin aviso: colocadas ∪ no_cupieron ∪ sin_dueño = total
  const ids = new Set([...r.colocacion.map((x) => String(x.id)), ...r.unassigned.map(String), ...r.unplaced.flatMap((u) => (u.piezas || []).map(String))]);
  const perdidas = c.piezas.filter((p) => !ids.has(String(p.id)));
  if (perdidas.length) falla(c.nombre, `C3 ${perdidas.length} pieza(s) desaparecen sin aviso: ${perdidas.map((p) => p.nombre).join(', ')}`);
  // C4 imposibles: nunca PASS, y lo colocado sigue limpio (mejor parcial válido)
  if (imposible && v.pass) falla(c.nombre, 'C4 imposible marcado PASS');
  if (imposible && v.fallas.length) falla(c.nombre, `C4 el parcial tiene fallas físicas ${JSON.stringify(v.codes)}`);
  // C5 nunca peor que el viejo en piezas bien colocadas
  if (factible && v.bien < v9.bien) falla(c.nombre, `C5 regresión vs viejo: ${v.bien} < ${v9.bien}`);
  // C6 determinismo y tiempo
  if (new Set(runs.map((x) => canon(x.r.colocacion))).size !== 1) falla(c.nombre, 'C6 no determinista');
  if (ms > 2000) falla(c.nombre, `C6 tardó ${Math.round(ms)} ms (> 2000)`);
  // C7 banca doble: sillas en los dos lados largos
  const uso = revisarUso(c.areas, c.piezas, r.colocacion);
  if (uso.length) falla(c.nombre, `C7 ${uso[0]}${uso.length > 1 ? ` (+${uso.length - 1})` : ''}`);
  // C8 el validador del edge coincide con el verificador cuando éste da PASS
  const ev = evaluarRecovery(c.areas, r.piezas, r.colocacion, { requested: c.piezas.length });
  if (v.pass && ev.status !== 'PASS') falla(c.nombre, `C8 evaluarRecovery=${ev.status} en un acomodo válido (${[...new Set(ev.issues.map((i) => i.code))].join(',')})`);
  // C9–C11 mensaje al vendedor
  if (!v.pass) {
    const m = mensajeVendedor(c.areas, r.piezas, r, { resolver: resolverKits });
    if (!m.hay_pendientes) falla(c.nombre, 'C9 hay faltantes y el mensaje dice que no hay pendientes');
    for (const mo of m.motivos) {
      if (/\b[A-Z]{3,}_?[A-Z_]*\b/.test(mo.texto.replace(/"[^"]*"/g, ''))) falla(c.nombre, `C10 código crudo al vendedor: "${mo.texto}"`);
      const mm = /necesita ~([\d.]+) m² y el área "[^"]*" tiene ~([\d.]+)/.exec(mo.texto);
      if (mm && +mm[1] <= +mm[2]) falla(c.nombre, `C10 motivo contradictorio: "${mo.texto}"`);
      if (/capacidad del catálogo/.test(mo.texto) && c.piezas.some((p) => /VISITOR_SEAT/.test(p.relation_role))) falla(c.nombre, `C10 motivo falso para sillas de visita: "${mo.texto}"`);
    }
    for (const o of m.opciones) {
      const t = o.aplicar(clone(c.areas), clone(c.piezas));
      const r2 = resolverKits(t.areas, t.piezas);
      const v2 = verificar(t.areas, t.piezas, r2.colocacion);
      const promete = /el resto queda acomodado completo|caben|cabe/.test(o.texto);
      // Lo que promete, verificado con el verificador independiente: todo lo que queda, limpio.
      if (promete && (v2.fallas.length || (/el resto queda acomodado completo/.test(o.texto) && !v2.pass))) falla(c.nombre, `C11 opción no cumple: "${o.texto}" → ${v2.bien}/${v2.total} ${JSON.stringify(v2.codes)}`);
      if (/\b1 puesto|\(1 de \d+\)/.test(o.texto)) falla(c.nombre, `C11 opción inútil: "${o.texto}"`);
    }
  }
}
console.log(filas.join('\n'));
console.log(`\n${fallos.length ? `NO ACEPTADO · ${fallos.length} incumplimientos` : 'ACEPTADO · 0 incumplimientos'}`);
for (const f of fallos) console.log(' - ' + f);
process.exitCode = fallos.length ? 1 : 0;
