// ============================================================================
//  REGRESIÓN 4859 (root-cause 2026-11-03) — la RED DE SEGURIDAD nunca regresa.
//  --------------------------------------------------------------------------
//  Caso real (cotización 4859): una pieza de 6000×1200 mm (p-1-1) fue colocada
//  MANUALMENTE (manual:true / provenance:USER_CONFIRMED) ROTADA 90° (→ 1200×6000)
//  en ÁREA OPERATIVA, que sólo tiene 3200 mm de fondo. Físicamente imposible:
//  se sale 3800 mm (OUT_OF_BOUNDS) y su huella sobredimensionada choca con la
//  silla p-7-5 (OVERLAP).
//
//  El SOLVER del servidor (kit-solver-multi-v1) se AUTO-AUDITÓ PASS porque honró
//  la colocación manual sin re-verificar bounds (strictPlacement). El VALIDADOR
//  INDEPENDIENTE (acomodoInvariantes) NO exime las manuales: debe cazar ambas
//  fallas y devolver FAIL. Esta prueba FIJA ese comportamiento: si alguien hace
//  que el validador independiente deje pasar una colocación manual fuera de
//  área, la colisión volvería a esconderse. Nunca debe pasar.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { evaluarInvariantesAcomodo } from './acomodoInvariantes.js';

const areas = [
  { nombre: 'OFICINA CEO', ancho: 4000, largo: 3200 },
  { nombre: 'SALA DE CONSEJO', ancho: 7000, largo: 3200 },
  { nombre: 'ÁREA OPERATIVA', ancho: 8000, largo: 3200 },
  { nombre: 'RECEPCIÓN', ancho: 4000, largo: 2400 },
];
const piezas = [
  { id: 'p-1-1', w: 6000, d: 1200 },          // la pieza larga, colocada manual + rot90
  { id: 'p-7-5', w: 600, d: 600 },            // silla operativa con la que choca
  { id: 'p-7-1', w: 600, d: 600 },
];
const colocacion = [
  { x: 1000, y: 1000, id: 'p-1-1', rot: 90, area: 2, manual: true, provenance: 'USER_CONFIRMED' },
  { x: 1450, y: 2200, id: 'p-7-5', rot: 0, area: 2 },
  { x: 1450, y: 400, id: 'p-7-1', rot: 0, area: 2 },
];

describe('ACOMODO · regresión 4859 (colisión manual fuera de área NO se esconde)', () => {
  it('el validador independiente caza OUT_OF_BOUNDS y OVERLAP de la pieza manual rotada', () => {
    const r = evaluarInvariantesAcomodo({ payload: { piezas, areas, requested: 3 }, plan: { colocacion } });
    const codes = (r.issues || []).map((i) => i.code);
    expect(r.status).toBe('FAIL');            // nunca render_ready con la colisión
    expect(r.render_ready).toBe(false);
    expect(codes).toContain('OUT_OF_BOUNDS'); // 6000 mm rotado no cabe en 3200 de fondo
    expect(codes).toContain('OVERLAP');       // choca con la silla
    const oob = (r.issues || []).find((i) => i.code === 'OUT_OF_BOUNDS');
    expect(String(oob.id)).toBe('p-1-1');     // la pieza manual, exactamente
  });

  it('control: la MISMA pieza sin rotar (6000 de ancho en área de 8000) sí cabe → sin OUT_OF_BOUNDS por esa pieza', () => {
    // rot0: 6000 de ancho cabe en 8000; 1200 de fondo cabe en 3200. (Sigue chocando con sillas si las pisa,
    // pero NO debe salir del área.) Aquí la aislamos para probar que el OOB era por la rotación+fondo, no por la pieza.
    const solo = [{ x: 1000, y: 1000, id: 'p-1-1', rot: 0, area: 2 }];
    const r = evaluarInvariantesAcomodo({ payload: { piezas: [{ id: 'p-1-1', w: 6000, d: 1200 }], areas, requested: 1 }, plan: { colocacion: solo } });
    const oob = (r.issues || []).filter((i) => i.code === 'OUT_OF_BOUNDS' && String(i.id) === 'p-1-1');
    expect(oob.length).toBe(0);
  });
});
