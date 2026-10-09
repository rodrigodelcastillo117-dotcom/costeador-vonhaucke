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

// P1-R10-13: patrones por PALABRA COMPLETA (\b) sobre texto NORMALIZADO (sin
// acentos, con _/-/ convertidos a espacio). Evita falsos positivos de substring:
// `direct` dentro de `indirect`, `puesto` dentro de `repuesto`, `print` dentro de
// `blueprint`. (El underscore es "word char", por eso se normaliza a espacio.)
const normaliza = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_\-/]+/g, ' ').replace(/\s+/g, ' ').trim();
const w = (alts) => new RegExp(`\\b(?:${alts})\\b`, 'i');
const ES_SILLA = w('silla|sillas|seat|seats|butaca|butacas|sillon|sillones');
const ES_STORAGE = w('gaveta|gavetas|pedestal|pedestales|credenza|credenzas|archivero|archiveros|cajonera|cajoneras|librero|libreros');
const ES_AMENITY = w('coffee|cafe|cafetera|cafeteria|locker|lockers|casillero|casilleros|print|printer|impresora|impresoras|mampara|mamparas|pizarron|pizarra');
const ES_MEETING = w('junta|juntas|meeting|board|boardroom');
const ES_RECEPTION = w('recepcion|reception|mostrador|lobby');
const ES_PRIVATE = w('direccion|director|directivo|directiva|privado|privada|private|ejecutivo|ejecutiva|executive|gerencia|gerente|despacho');
const ES_WORKSTATION = w('bench|benches|workstation|workstations|isla|islas|operativo|operativa|operativos|operativas|operational|puesto|puestos|escritorio|escritorios|desk|desks');

// Role CANÓNICO (si el lector lo da, manda sobre el texto libre — P1-R10-13).
const ROLE_CANON = Object.freeze({
  work_seat: { clase: CLASE.DEPENDENT, dependent_role: DEPENDENT_ROLE.WORK_SEAT },
  meeting_seat: { clase: CLASE.DEPENDENT, dependent_role: DEPENDENT_ROLE.MEETING_SEAT },
  executive_seat: { clase: CLASE.DEPENDENT, dependent_role: DEPENDENT_ROLE.EXECUTIVE_SEAT },
  visitor_seat: { clase: CLASE.DEPENDENT, dependent_role: DEPENDENT_ROLE.VISITOR_SEAT },
  storage: { clase: CLASE.DEPENDENT, dependent_role: DEPENDENT_ROLE.STORAGE },
  operational: { clase: CLASE.ANCHOR, anchor_role: ANCHOR_ROLE.WORKSTATION },
  workstation: { clase: CLASE.ANCHOR, anchor_role: ANCHOR_ROLE.WORKSTATION },
  private_office: { clase: CLASE.ANCHOR, anchor_role: ANCHOR_ROLE.DESK_PRIVATE },
  meeting: { clase: CLASE.ANCHOR, anchor_role: ANCHOR_ROLE.MEETING },
  reception: { clase: CLASE.ANCHOR, anchor_role: ANCHOR_ROLE.RECEPTION },
});

/**
 * Clasifica un mueble observado. Prioriza el ROLE canónico; si no, usa el texto
 * libre (type+role) por PALABRA COMPLETA. Determinista y sin inventar: lo que no
 * reconoce → UNKNOWN (va a revisión).
 * @param {{type?:string, role?:string}} it
 * @returns {{clase, anchor_role?:string, dependent_role?:string}}
 */
export function clasificarMueble(it = {}) {
  // 1) ROLE canónico explícito manda.
  const roleKey = String(it.role || '').toLowerCase().trim();
  if (ROLE_CANON[roleKey]) return { ...ROLE_CANON[roleKey] };

  const hay = normaliza(`${it.role || ''} ${it.type || ''}`);
  if (!hay) return { clase: CLASE.UNKNOWN };

  // 2) DEPENDIENTES primero (una "silla de juntas" NO es una sala).
  if (ES_SILLA.test(hay)) {
    let rol = DEPENDENT_ROLE.WORK_SEAT;
    if (ES_MEETING.test(hay)) rol = DEPENDENT_ROLE.MEETING_SEAT;
    else if (w('visita|visitante|visitor').test(hay)) rol = DEPENDENT_ROLE.VISITOR_SEAT;
    else if (ES_PRIVATE.test(hay)) rol = DEPENDENT_ROLE.EXECUTIVE_SEAT;
    return { clase: CLASE.DEPENDENT, dependent_role: rol };
  }
  if (ES_STORAGE.test(hay)) return { clase: CLASE.DEPENDENT, dependent_role: DEPENDENT_ROLE.STORAGE };

  // 3) AMENIDADES (no gobiernan el programa; van a revisión con su naturaleza).
  if (ES_AMENITY.test(hay)) return { clase: CLASE.AMENITY };

  // 4) ANCLAS.
  if (ES_MEETING.test(hay)) return { clase: CLASE.ANCHOR, anchor_role: ANCHOR_ROLE.MEETING };
  if (ES_RECEPTION.test(hay)) return { clase: CLASE.ANCHOR, anchor_role: ANCHOR_ROLE.RECEPTION };
  if (ES_WORKSTATION.test(hay)) {
    // escritorio/desk de dirección/privado → ancla privada; el resto → operativo.
    if (ES_PRIVATE.test(hay)) return { clase: CLASE.ANCHOR, anchor_role: ANCHOR_ROLE.DESK_PRIVATE };
    return { clase: CLASE.ANCHOR, anchor_role: ANCHOR_ROLE.WORKSTATION };
  }
  // dirección/privado sin palabra de workstation (p.ej. sólo "dirección")
  if (ES_PRIVATE.test(hay)) return { clase: CLASE.ANCHOR, anchor_role: ANCHOR_ROLE.DESK_PRIVATE };

  return { clase: CLASE.UNKNOWN };
}

/** ¿El mueble es un ancla (gobierna el programa)? */
export function esAncla(it) { return clasificarMueble(it).clase === CLASE.ANCHOR; }
/** ¿El mueble es un dependiente (silla/guarda: reconcilia, no gobierna)? */
export function esDependiente(it) { return clasificarMueble(it).clase === CLASE.DEPENDENT; }
