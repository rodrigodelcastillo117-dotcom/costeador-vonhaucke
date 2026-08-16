// ============================================================================
//  TRAZO A MANO ALZADA -> CONTORNO DE CUARTO
//
//  Rodrigo (2026-08-16): "siempre es líneas rectas, muchas oficinas tienen
//  curvas, vueltas, etc., y tienes que ir poniendo punto por punto hasta cerrar
//  el cuadrado para hacer un privado. ¿No hay alguna mejor manera? ¿Más fácil?"
//
//  La hay: que dibuje de corrido con el dedo y que el programa entienda el
//  trazo. Un trazo crudo del dedo trae 300 puntos temblorosos; un contorno de
//  cuarto son 4 esquinas, o una curva. Aquí se hace ese trabajo en tres pasos,
//  y en este orden porque cada uno depende del anterior:
//
//    1) SIMPLIFICAR (Douglas-Peucker): tira los puntos que no cambian la forma.
//       300 puntos quedan en 6 u 8, y una curva conserva los que la dibujan.
//    2) ENDEREZAR: un muro trazado a pulso sale con 3° de inclinación. Los
//       tramos casi horizontales o casi verticales se ponen rectos de verdad y
//       se alinean con su vecino. Lo que NO está cerca de recto se deja: eso es
//       la curva del cliente y respetarla es justo lo que se pidió.
//    3) CERRAR: si terminaste cerca de donde empezaste, el cuarto se cierra
//       solo. Nadie debería tener que atinarle al punto de salida.
//
//  Todo en METROS. Sin snap a cuadrícula: un snap de 50 cm convierte cualquier
//  curva en escalones.
// ============================================================================

// ---- 1) SIMPLIFICAR --------------------------------------------------------
// Douglas-Peucker: se queda con los puntos que de verdad definen la forma.
export function simplificar(pts, tol = 0.15) {
  if (!pts || pts.length <= 2) return pts ? [...pts] : [];
  const dist = ([px, py], [ax, ay], [bx, by]) => {
    const dx = bx - ax, dy = by - ay;
    const L = dx * dx + dy * dy;
    if (!L) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };
  const rec = (ini, fin) => {
    let peor = 0, idx = -1;
    for (let i = ini + 1; i < fin; i++) {
      const d = dist(pts[i], pts[ini], pts[fin]);
      if (d > peor) { peor = d; idx = i; }
    }
    if (peor <= tol || idx < 0) return [pts[ini]];
    return [...rec(ini, idx), ...rec(idx, fin)];
  };
  return [...rec(0, pts.length - 1), pts[pts.length - 1]];
}

// ---- 2) ENDEREZAR ----------------------------------------------------------
// Un tramo a menos de `gradosRectos` de la horizontal o la vertical se pone
// recto. Los demás se dejan como están: ahí está la curva.
export function enderezar(pts, gradosRectos = 12) {
  if (!pts || pts.length < 2) return pts ? [...pts] : [];
  const out = pts.map((p) => [...p]);
  const lim = Math.tan((gradosRectos * Math.PI) / 180);
  for (let i = 0; i < out.length - 1; i++) {
    const [x1, y1] = out[i], [x2, y2] = out[i + 1];
    const dx = x2 - x1, dy = y2 - y1;
    if (!dx && !dy) continue;
    if (Math.abs(dy) <= Math.abs(dx) * lim) out[i + 1] = [x2, y1];        // casi horizontal
    else if (Math.abs(dx) <= Math.abs(dy) * lim) out[i + 1] = [x1, y2];   // casi vertical
  }
  return out;
}

// ---- 3) CERRAR -------------------------------------------------------------
// Si el final quedó cerca del principio, se cierra el contorno. Devuelve el
// polígono SIN repetir el primer punto al final (es lo que espera el motor).
export function cerrar(pts, tol = 0.9) {
  if (!pts || pts.length < 3) return pts ? [...pts] : [];
  const out = pts.map((p) => [...p]);
  const [x0, y0] = out[0];
  const [xn, yn] = out[out.length - 1];
  if (Math.hypot(xn - x0, yn - y0) <= tol) out.pop();
  // Y si el último tramo quedó casi recto contra el primero, se ajusta para que
  // el cuarto cierre limpio y no quede una muesca de 3 cm en la esquina.
  if (out.length >= 3) {
    const u = out[out.length - 1];
    if (Math.abs(u[0] - x0) < 0.25) u[0] = x0;
    if (Math.abs(u[1] - y0) < 0.25) u[1] = y0;
  }
  return out;
}

// ---- Todo junto ------------------------------------------------------------
// De un trazo crudo del dedo al contorno del cuarto. `curvo` desactiva el
// enderezado, para cuando el trazo ES una curva y no se quiere tocar.
export function contornoDeTrazo(crudo, { tol = 0.15, rectos = 12, curvo = false } = {}) {
  const simple = simplificar(crudo, tol);
  const recto = curvo ? simple : enderezar(simple, rectos);
  const poly = cerrar(recto);
  // Menos de 3 puntos no es un cuarto: se avisa en vez de inventar uno.
  return poly.length >= 3 ? poly : null;
}

// Superficie de un polígono, en m² (fórmula del agrimensor).
export const areaDe = (p) => Math.abs(p.reduce((s, [x, y], i) => {
  const [x2, y2] = p[(i + 1) % p.length];
  return s + (x * y2 - x2 * y);
}, 0)) / 2;


// ---- SELLOS DE CUARTO ------------------------------------------------------
//  Rodrigo: "¿cómo podemos hacer para que pongas más rápido privado, sala de
//  juntas, baños, etc.?" Dibujar cada cuarto es el camino largo. Lo rápido es
//  SELLARLO: un toque deja el cuarto con su medida típica, su nombre y su tipo
//  —que es lo que el motor necesita para repartir los muebles—, y si hace falta
//  se corrige después. Las medidas salen de lo que Von Haucke arma todos los
//  días, no de un catálogo genérico.
export const SELLOS = [
  { tipo: 'privado',   et: 'Privado',     w: 3.5, h: 4.0 },
  { tipo: 'juntas',    et: 'Sala juntas', w: 5.0, h: 4.0 },
  { tipo: 'servicio',  et: 'Baño',        w: 2.5, h: 2.0 },
  { tipo: 'recepcion', et: 'Recepción',   w: 5.0, h: 4.0 },
  { tipo: 'lounge',    et: 'Comedor',     w: 6.0, h: 4.0 },
  { tipo: 'open',      et: 'Open space',  w: 10.0, h: 8.0 },
];

// Pega el cuarto nuevo a los que ya están: si un borde queda a menos de `tol`
// del borde de otro, se alinean EXACTO y comparten muro. Sin esto queda un
// pasillo de 20 cm entre privados que no existe en la obra.
export function pegarAVecinos(caja, otros, tol = 0.6) {
  let { x, y, w, h } = caja;
  for (const o of otros) {
    // Horizontal: pegar mi izquierda a su derecha, o alinear izquierdas.
    for (const [mio, suyo] of [[x, o.x + o.w], [x, o.x], [x + w, o.x], [x + w, o.x + o.w]]) {
      if (Math.abs(mio - suyo) <= tol) { x += suyo - mio; break; }
    }
    for (const [mio, suyo] of [[y, o.y + o.h], [y, o.y], [y + h, o.y], [y + h, o.y + o.h]]) {
      if (Math.abs(mio - suyo) <= tol) { y += suyo - mio; break; }
    }
  }
  return { x: +x.toFixed(2), y: +y.toFixed(2), w, h };
}
