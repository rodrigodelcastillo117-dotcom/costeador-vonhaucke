import { describe, it, expect } from 'vitest';
import {
  validarColocacion, resumenViolaciones, acomodarConReparacion, huellaConRot,
  planearDeterminista, CODIGO,
} from '../../supabase/functions/acomodar-espacio/acomodo-core.js';

const AREAS = [{ nombre: 'Sala', ancho: 3000, largo: 3000 }];
const PIEZAS = [
  { id: 'p1', nombre: 'Escritorio', w: 1500, d: 700 },
  { id: 'p2', nombre: 'Mesa', w: 1200, d: 1200 },
];
// Colocaciones reutilizables
const VALIDAS = [
  { id: 'p1', area: 0, x: 0, y: 0, rot: 0 },        // 1500×700 en (0,0)
  { id: 'p2', area: 0, x: 0, y: 1000, rot: 0 },     // 1200×1200 en (0,1000) — no traslapa
];
const P2_TRASLAPA = [
  { id: 'p1', area: 0, x: 0, y: 0, rot: 0 },
  { id: 'p2', area: 0, x: 100, y: 100, rot: 0 },    // encima de p1
];
const P2_FUERA = [
  { id: 'p1', area: 0, x: 0, y: 0, rot: 0 },
  { id: 'p2', area: 0, x: 2500, y: 0, rot: 0 },     // 2500+1200=3700 > 3000 → se sale
];

describe('validarColocacion · determinista', () => {
  it('colocación válida ⇒ ok, 2/2', () => {
    const v = validarColocacion(AREAS, PIEZAS, VALIDAS);
    expect(v.ok).toBe(true);
    expect(v.colocadas).toBe(2); expect(v.total).toBe(2);
  });
  it('detecta traslape', () => {
    const v = validarColocacion(AREAS, PIEZAS, P2_TRASLAPA);
    expect(v.ok).toBe(false);
    expect(v.noColocadas.some((p) => /traslapa/.test(p.motivo))).toBe(true);
  });
  it('detecta fuera de área', () => {
    const v = validarColocacion(AREAS, PIEZAS, P2_FUERA);
    expect(v.ok).toBe(false);
    expect(v.noColocadas.some((p) => /se sale/.test(p.motivo))).toBe(true);
  });
  it('pieza sin posición ⇒ no colocada (cantidad intacta: total sigue 2)', () => {
    const v = validarColocacion(AREAS, PIEZAS, [VALIDAS[0]]);
    expect(v.total).toBe(2); expect(v.colocadas).toBe(1);
    expect(v.noColocadas[0].motivo).toMatch(/no colocada/);
  });
  it('huellaConRot intercambia ancho/fondo con rot 90', () => {
    expect(huellaConRot({ w: 1500, d: 700 }, 90)).toEqual({ w: 700, d: 1500 });
  });
  it('resumenViolaciones da una razón por pieza inválida', () => {
    const v = validarColocacion(AREAS, PIEZAS, P2_FUERA);
    expect(resumenViolaciones(v).join(' ')).toMatch(/p2/);
  });
});

describe('acomodarConReparacion · repair-loop hasta 3', () => {
  it('CASO 1 — éxito al primer intento', async () => {
    const calls = [];
    const r = await acomodarConReparacion({
      areas: AREAS, piezas: PIEZAS, maxIntentos: 3,
      proponer: async (ctx) => { calls.push(ctx.intento); return { colocacion: VALIDAS, caben: true }; },
    });
    expect(r.completo).toBe(true);
    expect(r.colocadas).toBe(2); expect(r.total).toBe(2);
    expect(r.intentos).toHaveLength(1);
    expect(r.plan.caben).toBe(true);
    expect(calls).toEqual([1]);
  });

  it('CASO 2 — éxito tras reparación (usa violaciones y conserva lo válido)', async () => {
    const ctxVistos = [];
    const r = await acomodarConReparacion({
      areas: AREAS, piezas: PIEZAS, maxIntentos: 3,
      proponer: async (ctx) => {
        ctxVistos.push(ctx);
        return { colocacion: ctx.intento === 1 ? P2_TRASLAPA : VALIDAS };
      },
    });
    expect(r.completo).toBe(true);
    expect(r.intentos).toHaveLength(2);
    // El 2º intento recibió violaciones concretas del 1º…
    expect(ctxVistos[1].violacionesPrevias.length).toBeGreaterThan(0);
    expect(ctxVistos[1].violacionesPrevias.join(' ')).toMatch(/p2/);
    // …y la pieza válida (p1) se le pasó para NO moverla.
    expect(ctxVistos[1].colocacionValidaPrevia.map((c) => c.id)).toContain('p1');
    expect(ctxVistos[1].colocacionValidaPrevia.map((c) => c.id)).not.toContain('p2');
  });

  it('CASO 3 — parcial tras 3 intentos (no inventa, no reduce cantidades)', async () => {
    const r = await acomodarConReparacion({
      areas: AREAS, piezas: PIEZAS, maxIntentos: 3,
      proponer: async () => ({ colocacion: P2_FUERA }), // p2 nunca cabe
    });
    expect(r.completo).toBe(false);          // NUNCA completo si incompleto
    expect(r.plan.caben).toBe(false);
    expect(r.colocadas).toBe(1);
    expect(r.total).toBe(2);                  // cantidad intacta: no se redujo
    expect(r.intentos).toHaveLength(3);       // agotó los 3
    expect(r.noColocadas.map((p) => p.id)).toContain('p2');
    expect(r.recomendaciones.length).toBeGreaterThan(0);
  });

  it('CASO 4 — fallo definitivo: nada colocable ⇒ parcial 0/2 con motivos', async () => {
    const r = await acomodarConReparacion({
      areas: AREAS, piezas: PIEZAS, maxIntentos: 3,
      proponer: async () => ({ colocacion: [] }),
    });
    expect(r.completo).toBe(false);
    expect(r.colocadas).toBe(0); expect(r.total).toBe(2);
    expect(r.noColocadas).toHaveLength(2);
    expect(r.noColocadas.every((p) => /no colocada/.test(p.motivo))).toBe(true);
    expect(r.intentos).toHaveLength(3);
  });

  it('un intento que lanza error no tira el bucle (conserva el mejor parcial)', async () => {
    let n = 0;
    const r = await acomodarConReparacion({
      areas: AREAS, piezas: PIEZAS, maxIntentos: 3,
      proponer: async (ctx) => {
        n++;
        if (ctx.intento === 1) return { colocacion: P2_FUERA }; // 1/2 válido
        throw new Error('API caída');                           // intentos 2 y 3 fallan
      },
    });
    expect(r.completo).toBe(false);
    expect(r.colocadas).toBe(1);             // conservó el mejor (p1)
    expect(r.intentos).toHaveLength(3);
    expect(r.intentos.slice(1).every((i) => i.error)).toBe(true);
    expect(n).toBe(3);
  });
});

describe('validarColocacion · códigos estructurados + invariante', () => {
  it('OUTSIDE_AREA / OVERLAP / UNKNOWN_PIECE con código', () => {
    expect(validarColocacion(AREAS, PIEZAS, P2_FUERA).noColocadas[0].codigos).toContain(CODIGO.OUTSIDE_AREA);
    expect(validarColocacion(AREAS, PIEZAS, P2_TRASLAPA).noColocadas[0].codigos).toContain(CODIGO.OVERLAP);
    expect(validarColocacion(AREAS, PIEZAS, [VALIDAS[0]]).noColocadas[0].codigos).toContain(CODIGO.UNKNOWN_PIECE);
  });
  it('BLOCKS_DOOR cuando la pieza invade el despeje de una puerta', () => {
    const areaPuerta = [{ nombre: 'Con puerta', ancho: 3000, largo: 3000, puertas: [{ x: 0, y: 0, w: 1800, d: 900 }] }];
    const col = [{ id: 'p1', area: 0, x: 0, y: 0, rot: 0 }]; // sobre la puerta
    const v = validarColocacion(areaPuerta, [PIEZAS[0]], col);
    expect(v.noColocadas[0].codigos).toContain(CODIGO.BLOCKS_DOOR);
  });
  it('OUTSIDE_POLYGON respeta el contorno real', () => {
    // Triángulo que NO cubre la esquina inferior-derecha.
    const poly = [[0, 0], [3000, 0], [0, 3000]];
    const areaPoly = [{ nombre: 'L', ancho: 3000, largo: 3000, polygon: poly }];
    const col = [{ id: 'p2', area: 0, x: 1900, y: 1900, rot: 0 }];
    expect(validarColocacion(areaPoly, [PIEZAS[1]], col).noColocadas[0].codigos).toContain(CODIGO.OUTSIDE_POLYGON);
  });
  it('invariante: colocadas + noColocadas = total siempre', () => {
    for (const c of [VALIDAS, P2_FUERA, [], [VALIDAS[0]]]) {
      const v = validarColocacion(AREAS, PIEZAS, c);
      expect(v.colocadas + v.noColocadas.length).toBe(v.total);
      expect(v.invariante).toBe(true);
    }
  });
});

describe('planearDeterminista · el solver decide coordenadas válidas', () => {
  it('coloca todo y el resultado PASA el validador por construcción', () => {
    const r = planearDeterminista(AREAS, PIEZAS);
    expect(r.noColocadas).toHaveLength(0);
    const v = validarColocacion(AREAS, PIEZAS, r.colocacion);
    expect(v.ok).toBe(true); expect(v.colocadas).toBe(2);
  });
  it('determinista: mismo input ⇒ mismo output exacto', () => {
    const a = JSON.stringify(planearDeterminista(AREAS, PIEZAS).colocacion);
    const b = JSON.stringify(planearDeterminista(AREAS, PIEZAS).colocacion);
    expect(a).toBe(b);
  });
  it('pieza que no cabe en ningún área ⇒ NO_SPACE (no la inventa en otro lado)', () => {
    const chico = [{ nombre: 'Closet', ancho: 800, largo: 800 }];
    const grande = [{ id: 'g', nombre: 'Mesota', w: 2000, d: 1000 }];
    const r = planearDeterminista(chico, grande);
    expect(r.colocacion).toHaveLength(0);
    expect(r.noColocadas[0].codigos).toContain(CODIGO.NO_SPACE);
  });
  it('coloca rotando cuando solo cabe de lado', () => {
    const pasillo = [{ nombre: 'Pasillo', ancho: 800, largo: 2000 }]; // 0.8 × 2.0
    const barra = [{ id: 'b', nombre: 'Barra', w: 1800, d: 600 }];     // solo cabe rot 90
    const r = planearDeterminista(pasillo, barra);
    expect(r.noColocadas).toHaveLength(0);
    expect(r.colocacion[0].rot).toBe(90);
    expect(validarColocacion(pasillo, barra, r.colocacion).ok).toBe(true);
  });
  it('reparte a una segunda área cuando la primera se llena', () => {
    const dos = [{ nombre: 'A', ancho: 1600, largo: 800 }, { nombre: 'B', ancho: 3000, largo: 3000 }];
    const piezas = [
      { id: 'm1', nombre: 'Mesa', w: 1400, d: 700 },
      { id: 'm2', nombre: 'Mesa', w: 1400, d: 700 },
      { id: 'm3', nombre: 'Mesa', w: 1400, d: 700 },
    ];
    const r = planearDeterminista(dos, piezas);
    expect(r.noColocadas).toHaveLength(0);
    expect(new Set(r.colocacion.map((c) => c.area)).size).toBeGreaterThan(1); // usó 2 áreas
    expect(validarColocacion(dos, piezas, r.colocacion).ok).toBe(true);
  });
  it('conserva las piezas fijas y no las mueve', () => {
    const fijas = [{ id: 'p1', area: 0, x: 0, y: 0, rot: 0 }];
    const r = planearDeterminista(AREAS, PIEZAS, { fijas });
    const p1 = r.colocacion.find((c) => c.id === 'p1');
    expect(p1).toMatchObject({ x: 0, y: 0, area: 0 });
    expect(validarColocacion(AREAS, PIEZAS, r.colocacion).ok).toBe(true);
  });
  it('respeta puertas: no coloca sobre el despeje', () => {
    const area = [{ nombre: 'Rec', ancho: 3000, largo: 3000, puertas: [{ x: 0, y: 0, w: 1000, d: 1000 }] }];
    const r = planearDeterminista(area, [PIEZAS[0]]);
    expect(r.noColocadas).toHaveLength(0);
    expect(validarColocacion(area, [PIEZAS[0]], r.colocacion).noColocadas).toHaveLength(0);
  });
});
