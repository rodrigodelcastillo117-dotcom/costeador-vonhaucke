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

const sinAcento = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ⚠️ L/1500 ES UN ESTIMADO, NO LA CUENTA REAL (2026-08-19). Asume que cada
// puesto mide 1.50 m, pero `huellaReal` (espacio.js) arma el bloque con el
// ANCHO REAL del puesto —Cirque mide 1.20 m—: "Banca doble 6 puestos" a 1.20
// da un bloque de 3.60 × 1.50 m, y 3.60 / 1.50 redondea a 2 columnas: sólo 4
// de los 6 puestos comprados quedaban sentados, y las 2 sillas que sobraban
// se iban al hueco libre del cuarto en vez de a su banca —justo lo que
// `sentarSillas` existe para evitar—. El nombre YA DICE los puestos de
// verdad (mismo patrón que usa `huellaReal` para armar el bloque): si lo
// dice, manda sobre el estimado geométrico.
export function puestosDeclarados(nombre) {
  const s = sinAcento(nombre);
  const m = /(\d+)\s*(?:puesto|plaza|persona|posicion|usuario)s?\b/.exec(s) || /(\d+)\s*u\b(?!\w)/.exec(s);
  return m ? Math.max(1, +m[1]) : null;
}

/**
 * Dónde van las sillas de UN escritorio o banca ya colocado.
 *
 * ⚠️ VIVE AQUÍ Y SE EXPORTA A PROPÓSITO (2026-08-17). Esta regla —"una silla va
 * pegada a su escritorio"— sólo la aplicaba el camino MANUAL. El motor
 * automático (`acomodarLocal`) no la tenía, así que en el plano que recibe el
 * cliente las 12 sillas operativas quedaban regadas a **1.8–5.5 m** de su
 * banca. Medido: 0 de 14 sillas a menos de 300 mm de una superficie de trabajo.
 * Que la regla exista en dos copias es cómo se vuelven a separar, así que hay
 * UNA sola y la usan los dos.
 *
 * @param c colocación del escritorio: { rot }
 * @param h su huella ya girada: { x, y, w, d }
 * @param pw,ph medidas de la silla
 * @param nombreMueble nombre de la partida del escritorio/banca, para leer los
 *   puestos declarados ("6 puestos") cuando el puesto real no mide 1.50 m.
 * @returns [{x,y}] esquina superior izquierda de cada silla, en orden del puesto 1 al n
 */
export function puestosDe(c, h, pw, ph, nombreMueble = null) {
  // ⚠️ LA HILERA CORRE POR EL LADO LARGO Y UNA BANCA DOBLE TIENE GENTE DE LOS
  // DOS LADOS. Estas dos reglas ya estaban escritas en el dibujo 3D
  // (`PlanoAcomodo.jsx`: `bench = F > 1000`, `n = round(L/1500)`) y aquí no:
  // por eso una banca doble de 6 usuarios sólo ofrecía 3 puestos, y la mitad de
  // las sillas se quedaba sin sentar. Si el plano y el 3D no cuentan igual, uno
  // de los dos le miente al proyectista.
  const horiz = h.w >= h.d;
  const L = horiz ? h.w : h.d;          // a lo largo de la hilera
  const F = horiz ? h.d : h.w;          // de una hilera a la otra
  const doble = F > 1000;               // bench doble: dos hileras enfrentadas
  const declarados = puestosDeclarados(nombreMueble);
  // El nombre manda cuando lo dice (ver nota arriba de `puestosDeclarados`);
  // L/1500 se queda sólo como respaldo para lo que no declara puestos.
  const n = declarados ? Math.max(1, doble ? Math.ceil(declarados / 2) : declarados)
    : Math.max(1, Math.round(L / 1500));   // puestos POR hilera
  const [ux, uy] = LADO[((c.rot || 0) % 360 + 360) % 360] || LADO[0];
  const perp = horiz ? uy : ux;         // hacia dónde se sienta el de "acá"
  const salto = F / 2 + (horiz ? ph : pw) * 0.6;
  const out = [];
  // Primero la hilera del lado donde manda la orientación, luego la de enfrente:
  // así un escritorio suelto se comporta EXACTAMENTE igual que antes.
  for (const signo of doble ? [perp, -perp] : [perp]) {
    for (let k = 0; k < n; k++) {
      const u = (L * (k + 0.5)) / n;
      const cx = horiz ? h.x + u : h.x + h.w / 2;
      const cy = horiz ? h.y + h.d / 2 : h.y + u;
      out.push({
        x: Math.round(cx + (horiz ? 0 : signo * salto) - pw / 2),
        y: Math.round(cy + (horiz ? signo * salto : 0) - ph / 2),
      });
    }
  }
  return out;
}

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
      for (const s of puestosDe(c, h, pw, ph, byId[c.id]?.nombre)) {
        if (!cola.length) break;
        if (meter(cola[0], s.x, s.y)) cola.shift();
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
