import { describe, it, expect } from 'vitest';
import { escenasDeAcomodo, descripcionDeEscena, lineasDeEscena, tipoDeEscena } from './escenas.js';

const partidas = [
  { id: 'p1', nombre: 'Eclipse Escritorio Directivo 2.40 m', cantidad: 6, ruta: 'eclipse', productoId: 'escritorio' },
  { id: 'p2', nombre: 'Banca doble APP LT 1.20 · 6 usuarios', cantidad: 2, ruta: 'applt', productoId: 'banca_doble' },
  { id: 'p3', nombre: 'Silla directiva ALPHA', cantidad: 12 },
];
const areas = [
  { nombre: 'Open space', ancho: 9000, largo: 6000 },
  { nombre: 'Privado Dirección', ancho: 4000, largo: 3500 },
  { nombre: 'Baños', ancho: 3000, largo: 2000 },
];
const acomodo = {
  areas,
  plan: {
    colocacion: [
      { id: 'p2-1', area: 0, x: 500, y: 500, rot: 0 },
      { id: 'p2-2', area: 0, x: 500, y: 3000, rot: 0 },
      { id: 'p3-1', area: 0, x: 100, y: 100, rot: 0 },
      { id: 'p1-1', area: 1, x: 400, y: 400, rot: 0 },
      { id: 'p1-2', area: 1, x: 2200, y: 400, rot: 0 },
      { id: 'p3-2', area: 2, x: 100, y: 100, rot: 0 },   // en el baño: se ignora
    ],
  },
};

describe('escenas por área', () => {
  it('arma una escena por cada área CON muebles, y ninguna del baño', () => {
    const e = escenasDeAcomodo(partidas, acomodo);
    expect(e.map((x) => x.nombre)).toEqual(['Open space', 'Privado Dirección']);
  });

  it('cuenta las piezas que de verdad quedaron en cada cuarto', () => {
    const [open, privado] = escenasDeAcomodo(partidas, acomodo);
    expect(open.piezas.find((p) => p.id === 'p2').cantidad).toBe(2);
    expect(open.piezas.find((p) => p.id === 'p3').cantidad).toBe(1);
    // Las 6 de la partida son 6, pero en ESTE cuarto sólo cayeron 2.
    expect(privado.piezas.find((p) => p.id === 'p1').cantidad).toBe(2);
  });

  it('el recorte trae SOLO la colocación de su área, reindexada a 0', () => {
    const [, privado] = escenasDeAcomodo(partidas, acomodo);
    expect(privado.recorte.areas).toHaveLength(1);
    expect(privado.recorte.plan.colocacion).toHaveLength(2);
    expect(privado.recorte.plan.colocacion.every((c) => c.area === 0)).toBe(true);
  });

  it('la descripción nombra la LÍNEA, que es lo que no le llegaba al modelo', () => {
    const [, privado] = escenasDeAcomodo(partidas, acomodo);
    expect(privado.descripcion).toMatch(/Eclipse/);
    expect(privado.descripcion).toMatch(/4\.00 × 3\.50 m/);
  });

  it('las piezas van de mayor a menor cantidad: si hay que recortar, se caen los accesorios', () => {
    const [open] = escenasDeAcomodo(partidas, acomodo);
    expect(open.piezas[0].cantidad).toBeGreaterThanOrEqual(open.piezas[1].cantidad);
  });

  it('sabe qué tipo de cuarto es, para escoger la cámara', () => {
    expect(tipoDeEscena('Sala de juntas 12')).toBe('sala de juntas');
    expect(tipoDeEscena('Privado Dirección')).toBe('oficina privada');
    expect(tipoDeEscena('Recepción')).toBe('recepción');
    expect(tipoDeEscena('Open space')).toBe('open space');
  });

  it('lista las líneas presentes, sin repetir', () => {
    const [open] = escenasDeAcomodo(partidas, acomodo);
    expect(lineasDeEscena(open)).toEqual(['applt']);
  });

  it('sin acomodo no inventa escenas', () => {
    expect(escenasDeAcomodo(partidas, null)).toEqual([]);
    expect(escenasDeAcomodo(partidas, { areas, plan: { colocacion: [] } })).toEqual([]);
    expect(escenasDeAcomodo([], acomodo)).toEqual([]);
  });

  it('ignora piezas colocadas cuya partida ya no existe', () => {
    const roto = { areas, plan: { colocacion: [{ id: 'borrada-1', area: 0, x: 0, y: 0 }] } };
    expect(escenasDeAcomodo(partidas, roto)).toEqual([]);
  });

  it('descripcionDeEscena aguanta un área sin medidas', () => {
    expect(descripcionDeEscena('Open', {}, [{ nombre: 'X', cantidad: 1 }])).toBe('Open: 1× X.');
  });
});

// VH-121 · lo que viaja al modelo además del dibujo: medidas por pieza, sillas, esperados e imagen de referencia.
describe('VH-121 · escenas con geometría y referencias', () => {
  const partidas121 = [
    { id: 'r1', nombre: 'Recepción (2420 × 830 mm)', cantidad: 1, w: 2420, d: 830, piezaId: 'p9-recepcion-29920', deBanco: true },
    { id: 'g1', nombre: 'Mox · Gaveta pedestal 3 cajones', cantidad: 2, w: 380, d: 456, ruta: 'mox', productoId: 'pedestal' },
    { id: 'v1', nombre: 'Silla de visita · CONCERTO', cantidad: 2, w: 600, d: 600, piezaId: 'p9-silla-de-visita-concerto-5470', deBanco: true },
    { id: 'e1', nombre: 'Eclipse Escritorio Directivo 2.10 m', cantidad: 1, w: 2100, d: 900, ruta: 'eclipse', productoId: 'escritorio' },
  ];
  const acomodo121 = {
    areas: [{ nombre: 'RECEPCIÓN', ancho: 5000, largo: 3500 }, { nombre: 'OFICINA CEO', ancho: 4500, largo: 4000 }],
    plan: { colocacion: [
      { id: 'r1-1', area: 0, x: 0, y: 0, rot: 0 }, { id: 'v1-1', area: 0, x: 100, y: 100, rot: 0 }, { id: 'v1-2', area: 0, x: 800, y: 100, rot: 0 },
      { id: 'e1-1', area: 1, x: 0, y: 0, rot: 0 }, { id: 'g1-1', area: 1, x: 100, y: 1000, rot: 0 }, { id: 'g1-2', area: 1, x: 600, y: 1000, rot: 0 },
    ] },
  };
  const esc = escenasDeAcomodo(partidas121, acomodo121);
  it('cada pieza lleva huella real; los esperados son sólo de piso; las sillas se cuentan aparte', () => {
    const rec = esc.find((e) => e.nombre === 'RECEPCIÓN');
    expect(rec.pisoTotal).toBe(1); expect(rec.sillas).toBe(2);
    expect(rec.esperados).toEqual([{ nombre: 'Recepción (2420 × 830 mm)', cantidad: 1, tipo: expect.any(String), w: 2420, d: 830 }]);
    const ceo = esc.find((e) => e.nombre === 'OFICINA CEO');
    expect(ceo.pisoTotal).toBe(3); expect(ceo.sillas).toBe(0);
    expect(ceo.esperados.map((p) => [p.cantidad, p.w, p.d])).toEqual([[2, 380, 456], [1, 2100, 900]]);
  });
  it('la descripción dice medidas por pieza y el número exacto de sillas', () => {
    const rec = esc.find((e) => e.nombre === 'RECEPCIÓN');
    expect(rec.descripcion).toBe('RECEPCIÓN (5.00 × 3.50 m): 1× Recepción (2420 × 830 mm) (2.42 × 0.83 m), sillas: 2× Silla de visita · CONCERTO.');
    const ceo = esc.find((e) => e.nombre === 'OFICINA CEO');
    expect(ceo.descripcion).toContain('2× Mox · Gaveta pedestal 3 cajones (0.38 × 0.46 m)');
    expect(ceo.descripcion).toContain('1× Eclipse Escritorio Directivo 2.10 m (2.10 × 0.90 m)');
  });
  it('la imagen de referencia se resuelve con imagenPartida: línea+producto, silla del banco; sin evidencia → null (no se inventa)', () => {
    const ceo = esc.find((e) => e.nombre === 'OFICINA CEO');
    expect(ceo.piezas.find((p) => p.id === 'e1').imagen).toMatch(/eclipse/);
    const rec = esc.find((e) => e.nombre === 'RECEPCIÓN');
    expect(typeof rec.piezas.find((p) => p.id === 'v1').imagen === 'string' || rec.piezas.find((p) => p.id === 'v1').imagen === null).toBe(true);
    const [sin] = escenasDeAcomodo([{ id: 'x', nombre: 'Mueble sin ficha', cantidad: 1, w: 1000, d: 500 }], { areas: [{ nombre: 'A', ancho: 3000, largo: 3000 }], plan: { colocacion: [{ id: 'x-1', area: 0, x: 0, y: 0, rot: 0 }] } });
    expect(sin.piezas[0].imagen).toBe(null);
  });
});
