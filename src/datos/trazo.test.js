import { describe, it, expect } from 'vitest';
import { simplificar, enderezar, cerrar, contornoDeTrazo, areaDe, pegarAVecinos } from './trazo.js';

// Un trazo del dedo: muchos puntos, con temblor.
function trazoRecto(x0, y0, x1, y1, n = 60, temblor = 0.03) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // Temblor determinista (nada de aleatorio: las pruebas tienen que repetir).
    const w = Math.sin(i * 1.7) * temblor;
    pts.push([x0 + (x1 - x0) * t + w, y0 + (y1 - y0) * t - w]);
  }
  return pts;
}

describe('simplificar el trazo', () => {
  it('deja una línea temblorosa en dos puntos', () => {
    const r = simplificar(trazoRecto(0, 0, 8, 0), 0.15);
    expect(r.length).toBe(2);
    expect(r[0][0]).toBeCloseTo(0, 1);
    expect(r[1][0]).toBeCloseTo(8, 1);
  });

  it('CONSERVA la curva: no la convierte en una recta', () => {
    // Medio círculo de radio 3: es exactamente lo que Rodrigo dice que tienen
    // las oficinas y lo que el lienzo de hoy no sabe trazar.
    const arco = [];
    for (let i = 0; i <= 40; i++) {
      const a = (Math.PI * i) / 40;
      arco.push([3 + 3 * Math.cos(a), 3 * Math.sin(a)]);
    }
    const r = simplificar(arco, 0.15);
    expect(r.length).toBeGreaterThan(5);
    expect(r.length).toBeLessThan(40);
  });

  it('no toca un trazo de dos puntos', () => {
    expect(simplificar([[0, 0], [1, 1]])).toEqual([[0, 0], [1, 1]]);
  });
});

describe('enderezar los muros', () => {
  it('pone recto un muro trazado con 3° de inclinación', () => {
    const r = enderezar([[0, 0], [6, 0.31]]);   // ~3°
    expect(r[1][1]).toBe(0);
  });

  it('NO endereza una diagonal de verdad', () => {
    const r = enderezar([[0, 0], [5, 5]]);      // 45°
    expect(r[1]).toEqual([5, 5]);
  });

  it('deja la curva en paz', () => {
    const arco = [[0, 0], [1, 0.6], [1.8, 1.5], [2.2, 2.6]];
    const r = enderezar(arco);
    // Ningún tramo es horizontal ni vertical: la forma sobrevive.
    expect(r[1]).toEqual([1, 0.6]);
  });
});

describe('cerrar el contorno', () => {
  it('cierra solo si terminaste cerca de donde empezaste', () => {
    const r = cerrar([[0, 0], [5, 0], [5, 4], [0.2, 0.3]]);
    expect(r.length).toBe(3);           // el punto de más se quita
  });

  it('no cierra un trazo que quedó abierto de verdad', () => {
    const r = cerrar([[0, 0], [5, 0], [5, 4], [3, 4]]);
    expect(r.length).toBe(4);
  });
});

describe('de un trazo a mano a un cuarto', () => {
  it('un privado trazado de corrido queda en 4 esquinas', () => {
    // El dedo recorre el rectángulo 5×4 y regresa cerca del inicio.
    const t = [
      ...trazoRecto(0, 0, 5, 0),
      ...trazoRecto(5, 0, 5, 4),
      ...trazoRecto(5, 4, 0, 4),
      ...trazoRecto(0, 4, 0.15, 0.2),
    ];
    const poly = contornoDeTrazo(t);
    expect(poly).toBeTruthy();
    expect(poly.length).toBe(4);
    // Y mide lo que se dibujó, no cualquier cosa.
    expect(areaDe(poly)).toBeGreaterThan(18);
    expect(areaDe(poly)).toBeLessThan(22);
  });

  it('un cuarto con un muro CURVO conserva la curva', () => {
    const curva = [];
    for (let i = 0; i <= 30; i++) {
      const a = (Math.PI / 2) * (i / 30);
      curva.push([5 + 3 * Math.sin(a), 3 - 3 * Math.cos(a)]);   // cuarto de círculo
    }
    const t = [...trazoRecto(0, 0, 5, 0), ...curva, ...trazoRecto(8, 3, 0, 3), ...trazoRecto(0, 3, 0.1, 0.1)];
    const poly = contornoDeTrazo(t);
    // Con la curva dentro, el contorno NO puede quedar en 4 esquinas.
    expect(poly.length).toBeGreaterThan(5);
  });

  it('un garabato de dos puntos no inventa un cuarto', () => {
    expect(contornoDeTrazo([[0, 0], [1, 0]])).toBe(null);
  });
});

describe('sellos de cuarto', () => {
  it('pega un privado nuevo contra el de al lado, sin dejar pasillo falso', () => {
    const vecino = { x: 0, y: 0, w: 3.5, h: 4 };
    // Se suelta 30 cm a la derecha de donde va: debe quedar pegado exacto.
    const r = pegarAVecinos({ x: 3.8, y: 0.2, w: 3.5, h: 4 }, [vecino]);
    expect(r.x).toBe(3.5);
    expect(r.y).toBe(0);
  });

  it('no mueve un cuarto que está lejos de todos', () => {
    const r = pegarAVecinos({ x: 12, y: 9, w: 3.5, h: 4 }, [{ x: 0, y: 0, w: 3.5, h: 4 }]);
    expect(r.x).toBe(12);
    expect(r.y).toBe(9);
  });
});
