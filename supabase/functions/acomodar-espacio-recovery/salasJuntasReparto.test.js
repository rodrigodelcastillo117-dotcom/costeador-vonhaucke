// ============================================================================
//  Prueba de Rodrigo 2026-10-19 (cotización 3354): dos mesas de juntas SIN sala asignada (2.40 × 1.20 y 1.80 × 1.20)
//  con dos salas de juntas en el plano (SALA DE CONSEJO 7 × 5, 10 asientos; SALA CREATIVA 6 × 5, 6 asientos). El solver
//  metió LAS DOS en la sala de consejo (cabían) y dejó vacía la creativa. Regla: una mesa por sala de juntas, la más
//  grande en la sala con más asientos/área; si no cabe, las demás salas siguen siendo opción (no se pierde factibilidad).
// ============================================================================
import { describe, it, expect } from 'vitest';
import { construirRespuestaAcomodo } from './recoveryPipeline.js';

const sala = (nombre, ancho, largo, asientos) => ({ nombre, tipo: 'juntas', x: 0, y: 0, ancho, largo, asientos, puertas: [], obstaculos: [] });
const mesa = (id, w, d, cap) => ({ id, nombre: `Mesa de juntas APP LT ${w / 1000} × ${d / 1000}`, w, d, tipo: 'juntas', relation_role: 'ANCHOR_MEETING', functional_group_id: `fg:${id}`, user_capacity: cap, capacity_source: 'CATALOGO' });
const sillas = (fg, n) => Array.from({ length: n }, (_, i) => ({ id: `${fg}-s${i}`, nombre: 'Silla · SONATA', w: 600, d: 600, tipo: 'silla', relation_role: 'MEETING_SEAT', anchor_role: 'ANCHOR_MEETING', functional_group_id: `fg:${fg}` }));

describe('mesas de juntas sin sala: una por sala', () => {
  it('2.40 → SALA DE CONSEJO y 1.80 → SALA CREATIVA', () => {
    const areas = [sala('SALA DE CONSEJO', 7000, 5000, 10), sala('SALA CREATIVA', 6000, 5000, 6)];
    const piezas = [mesa('mj24', 2400, 1200, 8), ...sillas('mj24', 8), mesa('mj18', 1800, 1200, 6), ...sillas('mj18', 6)];
    const r = construirRespuestaAcomodo(areas, piezas);
    const areaDe = (id) => r.layoutSpec.placements.find((c) => c.id === id)?.area;
    expect([areaDe('mj24'), areaDe('mj18')]).toEqual([0, 1]);
    expect(r.layoutSpec.placed).toBe(16);
  });
  it('si la sala "natural" no la admite, la mesa sigue pudiendo ir a otra sala', () => {
    const areas = [sala('SALA CHICA', 2500, 2500, 4), sala('SALA GRANDE', 9000, 6000, 12)];
    const piezas = [mesa('mj24', 2400, 1200, 8), ...sillas('mj24', 8), mesa('mj18', 1800, 1200, 6), ...sillas('mj18', 6)];
    const r = construirRespuestaAcomodo(areas, piezas);
    const areaDe = (id) => r.layoutSpec.placements.find((c) => c.id === id)?.area;
    expect(areaDe('mj24')).toBe(1);                 // la grande en la sala grande
    expect(r.layoutSpec.placed).toBeGreaterThanOrEqual(9);
  });
});
