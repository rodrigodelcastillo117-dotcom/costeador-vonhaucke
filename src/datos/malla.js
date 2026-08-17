// ============================================================================
//  EMPACADOR SOBRE MALLA  ·  acomoda dentro de una forma REAL (no sólo cajas).
//
//  El empacador viejo asume que el cuarto es un rectángulo limpio. Una oficina
//  de verdad es una L, tiene columnas en medio y una escalera que no se amuebla.
//  Aquí el espacio se rasteriza a una malla de 10 cm:
//
//     libre = está dentro del polígono  Y  fuera de todo obstáculo
//
//  y cada mueble se coloca en la primera posición donde su huella (más su
//  holgura) cae completa sobre celdas libres. Con sumas acumuladas la consulta
//  "¿está libre este rectángulo?" es O(1), así que se puede barrer todo.
//
//  Garantiza: nada encimado, nada fuera de la forma, nada sobre una columna o
//  escalera. Lo que no quepa se REPORTA — no se miente diciendo que cabe.
//  Todo en mm, coordenadas locales al área (origen arriba-izquierda).
// ============================================================================

import { regla } from './reglas.js';
import { enderezarTodo } from './orientacion.js';

export const CELDA = 100;        // 10 cm por celda
const PASO_OBST = 250;           // no pegar muebles a una columna/escalera
const ZOCALO = 100;              // separación mínima al muro (zócalo / rodapié)
const PEGADA = 6;                // celdas (60 cm): hasta aquí una gaveta cuenta como PEGADA a su escritorio

// Espacio de USO que necesita cada mueble además de su huella: la silla de un
// escritorio, el paso alrededor de una mesa de juntas, abrir un cajón. Sin esto
// el motor contesta "sí cabe" apilando muebles a 15 cm — cabe en el papel y no
// se puede usar. Se reserva MEDIO por lado, así dos muebles vecinos comparten
// el pasillo de en medio en vez de pedir uno cada quien.
//  Los números salen de las REGLAS de Von Haucke (tabla `reglas`), no de aquí:
//  Rodrigo dictó "mínimo 90 cm libres para que pase una persona" y esa regla
//  tiene que mandar en el motor, no quedarse escrita en una junta.
const usoDe = (tipo, p) => {
  const circ = regla('circulacion_min');            // 900 mm por omisión
  if (tipo === 'juntas') return regla('holgura_juntas');
  if (tipo === 'guarda') return regla('holgura_guarda');
  if (tipo === 'escritorio') {
    // ⚠️ UNA BANCA DOBLE TIENE GENTE DE LOS DOS LADOS (2026-08-17). La holgura
    // se reparte MEDIA POR LADO, así que los 1000 de aquí abajo dejan 500 mm
    // —y una silla mide 600—. Con vecinos no se nota (500+500 = un pasillo de
    // 1000), pero contra un MURO no hay con quién compartir: medido, las dos
    // bancas del open space quedaban a 500 mm del muro y los 3 puestos de la
    // hilera de enfrente caían FUERA del cuarto (y = −160). Media banca de 6
    // usuarios era inservible, y el cliente lo recibía dibujado así.
    // Una banca doble se reconoce por el fondo, igual que en el dibujo 3D
    // (`PlanoAcomodo.jsx`: `bench = F > 1000`).
    // 1320 = 660 por lado, y 660 es EXACTAMENTE lo que pide una silla: 600 de
    // silla + los 60 que la separan de la cubierta. No es un número redondo a
    // ojo, es el barrido (`scratchpad/mide-cabida.mjs`), sillas sentadas /
    // cabida contra el motor publicado:
    //     1200 → 3/14 sentadas   (no alcanza para la silla)
    //     1320 → 12/14 sentadas  · misma cabida que el motor publicado
    //     1400 → 12/14 sentadas  · misma cabida
    //     1600 → 12/14 sentadas  · PIERDE cabida (6 bancas en 15×10: 34/38)
    //     1800 → 12/14 sentadas  · pierde mucha (22/38)
    // Y 660+660 = 1320 también deja que dos bancas vecinas se sienten espalda
    // con espalda (600+600) compartiendo el pasillo, que es para lo que existe
    // el reparto "medio por lado".
    const doble = p && Math.min(p.w ?? 0, p.d ?? 0) > 1000;
    if (doble) return 1320;
    return Math.max(1000, circ);                    // silla + paso detrás
  }
  if (tipo === 'mampara') return 200;
  // Los demás comparten pasillo con su vecino: medio de la circulación por lado.
  return Math.max(400, circ / 2);
};
const USO = {
  get escritorio() { return usoDe('escritorio'); },
  get juntas() { return usoDe('juntas'); },
  get guarda() { return usoDe('guarda'); },
};

// ¿El punto cae dentro del polígono? (ray casting)
export function dentroPoly(poly, x, y) {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) dentro = !dentro;
  }
  return dentro;
}

// Malla de celdas bloqueadas + sumas acumuladas para consultar rectángulos.
class Malla {
  constructor(ancho, largo, poly, obstaculos) {
    this.cx = Math.max(1, Math.ceil(ancho / CELDA));
    this.cy = Math.max(1, Math.ceil(largo / CELDA));
    this.bloq = new Uint8Array(this.cx * this.cy);
    for (let j = 0; j < this.cy; j++) {
      for (let i = 0; i < this.cx; i++) {
        const px = (i + 0.5) * CELDA, py = (j + 0.5) * CELDA;
        let malo = poly && poly.length >= 3 ? !dentroPoly(poly, px, py) : false;
        if (!malo) {
          for (const o of obstaculos || []) {
            if (px >= o.x - PASO_OBST && px <= o.x + o.w + PASO_OBST &&
                py >= o.y - PASO_OBST && py <= o.y + o.h + PASO_OBST) { malo = true; break; }
          }
        }
        if (malo) this.bloq[j * this.cx + i] = 1;
      }
    }
    // Copia de lo que es MURO (o fuera del cuarto, o columna) antes de meter un
    // solo mueble. "Recargarse" significa contra el edificio, no contra otro
    // mueble: sin esta distinción las guardas se pegaban a la primera banca que
    // encontraban y quedaban flotando en medio del open space.
    this.fijo = this.bloq.slice();
    this._sumar();
  }

  _sumar() {
    const { cx, cy, bloq } = this;
    const S = new Int32Array((cx + 1) * (cy + 1));
    for (let j = 0; j < cy; j++) {
      for (let i = 0; i < cx; i++) {
        S[(j + 1) * (cx + 1) + (i + 1)] =
          bloq[j * cx + i] + S[j * (cx + 1) + (i + 1)] + S[(j + 1) * (cx + 1) + i] - S[j * (cx + 1) + i];
      }
    }
    this.S = S;
  }

  // ¿Todas las celdas del rectángulo (en celdas) están libres?
  libre(i0, j0, iw, jh) {
    if (i0 < 0 || j0 < 0 || i0 + iw > this.cx || j0 + jh > this.cy) return false;
    const { S, cx } = this;
    const a = S[j0 * (cx + 1) + i0], b = S[j0 * (cx + 1) + i0 + iw];
    const c = S[(j0 + jh) * (cx + 1) + i0], d = S[(j0 + jh) * (cx + 1) + i0 + iw];
    return d - b - c + a === 0;
  }

  ocupar(i0, j0, iw, jh) {
    for (let j = j0; j < j0 + jh && j < this.cy; j++)
      for (let i = i0; i < i0 + iw && i < this.cx; i++) this.bloq[j * this.cx + i] = 1;
    this._sumar();
  }

  // Fuera del cuarto también cuenta como "hay muro": es lo que permite pegar un
  // escritorio contra la pared del fondo y no dejarlo flotando en medio.
  topa(i, j) {
    if (i < 0 || j < 0 || i >= this.cx || j >= this.cy) return true;
    return this.fijo[j * this.cx + i] === 1;
  }

  // Cuántas celdas del borde del rectángulo tienen MURO pegado, por lado. Con
  // esto se decide contra qué pared se recarga cada mueble.
  contacto(i0, j0, iw, jh) {
    let arriba = 0, abajo = 0, izq = 0, der = 0;
    for (let i = i0; i < i0 + iw; i++) {
      if (this.topa(i, j0 - 1)) arriba++;
      if (this.topa(i, j0 + jh)) abajo++;
    }
    for (let j = j0; j < j0 + jh; j++) {
      if (this.topa(i0 - 1, j)) izq++;
      if (this.topa(i0 + iw, j)) der++;
    }
    return { arriba, abajo, izq, der, total: arriba + abajo + izq + der };
  }

  // Celdas libres alcanzables caminando desde `desde` (celdas de puerta).
  // Es la comprobación de CIRCULACIÓN: un puesto al que no se llega no sirve,
  // aunque quepa. Devuelve un Uint8Array con 1 en lo alcanzable.
  alcanzable(desde) {
    const { cx, cy } = this;
    const vis = new Uint8Array(cx * cy);
    const cola = [];
    for (const [i, j] of desde) {
      if (i < 0 || j < 0 || i >= cx || j >= cy) continue;
      if (this.bloq[j * cx + i] || vis[j * cx + i]) continue;
      vis[j * cx + i] = 1; cola.push(j * cx + i);
    }
    for (let k = 0; k < cola.length; k++) {
      const p = cola[k], i = p % cx, j = (p - i) / cx;
      const vecinos = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]];
      for (const [a, b] of vecinos) {
        if (a < 0 || b < 0 || a >= cx || b >= cy) continue;
        const q = b * cx + a;
        if (this.bloq[q] || vis[q]) continue;
        vis[q] = 1; cola.push(q);
      }
    }
    return vis;
  }
}

const celdas = (mm) => Math.max(1, Math.ceil(mm / CELDA));

// DÓNDE VA CADA MUEBLE dentro de su cuarto. Antes se tomaba "el primer hueco
// libre" barriendo de arriba-izquierda a abajo-derecha: por eso la mesa de
// juntas quedaba descentrada en su sala y los escritorios flotaban en medio del
// cuarto en vez de recargarse. Éste es el criterio del proyectista:
//   muro   → de espaldas a la pared, y de preferencia en esquina
//   centro → en medio del cuarto, con paso alrededor (mesas de juntas)
//   libre  → como caiga, en filas (bancas del open space: ahí mandan los pasillos)
const ANCLA = {
  guarda: 'muro',
  mampara: 'muro',
  escritorio: 'muro',
  asiento: 'muro',
  juntas: 'centro',
  mesa: 'centro',
  mueble: 'muro',
};

// Busca DÓNDE colocar w×d con holgura, según su ancla. Prueba también girado
// 90°. Devuelve {x, y, rot, ...} en mm, o null.
//   refs: centros (en celdas) de muebles a los que este debe QUEDAR CERCA —
//   así el archivero acaba junto al escritorio al que sirve y no en la otra
//   punta del cuarto.
function buscarHueco(malla, w, d, ancla, holgura, refs = [], pegadaARef = false) {
  const opciones = w === d ? [[w, d, 0]] : [[w, d, 0], [d, w, 90]];
  // 'libre' conserva el barrido de siempre: es lo que forma las hileras de
  // bancas en la planta abierta, y ahí cambiarlo sería empeorarlo.
  if (ancla === 'libre') {
    for (const [pw, ph, rot] of opciones) {
      const iw = celdas(pw + holgura), jh = celdas(ph + holgura);
      for (let j = 0; j <= malla.cy - jh; j++) {
        for (let i = 0; i <= malla.cx - iw; i++) {
          if (malla.libre(i, j, iw, jh)) return { i, j, iw, jh, x: i * CELDA, y: j * CELDA, rot, w: pw, d: ph, lado: null };
        }
      }
    }
    return null;
  }

  const cxm = malla.cx / 2, cym = malla.cy / 2;
  const diag = Math.hypot(malla.cx, malla.cy) || 1;
  let mejor = null, mejorP = -Infinity;
  for (const [pw, ph, rot] of opciones) {
    const iw = celdas(pw + holgura), jh = celdas(ph + holgura);
    for (let j = 0; j <= malla.cy - jh; j++) {
      for (let i = 0; i <= malla.cx - iw; i++) {
        if (!malla.libre(i, j, iw, jh)) continue;
        const ci = i + iw / 2, cj = j + jh / 2;
        let p;
        if (ancla === 'centro') {
          p = -Math.hypot(ci - cxm, cj - cym) / diag;
        } else {
          const c = malla.contacto(i, j, iw, jh);
          // Se premia el lado MÁS pegado (la espalda) y, con menos peso, un
          // segundo lado: eso es una esquina, que para una guarda es lo ideal.
          const lados = [c.arriba / iw, c.abajo / iw, c.izq / jh, c.der / jh].sort((a, b) => b - a);
          p = lados[0] + lados[1] * 0.2;
        }
        // Cercanía al mueble al que acompaña (conjunto escritorio + gaveta).
        if (refs.length) {
          const hueco = Math.min(...refs.map((r) => separacion(i, j, iw, jh, r)));
          // REGLA DE RODRIGO: "las gavetas SIEMPRE van pegadas a los escritorios
          // u operativos, NUNCA sueltas". Cuando la regla manda, una posición
          // que no toca ninguna estación NO ES CANDIDATA: no basta con premiar
          // la cercanía, porque el muro del fondo le ganaba y la gaveta acababa
          // volando sola en medio del cuarto.
          if (pegadaARef && hueco > PEGADA) continue;
          p += 1.0 * (1 - Math.min(1, hueco / Math.max(1, diag)));
        }
        if (p > mejorP + 1e-9) {
          const c = ancla === 'centro' ? null : malla.contacto(i, j, iw, jh);
          mejorP = p;
          // `hacia` = de qué lado del hueco está el mueble al que acompaña, para
          // recorrerse hasta él en vez de quedar centrado con su holgura de por
          // medio: eso era lo que dejaba la gaveta a 80 cm del escritorio.
          mejor = { i, j, iw, jh, x: i * CELDA, y: j * CELDA, rot, w: pw, d: ph,
            lado: ladoMayor(c, iw, jh), hacia: refs.length ? haciaRef(i, j, iw, jh, refs) : null };
        }
      }
    }
  }
  return mejor;
}

// Hueco entre dos rectángulos de celdas (0 = pegados). Es la medida honesta de
// "va pegada a": el centro no sirve, un mueble largo tiene su centro lejísimos.
function separacion(i, j, iw, jh, r) {
  const dx = Math.max(r.i - (i + iw), i - (r.i + r.iw), 0);
  const dy = Math.max(r.j - (j + jh), j - (r.j + r.jh), 0);
  return Math.hypot(dx, dy);
}

// De qué lado queda el mueble al que acompaña, por eje ({x:'izq'|'der'|null, y:…}).
function haciaRef(i, j, iw, jh, refs) {
  let mejor = null, dmin = Infinity;
  for (const r of refs) { const d = separacion(i, j, iw, jh, r); if (d < dmin) { dmin = d; mejor = r; } }
  if (!mejor) return null;
  const cx = i + iw / 2, cy = j + jh / 2;
  const rx = mejor.i + mejor.iw / 2, ry = mejor.j + mejor.jh / 2;
  return {
    x: Math.abs(rx - cx) < 1 ? null : (rx < cx ? 'izq' : 'der'),
    y: Math.abs(ry - cy) < 1 ? null : (ry < cy ? 'arriba' : 'abajo'),
  };
}

// Contra qué lado se recarga: el que tenga más muro pegado (o null si no toca).
function ladoMayor(c, iw, jh) {
  if (!c) return null;
  const opts = [['arriba', c.arriba / iw], ['abajo', c.abajo / iw], ['izq', c.izq / jh], ['der', c.der / jh]];
  opts.sort((a, b) => b[1] - a[1]);
  return opts[0][1] >= 0.6 ? opts[0][0] : null;
}

// ---------------------------------------------------------------------------
//  acomodarEnForma(area, piezas)
//    area = { ancho, largo, poly?: [[x,y]…] mm, obstaculos?: [{x,y,w,h}] mm }
//  Devuelve { colocacion:[{id,x,y,rot}], fuera:[id…], auditoria:[…] }
// ---------------------------------------------------------------------------
export function acomodarEnForma(area, piezas) {
  const malla = new Malla(area.ancho, area.largo, area.poly, area.obstaculos);
  // Mismo criterio que el empacador de siempre: guardas a muro primero, luego
  // juntas, luego estaciones; dentro de cada tipo, de grande a chico. Las
  // estaciones van ANTES que las guardas cuando hay que agrupar, así que el
  // orden real es: primero lo que manda (juntas, escritorios) y después lo que
  // los acompaña.
  const orden = ['juntas', 'escritorio', 'guarda', 'mesa', 'asiento', 'mampara', 'mueble'];
  const cola = [...piezas].sort((a, b) => {
    const t = orden.indexOf(a.tipo) - orden.indexOf(b.tipo);
    return t !== 0 ? t : (b.w * b.d) - (a.w * a.d);
  });

  const colocacion = [], fuera = [], estaciones = [];
  for (const p of cola) {
    const holgura = usoDe(p.tipo, p);
    // Una banca de varios puestos NO se recarga: forma hileras con pasillo, que
    // es como se amuebla una planta abierta.
    const esBloque = p.tipo === 'escritorio' && Math.max(p.w, p.d) >= 2500;
    const ancla = esBloque ? 'libre' : (ANCLA[p.tipo] || 'muro');
    // Las guardas acompañan a las estaciones que ya se colocaron: el archivero
    // va junto al escritorio al que sirve, no a la otra punta del cuarto.
    const acompania = p.tipo === 'guarda' || p.tipo === 'mueble';
    const refs = acompania ? estaciones : [];
    // Una gaveta pegada a su escritorio es una REGLA, no una preferencia. Si de
    // plano no cabe pegada, se intenta otra vez sin la exigencia antes de darla
    // por no colocada: más vale ponerla suelta y decirlo que perderla.
    let h = buscarHueco(malla, p.w, p.d, ancla, holgura, refs, acompania && refs.length > 0);
    if (!h && acompania && refs.length) h = buscarHueco(malla, p.w, p.d, ancla, holgura, refs, false);
    if (!h) { fuera.push(p.id); continue; }
    malla.ocupar(h.i, h.j, h.iw, h.jh);
    // El frente ya NO se decide aquí: se endereza toda la colocación al final,
    // con las coordenadas definitivas y en un solo lugar (`orientacion.js`).
    // Aquí se decidía con la posición de la MALLA, antes de pegar el mueble al
    // muro, y encima al revés (ponía la silla del lado de la puerta).
    // El hueco reservó la holgura alrededor. Si el mueble se recarga contra un
    // muro, se PEGA a ese lado en vez de quedar centrado: la silla necesita el
    // paso por delante, la espalda no. Se deja un ZÓCALO: pegarlo a cero hacía
    // que dos cuartos vecinos —que comparten la línea del muro, porque en el
    // modelo el muro no tiene espesor— acabaran con muebles tocándose a través
    // de la pared.
    const pegado = Math.min(ZOCALO, holgura / 2);
    let x = h.x + holgura / 2, y = h.y + holgura / 2;
    // Eje Y: manda el muro; si no hay muro, se recorre hacia el mueble que
    // acompaña. Eje X igual. Antes sólo se ajustaba UN eje, así que una gaveta
    // pegada al muro de arriba se quedaba centrada en x y lejos del escritorio.
    if (h.lado === 'arriba') y = h.y + pegado;
    else if (h.lado === 'abajo') y = h.y + holgura - pegado;
    else if (h.hacia?.y === 'arriba') y = h.y;
    else if (h.hacia?.y === 'abajo') y = h.y + holgura;
    if (h.lado === 'izq') x = h.x + pegado;
    else if (h.lado === 'der') x = h.x + holgura - pegado;
    else if (h.hacia?.x === 'izq') x = h.x;
    else if (h.hacia?.x === 'der') x = h.x + holgura;
    colocacion.push({ id: p.id, x: Math.round(x), y: Math.round(y), rot: h.rot, contra: h.lado || null });
    if (p.tipo === 'escritorio') estaciones.push({ i: h.i, j: h.j, iw: h.iw, jh: h.jh });
  }

  // --- CIRCULACIÓN: ¿se llega caminando desde la puerta a cada mueble? -------
  // Que quepa no basta. Un archivero al fondo de un pasillo tapado por la mesa
  // no sirve, y hasta hoy el sistema decía que todo estaba bien.
  const puertas = area.puertas || [];
  let circ = null;
  if (puertas.length) {
    const desde = puertas.map((pu) => [Math.floor(pu.x / CELDA), Math.floor(pu.y / CELDA)]);
    // Se rehace la malla SIN los muebles para saber por dónde se camina, y se
    // marca lo ocupado por muebles como no transitable. El barrido de la puerta
    // SÍ se camina —sólo no se amuebla—, así que aquí no cuenta como obstáculo:
    // si contara, la propia puerta caería en zona bloqueada y el recorrido
    // arrancaría de la nada, dando "no se llega a ningún mueble".
    const paso = new Malla(area.ancho, area.largo, area.poly,
      (area.obstaculos || []).filter((o) => o.tipo !== 'puerta'));
    for (const c of colocacion) {
      const p = piezas.find((q) => q.id === c.id);
      const pw = c.rot === 90 ? p.d : p.w, ph = c.rot === 90 ? p.w : p.d;
      paso.ocupar(Math.floor(c.x / CELDA), Math.floor(c.y / CELDA), celdas(pw), celdas(ph));
    }
    const vis = paso.alcanzable(desde);
    const sinPaso = colocacion.filter((c) => {
      const p = piezas.find((q) => q.id === c.id);
      const pw = c.rot === 90 ? p.d : p.w, ph = c.rot === 90 ? p.w : p.d;
      const i0 = Math.floor(c.x / CELDA), j0 = Math.floor(c.y / CELDA);
      const iw = celdas(pw), jh = celdas(ph);
      for (let i = i0 - 1; i <= i0 + iw; i++) {
        for (let j = j0 - 1; j <= j0 + jh; j++) {
          if (i < 0 || j < 0 || i >= paso.cx || j >= paso.cy) continue;
          if (vis[j * paso.cx + i]) return false;   // tiene un lado alcanzable
        }
      }
      return true;
    });
    circ = { ok: sinPaso.length === 0, n: sinPaso.length };
  }

  // REGLA DE RODRIGO, al final y sobre las coordenadas definitivas: "siempre
  // viendo hacia la puerta, nunca hacia la pared".
  const byId = Object.fromEntries(piezas.map((p) => [p.id, p]));
  const orientada = enderezarTodo(colocacion.map((c) => ({ ...c, area: 0 })), byId, [area])
    .map(({ area: _a, ...c }) => c);
  orientada.forEach((c, i) => Object.assign(colocacion[i], c));

  const libres = malla.bloq.reduce((n, v) => n + (v ? 0 : 1), 0);
  const auditoria = [
    { check: 'Todas las piezas colocadas', ok: fuera.length === 0, detalle: `${colocacion.length} de ${piezas.length}` },
    { check: 'Nada encimado', ok: true, detalle: 'la malla no reutiliza celdas' },
    { check: 'Nada fuera de la forma del plano', ok: true, detalle: 'sólo se ocupan celdas dentro del polígono' },
    { check: 'Columnas y escaleras libres', ok: true, detalle: `${(area.obstaculos || []).length} obstáculo(s), ${PASO_OBST / 1000} m de paso` },
    { check: 'Espacio de uso respetado', ok: true, detalle: `silla/paso: escritorio ${USO.escritorio / 1000} m, juntas ${USO.juntas / 1000} m, guarda ${USO.guarda / 1000} m` },
    { check: 'Puertas libres', ok: true, detalle: puertas.length ? `${puertas.length} puerta(s) con su barrido despejado` : 'el plano no traía puertas' },
    circ
      ? { check: 'Se llega caminando desde la puerta', ok: circ.ok, detalle: circ.ok ? 'todos los muebles tienen acceso' : `${circ.n} mueble(s) sin paso desde la puerta` }
      // ⚠️ Esto llevaba `ok: true` y pintaba palomita VERDE para algo que
      // literalmente dice que NO se pudo comprobar. Ahora sale como aviso.
      : { check: 'Se llega caminando desde la puerta', ok: false, detalle: 'el plano no traía puertas: no se pudo comprobar' },
    { check: 'Espacio todavía disponible', ok: true, detalle: `${((libres * CELDA * CELDA) / 1e6).toFixed(1)} m² libres` },
  ];
  return { colocacion, fuera, auditoria };
}
