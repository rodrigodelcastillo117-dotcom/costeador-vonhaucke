// ============================================================================
//  HACIA DÓNDE MIRA CADA MUEBLE  ·  la regla de oficio de Rodrigo, en un solo
//  lugar y aplicada SIEMPRE: "siempre que la IA acomode los muebles o yo los
//  arrastre, que recuerde que siempre va viendo hacia la puerta, NUNCA hacia
//  la pared".
//
//  ⚠️ OJO CON `frenteDe`: devuelve DÓNDE SE SIENTA LA GENTE, no hacia dónde
//  mira. Quien se sienta abajo del escritorio mira hacia ARRIBA. La regla vieja
//  (en malla.js) ponía la SILLA del lado de la puerta y así el escritorio
//  quedaba de espaldas a la entrada y de cara al muro — justo al revés de lo
//  que pidió Rodrigo, y con el cartel verde diciendo que todo estaba bien.
//
//  Esto se aplica DESPUÉS de colocar, no durante: el giro elegido conserva la
//  huella (sólo se voltea 180°), así que nunca puede descolocar un acomodo que
//  ya cabía. Si además hace falta despegar el mueble del muro para que quepa la
//  silla, se despega sólo si el hueco está libre.
// ============================================================================
import { dimsPieza, frenteDe } from './espacio.js';
import { regla } from './reglas.js';

// Vector unitario de cada lado, en coordenadas de plano (y crece hacia abajo).
const DIR = { abajo: [0, 1], izq: [-1, 0], arriba: [0, -1], der: [1, 0] };

// Muebles donde alguien se sienta y MIRA. Un archivero o una mampara no miran
// a ningún lado: ésos van contra el muro y ahí se quedan.
export const MIRA = new Set(['escritorio', 'asiento', 'recepcion']);

// Lo que ocupa la silla y quien la usa, por detrás del mueble.
const sillaMM = () => Math.max(700, regla('circulacion_min') ?? 900);

// A menos de esto, dos muebles van JUNTOS a propósito (la gaveta de su
// escritorio). Mover uno sin el otro rompe el conjunto, así que no se mueve.
const PEGADO = 600;

const dimsDe = (p, rot) => { const { pw, ph } = dimsPieza(p, rot); return { w: pw, d: ph }; };

// Aire desde el borde del mueble hasta el borde del área, en una dirección.
// ⚠️ En un cuarto con forma (una L) se mide contra la CAJA envolvente, no
// contra el polígono: es aproximado y se prefiere así a no medir nada.
function aire(h, area, [ux, uy]) {
  if (ux > 0) return (area.ancho || 0) - (h.x + h.w);
  if (ux < 0) return h.x;
  if (uy > 0) return (area.largo || 0) - (h.y + h.d);
  return h.y;
}

const choca = (a, b, holgura = 0) => (
  a.x < b.x + b.w + holgura && a.x + a.w + holgura > b.x
  && a.y < b.y + b.d + holgura && a.y + a.d + holgura > b.y
);

// La puerta más cercana al mueble (mm locales al área), o null.
function puertaCerca(h, area) {
  const ps = (area?.puertas || []).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
  if (!ps.length) return null;
  const cx = h.x + h.w / 2, cy = h.y + h.d / 2;
  return ps.reduce((m, p) => (!m || Math.hypot(p.x - cx, p.y - cy) < Math.hypot(m.x - cx, m.y - cy) ? p : m), null);
}

/**
 * Evalúa un giro DESPUÉS de despegarlo del muro lo que haga falta para que
 * quepa la silla. Se califica lo que de verdad va a quedar, no lo que hay
 * ahorita: si no, gana siempre el giro que deja a la persona de cara al muro
 * sólo porque en su posición actual la silla ya cabía.
 * Devuelve `{pts, x, y}`; más `pts` es mejor.
 */
function evaluar(h, area, rot, vecinos, puedeMoverse) {
  const silla = DIR[frenteDe(rot)];            // dónde se sienta
  const mira = [-silla[0], -silla[1]];         // hacia dónde ve  ← lo que importa
  let { x, y } = h;
  let movido = false, cabe = true;

  const falta = sillaMM() - aire(h, area, silla);
  if (falta > 0) {
    // Se corre en sentido CONTRARIO a la silla, para abrirle el hueco.
    const cand = { ...h, x: x - silla[0] * falta, y: y - silla[1] * falta };
    const dentro = cand.x >= -1 && cand.y >= -1
      && cand.x + cand.w <= (area.ancho || 0) + 1 && cand.y + cand.d <= (area.largo || 0) + 1;
    if (puedeMoverse && dentro && !vecinos.some((v) => choca(cand, v))) { x = cand.x; y = cand.y; movido = true; }
    else cabe = false;
  }

  const hf = { ...h, x, y };
  let pts = 0;
  const pu = puertaCerca(hf, area);
  if (pu) {
    const dx = pu.x - (x + h.w / 2), dy = pu.y - (y + h.d / 2);
    const n = Math.hypot(dx, dy) || 1;
    pts += 3 * ((mira[0] * dx + mira[1] * dy) / n);          // coseno hacia la puerta
  }
  pts += Math.min(aire(hf, area, mira), 3000) / 3000;        // no quedar de cara al muro
  pts += cabe ? 0.6 : -2;                                    // que la silla quepa
  if (movido) pts -= 0.15;                                   // moverlo cuesta: se prefiere no
  return { pts, x, y };
}

/**
 * Endereza UNA pieza ya colocada. Devuelve `{x, y, rot}` (puede despegarla del
 * muro para que quepa la silla, si el hueco está libre).
 * @param {object} c        colocación {x, y, rot}
 * @param {object} p        pieza {w, d, tipo}
 * @param {object} area     {ancho, largo, puertas?}
 * @param {Array}  vecinos  huellas ya ocupadas [{x,y,w,d}] sin contar ésta
 */
export function enderezar(c, p, area, vecinos = [], opts = {}) {
  if (!p || !MIRA.has(p.tipo)) return c;
  const rot0 = ((c.rot || 0) % 360 + 360) % 360;
  const { w, d } = dimsDe(p, rot0);
  const h = { x: c.x, y: c.y, w, d };

  // ⚠️ CUÁNDO SE VALE MOVER EL MUEBLE, Y CUÁNDO NO.
  // Girarlo es gratis: la huella no cambia y nada se descoloca. MOVERLO sí
  // cuesta, y choca con dos reglas que ya estaban y son buenas: el escritorio
  // de un privado se recarga al muro, y la gaveta va PEGADA a su escritorio.
  // Así que sólo se mueve cuando hay una razón dura —**sabemos dónde está la
  // puerta**— y cuando el mueble no trae nada pegado que se quedaría huérfano.
  // Sin puerta no se inventa nada: se escoge el giro y se deja donde está.
  const hayPuerta = !!puertaCerca(h, area);
  const traePegado = vecinos.some((v) => choca(h, v, PEGADO));
  const puedeMoverse = opts.mover !== false && hayPuerta && !traePegado;

  // Sólo rot y rot+180: los otros dos cambian la huella y ya no cabría.
  let mejor = null, mejorRot = rot0;
  for (const r of [rot0, (rot0 + 180) % 360]) {
    const e = evaluar(h, area, r, vecinos, puedeMoverse);
    if (!mejor || e.pts > mejor.pts) { mejor = e; mejorRot = r; }
  }
  return { ...c, x: Math.round(mejor.x), y: Math.round(mejor.y), rot: mejorRot };
}

/**
 * Endereza TODA una colocación. Es lo que se llama al final de cualquier
 * acomodo —el de un clic, el de los cuartos y el de la IA— y también después
 * de que el proyectista suelta un mueble con el dedo.
 * @param {Array}  colocacion [{id, area, x, y, rot}]
 * @param {object} byId       id → pieza {w, d, tipo}
 * @param {Array}  areas      las áreas, en el mismo índice que `c.area`
 */
export function enderezarTodo(colocacion, byId, areas) {
  const huella = (c) => { const p = byId[c.id]; if (!p) return null; const { w, d } = dimsDe(p, c.rot || 0); return { x: c.x, y: c.y, w, d }; };
  return colocacion.map((c, i) => {
    const p = byId[c.id];
    if (!p || !MIRA.has(p.tipo)) return c;
    const area = areas[c.area ?? 0] || areas[0];
    if (!area) return c;
    const vecinos = colocacion
      .filter((o, j) => j !== i && (o.area ?? 0) === (c.area ?? 0))
      .map(huella).filter(Boolean);
    return enderezar(c, p, area, vecinos);
  });
}
