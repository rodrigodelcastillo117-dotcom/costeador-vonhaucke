// VH-154 · RC: en un cuarto alargado la mesa de juntas se orienta con el lado largo del cuarto y las sillas de
// cabecera dejan ≥ 600 mm (reproduce el C1 "SALA DE JUNTAS 4×7 m" donde dos sillas quedaron a 200 mm).
import { describe, it, expect } from 'vitest';
import { resolverKits } from './kit-solver.js';
import { resolverKits as resolverProd } from '../acomodar-espacio-recovery/kit-solver.js';

const area = { nombre: 'SALA DE JUNTAS', tipo: 'juntas', ancho: 4000, largo: 7000, puertas: [] };
const piezas = () => [
  { id: 'mj', nombre: 'Mesa de juntas App LT', piezaId: 'mj-2400x1200', relation_role: 'ANCHOR_MEETING', instance_id: 'inst:mj', w: 2400, d: 1200, tipo: 'mesa', zone_id: 'SALA DE JUNTAS' },
  ...Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, nombre: 'Silla CONCERTO', piezaId: 'silla-concerto', relation_role: 'MEETING_SEAT', anchor_role: 'ANCHOR_MEETING', anchor_instance_id: 'inst:mj', w: 600, d: 600, tipo: 'asiento', zone_id: 'SALA DE JUNTAS' })),
];
// La colocación no trae w/d: las sillas son 600×600 (entrada). Holgura = piso libre entre el conjunto y los muros.
const holguraCabeceras = (col) => {
  const sillas = col.filter((c) => /^s\d/.test(String(c.id)));
  const mesa = col.find((c) => c.id === 'mj');
  const minX = Math.min(...sillas.map((c) => c.x)), maxX = Math.max(...sillas.map((c) => c.x + 600));
  const minY = Math.min(...sillas.map((c) => c.y)), maxY = Math.max(...sillas.map((c) => c.y + 600));
  return { rot: mesa?.rot, holguraX: Math.min(minX, 4000 - maxX), holguraY: Math.min(minY, 7000 - maxY) };
};
describe('orientación de la mesa de juntas en cuarto alargado (VH-154)', () => {
  it('RC: lado largo de la mesa con el lado largo del cuarto; holgura lateral ≥ 600 mm', () => {
    const r = resolverKits([area], piezas());
    const h = holguraCabeceras(r.colocacion || r.plan?.colocacion || []);
    expect(h.rot).toBe(90);
    expect(Math.min(h.holguraX, h.holguraY)).toBeGreaterThanOrEqual(600);
  });
  it('producción (referencia): toma la primera variante que cabe → rot 0 y una holgura de 200 mm (el defecto)', () => {
    const r = resolverProd([area], piezas());
    const h = holguraCabeceras(r.colocacion || r.plan?.colocacion || []);
    expect(h.rot).toBe(0);
    expect(Math.min(h.holguraX, h.holguraY)).toBeLessThan(600);
  });
});
