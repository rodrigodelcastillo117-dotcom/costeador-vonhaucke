// ============================================================================
//  LAS GAVETAS SE REPARTEN, NO SE AMONTONAN
//  ---------------------------------------------------------------------------
//  Rodrigo, 2026-08-18, viendo la app: "las sillas y gavetas nunca se ponen
//  bien". Medido con su plano (5 privados con escritorio + 5 archiveros de
//  piso): la 2a pasada del acomodo metia LOS CINCO archiveros en el primer
//  cuarto con hueco -el Privado 1-, y las otras cuatro oficinas sin el suyo.
//
//  EL HUECO QUE LO DEJO PASAR: el guardian del plano (planoDeRodrigo.test.js)
//  NO incluye gavetas en su lista de muebles, asi que este bug nunca se veia.
//  Aqui si van, y con esto queda cubierto.
//
//  Esta prueba cuida el REPARTO (cada oficina recibe su gaveta). El pegado
//  a-ras del escritorio (0 cm en vez de ~80 cm) es un segundo paso: hoy la
//  holgura reservada del escritorio impide pegarla del todo. Lo que esta
//  prueba garantiza es lo que Rodrigo veia peor: que no se amontonen.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { expandirPiezas, dimsPieza, tipoDe } from './espacio.js';
import { acomodarLocal } from './planner.js';

const PASILLO = 'Pasillo de circulación / Área abierta';
const AREAS_M = [
  { nombre: 'Privado 1', tipo: 'privado', ancho: 4.5, largo: 5 },
  { nombre: 'Privado 2', tipo: 'privado', ancho: 3.5, largo: 6 },
  { nombre: 'Privado 3', tipo: 'privado', ancho: 5, largo: 5 },
  { nombre: 'Privado 4', tipo: 'privado', ancho: 4, largo: 5.5 },
  { nombre: 'Privado 5', tipo: 'privado', ancho: 5, largo: 5.5 },
  { nombre: 'Sala Juntas 1', tipo: 'juntas', ancho: 7, largo: 6 },
  { nombre: 'Sala Juntas 2', tipo: 'juntas', ancho: 7, largo: 5 },
  { nombre: 'Recepción', tipo: 'recepcion', ancho: 7, largo: 8 },
  { nombre: PASILLO, tipo: 'open', ancho: 23, largo: 14, contiene: 8 },
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ nombre: `Área Op. ${n}`, tipo: 'open', ancho: 4.5, largo: 3.5, dentroDe: PASILLO })),
];
const aMM = (as) => as.map((a) => ({ ...a, ancho: Math.round(a.ancho * 1000), largo: Math.round(a.largo * 1000) }));

const partidas = [
  { id: 'b', nombre: 'Banca doble APP LT 1.50 · 6 usuarios', cantidad: 8, precioUnitario: 1, w: 4500, d: 1200, ruta: 'applt' },
  { id: 'so', nombre: 'Silla operativa · GAMMA-E', cantidad: 48, precioUnitario: 1, w: 600, d: 600 },
  { id: 'e', nombre: 'Eclipse Escritorio Directivo 2.10 m', cantidad: 5, precioUnitario: 1, w: 2100, d: 900, ruta: 'eclipse' },
  { id: 'sd', nombre: 'Silla directiva ALPHA', cantidad: 5, precioUnitario: 1, w: 650, d: 650 },
  { id: 'sv', nombre: 'Silla de visita · CONCERTO', cantidad: 10, precioUnitario: 1, w: 550, d: 550 },
  { id: 'arc', nombre: 'Archivero de piso 2 gavetas', cantidad: 5, precioUnitario: 1, w: 900, d: 450 },
  { id: 'mj0', nombre: 'Mesa de juntas APP LT 10 personas', cantidad: 1, precioUnitario: 1, w: 3000, d: 1200, ruta: 'applt' },
  { id: 'mj1', nombre: 'Mesa de juntas APP LT 8 personas', cantidad: 1, precioUnitario: 1, w: 2600, d: 1200, ruta: 'applt' },
  { id: 'mos', nombre: 'Recepción · mostrador', cantidad: 1, precioUnitario: 1, w: 2420, d: 830 },
];

const piezas = expandirPiezas(partidas);
const byId = Object.fromEntries(piezas.map((p) => [p.id, p]));
const areasMM = aMM(AREAS_M);
const plan = acomodarLocal(areasMM, piezas, {});
const cajas = plan.colocacion.map((c) => {
  const { pw, ph } = dimsPieza(byId[c.id], c.rot || 0);
  return { x: c.x, y: c.y, w: pw, d: ph, area: c.area, tipo: tipoDe(byId[c.id]), nombre: byId[c.id].nombre };
});
const guardas = cajas.filter((c) => c.tipo === 'guarda');
const solapa = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.d && a.y + a.d > b.y;

describe('gavetas en el plano de Rodrigo', () => {
  it('los 5 archiveros SE COLOCAN', () => {
    expect(guardas.length).toBe(5);
  });
  it('NO se amontonan: caen en cuartos distintos, uno por oficina', () => {
    const areasConGuarda = new Set(guardas.map((g) => g.area));
    expect(areasConGuarda.size, 'los archiveros se amontonaron en pocos cuartos').toBeGreaterThanOrEqual(4);
  });
  it('ninguna gaveta cae en una sala de juntas', () => {
    const salas = areasMM.map((a, i) => (a.tipo === 'juntas' ? i : -1)).filter((i) => i >= 0);
    for (const g of guardas) expect(salas.includes(g.area), 'gaveta en sala de juntas').toBe(false);
  });
  it('cada gaveta cae en un cuarto que TIENE una estacion a la cual servir', () => {
    for (const g of guardas) {
      const hayEstacion = cajas.some((c) => c.area === g.area
        && (c.tipo === 'escritorio' || /banca|bench/i.test(c.nombre)));
      expect(hayEstacion, `gaveta en un cuarto sin estacion (area ${g.area})`).toBe(true);
    }
  });
  it('nada se encima', () => {
    for (let i = 0; i < cajas.length; i++) {
      for (let j = i + 1; j < cajas.length; j++) {
        if (cajas[i].area === cajas[j].area && solapa(cajas[i], cajas[j])) {
          throw new Error(`encimados: ${cajas[i].nombre} y ${cajas[j].nombre}`);
        }
      }
    }
  });
});
