// VH-062: la auditoría del planner se MIDE; antes 'dentro de su cuarto', 'nada encimado' y
// 'servicios sin amueblar' eran ok:true fijos aunque el acomodo estuviera roto.
import { describe, it, expect } from 'vitest';
import { auditoriaMedida, acomodarLocal } from './planner.js';

const areas = [{ nombre: 'Operativa', ancho: 6000, largo: 4000 }, { nombre: 'Baños', ancho: 2000, largo: 2000 }];
const piezas = [
  { id: 'e1', nombre: 'Escritorio 1', tipo: 'escritorio', w: 1500, d: 700 },
  { id: 'e2', nombre: 'Escritorio 2', tipo: 'escritorio', w: 1500, d: 700 },
  { id: 'a1', nombre: 'Archivero', tipo: 'guarda', w: 500, d: 500 },
];
const cuartos = [{ servicio: false }, { servicio: true }];
const porCheck = (lista) => Object.fromEntries(lista.map((c) => [c.check, c]));

describe('auditoriaMedida', () => {
  it('acomodo limpio → los tres checks en ok', () => {
    const col = [{ id: 'e1', area: 0, x: 100, y: 100, rot: 0 }, { id: 'e2', area: 0, x: 100, y: 1500, rot: 0 }];
    const a = porCheck(auditoriaMedida({ areas, colocacion: col, piezas, cuartos }));
    expect(a['Cada mueble dentro de su cuarto'].ok).toBe(true);
    expect(a['Nada encimado'].ok).toBe(true);
    expect(a['Baños y servicios sin amueblar'].ok).toBe(true);
  });
  it('encimado, fuera de área y mueble en baño → cada check lo nombra en false', () => {
    const col = [
      { id: 'e1', area: 0, x: 100, y: 100, rot: 0 }, { id: 'e2', area: 0, x: 600, y: 300, rot: 0 },   // e2 se monta sobre e1
      { id: 'a1', area: 1, x: 1800, y: 1800, rot: 0 },                                                 // en Baños y se sale 300 mm
    ];
    const a = porCheck(auditoriaMedida({ areas, colocacion: col, piezas, cuartos }));
    expect(a['Nada encimado'].ok).toBe(false);
    expect(a['Nada encimado'].detalle).toMatch(/Escritorio 1 ↔ Escritorio 2/);
    expect(a['Cada mueble dentro de su cuarto'].ok).toBe(false);
    expect(a['Cada mueble dentro de su cuarto'].detalle).toMatch(/Archivero/);
    expect(a['Baños y servicios sin amueblar'].ok).toBe(false);
    expect(a['Baños y servicios sin amueblar'].detalle).toMatch(/Archivero/);
  });
  it('el planner real sale con los tres checks medidos en ok', () => {
    const r = acomodarLocal(areas, piezas.slice(0, 2), {});
    const a = porCheck(r.auditoria || []);
    expect(a['Nada encimado']?.ok).toBe(true);
    expect(a['Cada mueble dentro de su cuarto']?.ok).toBe(true);
    expect(a['Baños y servicios sin amueblar']?.ok).toBe(true);
  });
});
