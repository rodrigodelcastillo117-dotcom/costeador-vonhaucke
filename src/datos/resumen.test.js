import { describe, it, expect } from 'vitest';
import { resumenPorArea, especificacion } from './resumen.js';

// Un proyecto como los de verdad: open space con bancas y guardas, un privado
// con su escritorio, y una gaveta que no pide piso (no la coloca el acomodo).
const PARTIDAS = [
  { id: 'p1', nombre: 'Banca doble APP LT 1.50 · 10 usuarios', cantidad: 2, precioUnitario: 28540 },
  { id: 'p2', nombre: 'Modulor · Archivero 0.75 2 puertas', cantidad: 6, precioUnitario: 7722 },
  { id: 'p3', nombre: 'Eclipse · Escritorio directivo 2.40', cantidad: 1, precioUnitario: 31500 },
  { id: 'p4', nombre: 'Gaveta rodante', cantidad: 4, precioUnitario: 4100 },
];

const ACOMODO = {
  areas: [
    { nombre: 'Sala Operativa', tipo: 'open', ancho: 20000, largo: 12000 },
    { nombre: 'Dirección', tipo: 'privado', ancho: 4000, largo: 3500 },
  ],
  plan: {
    colocacion: [
      { id: 'p1-1', area: 0 }, { id: 'p1-2', area: 0 },
      { id: 'p2-1', area: 0 }, { id: 'p2-2', area: 0 }, { id: 'p2-3', area: 0 },
      { id: 'p2-4', area: 0 }, { id: 'p2-5', area: 0 }, { id: 'p2-6', area: 0 },
      { id: 'p3-1', area: 1 },
    ],
  },
};

describe('resumen por área', () => {
  const r = resumenPorArea(PARTIDAS, ACOMODO);

  it('agrupa por cuarto y da el TOTAL de cada uno', () => {
    const operativa = r.find((b) => b.nombre === 'Sala Operativa');
    expect(operativa).toBeTruthy();
    // 2 bancas + 6 archiveros + las 3 gavetas que van bajo esas cubiertas
    expect(operativa.total).toBe(2 * 28540 + 6 * 7722 + 3 * 4100);
    const direccion = r.find((b) => b.nombre === 'Dirección');
    expect(direccion.total).toBe(31500 + 4100);   // su escritorio y su gaveta
  });

  it('dice los m² del área', () => {
    expect(r.find((b) => b.nombre === 'Sala Operativa').m2).toBe(240);
    expect(r.find((b) => b.nombre === 'Dirección').m2).toBe(14);
  });

  it('ordena los renglones por importe, de mayor a menor', () => {
    const op = r.find((b) => b.nombre === 'Sala Operativa');
    expect(op.renglones[0].nombre).toMatch(/Banca/);
  });

  // ⚠️ ESTO DECÍA QUE LAS 4 GAVETAS IBAN A "Sin ubicar en el plano".
  // Nunca fue verdad: una gaveta rodante no está en el limbo, está DEBAJO de la
  // cubierta de un escritorio, en el cuarto de ese escritorio. Lo que la prueba
  // cuidaba de verdad —que no se pierda ninguna— lo cuida la de más abajo (la
  // suma de las áreas es el total). Aquí ahora se comprueba que se UBICAN.
  it('las gavetas se ubican con los escritorios a los que sirven', () => {
    expect(r.find((b) => b.sinUbicar)).toBeUndefined();
    const gavetas = r.flatMap((b) => b.renglones.filter((x) => /Gaveta/.test(x.nombre)).map((x) => [b.nombre, x.cantidad]));
    // 4 gavetas repartidas entre los 2 escritorios de la Operativa y el 1 de Dirección.
    expect(gavetas.reduce((s, [, n]) => s + n, 0)).toBe(4);
    expect(gavetas.every(([nombre]) => nombre === 'Sala Operativa' || nombre === 'Dirección')).toBe(true);
    expect(r.flatMap((b) => b.renglones).find((x) => /Gaveta/.test(x.nombre)).bajoCubierta).toBe(true);
  });

  it('y lo que de plano no cupo SÍ sigue saliendo aparte', () => {
    const conSobrante = resumenPorArea(
      [...PARTIDAS, { id: 'p5', nombre: 'Sillón de espera', cantidad: 3, precioUnitario: 9000 }],
      ACOMODO,
    );
    const sueltas = conSobrante.find((b) => b.sinUbicar);
    expect(sueltas.total).toBe(3 * 9000);
  });

  it('la suma de las áreas es el total de la propuesta', () => {
    const totalPropuesta = PARTIDAS.reduce((s, p) => s + p.precioUnitario * p.cantidad, 0);
    expect(r.reduce((s, b) => s + b.total, 0)).toBe(totalPropuesta);
  });

  it('sin acomodo no inventa áreas', () => {
    expect(resumenPorArea(PARTIDAS, null)).toEqual([
      expect.objectContaining({ sinUbicar: true }),
    ]);
  });

  it('sin partidas devuelve vacío', () => {
    expect(resumenPorArea([], ACOMODO)).toEqual([]);
  });
});

describe('especificación del área', () => {
  it('describe el área por lo que tiene', () => {
    const r = resumenPorArea(PARTIDAS, ACOMODO);
    const op = r.find((b) => b.nombre === 'Sala Operativa');
    expect(especificacion(op)).toMatch(/2 × Banca doble APP LT 1.50/);
    expect(especificacion(op)).toMatch(/6 × Modulor/);
  });
});


describe('resumen por área · precio desconocido', () => {
  it('no suma una partida sin precio como $0', () => {
    const partidas=[
      {id:'p1',nombre:'Escritorio',cantidad:1,precioUnitario:null},
    ];
    const acomodo={
      areas:[{nombre:'Privado',tipo:'privado',ancho:4000,largo:3500}],
      plan:{colocacion:[{id:'p1-1',area:0}]},
    };
    const r=resumenPorArea(partidas,acomodo);
    expect(r[0].renglones[0].unitario).toBeNull();
    expect(r[0].renglones[0].importe).toBeNull();
    expect(r[0].total).toBeNull();
    expect(r[0].incompleto).toBe(true);
  });
});
