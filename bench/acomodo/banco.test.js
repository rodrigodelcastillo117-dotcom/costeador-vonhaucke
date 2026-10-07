import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { construirCasos, generarFactibles } from './casos.js';
import { construirDificiles } from './casos-dificiles.js';
import { construirPlanosReales, FUENTES, FUENTE_FALTANTE } from './planos-reales.js';
import { resolverKits } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';
import { planearDeterminista } from '../../supabase/functions/acomodar-espacio-recovery/acomodo-core.js';
import { mensajeVendedor } from '../../supabase/functions/acomodar-espacio-recovery/opciones.js';
import { juzgar } from './judge.js';

// ============================================================================
//  BANCO LOCAL · acomodador. Juez neutral independiente del solver. Compara el
//  recovery NUEVO (kit-solver) vs el viejo v9 (planearDeterminista), con el mismo
//  input normalizado, mismo catálogo y mismo juez. EVIDENCIA = BANCO LOCAL, no
//  "certificado en producción".
//
//  Casos: 8 nombrados + 5 imposibles + 30 factibles generados + 10 DIFÍCILES
//  congelados + 2 derivados de PLANOS REALES de Rodrigo (provenance en FUENTES).
// ============================================================================
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16);
const HASH_NUEVO = sha('supabase/functions/acomodar-espacio-recovery/kit-solver.js');
const HASH_V9 = sha('supabase/functions/acomodar-espacio-recovery/acomodo-core.js');
const HASH_JUEZ = sha('bench/acomodo/judge.js');
const HASH_CASOS = sha('bench/acomodo/casos.js');
const HASH_DIFICILES = sha('bench/acomodo/casos-dificiles.js');
const HASH_REALES = sha('bench/acomodo/planos-reales.js');
const HASH_OPCIONES = sha('supabase/functions/acomodar-espacio-recovery/opciones.js');

// Canónico para determinismo (excluye telemetría: _nodos, ms, ids de corrida).
const canonico = (r) => JSON.stringify((r.colocacion || []).map((c) => ({ id: c.id, area: c.area, x: c.x, y: c.y, rot: c.rot })).sort((a, b) => (a.id < b.id ? -1 : 1)));

function correrNuevo(c) {
  const t0 = Date.now();
  const r = resolverKits(c.areas, c.piezas);
  const ms = Date.now() - t0;
  const j = juzgar(c.areas, r.piezas, r.colocacion);
  const solverPASS = r.unplaced.length === 0 && r.unassigned.length === 0;
  return { r, j, ms, solverPASS };
}
// v9 NO emite anchor_instance_id. El mandato exige evaluar la REALIDAD ESPACIAL
// equivalente sin penalizar al viejo por carecer de metadata nueva. Le inferimos el
// dueño por el GRUPO FUNCIONAL REAL de la pieza (functional_group_id, que v9 sí
// recibe): el dueño es el ancla COLOCADA de su mismo grupo. Así una silla se acredita
// como unida SÓLO a SU escritorio (no a cualquiera cercano); si el ancla de su grupo
// no se colocó, la silla queda huérfana — que es la realidad espacial correcta.
function inferirDuenos(piezas, col) {
  const esAncla = (r) => typeof r === 'string' && r.startsWith('ANCHOR_');
  const colIds = new Set(col.map((c) => String(c.id)));
  const anclaDeGrupo = new Map();
  for (const p of piezas) if (esAncla(p.relation_role) && colIds.has(String(p.id))) anclaDeGrupo.set(p.functional_group_id, String(p.id));
  return piezas.map((p) => (esAncla(p.relation_role) ? { ...p } : { ...p, anchor_instance_id: anclaDeGrupo.get(p.functional_group_id) ?? null }));
}
function correrV9(c) {
  let col = [];
  try { col = (planearDeterminista(c.areas, c.piezas, {}) || {}).colocacion || []; } catch { col = []; }
  return juzgar(c.areas, inferirDuenos(c.piezas, col), col);
}
const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

describe('BANCO LOCAL · acomodador recovery (kit-solver) vs v9', () => {
  const casos = [...construirCasos(), ...generarFactibles(30), ...construirDificiles(), ...construirPlanosReales()];
  const nombres8 = ['multi-zona', 'APP LT + WIN + gavetas', 'privado', 'juntas 10', 'puerta', 'columna', '25 exactas', 'imposible (área minúscula)'];
  const conWitness = casos.filter((c) => c.witnessColoc);   // difíciles + reales

  const filas = [];
  const tiempos = [];
  let falsosPASS = 0, factPASS = 0, factTot = 0, impSinPASS = 0, impTot = 0, maxMs = 0, regresiones = 0;
  const named8 = new Map();

  for (const c of casos) {
    const { r, j, ms, solverPASS } = correrNuevo(c);
    const v9 = correrV9(c);
    maxMs = Math.max(maxMs, ms); tiempos.push(ms);
    if (solverPASS && j.status !== 'PASS') falsosPASS++;
    if (c.factible) { factTot++; if (j.status === 'PASS') factPASS++; } else { impTot++; if (j.status !== 'PASS') impSinPASS++; }
    if (j.colocadasBien < v9.colocadasBien) regresiones++;
    if (nombres8.includes(c.nombre)) named8.set(c.nombre, j);
    filas.push({ nombre: c.nombre, fact: c.factible, nuevo: `${j.colocadasBien}/${j.total}`, nuevoStatus: j.status, v9: `${v9.colocadasBien}/${v9.total}`, v9Status: v9.status, unidas: `${j.colocadas - j.desprendidas - j.sinDueno}/${j.total}`, ms, occ: c.occupancy });
  }

  it('imprime la tabla BANCO LOCAL (viejo vs nuevo) + hashes congelados', () => {
    /* eslint-disable no-console */
    console.log(`\n=== BANCO LOCAL · recovery kit-solver(${HASH_NUEVO}) vs v9(${HASH_V9}) ===`);
    console.log(`FREEZE juez=${HASH_JUEZ} casos=${HASH_CASOS} dificiles=${HASH_DIFICILES} reales=${HASH_REALES} opciones=${HASH_OPCIONES}`);
    console.log('CASO | fact | NUEVO bien/tot (status) | V9 bien/tot (status) | unidas-a-ancla | ms | occ');
    for (const f of filas) console.log(`${f.nombre.padEnd(34)} | ${f.fact ? 'F' : 'I'} | ${f.nuevo.padEnd(7)} ${f.nuevoStatus.padEnd(7)} | ${f.v9.padEnd(7)} ${f.v9Status.padEnd(7)} | ${f.unidas.padEnd(7)} | ${f.ms} | ${f.occ ?? ''}`);
    console.log(`--- falsosPASS=${falsosPASS} factPASS=${factPASS}/${factTot} impSinPASS=${impSinPASS}/${impTot} regresiones=${regresiones} p50=${pct(tiempos, 0.5)} p95=${pct(tiempos, 0.95)} maxMs=${maxMs}`);
    console.log(`--- PLANOS REALES (provenance): ${FUENTES.map((f) => `${f.archivo}@${f.hash_git.slice(0, 8)}`).join(', ')} | ${FUENTE_FALTANTE.accion}`);
    expect(true).toBe(true);
  });

  it('0 · witness de casos DIFÍCILES y REALES es PASS bajo el juez neutral (factibilidad probada, independiente del solver)', () => {
    expect(conWitness.length).toBe(12);   // 10 difíciles + 2 reales
    for (const c of conWitness) {
      const jw = juzgar(c.areas, c.witnessPiezas, c.witnessColoc);
      expect(jw.status, `witness ${c.nombre}`).toBe('PASS');
    }
  });

  it('1 · CERO PASS falsos (el juez nunca halla falla en un PASS del solver)', () => {
    expect(falsosPASS).toBe(0);
  });
  it('2 · factibles ≥95% PASS y los 8 nombrados al 100%', () => {
    expect(factPASS / factTot).toBeGreaterThanOrEqual(0.95);
    for (const n of nombres8) {
      const j = named8.get(n);
      if (n.startsWith('imposible')) expect(j.status, n).not.toBe('PASS');
      else expect(j.status, n).toBe('PASS');
    }
  });
  it('2b · los 10 difíciles y los 2 reales terminan en PASS (100% colocado y unido)', () => {
    for (const c of conWitness) {
      const { j } = correrNuevo(c);
      expect(j.status, c.nombre).toBe('PASS');
      expect(j.desprendidas, c.nombre).toBe(0);
      expect(j.sinDueno, c.nombre).toBe(0);
    }
  });
  it('3 · dependientes unidos a su ancla = 100% en todo PASS', () => {
    for (const c of casos) {
      const { j } = correrNuevo(c);
      if (j.status === 'PASS') { expect(j.desprendidas).toBe(0); expect(j.sinDueno).toBe(0); }
    }
  });
  it('4 · imposibles/PARTIAL: faltantes + motivo causal + ≥1 opción que SIMULADA mejora/resuelve', () => {
    for (const c of casos) {
      const { r, j } = correrNuevo(c);
      if (j.status === 'PASS') continue;
      const faltan = r.unplaced.length + r.unassigned.length;
      expect(faltan, c.nombre).toBeGreaterThan(0);
      for (const u of r.unplaced) expect(u.invariante, c.nombre).toBeTruthy();
      const msg = mensajeVendedor(c.areas, r.piezas, r, { resolver: resolverKits });
      expect(msg.pendientes.length, `pendientes ${c.nombre}`).toBeGreaterThan(0);
      expect(msg.motivos.length, `motivos ${c.nombre}`).toBeGreaterThan(0);
      // O hay opciones auto-verificadas, O se declara explícitamente que no hay forma.
      expect(msg.opciones.length > 0 || !!msg.sin_opcion, `opciones o sin_opcion ${c.nombre}`).toBe(true);
      // Cada opción mostrada, aplicada y re-resuelta, mejora de verdad (texto ↔ transformación).
      for (const opt of msg.opciones) {
        const { areas, piezas } = opt.aplicar(c.areas, c.piezas);
        const s2 = resolverKits(areas, piezas);
        const j2 = juzgar(areas, s2.piezas, s2.colocacion);
        const mejora = (j2.status === 'PASS' && j2.colocadas > 0) || j2.colocadasBien > j.colocadasBien;
        expect(mejora, `opción ${opt.id} mejora ${c.nombre}`).toBe(true);
      }
    }
  });
  it('5 · determinismo: 3 corridas idénticas byte a byte (sin telemetría)', () => {
    for (const c of casos.slice(0, 25)) {
      const a = canonico(resolverKits(c.areas, c.piezas));
      const b = canonico(resolverKits(c.areas, c.piezas));
      const d = canonico(resolverKits(c.areas, c.piezas));
      expect(a, c.nombre).toBe(b); expect(b, c.nombre).toBe(d);
    }
  });
  it('6 · p95 y máximo ≤ 2000 ms por caso', () => {
    expect(pct(tiempos, 0.95)).toBeLessThanOrEqual(2000);
    expect(maxMs).toBeLessThanOrEqual(2000);
  });
  it('7 · ninguna regresión vs v9: colocadasBien(nuevo) ≥ colocadasBien(v9) por caso', () => {
    // v9 se juzga con dueño inferido por su GRUPO FUNCIONAL real (realidad espacial
    // equivalente, sin penalizarlo por no emitir anchor_instance_id). Una silla se
    // acredita unida sólo a SU mueble; si el ancla de su grupo no se colocó, queda
    // huérfana (correcto). Mismo juez congelado para ambos motores.
    expect(regresiones).toBe(0);
  });
  it('8 · planos reales con provenance (archivo+ruta+hash) y FUENTE_FALTANTE declarada', () => {
    expect(FUENTES.length).toBeGreaterThanOrEqual(2);
    for (const f of FUENTES) { expect(f.archivo).toBeTruthy(); expect(f.ruta).toBeTruthy(); expect(f.hash_git).toMatch(/^[0-9a-f]{40}$/); }
    expect(FUENTE_FALTANTE.accion).toContain('FUENTE_FALTANTE');
  });
});
