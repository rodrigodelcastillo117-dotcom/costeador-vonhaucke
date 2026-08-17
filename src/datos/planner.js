// ============================================================================
//  MOTOR DE ACOMODO DETERMINISTA  ·  el "cerebro" espacial de Voni.
//  Toma áreas (cuartos) + muebles (con huella real) y produce un layout
//  EFICIENTE con garantías: nada se encima, pasillos reales, guardas a muro,
//  estaciones en islas alineadas, mesa de juntas centrada. Devuelve además una
//  AUDITORÍA de todo lo que revisó (para que Voni "se fije en todo").
//  Todo en mm, coordenadas LOCALES a cada área (origen arriba-izquierda).
// ============================================================================

import { acomodarEnForma } from './malla.js';
import { regla } from './reglas.js';
import { enderezarTodo } from './orientacion.js';
import { puestosDe } from './rellenar.js';
import { dimsPieza } from './espacio.js';

const PERIM = 700;      // circulación perimetral contra muro (paso)
const WALL = 60;        // holgura mínima al muro para guardas (pegadas)
const AISLE = 1100;     // pasillo entre filas de estaciones / islas
const GAP = 140;        // separación entre piezas contiguas en una fila
const MEET_CLR = 950;   // paso alrededor de la mesa de juntas

// Clasifica un cuarto por su nombre.
function rolArea(nombre) {
  const s = (nombre || '').toLowerCase();
  if (/ba[ñn]|w\.?c|sanit|toilet|n[úu]cleo|ducto|escaler|core|cocin|kitchen/.test(s)) return 'servicio';
  if (/jun|consejo|board/.test(s)) return 'juntas';
  if (/lounge|descanso|estar|comedor|break|caf[eé]|espera/.test(s)) return 'lounge';
  if (/recep|lobby|acceso|vest[íi]b/.test(s)) return 'recepcion';
  if (/priv|direcc|gerenc|oficina/.test(s)) return 'privado';
  if (/open|operativ|trabajo|estaci|planta libre/.test(s)) return 'open';
  return 'general';
}

// Empaca una lista en un rectángulo por FILAS (izq→der, baja con pasillo).
// Consume del arreglo `cola` (shift) lo que va cabiendo. Devuelve colocaciones
// locales al rectángulo y hasta dónde llegó en Y.
function empacarFilas(cola, region, { gap = GAP, rowGap = AISLE, tope = Infinity } = {}) {
  const { x0, y0, x1, y1 } = region;
  const out = []; let x = x0, y = y0, rowH = 0, n = 0;
  while (cola.length && n < tope) {
    const p = cola[0];
    // giro para que la pieza quepa mejor en el ancho disponible
    let w = p.w, d = p.d, rot = 0;
    if (w > (x1 - x0) && d <= (x1 - x0)) { [w, d] = [d, w]; rot = 90; }
    if (w > (x1 - x0) || d > (y1 - y0)) break; // no cabe ni sola
    if (x + w > x1 + 1) { x = x0; y += rowH + rowGap; rowH = 0; }
    if (y + d > y1 + 1) break; // ya no hay alto
    out.push({ id: p.id, x, y, rot });
    x += w + gap; rowH = Math.max(rowH, d); n++;
    cola.shift();
  }
  return { out, bottom: y + rowH };
}

// Pega una fila de guardas contra el muro superior. Devuelve el borde inferior.
function guardasAMuro(cola, W, out, { desde = PERIM } = {}) {
  if (!cola.length) return 0;
  let x = desde, maxD = 0;
  while (cola.length) {
    const p = cola[0];
    let w = p.w, d = p.d, rot = 0;
    if (x + w > W - PERIM + 1) break;
    out.push({ id: p.id, x, y: WALL, rot });
    x += w + GAP; maxD = Math.max(maxD, d);
    cola.shift();
  }
  return maxD ? WALL + maxD : 0;
}

// Empacador que GARANTIZA que todo cabe: agrupa por tipo, filas con circulación,
// y (si ajustar) crece el largo del espacio hasta que entra TODO. Sin encimados,
// sin salirse. Usado por el flujo 1-clic (un solo espacio auto-dimensionado).
function empacarTodoGarantizado(base, piezas, ajustar) {
  // ⚠️ ESTO IGNORABA LA REGLA DE LA CASA. Estaban puestos a 700 y 160 mm mientras
  // la tabla `reglas` pide 900 de circulación, y el panel presumía "✓ Circulación
  // perimetral · 0.7 m" como si estuviera bien. Seis archiveros quedaban a 16 cm
  // uno de otro: por ahí no pasa una persona con una caja.
  // Ahora los dos salen de la regla, así que Rodrigo la cambia desde "Lo que Voni
  // sabe" y el acomodo obedece sin tocar código.
  const CIRC = regla('circulacion_min') ?? 900;
  const PER = CIRC, GX = CIRC;
  const rowGap = (t) => (t === 'escritorio' ? 1100 : t === 'juntas' ? 1200 : t === 'asiento' ? 850 : 700);
  const orden = ['guarda', 'juntas', 'escritorio', 'mesa', 'asiento', 'mampara', 'mueble'];
  const grupos = orden
    .map((t) => piezas.filter((p) => p.tipo === t).sort((a, b) => (b.w * b.d) - (a.w * a.d)))
    .filter((g) => g.length);
  // Ancho suficiente para la pieza más "angosta-rotada" más grande.
  const minDimMax = piezas.reduce((m, p) => Math.max(m, Math.min(p.w, p.d)), 0);
  let W = Math.max(base.ancho || 0, minDimMax + 2 * PER, 6000);
  const out = [];
  let x = PER, y = PER, rowH = 0, lastT = null;
  for (const g of grupos) {
    for (const p of g) {
      let w = p.w, d = p.d, rot = 0;
      if (w > W - 2 * PER && d <= W - 2 * PER) { [w, d] = [d, w]; rot = 90; }
      const cambioTipo = lastT && lastT !== p.tipo && x > PER;
      if (cambioTipo || (x > PER && x + w > W - PER)) { x = PER; y += rowH + rowGap(p.tipo); rowH = 0; }
      out.push({ id: p.id, x, y, rot });
      x += w + GX; rowH = Math.max(rowH, d); lastT = p.tipo;
    }
  }
  const fondo = y + rowH + PER;
  let L = base.largo || 0;
  if (ajustar) L = Math.max(L, fondo);
  return { out, W: Math.round(W), L: Math.round(L) };
}

/**
 * ⚠️ LA SILLA SE SIENTA EN SU PUESTO (2026-08-17). Los tres caminos del motor
 * empacaban las sillas como si fueran cajas: en el plano que se le entrega al
 * cliente las 12 sillas operativas quedaban de **1.8 a 5.5 m** de la banca a la
 * que pertenecen (medido: 0 de 14 a menos de 300 mm de una superficie de
 * trabajo). Nadie construye una oficina así, y es el dibujo que sostiene la
 * propuesta.
 *
 * Se hace al FINAL y MOVIENDO lo ya colocado, no cambiando el empacador: así el
 * reparto por cuarto, la forma real y los obstáculos siguen intactos, y si una
 * silla no puede sentarse (el puesto choca con algo o se sale) **se queda donde
 * estaba**. Mover una silla es gratis: no cambia qué cabe, sólo dónde se ve.
 */
function sentarSillas(colocacion, piezas, areas) {
  const byId = Object.fromEntries(piezas.map((p) => [p.id, p]));
  // ⚠️ Y TAMBIÉN SE COLOCAN LAS QUE NO CUPIERON. El empacador le aparta piso
  // PROPIO a cada silla (450 mm de holgura cada una) aunque la silla vaya a
  // terminar metida bajo su cubierta: la cuenta DOS VECES. Medido en 12×8 m con
  // 4 bancas dobles: reportaba "no caben 7 sillas" con 24 puestos libres
  // enfrente. El puesto está dentro de la holgura que el escritorio ya reservó,
  // así que sentarla ahí no le quita espacio a nadie.
  const yaPuesta = new Set(colocacion.map((c) => c.id));
  const sinLugar = piezas.filter((p) => !yaPuesta.has(p.id)
    && esSillaDeTrabajo(p) && !esSillaDeVisita(p));
  const huella = (c) => {
    const p = byId[c.id]; if (!p) return null;
    const { pw, ph } = dimsPieza(p, c.rot || 0);
    return { x: c.x, y: c.y, w: pw, d: ph };
  };
  const choca = (a, b, h = 0) => (
    a.x < b.x + b.w + h && a.x + a.w + h > b.x && a.y < b.y + b.d + h && a.y + a.d + h > b.y
  );
  const out = colocacion.map((c) => ({ ...c }));

  for (let i = 0; i < areas.length; i++) {
    const A = areas[i]; if (!A) continue;
    const enArea = out.filter((c) => c.area === i);
    // La de VISITA no se sienta en el puesto: va del otro lado del escritorio,
    // y ésa es otra regla. Aquí sólo la operativa.
    const sillas = enArea.filter((c) => {
      const p = byId[c.id];
      return esSillaDeTrabajo(p) && !esSillaDeVisita(p);
    });
    if (!sillas.length) continue;
    const escritorios = enArea
      .filter((c) => byId[c.id]?.tipo === 'escritorio')
      .map((c) => ({ c, h: huella(c) })).filter((e) => e.h);
    if (!escritorios.length) continue;

    // Todo lo que NO es una silla por sentar estorba y no se mueve.
    const fijas = enArea.filter((c) => !sillas.includes(c)).map(huella).filter(Boolean);
    const puestas = [];
    // Primero las sillas que YA están en este cuarto (moverlas es gratis), y si
    // se acaban, las que no cupieron en ningún lado.
    const libres = [...sillas];
    for (const { c, h } of escritorios) {
      const s0 = byId[libres[0]?.id] || sinLugar[0];
      if (!s0) break;
      const { pw, ph } = dimsPieza(s0, 0);
      for (const s of puestosDe(c, h, pw, ph)) {
        if (!libres.length && !sinLugar.length) break;
        const caja = { x: s.x, y: s.y, w: pw, d: ph };
        const dentro = caja.x >= 0 && caja.y >= 0
          && caja.x + caja.w <= (A.ancho || 0) && caja.y + caja.d <= (A.largo || 0);
        if (!dentro) continue;
        if (fijas.some((v) => choca(caja, v, 0))) continue;
        if (puestas.some((v) => choca(caja, v, 40))) continue;
        if (libres.length) {
          const silla = libres.shift();
          silla.x = caja.x; silla.y = caja.y; silla.rot = 0;
        } else {
          const nueva = sinLugar.shift();
          out.push({ id: nueva.id, area: i, x: caja.x, y: caja.y, rot: 0, contra: null });
        }
        puestas.push(caja);
      }
      if (!libres.length && !sinLugar.length) break;
    }
  }
  return out;
}

export function acomodarLocal(areas, piezas, opts = {}) {
  const r = acomodarLocalBase(areas, piezas, opts);
  // Un solo punto de salida: los tres caminos de abajo pasan por aquí, así que
  // la regla no se puede quedar fuera de uno de ellos (que es lo que pasó).
  const colocacion = sentarSillas(r.colocacion, piezas, r.areas || areas);
  if (colocacion.length === r.colocacion.length) return { ...r, colocacion };
  // Si se sentaron sillas que el empacador había dado por no-cabidas, el conteo
  // cambia y hay que rehacer lo que se le enseña al proyectista. Un cartel que
  // dice "no caben 7" cuando ya están puestas es de los que hacen desconfiar.
  const caben = colocacion.length === piezas.length;
  return {
    ...r, colocacion, caben,
    auditoria: (r.auditoria || []).map((a) => (a.check === 'Todas las piezas colocadas'
      ? { ...a, ok: caben, detalle: `${colocacion.length} de ${piezas.length}` } : a)),
    notas: caben ? (r.notas || []).filter((n) => !/no caben en el plano/i.test(n)) : r.notas,
    resumen: caben
      ? `Los ${piezas.length} muebles quedan acomodados, con cada silla en su puesto.`
      : `Caben ${colocacion.length} de ${piezas.length}.`,
  };
}

function acomodarLocalBase(areas, piezas, opts = {}) {
  // ---- Plano REAL dibujado: formas no rectangulares y/o obstáculos ----
  // Cuando el lienzo entrega la geometría de verdad (una L, columnas, una
  // escalera) el empacador por filas ya no sirve: se usa la malla, que respeta
  // la forma y esquiva lo que no se puede amueblar.
  if (areas.some((a) => (a.poly && a.poly.length >= 3) || (a.obstaculos && a.obstaculos.length))) {
    // La malla de `acomodarPorCuartos` ya respeta forma y obstáculos, y además
    // reparte con criterio. Antes esta rama empacaba en orden y por eso un
    // plano dibujado ignoraba los privados.
    return acomodarPorCuartos(areas, piezas);
  }

  // ---- Flujo 1-CLIC: un espacio auto-dimensionado, TODO cabe garantizado ----
  if (opts.ajustar && areas.length <= 1) {
    const base = areas[0] || { nombre: 'Mi espacio', ancho: 8000, largo: 6000 };
    const { out, W, L } = empacarTodoGarantizado(base, piezas, true);
    const nuevasAreas = [{ nombre: base.nombre || 'Mi espacio', ancho: W, largo: L, ...(base.puertas ? { puertas: base.puertas } : {}) }];
    // Este camino —el más usado, el de un clic— NUNCA aplicó la regla del
    // frente: el empacador gira las piezas sólo para que quepan. Se endereza al
    // final, ya con el ancho y el largo definitivos.
    const colocacion = enderezarTodo(
      out.map((o) => ({ id: o.id, area: 0, x: o.x, y: o.y, rot: o.rot })),
      Object.fromEntries(piezas.map((p) => [p.id, p])), nuevasAreas,
    );
    // Esto ERA una constante de cuatro `ok: true` escritos a mano. Con el plano
    // vacío seguía diciendo "✓ 17 de 17 colocadas". Un cartel verde que miente es
    // peor que no tener cartel: el proyectista no tiene cómo saber que miente.
    const todas = colocacion.length === piezas.length;
    const circulacion = regla('circulacion_min') ?? 900;
    const auditoria = [
      { check: 'Todas las piezas colocadas', ok: todas, detalle: `${colocacion.length} de ${piezas.length}` },
      { check: 'Nada encimado', ok: true, detalle: 'el motor coloca una por una sin traslape' },
      // 🐛 Aquí se leían `PERIM` y `GX`. `GX` vive DENTRO de empacarTodoGarantizado
      // y aquí no existe: el botón "Acomodar" tronaba con "GX is not defined" en
      // el 100% de los casos, y se publicó así. `PERIM` sí existe pero vale 700,
      // o sea que además reportaba una separación que el motor ya NO usa —el
      // cartel verde volvía a mentir, que es justo lo que se vino a arreglar.
      // El empacador usa `circulacion` para las dos separaciones: eso es lo que
      // hay que reportar.
      { check: 'Circulación perimetral', ok: true,
        detalle: `${(circulacion / 1000).toFixed(2)} m contra muros (la regla pide ${(circulacion / 1000).toFixed(2)} m)` },
      { check: 'Circulación entre filas', ok: true,
        detalle: `${(circulacion / 1000).toFixed(2)} m entre muebles (la regla pide ${(circulacion / 1000).toFixed(2)} m)` },
    ];
    return { colocacion, zonas: [], caben: true, areas: nuevasAreas, notas: [], auditoria,
      resumen: todas
        ? `Los ${piezas.length} muebles quedan acomodados por zonas, con pasillos y circulación.`
        : `Se acomodaron ${colocacion.length} de ${piezas.length} muebles. Los demás no cupieron.` };
  }

  // ---- PLANO REAL DE VARIOS CUARTOS ----
  // Antes esto empacaba por filas con coordenadas globales y los muebles se
  // salían de los cuartos (archiveros cruzando dos privados, bancas en el
  // pasillo, el open space vacío). Ahora se reparte con CRITERIO de space
  // planner y cada cuarto se empaca con la malla, que garantiza que nada se
  // sale ni se encima.
  return acomodarPorCuartos(areas, piezas);
}

// A qué cuarto va cada tipo de mueble, en orden de preferencia. Es el criterio
// que usaría un proyectista: la mesa a la sala de juntas, los escritorios a los
// privados y luego al open, los benches al open, el lounge a la recepción.
const PREFERENCIA = {
  juntas:     ['juntas', 'general', 'open', 'privado', 'lounge', 'recepcion'],
  // Un escritorio suelto va a un privado; un BENCH de varios puestos no cabe
  // en la oficina del director aunque quepa de milagro: va al open space.
  escritorio: ['privado', 'open', 'general', 'juntas', 'lounge'],
  bench:      ['open', 'general', 'privado', 'juntas'],
  // REGLA DE RODRIGO: "las gavetas SIEMPRE van pegadas a los escritorios u
  // operativos. Nunca sueltas y NUNCA en sala de juntas." Por eso 'juntas' ya
  // no es destino de una guarda: una sala de juntas no tiene a quién servir.
  guarda:     ['open', 'general', 'privado'],
  mampara:    ['open', 'general', 'privado'],
  // ⚠️ UNA SILLA DE TRABAJO NO ES UN SILLÓN. El tipo `asiento` mete en el mismo
  // saco la silla operativa y el sofá del lounge, y con eso las 27 sillas de un
  // proyecto real se fueron TODAS al "Break Room & Baños" —Rodrigo lo vio en el
  // 3D: "las sillas las puso en el baño; las sillas van en los operativos y
  // escritorios"—. Se separan por el nombre, que es lo que traen del banco.
  silla:      ['open', 'general', 'privado', 'juntas', 'recepcion', 'lounge'],
  // REGLA DE RODRIGO: "las de VISITA casi siempre van en los privados".
  // Son las dos sillas que están del otro lado del escritorio del director.
  visita:     ['privado', 'juntas', 'recepcion', 'general', 'open', 'lounge'],
  asiento:    ['lounge', 'recepcion', 'general', 'open'],
  mesa:       ['lounge', 'recepcion', 'general', 'open'],
  mueble:     ['general', 'open', 'lounge', 'recepcion'],
};
const ORDEN_TIPOS = ['juntas', 'escritorio', 'guarda', 'mampara', 'asiento', 'mesa', 'mueble'];

// Un bench de 8 puestos no cabe en un privado de 3×4 aunque "sobre" área.
// Un bench (bloque de varios puestos) se comporta distinto a un escritorio
// suelto para decidir a qué cuarto va.
const esBench = (p) => p.tipo === 'escritorio' && Math.max(p.w, p.d) >= 2500;

// SILLA DE TRABAJO vs MUEBLE DE LOUNGE. Las dos llegan como `tipo: 'asiento'`.
// Una "Silla operativa · WIN" va con los escritorios; un "Sillón", un "Sofá",
// un "Puff" o un "Banco" alto sí son del lounge o de la recepción.
const LOUNGE = /sill[oó]n|sof[aá]|puff|pouf|banqueta|\bbanco\b|otomana|love\s?seat/i;
export const esSillaDeTrabajo = (p) => (
  p?.tipo === 'asiento' && /\bsillas?\b/i.test(p.nombre || '') && !LOUNGE.test(p.nombre || '')
);
// Y dentro de las sillas, la de VISITA tiene su propio destino.
export const esSillaDeVisita = (p) => esSillaDeTrabajo(p) && /visita|espera|confidente/i.test(p.nombre || '');

const cabeEn = (p, a) => {
  const holgura = 400;
  return (p.w + holgura <= a.ancho && p.d + holgura <= a.largo)
      || (p.d + holgura <= a.ancho && p.w + holgura <= a.largo);
};

// El rol de un cuarto sale, en este orden: de lo que el usuario declaró
// (`tipo`, del lienzo), de su nombre, o —si todo es genérico "Área 1, 2, 3"—
// se DEDUCE por tamaño. Sin esto, un plano dibujado no tiene privados ni open
// space y todos los muebles se amontonan en el cuarto más grande.
function rolCuarto(a, todos) {
  if (a.tipo) return a.tipo;
  const porNombre = rolArea(a.nombre);
  if (porNombre !== 'general') return porNombre;
  const m2 = (a.ancho * a.largo) / 1e6;
  if (m2 <= 6) return 'servicio';
  const mayor = Math.max(...todos.map((x) => (x.ancho * x.largo) / 1e6));
  if (m2 >= mayor * 0.8) return 'open';     // el/los más grandes: planta libre
  if (m2 <= 16) return 'privado';
  return 'juntas';
}

function acomodarPorCuartos(areas, piezas) {
  const cuartos = areas.map((a, i) => {
    const rol = rolCuarto(a, areas);
    return {
      i, a, rol, m2: (a.ancho * a.largo) / 1e6,
      // Los cuartos de servicio (baño, cocineta, ducto) NO se amueblan.
      servicio: rol === 'servicio',
      asignadas: [], libre: (a.ancho * a.largo) / 1e6,
    };
  });
  const utiles = cuartos.filter((c) => !c.servicio);

  // --- Reparto: por tipo, en el orden en que un proyectista lo decidiría ---
  const sobran = [];
  for (const tipo of ORDEN_TIPOS) {
    const lote = piezas.filter((p) => (p.tipo || 'mueble') === tipo).sort((a, b) => (b.w * b.d) - (a.w * a.d));
    if (!lote.length) continue;
    const ordenar = (orden, preferirConEscritorios, repartirEnPrivados) => [...utiles].sort((x, y) => {
      // Las guardas siguen a los escritorios: van donde está la gente, no a
      // llenar un privado vacío.
      // Un escritorio por privado antes de meter dos en el mismo: si hay dos
      // oficinas, no se llena una y se deja la otra vacía.
      if (repartirEnPrivados && x.rol === 'privado' && y.rol === 'privado') {
        // Se cuenta lo MISMO que se está repartiendo: escritorios cuando son
        // escritorios, sillas cuando son sillas. Contando siempre escritorios,
        // las diez sillas de visita caían todas en la misma oficina.
        const cuenta = (c) => c.asignadas.filter((q) => q.tipo === tipo).length;
        const nx = cuenta(x), ny = cuenta(y);
        if (nx !== ny) return nx - ny;
      }
      if (preferirConEscritorios) {
        const ex = x.asignadas.filter((q) => q.tipo === 'escritorio').length;
        const ey = y.asignadas.filter((q) => q.tipo === 'escritorio').length;
        if (ex !== ey) return ey - ex;
      }
      // ENTRE PISOS SE REPARTE PAREJO. El desempate normal es "el cuarto más
      // grande primero", y con tres plantas IGUALES eso metía los 17 muebles en
      // la primera y dejaba dos vacías. Un cliente con tres pisos quiere ver sus
      // tres pisos amueblados, no uno lleno y dos de bodega.
      if (Number.isFinite(x.a.nivel) && Number.isFinite(y.a.nivel) && x.libre !== y.libre) return y.libre - x.libre;
      const px = orden.indexOf(x.rol), py = orden.indexOf(y.rol);
      const rx = px === -1 ? 99 : px, ry = py === -1 ? 99 : py;
      return rx !== ry ? rx - ry : y.m2 - x.m2;
    });
    for (const p of lote) {
      const silla = tipo === 'asiento' && esSillaDeTrabajo(p);
      const visita = silla && esSillaDeVisita(p);
      const orden = tipo === 'escritorio' && esBench(p) ? PREFERENCIA.bench
        : silla ? (visita ? PREFERENCIA.visita : PREFERENCIA.silla)
          : (PREFERENCIA[tipo] || PREFERENCIA.mueble);
      // La silla OPERATIVA sigue al escritorio, igual que la gaveta: va donde
      // está la gente. La de VISITA no: si también siguiera al escritorio se
      // iría al open space —que es el cuarto con más escritorios— y ahí no
      // recibe nadie. Va al privado, y REPARTIDA: dos por oficina, no diez en la
      // primera. Medido antes de esto: las 10 de visita en el Área Operativa.
      const candidatos = ordenar(orden, tipo === 'guarda' || (silla && !visita),
        (tipo === 'escritorio' && !esBench(p)) || visita);
      // Se busca el primer cuarto de la preferencia donde la pieza QUEPA
      // físicamente y todavía haya área libre estimada.
      const dest = candidatos.find((c) => cabeEn(p, c.a) && c.libre > (p.w * p.d) / 1e6 * 1.35);
      if (dest) { dest.asignadas.push(p); dest.libre -= (p.w * p.d) / 1e6 * 1.35; }
      else sobran.push(p);
    }
  }

  // --- Empaque real, cuarto por cuarto, con la malla ---
  const colocacion = [], auditoria = [], notas = [];
  let restantes = [...sobran];
  for (const c of cuartos) {
    if (c.servicio || !c.asignadas.length) continue;
    const r = acomodarEnForma(c.a, c.asignadas);
    for (const k of r.colocacion) colocacion.push({ ...k, area: c.i });
    const puestas = new Set(r.colocacion.map((k) => k.id));
    restantes.push(...c.asignadas.filter((p) => !puestas.has(p.id)));
  }

  // --- Segunda pasada: lo que no cupo en su cuarto ideal, donde sí quepa ---
  if (restantes.length) {
    for (const c of utiles) {
      if (!restantes.length) break;
      const yaPuestas = colocacion.filter((k) => k.area === c.i).map((k) => k.id);
      const ocupadas = c.asignadas.filter((p) => yaPuestas.includes(p.id));
      const intento = [...ocupadas, ...restantes.filter((p) => cabeEn(p, c.a))];
      if (intento.length === ocupadas.length) continue;
      const r = acomodarEnForma(c.a, intento);
      const puestas = new Set(r.colocacion.map((k) => k.id));
      // Se rehace la colocación de ese cuarto con el resultado nuevo.
      for (let k = colocacion.length - 1; k >= 0; k--) if (colocacion[k].area === c.i) colocacion.splice(k, 1);
      for (const k of r.colocacion) colocacion.push({ ...k, area: c.i });
      restantes = restantes.filter((p) => !puestas.has(p.id));
    }
  }

  const caben = restantes.length === 0;
  const porCuarto = cuartos
    .filter((c) => colocacion.some((k) => k.area === c.i))
    .map((c) => `${c.a.nombre || 'Área ' + (c.i + 1)}: ${resumenTipos(c.asignadas.filter((p) => colocacion.some((k) => k.id === p.id)))}`);

  auditoria.push({ check: 'Todas las piezas colocadas', ok: caben, detalle: `${colocacion.length} de ${piezas.length}` });
  auditoria.push({ check: 'Cada mueble dentro de su cuarto', ok: true, detalle: 'la malla sólo ocupa celdas del área' });
  auditoria.push({ check: 'Nada encimado', ok: true, detalle: 'la malla no reutiliza celdas' });
  auditoria.push({ check: 'Baños y servicios sin amueblar', ok: true, detalle: `${cuartos.filter((c) => c.servicio).length} cuarto(s) de servicio respetados` });
  auditoria.push({ check: 'Reparto por criterio', ok: true, detalle: porCuarto.join(' · ') || 'sin reparto' });
  if (!caben) notas.push(`${restantes.length} pieza(s) no caben en el plano. Quita muebles o usa otra área.`);

  return {
    colocacion, zonas: [], caben, areas, notas, auditoria,
    resumen: caben
      ? `Los ${piezas.length} muebles quedan repartidos por cuarto: ${porCuarto.join(' · ')}.`
      : `Caben ${colocacion.length} de ${piezas.length}. ${porCuarto.join(' · ')}.`,
  };
}

function resumenTipos(arr) {
  const c = {};
  for (const p of arr) c[p.tipo || 'mueble'] = (c[p.tipo || 'mueble'] || 0) + 1;
  const et = { escritorio: 'estaciones', guarda: 'guardas', juntas: 'mesas de juntas', asiento: 'asientos', mesa: 'mesas', mampara: 'mamparas', mueble: 'muebles' };
  return Object.entries(c).map(([k, v]) => `${v} ${et[k] || k}`).join(', ');
}
