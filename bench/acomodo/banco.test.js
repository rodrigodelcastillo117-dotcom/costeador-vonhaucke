import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { construirCasos, generarFactibles } from './casos.js';
import { resolverKits } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';
import { planearDeterminista } from '../../supabase/functions/acomodar-espacio-recovery/acomodo-core.js';
import { juzgar } from './judge.js';

// ============================================================================
//  BANCO LOCAL · acomodador. Juez neutral independiente del solver. Compara el
//  recovery NUEVO (kit-solver) vs el viejo v9 (planearDeterminista), con el mismo
//  input normalizado, mismo catálogo y mismo juez. EVIDENCIA = BANCO LOCAL, no
//  "certificado en producción".
// ============================================================================
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16);
const HASH_NUEVO = sha('supabase/functions/acomodar-espacio-recovery/kit-solver.js');
const HASH_V9 = sha('supabase/functions/acomodar-espacio-recovery/acomodo-core.js');

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
function correrV9(c) {
  let col = [];
  try { col = (planearDeterminista(c.areas, c.piezas, {}) || {}).colocacion || []; } catch { col = []; }
  return juzgar(c.areas, c.piezas, col);
}

describe('BANCO LOCAL · acomodador recovery (kit-solver) vs v9', () => {
  const casos = [...construirCasos(), ...generarFactibles(30)];
  const nombres8 = ['multi-zona', 'APP LT + WIN + gavetas', 'privado', 'juntas 10', 'puerta', 'columna', '25 exactas', 'imposible (área minúscula)'];

  const filas = [];
  let falsosPASS = 0, factPASS = 0, factTot = 0, impSinPASS = 0, impTot = 0, maxMs = 0, regresiones = 0;
  const named8 = new Map();

  for (const c of casos) {
    const { r, j, ms, solverPASS } = correrNuevo(c);
    const v9 = correrV9(c);
    maxMs = Math.max(maxMs, ms);
    if (solverPASS && j.status !== 'PASS') falsosPASS++;
    if (c.factible) { factTot++; if (j.status === 'PASS') factPASS++; } else { impTot++; if (j.status !== 'PASS') impSinPASS++; }
    if (j.colocadasBien < v9.colocadasBien) regresiones++;
    if (nombres8.includes(c.nombre)) named8.set(c.nombre, j);
    filas.push({ nombre: c.nombre, fact: c.factible, nuevo: `${j.colocadasBien}/${j.total}`, nuevoStatus: j.status, v9: `${v9.colocadasBien}/${v9.total}`, v9Status: v9.status, unidas: `${j.colocadas - j.desprendidas - j.sinDueno}/${j.total}`, ms });
  }

  it('imprime la tabla BANCO LOCAL (viejo vs nuevo) + hashes', () => {
    /* eslint-disable no-console */
    console.log(`\n=== BANCO LOCAL · recovery kit-solver(${HASH_NUEVO}) vs v9(${HASH_V9}) ===`);
    console.log('CASO | fact | NUEVO bien/tot (status) | V9 bien/tot (status) | unidas-a-ancla | ms');
    for (const f of filas) console.log(`${f.nombre.padEnd(30)} | ${f.fact ? 'F' : 'I'} | ${f.nuevo.padEnd(7)} ${f.nuevoStatus.padEnd(7)} | ${f.v9.padEnd(7)} ${f.v9Status.padEnd(7)} | ${f.unidas.padEnd(7)} | ${f.ms}`);
    console.log(`--- falsosPASS=${falsosPASS} factPASS=${factPASS}/${factTot} impSinPASS=${impSinPASS}/${impTot} regresiones=${regresiones} maxMs=${maxMs}`);
    expect(true).toBe(true);
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
  it('3 · dependientes unidos a su ancla = 100% en todo PASS', () => {
    for (const c of casos) {
      const { j } = correrNuevo(c);
      if (j.status === 'PASS') { expect(j.desprendidas).toBe(0); expect(j.sinDueno).toBe(0); }
    }
  });
  it('4 · imposibles 100% sin PASS, con faltantes y motivo causal', () => {
    expect(impSinPASS).toBe(impTot);
    for (const c of casos.filter((x) => !x.factible)) {
      const { r } = correrNuevo(c);
      const faltan = r.unplaced.length + r.unassigned.length;
      expect(faltan, c.nombre).toBeGreaterThan(0);
      for (const u of r.unplaced) expect(u.invariante, c.nombre).toBeTruthy();
    }
  });
  it('5 · determinismo: 3 corridas idénticas byte a byte (sin telemetría)', () => {
    for (const c of casos.slice(0, 20)) {
      const a = canonico(resolverKits(c.areas, c.piezas));
      const b = canonico(resolverKits(c.areas, c.piezas));
      const d = canonico(resolverKits(c.areas, c.piezas));
      expect(a, c.nombre).toBe(b); expect(b, c.nombre).toBe(d);
    }
  });
  it('6 · máximo ≤ 2000 ms por caso', () => {
    expect(maxMs).toBeLessThanOrEqual(2000);
  });
  it('7 · ninguna regresión vs v9: colocadasBien(nuevo) ≥ colocadasBien(v9) por caso', () => {
    expect(regresiones).toBe(0);
  });
});
