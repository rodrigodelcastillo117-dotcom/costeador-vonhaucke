import { describe, it, expect } from 'vitest';
import { areasDeLectura, revisarAreas, contornoMM, areaM2 } from './planoLeido.js';

// ---------------------------------------------------------------------------
//  El plano REAL de Rodrigo (Plano_Organico_Con_Medidas.pdf, 2026-08-16):
//  30 × 20 m, sala de juntas CIRCULAR de Ø7 m dentro del open space, recepción
//  TRIANGULAR, break room TRAPEZOIDAL y cinco oficinas detrás de un muro CURVO.
//  Es el caso que la versión anterior dibujaba como nueve cajas rectas
//  encimadas, así que es el que tienen que cubrir las pruebas.
// ---------------------------------------------------------------------------
const PLANO = {
  envolvente: { ancho: 30000, largo: 20000 },
  tieneCotas: true,
  areas: [
    {
      nombre: 'ÁREA OPERATIVA', tipo: 'open', forma: 'poligono', dentroDe: '', confianza: 'media',
      circulo: { cx: 0, cy: 0, r: 0 },
      puntos: [
        { x: 0, y: 0 }, { x: 21700, y: 0 }, { x: 20500, y: 4000 }, { x: 20000, y: 8000 },
        { x: 20300, y: 12200 }, { x: 21400, y: 16000 }, { x: 23800, y: 20000 }, { x: 0, y: 20000 },
      ],
    },
    {
      nombre: 'Sala de Juntas Circular', tipo: 'juntas', forma: 'circulo', dentroDe: 'ÁREA OPERATIVA',
      confianza: 'alta', puntos: [], circulo: { cx: 9000, cy: 6000, r: 3500 },
    },
    {
      nombre: 'Recepción', tipo: 'recepcion', forma: 'poligono', dentroDe: '', confianza: 'media',
      circulo: { cx: 0, cy: 0, r: 0 },
      puntos: [{ x: 0, y: 12000 }, { x: 7000, y: 20000 }, { x: 0, y: 20000 }],
    },
  ],
};

describe('contorno de la lectura', () => {
  it('convierte un círculo en un polígono del diámetro que dice la cota', () => {
    const pts = contornoMM(PLANO.areas[1]);
    expect(pts.length).toBeGreaterThanOrEqual(12);
    const xs = pts.map((p) => p[0]);
    // Ø 7 m: el ancho del contorno no puede alejarse de 7000 mm.
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(6800);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(7000);
    // Y su superficie es la del círculo (π r²  ≈ 38.5 m²), no la del cuadrado
    // de 7×7 = 49 m² que devolvía el esquema viejo.
    expect(areaM2(pts)).toBeGreaterThan(36);
    expect(areaM2(pts)).toBeLessThan(39);
  });

  it('acepta el formato viejo (sólo x/y/ancho/largo) sin tronar', () => {
    const pts = contornoMM({ x: 1000, y: 2000, ancho: 3000, largo: 4000 });
    expect(pts).toEqual([[1000, 2000], [4000, 2000], [4000, 6000], [1000, 6000]]);
  });

  it('descarta un área sin forma reconocible', () => {
    expect(contornoMM({ nombre: 'x', puntos: [{ x: 0, y: 0 }] })).toBe(null);
  });
});

describe('lectura -> áreas de la app', () => {
  const { areas } = areasDeLectura(PLANO);

  it('conserva la forma real: el open space NO es un rectángulo', () => {
    const open = areas.find((a) => a.tipo === 'open');
    expect(open.poly.length).toBe(8);
    // El bbox mide 23.8 × 20 = 476 m², pero la planta real es bastante menor:
    // si salieran iguales, la forma se habría perdido.
    const real = areaM2(open.poly.map(([x, y]) => [x * 1000, y * 1000]));
    expect(real).toBeLessThan(open.ancho * open.largo * 0.95);
  });

  it('pone el contorno RELATIVO a la esquina del cuarto', () => {
    const rec = areas.find((a) => a.tipo === 'recepcion');
    expect(rec.x).toBe(0);
    expect(rec.y).toBe(12);
    // El primer punto del triángulo está en el origen local, no en y=12 m.
    expect(rec.poly[0]).toEqual([0, 0]);
    expect(rec.poly.length).toBe(3);
  });

  it('convierte cada cuarto anidado en un hueco que su padre no amuebla', () => {
    const open = areas.find((a) => a.tipo === 'open');
    // La sala circular Y la recepción caen dentro del contorno del open space:
    // los dos son huecos. El anidamiento se DEDUCE por geometría, así que la
    // recepción cuenta aunque la lectura no lo haya declarado.
    expect(open.obstaculos).toHaveLength(2);
    const circ = open.obstaculos.find((o) => Math.abs(o.w - 7) < 0.2);
    expect(circ).toBeTruthy();
    expect(circ.h).toBeCloseTo(7, 1);
    // Y los cuartos siguen existiendo por su cuenta, para amueblarlos ellos.
    expect(areas.some((a) => a.tipo === 'juntas')).toBe(true);
    expect(areas.some((a) => a.tipo === 'recepcion')).toBe(true);
  });
});

describe('revisión de la lectura', () => {
  it('no inventa problemas en un plano bien leído', () => {
    expect(revisarAreas(PLANO)).toEqual([]);
  });

  it('un cuarto DENTRO de otro no se reporta como traslape', () => {
    const problemas = revisarAreas(PLANO);
    expect(problemas.join(' ')).not.toMatch(/enciman/);
  });

  it('reporta dos cuartos encimados de verdad', () => {
    const malo = {
      envolvente: { ancho: 20000, largo: 20000 },
      areas: [
        { nombre: 'A', tipo: 'open', forma: 'poligono', dentroDe: '', circulo: { cx: 0, cy: 0, r: 0 },
          puntos: [{ x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 10000 }, { x: 0, y: 10000 }] },
        { nombre: 'B', tipo: 'privado', forma: 'poligono', dentroDe: '', circulo: { cx: 0, cy: 0, r: 0 },
          puntos: [{ x: 5000, y: 5000 }, { x: 15000, y: 5000 }, { x: 15000, y: 15000 }, { x: 5000, y: 15000 }] },
      ],
    };
    expect(revisarAreas(malo).join(' ')).toMatch(/"A" y "B" se enciman/);
  });

  it('reporta un cuarto fuera del contorno del plano', () => {
    const fuera = {
      envolvente: { ancho: 10000, largo: 10000 },
      areas: [
        { nombre: 'Fuera', tipo: 'privado', forma: 'poligono', dentroDe: '', circulo: { cx: 0, cy: 0, r: 0 },
          puntos: [{ x: 9000, y: 0 }, { x: 18000, y: 0 }, { x: 18000, y: 4000 }, { x: 9000, y: 4000 }] },
      ],
    };
    expect(revisarAreas(fuera).join(' ')).toMatch(/se salen del contorno/);
  });

  it('avisa cuando no se reconoció ningún cuarto', () => {
    expect(revisarAreas({ envolvente: { ancho: 1, largo: 1 }, areas: [] })[0]).toMatch(/ningún cuarto/);
  });
});
