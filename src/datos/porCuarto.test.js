import { describe, it, expect } from 'vitest';
import { listaPorCuarto, textoPorCuarto, puestosDe } from './porCuarto.js';

// ============================================================================
//  "QUE DIGA POR ESCRITO QUÉ VA EN CADA CUARTO (CON GAVETAS Y SILLAS)"
//  Las dos cosas que el dibujo NO puede decir son justo las que pidió Rodrigo:
//  la gaveta (vive bajo la cubierta, no se dibuja) y cuántas sillas quedaron.
// ============================================================================
const PARTIDAS = [
  { id: 'p1', nombre: 'Banca doble APP LT 1.50 · 10 usuarios', cantidad: 2, precioUnitario: 28540 },
  { id: 'p2', nombre: 'Modulor · Archivero 0.75 2 puertas', cantidad: 4, precioUnitario: 7722 },
  { id: 'p3', nombre: 'Eclipse · Escritorio directivo 2.40', cantidad: 1, precioUnitario: 31500 },
  { id: 'p4', nombre: 'Gaveta rodante Mox', cantidad: 6, precioUnitario: 4100 },
  { id: 'p5', nombre: 'Silla operativa WIN', cantidad: 8, precioUnitario: 5210 },
  { id: 'p6', nombre: 'Silla de visita CONCERTO', cantidad: 2, precioUnitario: 1950 },
];
const ACOMODO = {
  areas: [
    { nombre: 'Open space', tipo: 'open', ancho: 20000, largo: 12000 },
    { nombre: 'Dirección', tipo: 'privado', ancho: 4000, largo: 3500 },
  ],
  plan: {
    colocacion: [
      { id: 'p1-1', area: 0 }, { id: 'p1-2', area: 0 },
      { id: 'p2-1', area: 0 }, { id: 'p2-2', area: 0 }, { id: 'p2-3', area: 0 }, { id: 'p2-4', area: 0 },
      ...Array.from({ length: 8 }, (_, i) => ({ id: `p5-${i + 1}`, area: 0 })),
      { id: 'p3-1', area: 1 },
      { id: 'p6-1', area: 1 }, { id: 'p6-2', area: 1 },
    ],
  },
};

describe('qué va en cada cuarto', () => {
  const lista = listaPorCuarto(PARTIDAS, ACOMODO);
  const open = lista.find((c) => c.nombre === 'Open space');
  const dir = lista.find((c) => c.nombre === 'Dirección');

  it('cuenta los PUESTOS, no las bancas: 2 bancas de 10 son 20 personas', () => {
    expect(open.puestos).toBe(20);
    expect(puestosDe('Banca doble APP LT 1.50 · 10 usuarios', 2)).toBe(20);
    expect(puestosDe('Eclipse · Escritorio directivo 2.40')).toBe(1);
  });

  it('dice cuántas SILLAS hay en cada cuarto, y cuáles son de visita', () => {
    expect(open.sillas).toBe(8);
    expect(dir.sillas).toBe(2);
    expect(dir.visitas).toBe(2);
  });

  it('las GAVETAS salen escritas, con su aviso de que no ocupan piso', () => {
    const todas = lista.reduce((s, c) => s + c.gavetas, 0);
    expect(todas).toBe(6);
    const g = open.renglones.find((r) => /Gaveta/.test(r.nombre));
    expect(g.bajoCubierta).toBe(true);
    expect(g.nota).toMatch(/no ocupa piso/);
  });

  it('se lee en el orden de un proyectista: primero dónde se sienta la gente', () => {
    expect(open.renglones[0].nombre).toMatch(/Banca/);
    expect(open.renglones[open.renglones.length - 1].nombre).toMatch(/Gaveta/);
  });

  it('el titular del cuarto se lee de un vistazo', () => {
    expect(open.titular).toMatch(/20 puestos de trabajo/);
    expect(open.titular).toMatch(/8 sillas/);
    expect(open.titular).toMatch(/gavetas bajo la cubierta/);
    expect(dir.titular).toMatch(/2 sillas \(2 de visita\)/);
  });

  it('y se puede copiar como texto para mandarlo por correo', () => {
    const t = textoPorCuarto(lista, { cliente: 'ACME' });
    expect(t).toMatch(/^Proyecto: ACME/);
    expect(t).toMatch(/Open space \(240 m2\)/);
    expect(t).toMatch(/x Gaveta rodante Mox \[debajo de la cubierta/);
  });

  it('sin acomodo no inventa cuartos', () => {
    const l = listaPorCuarto(PARTIDAS, null);
    expect(l).toHaveLength(1);
    expect(l[0].sinUbicar).toBe(true);
  });
});
