// ============================================================================
//  mobiliarioOntologia · ANCLA vs DEPENDIENTE vs AMENIDAD (ChatGPT P0-R9-6)
//
//  Vocabulario DETERMINISTA para clasificar un mueble observado. Resuelve el bug:
//  el regex viejo mapeaba "silla operativa" → operativos y "silla de juntas" →
//  sala, inflando puestos/salas. Aquí una SILLA es SIEMPRE un DEPENDIENTE: valida/
//  reconcilia el ancla, nunca crea una nueva. Sólo las ANCLAS gobiernan el programa.
//
//  ANCLAS:      bench/workstation, escritorio, mesa de juntas, recepción.
//  DEPENDIENTES: silla (operativa/juntas/ejecutiva/visita), gaveta/pedestal/credenza/archivero.
//  AMENIDADES:  coffee point, lockers, mamparas, print.
//  El orden de evaluación importa: DEPENDIENTE y AMENIDAD se checan ANTES que
//  ANCLA (una "silla de juntas" contiene "junta", pero NO es una sala).
// ============================================================================

export const CLASE = Object.freeze({
  ANCHOR: 'anchor',
  DEPENDENT: 'dependent',
  AMENITY: 'amenity',
  UNKNOWN: 'unknown',
});

export const ANCHOR_ROLE = Object.freeze({
  WORKSTATION: 'ANCHOR_WORKSTATION',   // bench/isla operativa
  DESK_PRIVATE: 'ANCHOR_DESK_PRIVATE', // escritorio de dirección/privado
  MEETING: 'ANCHOR_MEETING',           // mesa de juntas
  RECEPTION: 'ANCHOR_RECEPTION',       // recepción/mostrador
});

export const DEPENDENT_ROLE = Object.freeze({
  WORK_SEAT: 'WORK_SEAT',
  MEETING_SEAT: 'MEETING_SEAT',
  EXECUTIVE_SEAT: 'EXECUTIVE_SEAT',
  VISITOR_SEAT: 'VISITOR_SEAT',
  STORAGE: 'STORAGE',
});

const re = (s) => new RegExp(s, 'i');
const ES_SILLA = re('silla|seat|butaca|sill[oó]n');
const ES_STORAGE = re('gaveta|pedestal|credenza|archiver|cajoner|libreer|librer');
const ES_AMENITY = re('coffee|caf[eé]|locker|casiller|print|impres|mampara|planta|pizarr|v[eé]nd(ing)?');
const ES_MEETING = re('junta|meeting|board|sala\\s+de\\s+junta|boardroom');
const ES_RECEPTION = re('recep|reception|mostrador|lobby');
const ES_PRIVATE = re('direcc|direct|privad|privat|private|ejecut|exec|gerenc|despacho');
const ES_WORKSTATION = re('bench|workstation|work[\\s_-]?station|isla|operativ|puesto|escritor|desk');

/**
 * Clasifica un mueble observado a partir de type+role (texto libre del lector).
 * Determinista y sin inventar: lo que no reconoce → UNKNOWN (va a revisión).
 * @param {{type?:string, role?:string}} it
 * @returns {{clase, anchor_role?:string, dependent_role?:string}}
 */
export function clasificarMueble(it = {}) {
  const hay = `${it.role || ''} ${it.type || ''}`.toLowerCase().trim();
  if (!hay) return { clase: CLASE.UNKNOWN };

  // 1) DEPENDIENTES primero (una "silla de juntas" NO es una sala).
  if (ES_SILLA.test(hay)) {
    let rol = DEPENDENT_ROLE.WORK_SEAT;
    if (ES_MEETING.test(hay)) rol = DEPENDENT_ROLE.MEETING_SEAT;
    else if (ES_PRIVATE.test(hay)) rol = DEPENDENT_ROLE.EXECUTIVE_SEAT;
    else if (/visit|visitor/i.test(hay)) rol = DEPENDENT_ROLE.VISITOR_SEAT;
    return { clase: CLASE.DEPENDENT, dependent_role: rol };
  }
  if (ES_STORAGE.test(hay)) return { clase: CLASE.DEPENDENT, dependent_role: DEPENDENT_ROLE.STORAGE };

  // 2) AMENIDADES (no gobiernan el programa; van a revisión con su naturaleza).
  if (ES_AMENITY.test(hay)) return { clase: CLASE.AMENITY };

  // 3) ANCLAS.
  if (ES_MEETING.test(hay)) return { clase: CLASE.ANCHOR, anchor_role: ANCHOR_ROLE.MEETING };
  if (ES_RECEPTION.test(hay)) return { clase: CLASE.ANCHOR, anchor_role: ANCHOR_ROLE.RECEPTION };
  if (ES_WORKSTATION.test(hay)) {
    // escritorio/desk de dirección/privado → ancla privada; el resto → operativo.
    if (ES_PRIVATE.test(hay)) return { clase: CLASE.ANCHOR, anchor_role: ANCHOR_ROLE.DESK_PRIVATE };
    return { clase: CLASE.ANCHOR, anchor_role: ANCHOR_ROLE.WORKSTATION };
  }
  // escritorio privado sin palabra de workstation (p.ej. sólo "dirección")
  if (ES_PRIVATE.test(hay)) return { clase: CLASE.ANCHOR, anchor_role: ANCHOR_ROLE.DESK_PRIVATE };

  return { clase: CLASE.UNKNOWN };
}

/** ¿El mueble es un ancla (gobierna el programa)? */
export function esAncla(it) { return clasificarMueble(it).clase === CLASE.ANCHOR; }
/** ¿El mueble es un dependiente (silla/guarda: reconcilia, no gobierna)? */
export function esDependiente(it) { return clasificarMueble(it).clase === CLASE.DEPENDENT; }
