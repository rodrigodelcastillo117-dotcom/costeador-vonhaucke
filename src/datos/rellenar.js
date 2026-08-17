// ============================================================================
//  RELLENAR EL RESTO  ·  pones UNA y te ofrece poner TODAS.
//
//  Rodrigo, 2026-08-17: "poner los escritorios y sillas tú mismo está tedioso.
//  Deberíamos poner una regla: si la IA se da cuenta que puse 1 silla WIN en el
//  operativo, que me pregunte «¿quieres que rellenemos todas las sillas WIN en
//  el operativo?»".
//
//  La idea de fondo: el proyectista no quiere colocar 27 sillas, quiere DECIDIR
//  que las 27 sillas van en el operativo. Una decisión, no veintisiete arrastres.
//
//  Y para las SILLAS hay algo mejor que empacarlas en fila: una silla va PEGADA
//  A SU ESCRITORIO. Así que primero se sientan en los puestos que estén vacíos,
//  y sólo lo que sobra se acomoda en el hueco libre.
// ============================================================================
import { dimsPieza } from './espacio.js';

const choca = (a, b, h = 0) => (
  a.x < b.x + b.w + h && a.x + a.w + h > b.x && a.y < b.y + b.d + h && a.y + a.d + h > b.y
);

const huellaDe = (c, byId) => {
  const p = byId[c.id]; if (!p) return null;
  const { pw, ph } = dimsPieza(p, c.rot || 0);
  return { x: c.x, y: c.y, w: pw, d: ph };
};

// El lado por donde se sienta la gente, para dejar ahí la silla.
const LADO = { 0: [0, 1], 90: [-1, 0], 180: [0, -1], 270: [1, 0] };

/**
 * Dónde poner `ids` piezas iguales dentro de `area`, sin encimar nada.
 * @returns [{id, area, x, y, rot}] — puede devolver menos si ya no cabe.
 */
export function rellenar({ ids, pieza, area, iArea, colocadas, byId }) {
  const puestas = colocadas.filter((c) => c.area === iArea).map((c) => huellaDe(c, byId)).filter(Boolean);
  const W = area?.ancho || 0, L = area?.largo || 0;
  const { pw, ph } = dimsPieza(pieza, 0);
  const out = [];
  // `puestas` va creciendo con cada silla que se pone, así que ella sola cuida
  // que no se encimen entre sí. 40 mm de holgura para que no se toquen.
  const libre = (h) => h.x >= 0 && h.y >= 0 && h.x + h.w <= W && h.y + h.d <= L
    && !puestas.some((v) => choca(h, v, 40));

  const meter = (id, x, y, rot = 0) => {
    const h = { x: Math.round(x), y: Math.round(y), w: pw, d: ph };
    if (!libre(h)) return false;
    puestas.push(h);
    out.push({ id, area: iArea, x: h.x, y: h.y, rot });
    return true;
  };

  const cola = [...ids];

  // 1) SI SON SILLAS: una por cada puesto de trabajo que esté sin silla.
  if (pieza?.tipo === 'asiento') {
    const escritorios = colocadas
      .filter((c) => c.area === iArea && byId[c.id]?.tipo === 'escritorio')
      .map((c) => ({ c, h: huellaDe(c, byId) })).filter((e) => e.h);
    for (const { c, h } of escritorios) {
      if (!cola.length) break;
      // Cuántos puestos tiene: una banca de 7.5 m son 5, un escritorio es 1.
      const largo = Math.max(h.w, h.d);
      const n = Math.max(1, Math.round(largo / 1500));
      const horiz = h.w >= h.d;
      const [ux, uy] = LADO[((c.rot || 0) % 360 + 360) % 360] || LADO[0];
      for (let k = 0; k < n && cola.length; k++) {
        const u = (largo * (k + 0.5)) / n;
        // centro del puesto, y la silla corrida hacia el lado donde se sienta
        const cx = horiz ? h.x + u : h.x + h.w / 2;
        const cy = horiz ? h.y + h.d / 2 : h.y + u;
        const sx = cx + ux * (horiz ? h.w * 0 : h.w / 2 + pw * 0.6) - pw / 2;
        const sy = cy + uy * (horiz ? h.d / 2 + ph * 0.6 : 0) - ph / 2;
        if (meter(cola[0], sx, sy)) cola.shift();
      }
    }
  }

  // 2) LO QUE SOBRE: en filas, por el hueco libre, con paso entre ellas.
  const paso = Math.max(300, Math.round(Math.min(pw, ph) * 0.5));
  for (let y = 0; y + ph <= L && cola.length; y += ph + paso) {
    for (let x = 0; x + pw <= W && cola.length; x += pw + paso) {
      if (meter(cola[0], x, y)) cola.shift();
    }
  }
  return out;
}
