// ============================================================================
//  VONI 2.0 — CONOCIMIENTO DE PRODUCTO (Von Haucke). Para que Voni "sepa de
//  muebles como nadie": qué línea sirve para qué, de qué está hecha, su gama, y
//  el principio clave de Von Haucke — casi todo se fabrica A LA MEDIDA.
//
//  DETERMINISTA y SIN INVENTAR: se alimenta del catálogo real (`datos/catalogo.js`:
//  LINEAS con `que`/`gama`/`muebles`). No fabrica datos; si no hay match, lo dice.
// ============================================================================
import { LINEAS, MUEBLES } from '../datos/catalogo.js';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Principios Von Haucke verificables en la propia app (no se inventan).
export const PRINCIPIOS = [
  'Von Haucke fabrica mobiliario de oficina propio, con más de 68 años de oficio (desde 1958).',
  'Casi todo es A LA MEDIDA: medidas, acabados y materiales se ajustan al proyecto. Por eso el costo y el precio salen del despiece real de cada pieza, no de un SKU fijo.',
  'La propuesta se arma por zonas (open space, privados, juntas, recepción, lounge) y tiene que poder caminarse: hay reglas de circulación y sillas de visita.',
];

// Sinónimos del lenguaje de venta → tipos de mueble del catálogo.
const MUEBLE_SINON = [
  { re: /(junta|reunion|reuni|consejo|board|directorio)/, tipos: ['mesa_juntas', 'mesa_consejo'] },
  { re: /(escritorio|estacion|puesto|operativ|bench)/, tipos: ['escritorio', 'estacion_l', 'bench'] },
  { re: /(archiv|guarda|cajon|credenza|torre|locker)/, tipos: ['archivero', 'archivo_lateral', 'cajonera', 'credenza', 'torre'] },
  { re: /(recepci|lobby|vestibulo)/, tipos: ['recepcion'] },
  { re: /(lounge|espera|sillon|pouf|descanso|cafeteria|comedor)/, tipos: ['lounge', 'sillon', 'pouf'] },
  { re: /(mampara|division|muro|cancel|privacidad|cristal)/, tipos: ['mampara', 'muro', 'divisor', 'puerta'] },
  { re: /(mesa de apoyo|mesa de centro|apoyo)/, tipos: ['mesa_apoyo'] },
  { re: /(mesa de trabajo|mesa)/, tipos: ['mesa_trabajo', 'mesa_juntas'] },
];

const gamaIntencion = (q) => {
  if (/(ejecutiv|direcci|premium|lujo|director|nogal|piel|\balta\b)/.test(q)) return 'alta';
  if (/(econom|barat|bajo costo|accesible|operativ)/.test(q)) return 'baja';
  return null;
};

// Materiales → líneas que los trabajan (según el `que` real del catálogo).
const MATERIAL = [
  { re: /(nogal|madera|chapa|piel|ecopiel)/, lineas: ['eclipse', 'eclipse_drift', 'alba'] },
  { re: /(cristal|vidrio|templado)/, lineas: ['privacy_4'] },
  { re: /(inox|inoxidable|acero)/, lineas: ['luna'] },
  { re: /(metal|tubular)/, lineas: ['alba', 'feather', 'spine_ii'] },
];

const legibles = (tipos = []) => tipos.map((t) => MUEBLES[t] || t);

/** Recomienda líneas Von Haucke para lo que describe el usuario (ranked). */
export function recomendar(query) {
  const q = norm(query);
  const gama = gamaIntencion(q);
  const porMat = MATERIAL.find((m) => m.re.test(q));
  const tipo = MUEBLE_SINON.find((m) => m.re.test(q));
  const tipos = tipo ? tipo.tipos : [];
  const out = [];
  for (const l of LINEAS) {
    if (l.confirmar) continue;
    let score = 0; const razones = [];
    const hace = (l.muebles || []).filter((x) => tipos.includes(x));
    if (hace.length) { score += 3; razones.push(`fabrica ${legibles(hace).join('/')}`); }
    if (porMat && porMat.lineas.includes(l.id)) { score += 3; razones.push('trabaja ese material'); }
    if (gama === 'alta' && l.gama >= 7) { score += 2; razones.push('gama ejecutiva'); }
    if (gama === 'baja' && l.gama <= 3) { score += 2; razones.push('más económica'); }
    if (score > 0) out.push({ id: l.id, nombre: l.nombre, que: l.que, gama: l.gama, razones, _s: score });
  }
  out.sort((a, b) => b._s - a._s || (gama === 'alta' ? b.gama - a.gama : a.gama - b.gama));
  return out.slice(0, 4).map(({ _s, ...r }) => r);
}

/** Explica una línea por nombre o id. */
export function explicar(nombreOId) {
  const q = norm(nombreOId);
  // Busca la línea cuyo NOMBRE (o id) aparezca dentro de la frase: "¿de qué está
  // hecha Alba?" encuentra Alba. Antes comparaba la frase completa contra el nombre.
  const l = LINEAS.find((x) => x.id === q || norm(x.nombre) === q || q.includes(norm(x.nombre)));
  return l ? { id: l.id, nombre: l.nombre, que: l.que, gama: l.gama, fabrica: legibles(l.muebles || []) } : null;
}

/** Paquete de conocimiento para una consulta (lo usa la tool get_catalog_knowledge). */
export function conocimientoDe(query) {
  const q = norm(query);
  const esAMedida = /(a la medida|a medida|custom|personaliz|adaptar)/.test(q);
  const recomendaciones = recomendar(query);
  const linea = recomendaciones.length === 0 ? explicar(query) : null;
  return { principios: PRINCIPIOS, recomendaciones, linea, esAMedida };
}
