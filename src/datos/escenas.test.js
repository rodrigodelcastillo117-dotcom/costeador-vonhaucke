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
