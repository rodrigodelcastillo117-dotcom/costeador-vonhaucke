// ============================================================================
//  ESCENAS POR ÁREA — de qué se le habla al modelo cuando pide un render.
//
//  Rodrigo, probando la app en su teléfono (2026-08-16):
//    "el render sale así siempre, no pone Eclipse ni nada que realmente debería.
//     Debería generar render de los privados también, tomando en cuenta el plano."
//
//  Tenía razón, y la causa era de raíz: al modelo se le mandaba UNA lista de
//  texto ("2× Banca doble, 1× Mesa de juntas") y nada más. Con eso sólo puede
//  dibujar una oficina genérica bonita — no sabe qué línea es, ni qué acabado,
//  ni cuántos cuartos hay, ni qué mueble quedó en cuál. Por eso salía siempre
//  igual, proyecto tras proyecto.
//
//  Aquí se arma, POR CADA ÁREA del acomodo, todo lo que hace falta para que la
//  imagen sea de ESE cuarto y no de una oficina cualquiera:
//    · qué muebles quedaron ahí de verdad, con su línea, acabado y cantidad
//    · las medidas reales del cuarto y su superficie
//    · el recorte del acomodo de ESA área (para rasterizarlo y mandarlo como
//      referencia de geometría: el dibujo manda el layout, el modelo el realismo)
//    · qué renders de catálogo mandarle, para que los muebles sean los NUESTROS
//
//  Este archivo NO habla con la nube ni con el navegador: sólo prepara datos, y
//  por eso se puede probar. La llamada vive en la pantalla.
// ============================================================================
import { tipoDe } from './espacio.js';

// El id de una pieza colocada es `<idPartida>-<n>`. Igual que en resumen.js.
const partidaDe = (idPieza) => String(idPieza).replace(/-\d+$/, '');

// Los cuartos de servicio no se amueblan (regla de la casa), así que tampoco
// tiene sentido pedirle al modelo una escena de un baño.
const ES_SERVICIO = /ba[ñn]o|sanitario|servicio|bodega|site|limpieza|cocineta/i;

/**
 * Arma una escena por cada área que tenga muebles.
 *
 * @param {Array}  partidas   renglones de la cotización
 * @param {Object} acomodo    { areas, plan:{ colocacion } }  (medidas en mm)
 * @returns {Array} escenas listas para pedirle el render a la nube
 */
export function escenasDeAcomodo(partidas, acomodo) {
  const areas = acomodo?.areas || [];
  const coloc = acomodo?.plan?.colocacion || [];
  if (!areas.length || !coloc.length || !partidas?.length) return [];

  const porId = Object.fromEntries(partidas.map((p) => [p.id, p]));

  // area -> idPartida -> cuántas piezas de esa partida cayeron ahí
  const cuenta = new Map();
  for (const c of coloc) {
    const pid = partidaDe(c.id);
    if (!porId[pid]) continue;
    const k = c.area ?? 0;
    if (!cuenta.has(k)) cuenta.set(k, new Map());
    const m = cuenta.get(k);
    m.set(pid, (m.get(pid) || 0) + 1);
  }

  const escenas = [];
  for (const [i, m] of [...cuenta.entries()].sort((a, b) => a[0] - b[0])) {
    const area = areas[i];
    if (!area) continue;
    const nombre = area.nombre || `Área ${i + 1}`;
    if (ES_SERVICIO.test(nombre)) continue;   // un baño no se amuebla ni se renderiza

    const piezas = [...m.entries()]
      .map(([pid, cantidad]) => {
        const p = porId[pid];
        return { id: pid, nombre: p.nombre, cantidad, ruta: p.ruta || null, productoId: p.productoId || null, tipo: tipoDe(p) };
      })
      // Lo grande primero: es lo que define la escena y lo que el modelo debe
      // acertar. Si hay que recortar la lista, que se caigan los accesorios.
      .sort((a, b) => b.cantidad - a.cantidad);

    // Cuántas piezas DE PISO (todo menos sillas) tiene que tener la foto, ni
    // una más ni una menos. Las sillas se dejan fuera a propósito: el prompt ya
    // le pide al modelo poner "una silla en cada puesto" por su cuenta —contarlas
    // aquí lo obligaría a acertar un número que él mismo decide cómo repartir.
    const pisoTotal = piezas.reduce((s, p) => (p.tipo === 'asiento' ? s : s + p.cantidad), 0);

    escenas.push({
      areaIndex: i,
      nombre,
      anchoMM: area.ancho,
      largoMM: area.largo,
      m2: Math.round(((area.ancho || 0) * (area.largo || 0)) / 1e6 * 10) / 10,
      piezas,
      pisoTotal,
      // El recorte para dibujar SÓLO este cuarto: el área en el origen y su
      // colocación reindexada a 0. Así se puede rasterizar el isométrico de una
      // sola habitación en vez del piso completo.
      recorte: {
        areas: [{ ...area, x: 0, y: 0 }],
        plan: { colocacion: coloc.filter((c) => (c.area ?? 0) === i).map((c) => ({ ...c, area: 0 })) },
      },
      descripcion: descripcionDeEscena(nombre, area, piezas),
    });
  }
  return escenas;
}

/**
 * Lo que se le DICE al modelo sobre este cuarto. Va en español de mueblería y
 * con la línea por delante: "Eclipse" o "App LT" es lo que cambia el mueble, y
 * era justo lo que no le llegaba.
 */
export function descripcionDeEscena(nombre, area, piezas) {
  const lista = piezas.map((p) => `${p.cantidad}× ${p.nombre}`).join(', ');
  const med = area?.ancho && area?.largo
    ? `${(area.ancho / 1000).toFixed(2)} × ${(area.largo / 1000).toFixed(2)} m`
    : '';
  return `${nombre}${med ? ` (${med})` : ''}: ${lista}.`;
}

/**
 * Las líneas Von Haucke presentes en la escena, sin repetir. Sirve para pedirle
 * al modelo los renders de catálogo correctos y para nombrarlas en el prompt.
 */
export function lineasDeEscena(escena) {
  return [...new Set((escena?.piezas || []).map((p) => p.ruta).filter(Boolean))];
}

/**
 * Qué tipo de cuarto es, para que el modelo escoja la cámara y el ambiente.
 * Un privado se fotografía distinto que un open space.
 */
export function tipoDeEscena(nombre = '') {
  const t = String(nombre).toLowerCase();
  if (/junta|consejo|board|sala de reuni/.test(t)) return 'sala de juntas';
  if (/privad|direcci[oó]n|gerenc|ejecutiv/.test(t)) return 'oficina privada';
  if (/recepci|lobby|vest[ií]bulo/.test(t)) return 'recepción';
  if (/comedor|cafeter|break|lounge|espera/.test(t)) return 'área de descanso';
  return 'open space';
}
