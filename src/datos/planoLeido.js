// ============================================================================
//  LECTURA DE PLANO -> ÁREAS DE LA APP
//
//  La edge function `leer-plano` devuelve el levantamiento en MILÍMETROS
//  ABSOLUTOS (origen arriba-izquierda del envolvente) con la forma REAL de
//  cada cuarto: un polígono, o un círculo cuando la sala es redonda. Aquí eso
//  se traduce a lo que el resto de la app ya sabía manejar desde el lienzo
//  "Dibujar mi oficina":
//
//      { nombre, tipo, x, y, ancho, largo, poly, obstaculos }   en METROS
//
//  con `poly` RELATIVO a la esquina del cuarto (así lo produce DibujarPlano y
//  así lo espera la malla del motor).
//
//  POR QUÉ EXISTE ESTE ARCHIVO (2026-08-16): Rodrigo subió una planta orgánica
//  —sala circular, recepción triangular, break trapezoidal, muro curvo— y la
//  app dibujó nueve cajas rectas encimadas. El motor y el plano ya sabían
//  dibujar polígonos; lo que faltaba era que la lectura los produjera y que
//  alguien REVISARA el resultado en vez de dibujarlo a ciegas. `revisarAreas`
//  es esa revisión: mide traslapes y salidas del envolvente sobre una malla y
//  los reporta en español, porque un plano mal leído que se dibuja sin avisar
//  es peor que uno que no se lee.
// ============================================================================

// Un círculo se aproxima con este número de lados: suficiente para que se vea
// redondo en el plano y para que la malla del motor lo llene bien.
const LADOS_CIRCULO = 24;

// Malla de muestreo para medir superficies y traslapes (en mm). 25 cm da un
// error de centésimas de m² y recorre una planta de 30×20 m en 9600 puntos.
const PASO = 250;

// Una puerta vive SOBRE el muro, así que rara vez cae limpia dentro del
// polígono del cuarto: se le da un margen para decidir a quién pertenece.
const TOCA_PUERTA = 700;
// Paso libre delante de la puerta, además de su ancho: el barrido de la hoja
// más el espacio para entrar.
const BARRIDO = 900;

// ¿El punto cae dentro del polígono? (ray casting, mismo criterio que la malla
// del motor: si aquí dijera que sí y allá que no, el mueble se saldría.)
export function dentroPoly(poly, x, y) {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) dentro = !dentro;
  }
  return dentro;
}

// Contorno en mm ABSOLUTOS de un área tal como viene de la lectura.
// Acepta las dos formas y también el formato viejo (sólo x/y/ancho/largo),
// para que una respuesta de la versión anterior no truene.
export function contornoMM(a) {
  if (a?.forma === 'circulo' && a.circulo && a.circulo.r > 0) {
    const { cx, cy, r } = a.circulo;
    const pts = [];
    for (let i = 0; i < LADOS_CIRCULO; i++) {
      const t = (i / LADOS_CIRCULO) * Math.PI * 2;
      pts.push([Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t))]);
    }
    return pts;
  }
  const pts = (a?.puntos || []).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
  if (pts.length >= 3) return pts.map((p) => [Math.round(p.x), Math.round(p.y)]);
  // Formato viejo: rectángulo por x/y/ancho/largo.
  if (Number.isFinite(a?.ancho) && Number.isFinite(a?.largo)) {
    const x = Number.isFinite(a.x) ? a.x : 0, y = Number.isFinite(a.y) ? a.y : 0;
    return [[x, y], [x + a.ancho, y], [x + a.ancho, y + a.largo], [x, y + a.largo]];
  }
  return null;
}

// ¿El punto está dentro del contorno, o a menos de `tol` de alguno de sus
// lados? Se usa para saber a qué cuarto pertenece una puerta.
function cercaDe(pts, x, y, tol) {
  if (dentroPoly(pts, x, y)) return true;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [x1, y1] = pts[j], [x2, y2] = pts[i];
    const dx = x2 - x1, dy = y2 - y1;
    const L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L)) : 0;
    if (Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)) <= tol) return true;
  }
  return false;
}

const bbox = (pts) => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
};

const m = (mm) => +(mm / 1000).toFixed(2);

// Superficie de un polígono en m² (fórmula del zapato, en mm² -> m²).
export function areaM2(pts) {
  let s = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    s += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  }
  return Math.abs(s / 2) / 1e6;
}

// Superficie COMÚN a dos contornos, en m². Se mide sobre una malla en vez de
// con geometría exacta: es más simple y el error es de cm².
function comunM2(A, B) {
  const ba = bbox(A), bb = bbox(B);
  if (ba.x2 <= bb.x || bb.x2 <= ba.x || ba.y2 <= bb.y || bb.y2 <= ba.y) return 0;
  let n = 0;
  for (let y = Math.max(ba.y, bb.y); y < Math.min(ba.y2, bb.y2); y += PASO) {
    for (let x = Math.max(ba.x, bb.x); x < Math.min(ba.x2, bb.x2); x += PASO) {
      if (dentroPoly(A, x, y) && dentroPoly(B, x, y)) n++;
    }
  }
  return (n * PASO * PASO) / 1e6;
}

// Quién está DENTRO de quién. El modelo lo declara en `dentroDe`, pero se
// verifica por geometría y también se DEDUCE: si un cuarto cae casi entero
// dentro de otro, es un cuarto anidado aunque no lo haya dicho. Sin esto, un
// open space trazado por fuera —con la recepción y el break dentro de su
// contorno— se reportaba como tres traslapes y el motor amueblaba encima.
function anidamientos(crudas) {
  const padre = new Map();   // índice hijo -> índice padre
  for (let i = 0; i < crudas.length; i++) {
    for (let j = 0; j < crudas.length; j++) {
      if (i === j) continue;
      const hijo = crudas[i], cand = crudas[j];
      const aH = areaM2(hijo.pts), aC = areaM2(cand.pts);
      if (!(aC > aH)) continue;                       // el padre es el grande
      const dentro = comunM2(hijo.pts, cand.pts) / (aH || 1);
      const declarado = hijo.a.dentroDe === cand.a.nombre;
      if (dentro >= (declarado ? 0.5 : 0.85)) {
        const yaP = padre.get(i);
        if (yaP == null || areaM2(crudas[yaP].pts) > aC) padre.set(i, j);  // el más ajustado
      }
    }
  }
  return padre;
}

// ---------------------------------------------------------------------------
//  Lectura -> áreas de la app (en METROS, con poly relativo)
// ---------------------------------------------------------------------------
export function areasDeLectura(lectura) {
  const crudas = (lectura?.areas || [])
    .map((a) => ({ a, pts: contornoMM(a) }))
    .filter((r) => r.pts && r.pts.length >= 3);

  // Un cuarto dentro de otro (la sala circular en medio del open space) no es
  // un traslape: es un hueco que el cuarto padre no puede amueblar. Se le pasa
  // al padre como obstáculo.
  const padre = anidamientos(crudas);
  const hijos = new Map();   // nombre del padre -> [contornos hijos]
  for (const [h, p] of padre) {
    const n = crudas[p].a.nombre;
    if (!hijos.has(n)) hijos.set(n, []);
    hijos.get(n).push(crudas[h].pts);
  }

  // Las puertas del plano se reparten a los cuartos que tocan. A cada cuarto le
  // dejan dos cosas: el HUECO de barrido, que nadie puede ocupar (antes el
  // motor plantaba un archivero tapando la entrada y decía que todo bien), y el
  // punto desde el que se mide si se LLEGA caminando a cada mueble.
  const puertas = (lectura?.puertas || []).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));

  // ⚠️ EL ANIDAMIENTO SE CALCULABA Y SE TIRABA (2026-08-17). `anidamientos` ya
  // sabe qué cuarto está dentro de cuál, pero eso sólo se usaba para poner
  // obstáculos y no salía de aquí. Sin el dato, el motor no distinguía una ZONA
  // (las 8 islas del plano de Rodrigo, dibujadas punteadas dentro del open
  // space) de un CUARTO con muros, y el 3D le dibujaba muros a las islas.
  // Ahora cada área dice de quién es hija (`dentroDe`) y cuántas hijas tiene
  // (`contiene`). Con eso:
  //   · una zona con `dentroDe` NO lleva muros — no es un cuarto,
  //   · su padre es CIRCULACIÓN: lo amueblado va en las zonas, no en el pasillo.
  const nombreDe = (i) => crudas[i].a.nombre || 'Área';
  const padreDe = new Map();
  for (const [h, p] of padre) padreDe.set(nombreDe(h), nombreDe(p));

  const areas = crudas.map(({ a, pts }, idx) => {
    const b = bbox(pts);
    const obst = (hijos.get(a.nombre) || []).map((hp) => {
      const hb = bbox(hp);
      return {
        x: m(hb.x - b.x), y: m(hb.y - b.y),
        w: m(hb.x2 - hb.x), h: m(hb.y2 - hb.y),
        tipo: 'cuarto',
      };
    });
    // Una puerta le toca a este cuarto si cae dentro de su contorno o a un
    // palmo de él: está SOBRE el muro, así que casi nunca cae limpia adentro.
    const suyas = puertas.filter((p) => cercaDe(pts, p.x, p.y, TOCA_PUERTA));
    for (const p of suyas) {
      const lado = Math.max(p.ancho || 900, 900) + BARRIDO;
      obst.push({
        x: m(p.x - b.x - lado / 2), y: m(p.y - b.y - lado / 2),
        w: m(lado), h: m(lado), tipo: 'puerta',
      });
    }
    return {
      nombre: a.nombre || 'Área',
      ...(a.tipo ? { tipo: a.tipo } : {}),
      // Puestos CONTADOS del dibujo por el lector. Es dato duro: el programa lo
      // respeta en vez de re-estimar por geometría (ver programaDelPlano).
      ...(Number.isFinite(a.puestos) && a.puestos > 0 ? { puestos: a.puestos } : {}),
      ...(padreDe.has(nombreDe(idx)) ? { dentroDe: padreDe.get(nombreDe(idx)) } : {}),
      ...((hijos.get(a.nombre) || []).length ? { contiene: (hijos.get(a.nombre) || []).length } : {}),
      x: m(b.x), y: m(b.y),
      ancho: m(b.x2 - b.x), largo: m(b.y2 - b.y),
      poly: pts.map(([px, py]) => [m(px - b.x), m(py - b.y)]),
      ...(obst.length ? { obstaculos: obst } : {}),
      ...(suyas.length ? { puertas: suyas.map((p) => ({ x: m(p.x - b.x), y: m(p.y - b.y), ancho: m(p.ancho || 900) })) } : {}),
    };
  });

  return { areas, envolvente: lectura?.envolvente || null, puertas };
}

// ---------------------------------------------------------------------------
//  REVISIÓN: ¿la lectura tiene sentido como planta?
//  Devuelve frases en español para enseñárselas al proyectista. No corrige
//  nada por su cuenta: decir "lo leí así y esto no me cuadra" es más útil que
//  dibujar un plano equivocado con cara de seguro.
// ---------------------------------------------------------------------------
export function revisarAreas(lectura) {
  const problemas = [];
  const env = lectura?.envolvente;
  const crudas = (lectura?.areas || [])
    .map((a) => ({ a, pts: contornoMM(a) }))
    .filter((r) => r.pts && r.pts.length >= 3);
  if (!crudas.length) return ['No se reconoció ningún cuarto en el plano.'];

  // 1) Todo dentro del envolvente.
  if (env?.ancho > 0 && env?.largo > 0) {
    const fuera = crudas.filter(({ pts }) => pts.some(([x, y]) =>
      x < -50 || y < -50 || x > env.ancho + 50 || y > env.largo + 50));
    if (fuera.length) {
      problemas.push(`${fuera.length} cuarto(s) se salen del contorno del plano (${fuera.map((f) => f.a.nombre).join(', ')}).`);
    }
  }

  // 2) Traslapes entre cuartos que NO están anidados. Un cuarto DENTRO de otro
  //    es legítimo (la sala de juntas en medio del open space); lo que no lo es
  //    son dos cuartos que se muerden a medias.
  const padre = anidamientos(crudas);
  const anidado = (i, j) => padre.get(i) === j || padre.get(j) === i;
  for (let i = 0; i < crudas.length; i++) {
    for (let j = i + 1; j < crudas.length; j++) {
      if (anidado(i, j)) continue;
      const A = crudas[i], B = crudas[j];
      const m2 = comunM2(A.pts, B.pts);
      const menor = Math.min(areaM2(A.pts), areaM2(B.pts));
      // Menos del 5% del cuarto chico es el grosor de un muro mal trazado.
      if (m2 > 1 && m2 > menor * 0.05) {
        problemas.push(`"${A.a.nombre}" y "${B.a.nombre}" se enciman ${m2.toFixed(1)} m².`);
      }
    }
  }

  // 3) La suma de los cuartos no puede pasar la superficie del plano (los
  //    anidados no se cuentan dos veces).
  if (env?.ancho > 0 && env?.largo > 0) {
    const sum = crudas.reduce((s, r, i) => s + (padre.has(i) ? 0 : areaM2(r.pts)), 0);
    const total = (env.ancho * env.largo) / 1e6;
    if (sum > total * 1.05) {
      problemas.push(`Los cuartos suman ${sum.toFixed(0)} m² y el plano mide ${total.toFixed(0)} m².`);
    }
  }

  return problemas;
}
