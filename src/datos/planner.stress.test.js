import { describe, it, expect } from 'vitest';
import { expandirPiezas } from './espacio.js';
import { acomodarLocal } from './planner.js';
import { violacionesSemanticas } from './floorSpec.js';

const catalogo = [
  { id: 'desk', nombre: 'Escritorio operativo 1.20', cantidad: 20, precioUnitario: 1, w: 1200, d: 750 },
  { id: 'chair', nombre: 'Silla operativa WIN', cantidad: 20, precioUnitario: 1, w: 600, d: 600 },
  { id: 'guard', nombre: 'Archivero guarda', cantidad: 6, precioUnitario: 1, w: 900, d: 450 },
  { id: 'meet', nombre: 'Mesa de juntas', cantidad: 2, precioUnitario: 1, w: 2600, d: 1200 },
  { id: 'recep', nombre: 'Módulo recepción', cantidad: 2, precioUnitario: 1, w: 2200, d: 800 },
];

const areas = [
  { nombre: 'Recepción', ancho: 6000, largo: 4500 },
  { nombre: 'Sala de Juntas 1', ancho: 6500, largo: 5000 },
  { nombre: 'Sala de Juntas 2', ancho: 6500, largo: 5000 },
  { nombre: 'Área Operativa 1', ancho: 12000, largo: 9000 },
  { nombre: 'Área Operativa 2', ancho: 12000, largo: 9000 },
  { nombre: 'Dirección', ancho: 5000, largo: 4500 },
];

const byId = (piezas) => Object.fromEntries(piezas.map((p) => [p.id, p]));
const firma = (r) => r.colocacion.map(({ id, area, x, y, rot }) => [id, area, x, y, rot]);

describe('VH-016 · hardening de acomodo complejo', () => {
  it('50 piezas: no truena, no duplica, no viola zonas y contabiliza honestamente el overflow', () => {
    const piezas = expandirPiezas(catalogo);
    expect(piezas).toHaveLength(50);

    const r = acomodarLocal(areas, piezas);
    const ids = r.colocacion.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(r.colocacion.length).toBeLessThanOrEqual(piezas.length);
    expect(violacionesSemanticas(r.colocacion, areas, byId(piezas))).toHaveLength(0);

    const check = r.auditoria.find((a) => a.check === 'Todas las piezas colocadas');
    expect(check).toBeTruthy();
    expect(check.detalle).toBe(`${r.colocacion.length} de ${piezas.length}`);
    expect(r.caben).toBe(r.colocacion.length === piezas.length);
    if (!r.caben) {
      expect(r.notas.join(' ')).toMatch(/no caben/i);
      expect(r.resumen).toMatch(/Caben \d+ de 50/i);
    }
  });

  it('es determinista: mismo plano + mismas piezas ⇒ mismo acomodo', () => {
    const piezas = expandirPiezas(catalogo);
    expect(firma(acomodarLocal(areas, piezas))).toEqual(firma(acomodarLocal(areas, piezas)));
  });

  it('flujo 1-clic ajustable con 50 piezas crece el espacio y no pierde ninguna', () => {
    const piezas = expandirPiezas(catalogo);
    const r = acomodarLocal([{ nombre: 'Mi espacio', ancho: 6000, largo: 4000 }], piezas, { ajustar: true });
    expect(r.colocacion).toHaveLength(50);
    expect(new Set(r.colocacion.map((c) => c.id)).size).toBe(50);
    expect(r.auditoria.find((a) => a.check === 'Todas las piezas colocadas')?.ok).toBe(true);
  });
});
