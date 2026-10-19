// ============================================================================
//  2026-10-19 · CERTIFICACIÓN C2 (plano curvo, 6 áreas, 41 piezas): la edge
//  acomodar-espacio-recovery respondía HTTP 546 (límite de CPU de ~2 s). Medido: 1.75 s por
//  llamada, 93 % en la prueba estática de posiciones (barrido de puertas y contorno), repetida en
//  las 6 estrategias y en cada simulación de las opciones del vendedor.
//  Arreglo: (1) caja envolvente antes de cruzar rect × polígono; (2) veredicto estático por
//  posición compartido en la petición. Contrato: MISMA salida, mucho menos CPU.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { rectIntersecaPoligono, poligonoBarridoPuerta, puntoEnPoligono } from './spatial-core.js';
import { resolverKits, metricasSolver } from './kit-solver.js';
import { construirRespuestaAcomodo } from './recoveryPipeline.js';

const C2 = JSON.parse(readFileSync(new URL('../../../bench/acomodo-calidad/fixtures/c2-curvo-request.json', import.meta.url), 'utf8'));

// Implementación previa (sin caja envolvente), copiada tal cual para comparar.
const EPS = 1;
const dentroRect = ([x, y], r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.d;
const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const enSegmento = (a, b, p) => Math.min(a[0], b[0]) - EPS <= p[0] && p[0] <= Math.max(a[0], b[0]) + EPS
  && Math.min(a[1], b[1]) - EPS <= p[1] && p[1] <= Math.max(a[1], b[1]) + EPS;
function cruzan(a, b, c, d) {
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
  if ((o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0)) return true;
  return (Math.abs(o1) <= EPS && enSegmento(a, b, c)) || (Math.abs(o2) <= EPS && enSegmento(a, b, d))
    || (Math.abs(o3) <= EPS && enSegmento(c, d, a)) || (Math.abs(o4) <= EPS && enSegmento(c, d, b));
}
function previo(rect, poly) {
  const rc = [[rect.x, rect.y], [rect.x + rect.w, rect.y], [rect.x + rect.w, rect.y + rect.d], [rect.x, rect.y + rect.d]];
  if (rc.some((p) => puntoEnPoligono(p, poly))) return true;
  if (poly.some((p) => dentroRect(p, rect))) return true;
  for (let i = 0; i < 4; i++) for (let j = 0; j < poly.length; j++) if (cruzan(rc[i], rc[(i + 1) % 4], poly[j], poly[(j + 1) % poly.length])) return true;
  return false;
}

describe('acomodo · CPU de la edge (C2 curvo, 546)', () => {
  it('rectIntersecaPoligono: idéntico a la versión previa, también en bordes y toques', () => {
    let s = 7; const r = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    const puertas = [];
    for (let i = 0; i < 40; i++) {
      puertas.push(poligonoBarridoPuerta({ tieneBarrido: true, bisagraX: Math.round(r() * 8000), bisagraY: Math.round(r() * 8000),
        ancho: 700 + Math.round(r() * 500), anguloCerradaDeg: Math.round(r() * 360), barridoDeg: 90, sentido: r() < 0.5 ? 'horario' : 'antihorario' }));
    }
    let n = 0, distintos = 0;
    for (const poly of puertas) {
      const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
      const maxX = Math.max(...xs), minY = Math.min(...ys);
      // rects al azar + rects que quedan justo en el borde de la caja (±0..3 mm)
      const rects = Array.from({ length: 300 }, () => ({ x: Math.round(r() * 9000) - 500, y: Math.round(r() * 9000) - 500, w: 300 + Math.round(r() * 2000), d: 300 + Math.round(r() * 1500) }));
      for (let k = -3; k <= 3; k++) rects.push({ x: maxX + k, y: minY - 500, w: 600, d: 2000 }, { x: maxX - 600, y: minY - 600 + k, w: 600, d: 600 });
      for (const rect of rects) { n++; if (rectIntersecaPoligono(rect, poly) !== previo(rect, poly)) distintos++; }
    }
    expect(n).toBeGreaterThan(12000);
    expect(distintos).toBe(0);
  });

  it('resolverKits: con caché estática compartida da EXACTAMENTE la misma colocación en cada estrategia', () => {
    const cache = new WeakMap();
    for (const orden of [undefined, 'center', 'reverse', 'col', 'colReverse', 'access']) {
      const sin = resolverKits(C2.areas, C2.piezas, { orden, certificados: false });
      const con = resolverKits(C2.areas, C2.piezas, { orden, certificados: false, cacheEstatico: cache });
      expect(JSON.stringify(con.colocacion)).toBe(JSON.stringify(sin.colocacion));
      expect(JSON.stringify(con.unplaced)).toBe(JSON.stringify(sin.unplaced));
      expect(JSON.stringify(con.busqueda)).toBe(JSON.stringify(sin.busqueda));
    }
  });

  // Medida DETERMINISTA del trabajo (no del reloj: en CI y en el build de Vercel las pruebas corren en paralelo y
  // tanto un tope en ms como una razón de tiempos salieron frágiles). Se cuentan las evaluaciones estáticas reales
  // (muros, contorno, puertas, acceso: el 93 % del CPU medido). El pipeline completo (multi de 6 estrategias + 3
  // simulaciones de opciones) debe hacer MENOS que 6 búsquedas sin caché; sin el arreglo hacía ≈ 2.7 veces más.
  it('C2 completo (multi + opciones del vendedor) evalúa menos posiciones que 6 búsquedas sin caché', () => {
    metricasSolver.estaticos = 0;
    const r = construirRespuestaAcomodo(C2.areas, C2.piezas);
    const pipeline = metricasSolver.estaticos;
    metricasSolver.estaticos = 0;
    for (const orden of [undefined, 'center', 'reverse', 'col', 'colReverse', 'access']) resolverKits(C2.areas, C2.piezas, { orden, certificados: false });
    const base = metricasSolver.estaticos;
    expect(r.layoutSpec.placed).toBe(28);                         // la sala de consejo no cabe completa (sin cambio)
    expect(r.layoutSpec.mensaje_vendedor.opciones.map((o) => o.id)).toEqual(['mesa_mas_chica', 'quitar_no_colocadas']);
    expect(base).toBeGreaterThan(0);
    expect(pipeline).toBeLessThan(base);
  });
});
