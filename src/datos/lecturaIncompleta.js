// ============================================================================
//  VH-178 · LECTURA INCOMPLETA DE LA IA (lab Costear 2026-10-13, gabinete alto)
//  analizar-mueble devolvió, para un gabinete de 2 puertas de 800×450×2000, UNA sola pieza ("Laterales") con un
//  texto basura en `relacion_con` ("Entrepaños ajustables … 1 2 3 … 100 …": el modelo se trabó repitiendo),
//  `informe_pendiente: true`, `design_intent` vacío, y aun así `confianzaGeneral: "alta"`. La app lo costeó.
//  Regla: una lectura incoherente se REINTENTA una vez; si sigue incoherente, entra marcada, con confianza
//  baja, y el costo NO es emitible hasta que una persona revise el despiece. Nunca se completa a ciegas.
// ============================================================================
import { propuestaDegenerada } from './guardaPropuesta.js';

const piezasDe = (p) => (Array.isArray(p?.piezas) ? p.piezas : []);
const NUM = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8 };

/** ¿Un texto muestra que el modelo se trabó (secuencia numérica larga o palabras repetidas en bucle)? */
export function textoDegenerado(s) {
  const t = String(s || '');
  if (t.length < 120) return false;
  if (/(?:\b\d{1,3}\s+){15,}/.test(t)) return true;                     // "1 2 3 4 … 100"
  const palabras = t.toLowerCase().match(/[a-záéíóúñ0-9]+/g) || [];
  if (palabras.length < 40) return false;
  return new Set(palabras).size / palabras.length < 0.2;                 // 5+ repeticiones por palabra en promedio
}

const textoDe = (p, texto) => [p?.producto, p?.tipo, p?.design_intent?.product_type, texto].filter(Boolean).join(' ').toLowerCase();

/** Cantidad pedida de un elemento en el texto: "2 puertas", "dos puertas" → 2; sin mención → 0. */
function cantidadMencionada(t, rx) {
  const m = t.match(new RegExp(`\\b(\\d+|${Object.keys(NUM).join('|')})\\s+${rx}`));
  if (!m) return 0;
  return NUM[m[1]] ?? Number(m[1]) ?? 0;
}

/**
 * Evalúa si la lectura de la IA es coherente con lo que ella misma dice que es el mueble.
 * @param {object} propuesta  respuesta de analizar-mueble (`res.propuesta`)
 * @param {{texto?: string}} ctx  descripción del usuario, si la hay
 * @returns {{ incompleta: boolean, motivos: string[] }}
 */
export function evaluarLectura(propuesta, { texto = '' } = {}) {
  const piezas = piezasDe(propuesta);
  const motivos = [];
  if (piezas.some((x) => x && Object.values(x).some((v) => typeof v === 'string' && textoDegenerado(v))))
    motivos.push('la IA se trabó: una pieza trae texto repetido sin sentido');
  if (propuestaDegenerada(propuesta)) motivos.push('respuesta mal formada (piezas metidas dentro de un texto)');
  if (propuesta?.informe_pendiente === true && piezas.length <= 2)
    motivos.push(`la IA dejó su lectura sin terminar (${piezas.length} pieza(s))`);
  const t = textoDe(propuesta, texto);
  // Un mueble de guardado (cuerpo) no se arma con menos de 4 piezas: 2 laterales + piso/techo + respaldo o frentes.
  const guardado = /gabinete|credenza|librero|archivero|guarda|closet|cl[oó]set|locker|alacena|librer[ií]a|vitrina|cajonera/.test(t);
  const unidades = piezas.reduce((s, x) => s + (Number(x?.cantidad) > 0 ? Number(x.cantidad) : 1), 0);
  if (guardado && unidades < 4) motivos.push(`un mueble de guardado no se arma con ${unidades} pieza(s)`);
  const nombres = piezas.map((x) => `${x?.nombre || ''} ${x?.semantic_role || ''}`.toLowerCase()).join(' | ');
  const puertas = cantidadMencionada(t, 'puertas?');
  if (puertas > 0 && !/puerta|frente|hoja abatible/.test(nombres)) motivos.push(`el mueble lleva ${puertas} puerta(s) y el despiece no trae ninguna`);
  const cajones = cantidadMencionada(t, 'cajon(?:es)?');
  if (cajones > 0 && !/caj[oó]n|gaveta|frente/.test(nombres)) motivos.push(`el mueble lleva ${cajones} cajón(es) y el despiece no trae ninguno`);
  return { incompleta: motivos.length > 0, motivos };
}

/**
 * Entre dos lecturas (la original y el reintento) elige la más coherente. Sin reintento válido, la original.
 * @returns {{ res: object, evaluacion: {incompleta:boolean, motivos:string[]}, reintento: boolean }}
 */
export function elegirLectura(v1, v2, ctx = {}) {
  const e1 = evaluarLectura(v1?.propuesta, ctx);
  if (!v2?.ok) return { res: v1, evaluacion: e1, reintento: false };
  const e2 = evaluarLectura(v2.propuesta, ctx);
  if (!e2.incompleta) return { res: v2, evaluacion: e2, reintento: true };
  // Las dos son incoherentes: la de menos problemas y, a empate, la de más piezas.
  const mejor2 = e2.motivos.length < e1.motivos.length
    || (e2.motivos.length === e1.motivos.length && piezasDe(v2.propuesta).length > piezasDe(v1?.propuesta).length);
  return mejor2 ? { res: v2, evaluacion: e2, reintento: true } : { res: v1, evaluacion: e1, reintento: true };
}
