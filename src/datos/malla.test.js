import { describe, it, expect } from 'vitest';
import { acomodarEnForma, CELDA } from './malla.js';

// ---------------------------------------------------------------------------
//  CRITERIO DE PROYECTISTA (2026-08-16). Antes el motor tomaba "el primer hueco
//  libre" barriendo de arriba-izquierda a abajo-derecha: la mesa de juntas
//  quedaba descentrada, los archiveros flotaban en medio del cuarto y nada
//  sabía de puertas. Estas pruebas fijan las tres reglas nuevas.
// ---------------------------------------------------------------------------
const cuarto = (ancho, largo, extra = {}) => ({ nombre: 'Cuarto', ancho, largo, ...extra });
const pieza = (id, w, d, tipo) => ({ id, w, d, tipo, nombre: id });

// Distancia del mueble al muro más cercano, en mm.
function alMuro(area, c, p) {
  const w = c.rot === 90 ? p.d : p.w, d = c.rot === 90 ? p.w : p.d;
  return Math.min(c.x, c.y, area.ancho - (c.x + w), area.largo - (c.y + d));
}

describe('anclaje a muro', () => {
  it('recarga un archivero contra la pared, no lo deja en medio', () => {
    const a = cuarto(6000, 5000);
    const p = pieza('g1', 900, 450, 'guarda');
    const r = acomodarEnForma(a, [p]);
    expect(r.colocacion).toHaveLength(1);
    const c = r.colocacion[0];
    expect(c.contra).toBeTruthy();               // declara contra qué se recargó
    expect(alMuro(a, c, p)).toBeLessThanOrEqual(150);   // zócalo, no medio cuarto
  });

  it('recarga también el escritorio de una oficina privada', () => {
    const a = cuarto(4000, 3500);
    const p = pieza('e1', 1800, 800, 'escritorio');
    const r = acomodarEnForma(a, [p]);
    expect(alMuro(a, r.colocacion[0], p)).toBeLessThanOrEqual(150);
  });

  it('la mesa de juntas va al CENTRO de su sala, no a una esquina', () => {
    const a = cuarto(7000, 7000);
    const p = pieza('m1', 3000, 1200, 'juntas');
    const r = acomodarEnForma(a, [p]);
    const c = r.colocacion[0];
    const w = c.rot === 90 ? p.d : p.w, d = c.rot === 90 ? p.w : p.d;
    // El centro del mueble queda cerca del centro del cuarto.
    expect(Math.abs(c.x + w / 2 - a.ancho / 2)).toBeLessThan(700);
    expect(Math.abs(c.y + d / 2 - a.largo / 2)).toBeLessThan(700);
  });
});

describe('puertas', () => {
  const puerta = { x: 3000, y: 0, ancho: 900 };
  // El hueco de barrido llega como obstáculo: es lo que produce `areasDeLectura`.
  const barrido = { x: 3000 - 900, y: -900, w: 1800, h: 1800, tipo: 'puerta' };

  it('no coloca nada sobre el barrido de la puerta', () => {
    const a = cuarto(6000, 5000, { obstaculos: [barrido], puertas: [puerta] });
    const piezas = Array.from({ length: 6 }, (_, k) => pieza('g' + k, 900, 450, 'guarda'));
    const r = acomodarEnForma(a, piezas);
    for (const c of r.colocacion) {
      const p = piezas.find((q) => q.id === c.id);
      const w = c.rot === 90 ? p.d : p.w, d = c.rot === 90 ? p.w : p.d;
      const choca = c.x < barrido.x + barrido.w && barrido.x < c.x + w
                 && c.y < barrido.y + barrido.h && barrido.y < c.y + d;
      expect(choca).toBe(false);
    }
  });

  // Esta prueba se llamaba "dice honestamente" y exigía... una PALOMITA VERDE
  // para algo que el propio texto decía que no se pudo comprobar. O sea que
  // certificaba la mentira. Lo honesto es que salga como AVISO: el proyectista
  // tiene que enterarse de que ese punto quedó sin revisar.
  it('sin puertas NO da por buena la circulación: lo marca como no comprobado', () => {
    const r = acomodarEnForma(cuarto(6000, 5000), [pieza('g1', 900, 450, 'guarda')]);
    const check = r.auditoria.find((x) => x.check === 'Se llega caminando desde la puerta');
    expect(check.detalle).toMatch(/no se pudo comprobar/);
    expect(check.ok).toBe(false);   // nada de palomita verde para lo no revisado
  });

  it('comprueba que se llega caminando a cada mueble', () => {
    const a = cuarto(6000, 5000, { obstaculos: [barrido], puertas: [puerta] });
    const piezas = [pieza('e1', 1600, 800, 'escritorio'), pieza('g1', 900, 450, 'guarda')];
    const r = acomodarEnForma(a, piezas);
    const check = r.auditoria.find((x) => x.check === 'Se llega caminando desde la puerta');
    expect(check.ok).toBe(true);
    expect(check.detalle).toMatch(/acceso/);
  });

  it('reporta el mueble al que NO se llega', () => {
    // Cuarto partido en dos por una columna larguísima: la puerta queda de un
    // lado y el mueble del otro. Antes esto pasaba como "todo bien".
    const a = {
      nombre: 'Partido', ancho: 6000, largo: 5000,
      obstaculos: [{ x: 2800, y: 0, w: 400, h: 5000, tipo: 'columna' }],
      puertas: [{ x: 1000, y: 0, ancho: 900 }],
    };
    const piezas = [pieza('g1', 900, 450, 'guarda'), pieza('g2', 900, 450, 'guarda')];
    const r = acomodarEnForma(a, piezas);
    const check = r.auditoria.find((x) => x.check === 'Se llega caminando desde la puerta');
    // Con dos archiveros, alguno cae del lado sin puerta.
    if (r.colocacion.some((c) => c.x > 3200)) {
      expect(check.ok).toBe(false);
      expect(check.detalle).toMatch(/sin paso/);
    }
  });
});

// REGLA DE RODRIGO (2026-08-16): "las gavetas SIEMPRE van pegadas a los
// escritorios u operativos. NUNCA sueltas y NUNCA en sala de juntas."
// Salió de verlo en vivo: "PONE LAS GAVETAS VOLANDO".
describe('conjuntos: la gaveta va PEGADA a su escritorio', () => {
  // Hueco real entre dos muebles colocados, en mm (0 = pegados).
  const hueco = (ca, pa, cb, pb) => {
    const A = { x: ca.x, y: ca.y, w: ca.rot % 180 ? pa.d : pa.w, h: ca.rot % 180 ? pa.w : pa.d };
    const B = { x: cb.x, y: cb.y, w: cb.rot % 180 ? pb.d : pb.w, h: cb.rot % 180 ? pb.w : pb.d };
    const dx = Math.max(B.x - (A.x + A.w), A.x - (B.x + B.w), 0);
    const dy = Math.max(B.y - (A.y + A.h), A.y - (B.y + B.h), 0);
    return Math.hypot(dx, dy);
  };

  it('no la deja volando en la esquina del fondo', () => {
    const a = cuarto(9000, 6000);
    const e = pieza('e1', 1800, 800, 'escritorio');
    const g = pieza('g1', 900, 450, 'guarda');
    const r = acomodarEnForma(a, [e, g]);
    const ce = r.colocacion.find((c) => c.id === 'e1');
    const cg = r.colocacion.find((c) => c.id === 'g1');
    expect(cg).toBeTruthy();
    // Pegada = a menos de 60 cm del escritorio al que sirve.
    expect(hueco(ce, e, cg, g)).toBeLessThanOrEqual(600);
  });

  it('con varios escritorios, cada gaveta se pega a alguno', () => {
    const a = cuarto(12000, 8000);
    const es = [pieza('e1', 1800, 800, 'escritorio'), pieza('e2', 1800, 800, 'escritorio')];
    const gs = [pieza('g1', 900, 450, 'guarda'), pieza('g2', 900, 450, 'guarda')];
    const r = acomodarEnForma(a, [...es, ...gs]);
    for (const g of gs) {
      const cg = r.colocacion.find((c) => c.id === g.id);
      if (!cg) continue;
      const cerca = es.some((e) => {
        const ce = r.colocacion.find((c) => c.id === e.id);
        return ce && hueco(ce, e, cg, g) <= 600;
      });
      expect(cerca).toBe(true);
    }
  });

  it('si no hay ningún escritorio, la coloca igual y no la pierde', () => {
    const r = acomodarEnForma(cuarto(6000, 5000), [pieza('g1', 900, 450, 'guarda')]);
    expect(r.colocacion).toHaveLength(1);
  });
});

describe('la malla sigue garantizando lo de siempre', () => {
  it('nada se sale ni se encima', () => {
    const a = cuarto(8000, 6000);
    const piezas = Array.from({ length: 10 }, (_, k) => pieza('p' + k, 1400, 700, 'escritorio'));
    const r = acomodarEnForma(a, piezas);
    const cajas = r.colocacion.map((c) => {
      const p = piezas.find((q) => q.id === c.id);
      return { x: c.x, y: c.y, w: c.rot === 90 ? p.d : p.w, d: c.rot === 90 ? p.w : p.d };
    });
    for (const b of cajas) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(a.ancho + CELDA);
      expect(b.y + b.d).toBeLessThanOrEqual(a.largo + CELDA);
    }
    for (let i = 0; i < cajas.length; i++) {
      for (let j = i + 1; j < cajas.length; j++) {
        const A = cajas[i], B = cajas[j];
        expect(A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.d && B.y < A.y + A.d).toBe(false);
      }
    }
  });
});
