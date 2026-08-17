import { describe, it, expect } from 'vitest';
import { enderezar, enderezarTodo } from './orientacion.js';
import { frenteDe } from './espacio.js';

// ============================================================================
//  "SIEMPRE VIENDO HACIA LA PUERTA, NUNCA HACIA LA PARED" (Rodrigo, 2026-08-17)
//  ⚠️ `frenteDe` dice DÓNDE SE SIENTA la gente. Quien se sienta abajo MIRA
//  hacia arriba. Todas las pruebas de aquí comprueban la MIRADA, no la silla,
//  porque confundir las dos es justo el error que traía la regla vieja.
// ============================================================================
const MIRADA = { abajo: 'arriba', arriba: 'abajo', izq: 'der', der: 'izq' };
const mira = (rot) => MIRADA[frenteDe(rot)];

const ESCRITORIO = { w: 1800, d: 800, tipo: 'escritorio' };

describe('el escritorio mira a la puerta', () => {
  it('puerta abajo → la persona mira hacia abajo', () => {
    const area = { ancho: 6000, largo: 5000, puertas: [{ x: 3000, y: 4950, ancho: 900 }] };
    const c = enderezar({ x: 2000, y: 2000, rot: 0 }, ESCRITORIO, area);
    expect(mira(c.rot)).toBe('abajo');
  });

  it('puerta arriba → la persona mira hacia arriba', () => {
    const area = { ancho: 6000, largo: 5000, puertas: [{ x: 3000, y: 50, ancho: 900 }] };
    const c = enderezar({ x: 2000, y: 2000, rot: 0 }, ESCRITORIO, area);
    expect(mira(c.rot)).toBe('arriba');
  });

  it('con el escritorio de canto, la puerta a la derecha lo voltea a la derecha', () => {
    const area = { ancho: 6000, largo: 5000, puertas: [{ x: 5950, y: 2500, ancho: 900 }] };
    const c = enderezar({ x: 2000, y: 1500, rot: 90 }, ESCRITORIO, area);
    expect(mira(c.rot)).toBe('der');
  });
});

describe('nunca de cara a la pared', () => {
  it('en medio del cuarto y sin puerta, mira al lado más despejado', () => {
    const area = { ancho: 6000, largo: 8000 };
    // A 1 m del muro de arriba y a 6.2 m del de abajo: la mirada va hacia abajo.
    const c = enderezar({ x: 2000, y: 1000, rot: 180 }, ESCRITORIO, area);
    expect(mira(c.rot)).toBe('abajo');
  });

  it('despega el mueble del muro para que quepa la silla y se vea la puerta', () => {
    const area = { ancho: 6000, largo: 5000, puertas: [{ x: 3000, y: 4950, ancho: 900 }] };
    // Mira hacia abajo (la puerta) ⇒ la silla va ARRIBA, y arriba sólo hay 100 mm.
    const c = enderezar({ x: 2000, y: 100, rot: 0 }, ESCRITORIO, area);
    expect(mira(c.rot)).toBe('abajo');
    expect(c.y).toBeGreaterThanOrEqual(900);
  });

  it('no lo despega si al moverlo se encimaría con otro', () => {
    const area = { ancho: 6000, largo: 5000, puertas: [{ x: 3000, y: 4950, ancho: 900 }] };
    const vecino = { x: 1900, y: 1000, w: 2000, d: 900 };   // justo donde tendría que correrse
    const c = enderezar({ x: 2000, y: 100, rot: 0 }, ESCRITORIO, area, [vecino]);
    expect(c.y).toBe(100);            // se queda donde estaba
    expect(mira(c.rot)).toBe('abajo');  // pero el giro sí se corrige
  });

  // ⚠️ ESTAS DOS SON LAS QUE PROTEGEN LAS REGLAS QUE YA ESTABAN.
  it('SIN puerta no mueve nada: el escritorio se queda recargado al muro', () => {
    const area = { ancho: 4000, largo: 3500 };            // privado, sin puerta puesta
    const c = enderezar({ x: 1100, y: 100, rot: 0 }, ESCRITORIO, area);
    expect(c.y).toBe(100);
  });

  it('no despega un escritorio que trae su gaveta pegada', () => {
    const area = { ancho: 6000, largo: 5000, puertas: [{ x: 3000, y: 4950, ancho: 900 }] };
    const gaveta = { x: 3900, y: 100, w: 450, d: 800 };   // pegada a su costado
    const c = enderezar({ x: 2000, y: 100, rot: 0 }, ESCRITORIO, area, [gaveta]);
    expect(c.y).toBe(100);              // el conjunto no se rompe
    expect(mira(c.rot)).toBe('abajo');  // el giro sí se corrige
  });
});

describe('lo que NO se toca', () => {
  it('un archivero no mira a ningún lado: se queda igual', () => {
    const area = { ancho: 6000, largo: 5000, puertas: [{ x: 3000, y: 4950, ancho: 900 }] };
    const antes = { x: 100, y: 100, rot: 0 };
    expect(enderezar(antes, { w: 900, d: 450, tipo: 'guarda' }, area)).toEqual(antes);
  });

  it('enderezarTodo respeta el área de cada pieza y no mueve las que no miran', () => {
    const areas = [
      { ancho: 6000, largo: 5000, puertas: [{ x: 3000, y: 4950, ancho: 900 }] },
      { ancho: 6000, largo: 5000, puertas: [{ x: 3000, y: 50, ancho: 900 }] },
    ];
    const byId = { e1: ESCRITORIO, e2: ESCRITORIO, g1: { w: 900, d: 450, tipo: 'guarda' } };
    const out = enderezarTodo([
      { id: 'e1', area: 0, x: 2000, y: 2000, rot: 0 },
      { id: 'e2', area: 1, x: 2000, y: 2000, rot: 0 },
      { id: 'g1', area: 0, x: 100, y: 100, rot: 0 },
    ], byId, areas);
    expect(mira(out[0].rot)).toBe('abajo');
    expect(mira(out[1].rot)).toBe('arriba');
    expect(out[2]).toEqual({ id: 'g1', area: 0, x: 100, y: 100, rot: 0 });
  });
});
