// ============================================================================
//  Cierre ChatGPT · P1-ARQ-01 (corpus C7): el lector contó 8 donde el plano dibuja 16 ESCRITORIOS (sólo la mitad con
//  silla). Escritorio físico, silla física y puesto son detecciones distintas: los puestos salen de los ESCRITORIOS y
//  nunca se reducen porque haya menos sillas dibujadas; la diferencia se dice ("capacidad por confirmar").
// ============================================================================
import { describe, it, expect } from 'vitest';
import { areasDeLectura, revisarAreas } from './planoLeido.js';

const lectura = (area) => ({ envolvente: { ancho: 24000, largo: 14000 }, areas: [{ nombre: 'OPERATIVA', tipo: 'open', forma: 'poligono',
  puntos: [{ x: 0, y: 7000 }, { x: 12000, y: 7000 }, { x: 12000, y: 14000 }, { x: 0, y: 14000 }], circulo: { cx: 0, cy: 0, r: 0 }, dentroDe: '', asientos: 0, confianza: 'alta', ...area }] });

describe('P1-ARQ-01 · puestos = escritorios observados (no sillas)', () => {
  it('16 escritorios y 8 sillas dibujadas → 16 puestos', () => {
    const { areas: [a] } = areasDeLectura(lectura({ puestos: 8, escritorios: 16, sillas: 8 }));
    expect(a.puestos).toBe(16);
    expect(a.escritorios).toBe(16);
    expect(a.sillasDibujadas).toBe(8);
  });
  it('la diferencia se dice al confirmar la lectura: 16 escritorios, 8 sillas, capacidad por confirmar', () => {
    const p = revisarAreas(lectura({ puestos: 8, escritorios: 16, sillas: 8 })).join(' ');
    expect(p).toMatch(/OPERATIVA.*16 escritorios.*8 sillas.*capacidad por confirmar/);
  });
  it('lector viejo (sin escritorios): se respeta puestos como antes', () => {
    expect(areasDeLectura(lectura({ puestos: 12 })).areas[0].puestos).toBe(12);
  });
  it('escritorios = sillas: sin aviso', () => {
    expect(revisarAreas(lectura({ puestos: 16, escritorios: 16, sillas: 16 })).join(' ')).not.toMatch(/capacidad por confirmar/);
  });
});
