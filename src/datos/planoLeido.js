// ============================================================================
// LECTURA DE PLANO -> ÁREAS CANÓNICAS DE LA APP
// Entrada: geometría absoluta en mm desde `leer-plano`.
// Salida: áreas en metros, con poly relativo y evidencia de puerta preservada.
// ============================================================================

const LADOS_CIRCULO = 24;
const PASO = 250;
const TOCA_PUERTA = 700;
const BARRIDO = 900;

export function dentroPoly(poly, x, y) {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi) dentro = !dentro;
  }
  return dentro;
}

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
  if (Number.isFinite(a?.ancho) && Number.isFinite(a?.largo)) {
    const x = Number.isFinite(a.x) ? a.x : 0;
    const y = Number.isFinite(a.y) ? a.y : 0;
    return [[x, y], [x + a.ancho, y], [x + a.ancho, y + a.largo], [x, y + a.largo]];
  }
  return null;
}

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
const m = (mm) => +(mm / 1000).toFixed(3);

export function areaM2(pts) {
  let s = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    s += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  }
  return Math.abs(s / 2) / 1e6;
}

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

// ACOMODO 10 · VH-A10-01: un documento con varias plantas (una por hoja) trae los cuartos de cada nivel en el
// MISMO sistema de coordenadas. Dos cosas son de la misma planta salvo que ambas declaren nivel (u hoja) y
// sean distintos. Sin esto, la DIRECCIÓN del nivel 2 se volvía un "cuarto" (obstáculo) dentro de la SALA DE
// JUNTAS del nivel 1, y sus columnas y puertas caían en cuartos de otra planta.
const nivelDe = (o) => String(o?.nivel ?? '').trim();
const hojaDe = (o) => (Number.isInteger(Number(o?.pagina)) && Number(o.pagina) > 0 ? Number(o.pagina) : null);
export function mismaPlanta(a, b) {
  const na = nivelDe(a), nb = nivelDe(b);
  if (na && nb) return na === nb;
  const ha = hojaDe(a), hb = hojaDe(b);
  if (ha != null && hb != null) return ha === hb;
  return true;
}

function anidamientos(crudas) {
  const padre = new Map();
  for (let i = 0; i < crudas.length; i++) {
    for (let j = 0; j < crudas.length; j++) {
      if (i === j) continue;
      const hijo = crudas[i], cand = crudas[j];
      if (!mismaPlanta(hijo.a, cand.a)) continue;
      const aH = areaM2(hijo.pts), aC = areaM2(cand.pts);
      if (!(aC > aH)) continue;
      const dentro = comunM2(hijo.pts, cand.pts) / (aH || 1);
      const declarado = hijo.a.dentroDe === cand.a.nombre;
      if (dentro >= (declarado ? 0.5 : 0.85)) {
        const yaP = padre.get(i);
        if (yaP == null || areaM2(crudas[yaP].pts) > aC) padre.set(i, j);
      }
    }
  }
  return padre;
}

function puertaLocal(p, b) {
  const base = {
    x: m(p.x - b.x),
    y: m(p.y - b.y),
    ancho: Number.isFinite(Number(p.ancho)) && Number(p.ancho) > 0 ? m(Number(p.ancho)) : null,
    ...(p.procedencia ? { procedencia: p.procedencia } : {}),
    ...(p.evidencia ? { evidencia: p.evidencia } : {}),
    ...(Number.isInteger(Number(p.pagina)) && Number(p.pagina) > 0 ? { pagina: Number(p.pagina) } : {}),
  };
  if (typeof p.tieneBarrido !== 'boolean') return base;
  const rich = {
    ...base,
    tieneBarrido: p.tieneBarrido,
    sentido: p.sentido || 'desconocido',
    barridoDeg: Number.isFinite(Number(p.barridoDeg)) ? Number(p.barridoDeg) : null,
    anguloCerradaDeg: Number.isFinite(Number(p.anguloCerradaDeg)) ? Number(p.anguloCerradaDeg) : null,
    confianza: p.confianza || 'baja',
  };
  if (p.tieneBarrido && Number.isFinite(p.bisagraX) && Number.isFinite(p.bisagraY)) {
    rich.bisagraX = m(p.bisagraX - b.x);
    rich.bisagraY = m(p.bisagraY - b.y);
  }
  return rich;
}

export function areasDeLectura(lectura) {
  const crudas = (lectura?.areas || [])
    .map((a) => ({ a, pts: contornoMM(a) }))
    .filter((r) => r.pts && r.pts.length >= 3);

  const padre = anidamientos(crudas);
  const hijos = new Map();
  for (const [h, p] of padre) {
    const n = crudas[p].a.nombre;
    if (!hijos.has(n)) hijos.set(n, []);
    hijos.get(n).push(crudas[h].pts);
  }

  const puertas = (lectura?.puertas || []).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
  // L1 (VH-140): columnas/obstáculos fijos del plano → obstáculo 'columna' del cuarto MÁS CHICO que las contiene.
  const columnas = (lectura?.columnas || []).filter((c) => Number.isFinite(c?.x) && Number.isFinite(c?.y));
  const duenoDeColumna = new Map();
  columnas.forEach((c, k) => {
    let mejor = -1, mejorM2 = Infinity;
    crudas.forEach(({ a, pts }, i) => { if (mismaPlanta(a, c) && dentroPoly(pts, c.x, c.y)) { const a2 = areaM2(pts); if (a2 < mejorM2) { mejorM2 = a2; mejor = i; } } });
    if (mejor >= 0) duenoDeColumna.set(k, mejor);
  });
  const nombreDe = (i) => crudas[i].a.nombre || 'Área';
  const padreDe = new Map();
  for (const [h, p] of padre) padreDe.set(nombreDe(h), nombreDe(p));

  const areas = crudas.map(({ a, pts }, idx) => {
    const b = bbox(pts);
    const obst = (hijos.get(a.nombre) || []).map((hp) => {
      const hb = bbox(hp);
      return { x: m(hb.x - b.x), y: m(hb.y - b.y), w: m(hb.x2 - hb.x), h: m(hb.y2 - hb.y), tipo: 'cuarto' };
    });
    columnas.forEach((c, k) => {
      if (duenoDeColumna.get(k) !== idx) return;
      const lado = Number(c.lado) > 0 ? Number(c.lado) : 400;
      obst.push({ x: m(c.x - b.x - lado / 2), y: m(c.y - b.y - lado / 2), w: m(lado), h: m(lado), tipo: 'columna', ...(c.clave ? { clave: String(c.clave) } : {}) });
    });
    const suyas = puertas.filter((p) => mismaPlanta(a, p) && cercaDe(pts, p.x, p.y, TOCA_PUERTA));
    const puertasPendientes = [];
    for (const p of suyas) {
      const anchoConocido = Number.isFinite(Number(p.ancho)) && Number(p.ancho) > 0;
      const barridoConocido = p.tieneBarrido === true
        && Number.isFinite(Number(p.bisagraX))
        && Number.isFinite(Number(p.bisagraY));
      if (anchoConocido && barridoConocido) {
        const lado = Math.max(Number(p.ancho), 900) + BARRIDO;
        obst.push({ x: m(p.x - b.x - lado / 2), y: m(p.y - b.y - lado / 2), w: m(lado), h: m(lado), tipo: 'puerta' });
      } else {
        puertasPendientes.push({
          x: m(p.x - b.x),
          y: m(p.y - b.y),
          ...(anchoConocido ? { ancho: m(Number(p.ancho)) } : {}),
          motivo: !anchoConocido ? 'ANCHO_PUERTA_DESCONOCIDO' : 'BARRIDO_PUERTA_NO_VERIFICADO',
        });
      }
    }
    return {
      nombre: a.nombre || 'Área',
      ...(a.tipo ? { tipo: a.tipo } : {}),
      // Cierre ChatGPT P1-ARQ-01: escritorio físico ≠ silla física ≠ puesto. Si el lector declara ESCRITORIOS, ésos son
      // los puestos (nunca se reducen porque haya menos sillas dibujadas); lector viejo sin el campo: `puestos` como antes.
      ...((Number(a.escritorios) > 0 ? Number(a.escritorios) : Number(a.puestos)) > 0 ? { puestos: Number(a.escritorios) > 0 ? Number(a.escritorios) : Number(a.puestos) } : {}),
      ...(Number(a.escritorios) > 0 ? { escritorios: Number(a.escritorios) } : {}),
      ...(Number.isFinite(Number(a.sillas)) && Number(a.sillas) > 0 ? { sillasDibujadas: Number(a.sillas) } : {}),
      ...(Number.isFinite(Number(a.asientos)) && Number(a.asientos) > 0 ? { asientos: Number(a.asientos) } : {}),
      ...(a.confianza ? { confianza: a.confianza } : {}),
      ...(a.procedencia ? { procedencia: a.procedencia } : {}),
      ...(a.evidencia ? { evidencia: a.evidencia } : {}),
      ...(Number.isInteger(Number(a.pagina)) && Number(a.pagina) > 0 ? { pagina: Number(a.pagina) } : {}),
      ...(String(a.nivel || '').trim() ? { nivel: String(a.nivel).trim() } : {}),
      ...(padreDe.has(nombreDe(idx)) ? { dentroDe: padreDe.get(nombreDe(idx)) } : {}),
      ...((hijos.get(a.nombre) || []).length ? { contiene: (hijos.get(a.nombre) || []).length } : {}),
      x: m(b.x), y: m(b.y),
      ancho: m(b.x2 - b.x), largo: m(b.y2 - b.y),
      poly: pts.map(([px, py]) => [m(px - b.x), m(py - b.y)]),
      ...(obst.length ? { obstaculos: obst } : {}),
      ...(suyas.length ? { puertas: suyas.map((p) => puertaLocal(p, b)) } : {}),
      ...(puertasPendientes.length ? { puertasPendientes } : {}),
    };
  });

  const columnasSinCuarto = columnas.filter((_, k) => !duenoDeColumna.has(k)).length;
  return { areas, envolvente: lectura?.envolvente || null, puertas, columnas: columnas.length, columnasSinCuarto, niveles: nivelesDeLectura(lectura) };
}

/** Niveles/plantas distintos que declaran las áreas (documentos con varias plantas). */
export function nivelesDeLectura(lectura) {
  return [...new Set((lectura?.areas || []).map((a) => String(a?.nivel || '').trim()).filter(Boolean))];
}

/** L1: documento con varias plantas → se acomoda UN nivel a la vez (las áreas de otros niveles no se mezclan
 *  en la misma planta; se cotizan como otro proyecto). `nivel` = el que eligió la persona en la compuerta
 *  (2026-10-19, C4: antes siempre el primero y el segundo nivel no se podía acomodar nunca); sin elección o
 *  con uno que no existe, el primero. Sin niveles declarados, todas. Única regla (Voni, Acomodo y pruebas). */
export function areasDelNivelUsado(areas = [], niveles = [], nivel = null) {
  const lista = Array.isArray(areas) ? areas : [];
  if (!(Array.isArray(niveles) && niveles.length > 1)) return lista;
  const elegido = niveles.includes(nivel) ? nivel : niveles[0];
  return lista.filter((a) => !a.nivel || a.nivel === elegido);
}

// ---------------------------------------------------------------------------
//  REVISIÓN: ¿la lectura tiene sentido como planta?
//  Devuelve frases en español para enseñárselas al proyectista. No corrige
//  nada por su cuenta: decir "lo leí así y esto no me cuadra" es más útil que
//  dibujar un plano equivocado con cara de seguro.
// ---------------------------------------------------------------------------
// ESCALA (VH-043, 2026-10-11). El lector devuelve la cota general (envolvente) y las
// cotas de los ejes (grid). Si el plano trae ejes, la suma de sus segmentos TIENE que
// cuadrar con la cota general: es la única comprobación determinista de que la escala
// no salió inventada. Nadie la revisaba. Tolerancia 3 % (redondeos de cota).
export function validarEscala(lectura, tol = 0.03) {
  const problemas = [];
  const env = lectura?.envolvente;
  const g = lectura?.grid || {};
  const suma = (xs) => (Array.isArray(xs) ? xs.filter((x) => Number.isFinite(x) && x > 0).reduce((a, b) => a + b, 0) : 0);
  const m = (mm) => (mm / 1000).toFixed(2);
  const sh = suma(g.horizontal), sv = suma(g.vertical);
  if (env?.ancho > 0 && sh > 0 && Math.abs(sh - env.ancho) > env.ancho * tol) {
    problemas.push(`La cota general de ancho (${m(env.ancho)} m) no cuadra con la suma de los ejes (${m(sh)} m): revisa la escala.`);
  }
  if (env?.largo > 0 && sv > 0 && Math.abs(sv - env.largo) > env.largo * tol) {
    problemas.push(`La cota general de largo (${m(env.largo)} m) no cuadra con la suma de los ejes (${m(sv)} m): revisa la escala.`);
  }
  return problemas;
}

export function revisarAreas(lectura) {
  const problemas = [];
  const env = lectura?.envolvente;
  const crudas = (lectura?.areas || [])
    .map((a) => ({ a, pts: contornoMM(a) }))
    .filter((r) => r.pts && r.pts.length >= 3);
  if (!crudas.length) return ['No se reconoció ningún cuarto en el plano.'];

  // 0) Escala: cota general vs. ejes (determinista, antes que todo lo demás).
  problemas.push(...validarEscala(lectura));
  // 0b) P1-ARQ-01: escritorios y sillas dibujados que no coinciden → se dice (los puestos son los escritorios).
  for (const { a } of crudas) {
    const e = Number(a.escritorios), s = Number(a.sillas);
    if (e > 0 && s > 0 && e !== s) problemas.push(`«${a.nombre}»: ${e} escritorios observados y ${s} sillas observadas. Tomé ${e} puestos (los escritorios); capacidad por confirmar.`);
  }

  // 1) Todo dentro del envolvente.
  if (env?.ancho > 0 && env?.largo > 0) {
    const fuera = crudas.filter(({ pts }) => pts.some(([x, y]) => x < -50 || y < -50 || x > env.ancho + 50 || y > env.largo + 50));
    if (fuera.length) problemas.push(`${fuera.length} cuarto(s) se salen del contorno del plano (${fuera.map((f) => f.a.nombre).join(', ')}).`);
  }

  const padre = anidamientos(crudas);
  const anidado = (i, j) => padre.get(i) === j || padre.get(j) === i;
  for (let i = 0; i < crudas.length; i++) {
    for (let j = i + 1; j < crudas.length; j++) {
      if (anidado(i, j)) continue;
      const A = crudas[i], B = crudas[j];
      if (!mismaPlanta(A.a, B.a)) continue;   // VH-A10-01: plantas distintas se dibujan encimadas a propósito
      const m2 = comunM2(A.pts, B.pts);
      const menor = Math.min(areaM2(A.pts), areaM2(B.pts));
      if (m2 > 1 && m2 > menor * 0.05) problemas.push(`"${A.a.nombre}" y "${B.a.nombre}" se enciman ${m2.toFixed(1)} m².`);
    }
  }

  if (env?.ancho > 0 && env?.largo > 0) {
    // VH-A10-01: el contorno es de UNA planta; con varios niveles la suma se compara nivel por nivel.
    const porNivel = new Map();
    crudas.forEach((r, i) => { const k = nivelDe(r.a); porNivel.set(k, (porNivel.get(k) || 0) + (padre.has(i) ? 0 : areaM2(r.pts))); });
    const sum = Math.max(...porNivel.values());
    const total = (env.ancho * env.largo) / 1e6;
    if (sum > total * 1.05) problemas.push(`Los cuartos suman ${sum.toFixed(0)} m² y el plano mide ${total.toFixed(0)} m².`);
  }

  for (const { a, pts } of crudas) {
    const b = bbox(pts);
    const w = (b.x2 - b.x) / 1000, h = (b.y2 - b.y) / 1000;
    const nom = a.nombre || 'Área';
    if (w < 0.5 || h < 0.5) problemas.push(`"${nom}" quedó diminuto (${w.toFixed(2)}×${h.toFixed(2)} m): puede ser un muro o una cota leída como cuarto.`);
    else if (w > 50 || h > 50) problemas.push(`"${nom}" quedó enorme (${w.toFixed(1)}×${h.toFixed(1)} m): revisa la escala del plano.`);
    else {
      const larg = Math.max(w, h), cort = Math.min(w, h);
      if (cort > 0 && larg / cort > 12 && cort < 1) problemas.push(`"${nom}" es una astilla (${w.toFixed(2)}×${h.toFixed(2)} m): probablemente un muro, no un cuarto.`);
    }
  }

  const vistos = new Set();
  const dupAvisado = new Set();
  for (const { a } of crudas) {
    const n = String(a.nombre || '').trim().toLowerCase();
    if (!n) continue;
    if (vistos.has(n) && !dupAvisado.has(n)) {
      problemas.push(`El cuarto "${a.nombre}" aparece más de una vez: puede ser una doble lectura.`);
      dupAvisado.add(n);
    }
    vistos.add(n);
  }

  const puertas = (lectura?.puertas || []).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
  const huerfanas = puertas.filter((p) => !crudas.some(({ pts }) => cercaDe(pts, p.x, p.y, TOCA_PUERTA)));
  if (huerfanas.length) problemas.push(`${huerfanas.length} puerta(s) no caen sobre ningún cuarto: revisa dónde está el acceso.`);

  const sinAncho = puertas.filter((p) => !(Number.isFinite(Number(p.ancho)) && Number(p.ancho) > 0));
  if (sinAncho.length) problemas.push(`${sinAncho.length} puerta(s) no tienen ancho verificable: no se inventa 900 mm; confirma la cota antes de aprobar el acomodo.`);

  const sinBarrido = puertas.filter((p) =>
    p.tieneBarrido !== true
    || !Number.isFinite(Number(p.bisagraX))
    || !Number.isFinite(Number(p.bisagraY))
  );
  if (sinBarrido.length) problemas.push(`${sinBarrido.length} puerta(s) no tienen barrido verificable: confirma bisagra y sentido antes de aprobar el acomodo.`);

  return problemas;
}

export function resumenLectura(lectura) {
  const crudas = (lectura?.areas || [])
    .map((a) => ({ a, pts: contornoMM(a) }))
    .filter((r) => r.pts && r.pts.length >= 3);
  const problemas = revisarAreas(lectura);
  const padre = anidamientos(crudas);
  const m2 = crudas.reduce((s, r, i) => s + (padre.has(i) ? 0 : areaM2(r.pts)), 0);
  const puertas = (lectura?.puertas || []).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
  const puertasPendientes = puertas.filter((p) =>
    !(Number.isFinite(Number(p.ancho)) && Number(p.ancho) > 0)
    || p.tieneBarrido !== true
    || !Number.isFinite(Number(p.bisagraX))
    || !Number.isFinite(Number(p.bisagraY))
  ).length;
  const nivel = !crudas.length ? 'nula' : problemas.length === 0 ? 'alta' : problemas.length <= 2 ? 'media' : 'baja';
  const columnas = (lectura?.columnas || []).filter((c) => Number.isFinite(c?.x) && Number.isFinite(c?.y));
  const niveles = nivelesDeLectura(lectura);
  return {
    columnas: columnas.length,
    niveles,
    cuartos: crudas.length,
    m2: +m2.toFixed(1),
    puertas: puertas.length,
    puertasVerificadas: puertas.length - puertasPendientes,
    puertasPendientes,
    problemas,
    nProblemas: problemas.length,
    nivel,
    confiable: problemas.length === 0 && crudas.length > 0,
  };
}
