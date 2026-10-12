// ============================================================================
//  LA SILLA SE SIENTA EN SU PUESTO.
//
//  Esto no lo veía NINGUNA de las 186 pruebas: el motor colocaba las sillas como
//  cajas y en el plano que recibe el cliente quedaban de 1.8 a 5.5 m de la banca
//  a la que pertenecen. Salió MIRANDO el PDF, no leyendo el código.
//
//  Las tres cosas que hay que cuidar:
//    1. que la silla acabe pegada a una superficie de trabajo,
//    2. que una banca DOBLE tenga puestos de los dos lados (si no, la mitad de
//       una banca de 6 usuarios queda inservible),
//    3. que sentarlas no haga que quepan MENOS muebles.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { expandirPiezas, dimsPieza } from './espacio.js';
import { acomodarLocal } from './planner.js';
import { puestosDe } from './rellenar.js';

const BANCA = { id: 'b', nombre: 'Banca doble APP LT 1.50 · 6 usuarios', cantidad: 2, precioUnitario: 1, w: 4500, d: 1200, ruta: 'applt' };
const SILLA = { id: 's', nombre: 'Silla operativa WIN', cantidad: 12, precioUnitario: 1, w: 600, d: 600 };
const ARCH = { id: 'a', nombre: 'Archivero Modulor 1.20 · 2 cajones', cantidad: 2, precioUnitario: 1, w: 1200, d: 450, ruta: 'modulor' };

function acomodar(partidas, ancho = 12000, largo = 8000) {
  const piezas = expandirPiezas(partidas);
  const byId = Object.fromEntries(piezas.map((p) => [p.id, p]));
  const r = acomodarLocal([{ nombre: 'Open space', ancho, largo }], piezas, {});
  const huella = (c) => {
    const { pw, ph } = dimsPieza(byId[c.id], c.rot || 0);
    return { x: c.x, y: c.y, w: pw, d: ph, nombre: byId[c.id].nombre };
  };
  return { r, piezas, cajas: r.colocacion.map(huella) };
}

// Distancia entre rectángulos: 0 si se tocan.
const dist = (a, b) => Math.round(Math.hypot(
  Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w))),
  Math.max(0, Math.max(a.y - (b.y + b.d), b.y - (a.y + a.d))),
));

describe('la silla se sienta en su puesto', () => {
  it('las sillas operativas quedan pegadas a una superficie de trabajo', () => {
    const { cajas } = acomodar([BANCA, SILLA, ARCH]);
    const sillas = cajas.filter((c) => /silla/i.test(c.nombre));
    const mesas = cajas.filter((c) => /banca/i.test(c.nombre));
    expect(sillas.length).toBe(12);
    const sentadas = sillas.filter((s) => Math.min(...mesas.map((m) => dist(s, m))) <= 300);
    // 2 bancas dobles = 12 puestos para 12 sillas: se sientan TODAS.
    expect(sentadas.length).toBe(12);
  });

  it('una banca DOBLE ofrece puestos de los dos lados', () => {
    // 4500×1200 con fondo > 1000 = bench doble: 3 puestos por hilera, 2 hileras.
    const puestos = puestosDe({ rot: 0 }, { x: 0, y: 2000, w: 4500, d: 1200 }, 600, 600);
    expect(puestos.length).toBe(6);
    const ys = [...new Set(puestos.map((p) => p.y))];
    expect(ys.length).toBe(2);                       // dos hileras, no una
    // Una arriba de la cubierta y otra abajo.
    expect(Math.min(...ys)).toBeLessThan(2000);
    expect(Math.max(...ys)).toBeGreaterThan(2000 + 1200);
  });

  it('un escritorio sencillo sigue teniendo UN solo lado', () => {
    // 2100×900: fondo ≤ 1000, no es bench. No se le puede sentar gente atrás.
    const puestos = puestosDe({ rot: 0 }, { x: 0, y: 0, w: 2100, d: 900 }, 600, 600);
    expect([...new Set(puestos.map((p) => p.y))].length).toBe(1);
  });

  it('sentarlas NO hace que quepan menos muebles', () => {
    // El caso denso que se rompió al subir la holgura: 4 bancas dobles (24
    // puestos) en 12 × 8 m. El empacador le apartaba piso propio a cada silla
    // aunque fuera a acabar bajo la cubierta, y reportaba "no caben 7".
    const { r, piezas } = acomodar([{ ...BANCA, cantidad: 4 }, { ...SILLA, cantidad: 24 }, ARCH]);
    expect(r.colocacion.length).toBe(piezas.length);
    expect(r.caben).toBe(true);
    // Y el cartel tiene que decir la verdad, no quedarse con el conteo viejo.
    const check = r.auditoria.find((a) => a.check === 'Todas las piezas colocadas');
    expect(check.ok).toBe(true);
    expect(check.detalle).toBe(`${piezas.length} de ${piezas.length}`);
  });

  it('nada se encima ni se sale del cuarto al sentarlas', () => {
    const { cajas } = acomodar([{ ...BANCA, cantidad: 4 }, { ...SILLA, cantidad: 24 }, ARCH]);
    for (const c of cajas) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(12000);
      expect(c.y + c.d).toBeLessThanOrEqual(8000);
    }
    for (let i = 0; i < cajas.length; i++) {
      for (let j = i + 1; j < cajas.length; j++) {
        const a = cajas[i], b = cajas[j];
        const encima = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.d && a.y + a.d > b.y;
        expect(encima, `se enciman: ${a.nombre} y ${b.nombre}`).toBe(false);
      }
    }
  });

});


describe('sillas · vínculo de grupo funcional', () => {
  it('dos sillas agrupadas no intercambian escritorios dentro del mismo cuarto', () => {
    const partidas = [
      { id:'da', nombre:'Escritorio operativo A', cantidad:1, w:1600, d:800, functional_group_id:'fg-a', relation_role:'ANCHOR_WORKSTATION' },
      { id:'db', nombre:'Escritorio operativo B', cantidad:1, w:1600, d:800, functional_group_id:'fg-b', relation_role:'ANCHOR_WORKSTATION' },
      { id:'ca', nombre:'Silla operativa A', cantidad:1, w:600, d:600, functional_group_id:'fg-a', relation_role:'WORK_SEAT', anchor_role:'ANCHOR_WORKSTATION' },
      { id:'cb', nombre:'Silla operativa B', cantidad:1, w:600, d:600, functional_group_id:'fg-b', relation_role:'WORK_SEAT', anchor_role:'ANCHOR_WORKSTATION' },
    ];
    const piezas = expandirPiezas(partidas);
    const byId = Object.fromEntries(piezas.map((p) => [p.id,p]));
    const r = acomodarLocal([{ nombre:'Área Operativa', ancho:9000, largo:6000 }], piezas);
    const ca = r.colocacion.find((x) => x.id === 'ca-1');
    const cb = r.colocacion.find((x) => x.id === 'cb-1');
    expect(byId[ca.anchor_id].functional_group_id).toBe('fg-a');
    expect(byId[cb.anchor_id].functional_group_id).toBe('fg-b');
  });
});
