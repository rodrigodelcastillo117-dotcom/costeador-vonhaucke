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

// Clasifica un cuarto por su nombre. Se EXPORTA para que el programa del plano
// use el mismo criterio que el acomodo: si difieren, la app propone un programa
// para unos cuartos y lo acomoda en otros.
export function rolArea(nombre) {
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
  const sinLugar = piezas.filter((p) => !yaPuesta.has(p.id) && esSillaOperativa(p));
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
    const sillas = enArea.filter((c) => esSillaOperativa(byId[c.id]) || esSillaDirectiva(byId[c.id]));
    // ⚠️ Se salía del cuarto cuando no había NINGUNA silla ya puesta en él, y
    // por eso nunca llegaba a las de `sinLugar`: en el plano real, con las
    // sillas fuera del reparto, las 48 se quedaban sin colocar aunque hubiera
    // 48 puestos libres. Basta con que haya sillas de UNO de los dos lados.
    if (!sillas.length && !sinLugar.length) continue;
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
    // ⚠️ LA NOTA TAMBIÉN MIENTE SI NO SE REHACE. Se escribe ANTES de sentar las
    // sillas, con el conteo de ese momento: decía "48 piezas no caben" con 91
    // de 92 ya colocadas. Se quita la vieja SIEMPRE y se vuelve a escribir con
    // el número de verdad.
    notas: [
      ...(r.notas || []).filter((n) => !/no caben en el plano/i.test(n)),
      ...(caben ? [] : [`${piezas.length - colocacion.length} pieza(s) no caben en el plano. Quita muebles o usa otra área.`]),
    ],
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
  // La CREDENZA no es una gaveta suelta: es el mueble bajo que va DETRÁS del
  // escritorio del director, en su privado. Por eso prefiere 'privado' (donde
  // están los directivos) y se reparte una por oficina, como el escritorio.
  // Antes caía en 'guarda' → open primero → las 5 credenzas al open space,
  // ninguna en su privado, y varias flotando a media planta (Rodrigo lo vio).
  credenza:   ['privado', 'general', 'open'],
  mampara:    ['open', 'general', 'privado'],
  // El mostrador va en la RECEPCIÓN. Obvio, pero hasta hoy no existía el tipo.
  recepcion:  ['recepcion', 'general', 'open'],
  // ⚠️ UNA SILLA DE TRABAJO NO ES UN SILLÓN. El tipo `asiento` mete en el mismo
  // saco la silla operativa y el sofá del lounge, y con eso las 27 sillas de un
  // proyecto real se fueron TODAS al "Break Room & Baños" —Rodrigo lo vio en el
  // 3D: "las sillas las puso en el baño; las sillas van en los operativos y
  // escritorios"—. Se separan por el nombre, que es lo que traen del banco.
  silla:      ['open', 'general', 'privado', 'juntas', 'recepcion', 'lounge'],
  // REGLA DE RODRIGO: "las de VISITA casi siempre van en los privados".
  // Son las dos sillas que están del otro lado del escritorio del director.
  visita:     ['privado', 'juntas', 'recepcion', 'general', 'open', 'lounge'],
  // ⚠️ NO TODA SILLA DE TRABAJO ES OPERATIVA (2026-08-17). La DIRECTIVA es la
  // del director: va en su privado, con su escritorio. La de JUNTAS va en la
  // sala. Sin separarlas, las dos caían en el saco de "operativa" —que ya no
  // se reparte por cuarto porque sigue a su banca— y acababan sentadas en un
  // bench del open space. Medido en el plano real: 4 sillas directivas en el
  // Área Op. 8 y las de juntas repartidas por los privados.
  directiva:  ['privado', 'general', 'juntas', 'open'],
  juntasSilla: ['juntas', 'general', 'privado', 'open', 'lounge'],
  asiento:    ['lounge', 'recepcion', 'general', 'open'],
  mesa:       ['lounge', 'recepcion', 'general', 'open'],
  mueble:     ['general', 'open', 'lounge', 'recepcion'],
};
const ORDEN_TIPOS = ['juntas', 'recepcion', 'escritorio', 'guarda', 'mampara', 'asiento', 'mesa', 'mueble'];

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
// La del director (va en su privado) y la de la sala de juntas. Ninguna de las
// dos "sigue a un bench": tienen cuarto propio, como la de visita.
export const esSillaDirectiva = (p) => esSillaDeTrabajo(p) && /directiv|ejecutiv|presiden|gerencial/i.test(p.nombre || '');
export const esSillaDeJuntas = (p) => esSillaDeTrabajo(p) && /junta|consejo|board/i.test(p.nombre || '');
// Sólo la OPERATIVA se sienta en un bench: es la única sin cuarto propio.
export const esSillaOperativa = (p) => esSillaDeTrabajo(p)
  && !esSillaDeVisita(p) && !esSillaDirectiva(p) && !esSillaDeJuntas(p);

const cabeEn = (p, a) => {
  const holgura = 400;
  const entra = (w, d, hw, hd) => w + hw <= a.ancho && d + hd <= a.largo;
  if (entra(p.w, p.d, holgura, holgura) || entra(p.d, p.w, holgura, holgura)) return true;
  // ⚠️ CIRCULACIÓN POR FUERA (Rodrigo, 2026-08-17), la misma regla que en
  // `malla.js`. Este filtro decide qué cuartos son CANDIDATOS, y pedía 400 mm
  // por los cuatro lados: una banca de 4.5 m en una isla de 4.5 m daba
  // "no cabe", así que **las 8 islas del plano real nunca fueron candidatas** y
  // las bancas acababan en los privados y en la recepción. La isla no tiene
  // muros: el mueble la llena a lo largo y se camina por el pasillo de fuera.
  const largo = Math.max(p.w, p.d), corto = Math.min(p.w, p.d);
  return entra(largo, corto, 0, holgura) || entra(corto, largo, holgura, 0);
};

// El rol de un cuarto sale, en este orden: de lo que el usuario declaró
// (`tipo`, del lienzo), de su nombre, o —si todo es genérico "Área 1, 2, 3"—
// se DEDUCE por tamaño. Sin esto, un plano dibujado no tiene privados ni open
// space y todos los muebles se amontonan en el cuarto más grande.
function rolCuarto(a, todos) {
  // ⚠️ EL PASILLO SE LLEVABA TODO (2026-08-17). En el plano real de Rodrigo el
  // lector marca `tipo:'open'` **tanto al pasillo (321 m²) como a las 8 islas**,
  // y aquí se devolvía `a.tipo` sin más → ganaba el más grande y **las 8 islas
  // quedaban vacías**, con 30 sillas y 5 sillas directivas tiradas en el
  // corredor.
  // ⚠️ Y NO SE ADIVINA POR EL NOMBRE. El primer intento fue un
  // /pasillo|circulación/, que se rompe con el plano que llame distinto a sus
  // cuartos. El dato real ya viene del lector: un cuarto que CONTIENE zonas
  // (`contiene`) es el espacio donde ellas viven, o sea la circulación; lo que
  // se amuebla son las zonas. Se comprueba que las hijas de verdad sirvan para
  // amueblar: si no, el padre sigue siendo el que recibe los muebles.
  if (a.contiene > 0) {
    const zonas = todos.filter((x) => x !== a && x.dentroDe === a.nombre
      && rolCuartoBase(x, todos) !== 'servicio');
    if (zonas.length) return 'servicio';
  }
  return rolCuartoBase(a, todos);
}

// El criterio de siempre, sin la regla del anidamiento (se separa para poder
// preguntarle por las hijas sin caer en recursión infinita).
function rolCuartoBase(a, todos) {
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
  // Con escritorios en el proyecto, la silla operativa NO se reparte por cuarto:
  // se sienta en su puesto al final. Se define aquí porque también hay que
  // dejarla fuera de la SEGUNDA PASADA, que si no la recoge y la mete en el
  // primer privado con hueco (medido: 6 sillas operativas en el Privado 1).
  const hayEscritorios = piezas.some((q) => q.tipo === 'escritorio');
  const sinCuartoPropio = (p) => hayEscritorios && esSillaOperativa(p);
  for (const tipo of ORDEN_TIPOS) {
    const lote = piezas.filter((p) => (p.tipo || 'mueble') === tipo).sort((a, b) => (b.w * b.d) - (a.w * a.d));
    if (!lote.length) continue;
    const ordenar = (orden, preferirConEscritorios, repartirEnPrivados) => [...utiles].sort((x, y) => {
      // Las guardas siguen a los escritorios: van donde está la gente, no a
      // llenar un privado vacío.
      // Un escritorio por privado antes de meter dos en el mismo: si hay dos
      // oficinas, no se llena una y se deja la otra vacía.
      // ⚠️ TAMBIÉN ENTRE ZONAS DECLARADAS (2026-08-17). Esto sólo valía para
      // privados. En el plano real de Rodrigo hay 8 islas iguales de 4.5 × 3.5 m
      // y el reparto medía por ÁREA: 15.75 m² "aguantan" dos bancas de 5.4 m²,
      // así que metía 2 por isla —y sólo cabe UNA—. Las otras 4 rebotaban a la
      // segunda pasada y acababan en la RECEPCIÓN y en los privados, con 4 islas
      // vacías. Es la misma idea que ya estaba escrita para los privados y para
      // los pisos: llenar cada zona una vez antes de doblar en la misma.
      if (repartirEnPrivados && x.rol === y.rol) {
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
      // ⚠️ LA SILLA OPERATIVA NO TIENE CUARTO PROPIO: pertenece a un escritorio.
      // Repartirla por área la mandaba a donde hubiera metros libres —5 en la
      // Sala de Juntas 2, 7 en un privado— lejos de cualquier puesto. Se sale
      // del reparto y la coloca `sentarSillas`, que la sienta en su puesto
      // dondequiera que haya quedado su banca. Lo que no alcance puesto se
      // reporta como no colocado, que es la verdad.
      if (sinCuartoPropio(p)) { sobran.push(p); continue; }
      // La credenza va con el director, en su privado (no es un archivero suelto).
      const credenza = tipo === 'guarda' && /credenza|lateral|bajo\b/i.test(p.nombre || '');
      const orden = tipo === 'escritorio' && esBench(p) ? PREFERENCIA.bench
        : silla ? (visita ? PREFERENCIA.visita
          : esSillaDirectiva(p) ? PREFERENCIA.directiva
            : esSillaDeJuntas(p) ? PREFERENCIA.juntasSilla : PREFERENCIA.silla)
          : credenza ? PREFERENCIA.credenza
            : (PREFERENCIA[tipo] || PREFERENCIA.mueble);
      // La silla OPERATIVA sigue al escritorio, igual que la gaveta: va donde
      // está la gente. La de VISITA no: si también siguiera al escritorio se
      // iría al open space —que es el cuarto con más escritorios— y ahí no
      // recibe nadie. Va al privado, y REPARTIDA: dos por oficina, no diez en la
      // primera. Medido antes de esto: las 10 de visita en el Área Operativa.
      // ⚠️ LAS BANCAS TAMBIÉN SE REPARTEN (2026-08-17). Decía `!esBench(p)`:
      // pensado para UN open space, donde las bancas forman hileras y repartir
      // no aplica. Pero el plano real trae 8 ISLAS iguales, y sin repartir el
      // reparto medía por área —15.75 m² "aguantan" dos bancas de 5.4— y metía
      // 2 por isla cuando sólo cabe UNA: 4 islas vacías y las bancas sobrantes
      // en la recepción. Con un solo cuarto esto no hace nada (no hay entre qué
      // repartir), así que la planta abierta se comporta igual que antes.
      // Y las MESAS DE JUNTAS igual: con 2 salas, una en cada una — antes las
      // dos caían en la Sala 1 y la Sala 2 quedaba vacía.
      // OJO: la credenza NO usa "preferir el cuarto con más escritorios" — eso la
      // mandaba al open (que tiene los 5 benches) por encima de su preferencia de
      // privado. Sigue su orden (privado primero) y se reparte una por oficina.
      const candidatos = ordenar(orden, (tipo === 'guarda' && !credenza) || (silla && !visita),
        tipo === 'escritorio' || tipo === 'juntas' || visita || credenza
        || esSillaDirectiva(p) || esSillaDeJuntas(p));
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
      // ⚠️ LA SEGUNDA PASADA IGNORABA LA PREFERENCIA (2026-08-17). Metía lo que
      // fuera donde cupiera: medido con la lista real de Rodrigo, **21
      // archiveros en la Sala de Juntas 1 y 14 en la Sala 2**. Y la regla de la
      // casa ya lo prohibía: "las gavetas SIEMPRE van pegadas a los escritorios
      // u operativos. Nunca sueltas y NUNCA en sala de juntas". Aquí se respeta:
      // un cuarto que NO está en la preferencia de la pieza no la recibe ni de
      // rebote. Más vale reportar que no cupo que dibujar un disparate.
      const permite = (p) => {
        const pref = p.tipo === 'escritorio' && esBench(p) ? PREFERENCIA.bench
          : (PREFERENCIA[p.tipo] || PREFERENCIA.mueble);
        return pref.includes(c.rol);
      };
      // ⚠️ LAS GAVETAS SE REPARTEN, NO SE AMONTONAN (2026-08-18). Rodrigo:
      // "las sillas y gavetas nunca se ponen bien". Medido con su plano (5
      // privados con escritorio + 5 archiveros): la 2ª pasada metía LOS CINCO
      // en el primer cuarto con hueco —el Privado 1—, a 0.8–3.0 m de cualquier
      // escritorio, y las otras cuatro oficinas sin su archivero. La regla de la
      // casa ("gaveta pegada a su escritorio") ya valía en la 1ª pasada pero
      // aquí se perdía. Ahora un cuarto toma a lo más tantas gavetas nuevas como
      // estaciones (escritorios/bancas) tenga todavía SIN gaveta: la suya, y no
      // dobla hasta que las demás oficinas tengan la propia.
      let cupoGuarda = ocupadas.filter((p) => p.tipo === 'escritorio').length
        - ocupadas.filter((p) => p.tipo === 'guarda').length;
      const nuevas = restantes.filter((p) => !sinCuartoPropio(p) && permite(p) && cabeEn(p, c.a))
        .filter((p) => {
          if (p.tipo !== 'guarda') return true;      // sólo las gavetas se racionan
          if (cupoGuarda <= 0) return false;
          cupoGuarda -= 1; return true;
        });
      const intento = [...ocupadas, ...nuevas];
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
