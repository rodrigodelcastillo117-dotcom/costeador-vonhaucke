// ============================================================================
//  PILOTO AUTOMÁTICO · respuestas por REGLA DE CASA a las preguntas de la IA (Dirección 12-oct:
//  "que la IA haga la mayoría de las cosas, que deje lo menos para el humano, casi automatizado,
//  pero real"). Contesta sólo lo que una regla declarada puede contestar; lo demás queda para la
//  persona. Cada respuesta automática dice de dónde sale ("regla de casa") para que la IA y la
//  bitácora de confirmaciones lo registren tal cual. Puro y probado.
// ============================================================================
import { REGLAS_TALLER } from './reglasTaller.js';

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const eligeOpcion = (ops, re) => (ops || []).map(String).find((o) => re.test(norm(o))) || null;

// Reglas: [prueba sobre la pregunta, respuesta (texto u opción), motivo]. Orden = prioridad.
const REGLAS = [
  { clave: 'tapacanto', re: /tapacanto|cubre ?canto|chapacinta|\bcanto\b/, responder: (q, ops) => eligeOpcion(ops, /pvc|tapacanto/) || 'Tapacanto PVC estándar de casa, mismo color que el acabado, en todos los cantos visibles' },
  { clave: 'pintura_acero', re: /(pintura|acabado|color).*(acero|ptr|tubo|lamina|estructura|metal)|(acero|ptr|tubo|lamina|estructura|metal).*(pintura|acabado|color)/, responder: (q, ops) => eligeOpcion(ops, /electrost|polvo/) || 'Pintura electrostática en polvo (todo el acero visible), color según lo solicitado' },
  { clave: 'niveladores', re: /nivelador|regaton/, responder: () => `${REGLAS_TALLER.niveladores.porModulo} niveladores por módulo` },
  { clave: 'zoclo', re: /zoclo|zocalo/, responder: (q, ops) => eligeOpcion(ops, /^s[ií]\b|con zoclo|lleva/) || `Sí, zoclo de ${REGLAS_TALLER.zoclo.altoMM} mm (durabilidad y vista)` },
  { clave: 'bisagras', re: /cuant[ao]s? bisagras|bisagras por puerta|numero de bisagras/, responder: () => '2 bisagras por puerta hasta 900 mm de alto; 3 si es más alta' },
  { clave: 'jaladeras', re: /jaladera|tirador/, responder: (q, ops) => eligeOpcion(ops, /jaladera|barra/) || '1 jaladera por puerta y por cajón, estándar de casa' },
  { clave: 'espesor_panel', re: /espesor.*(melamina|mdf|tablero|cubierta|costado|entrepa|repisa|puerta)|(melamina|mdf|tablero|cubierta|costado|entrepa|repisa|puerta).*espesor/, responder: (q, ops) => eligeOpcion(ops, /\b19\b/) || '19 mm (espesor comercial de casa; 18 mm no existe en catálogo)' },
  { clave: 'espesor_respaldo', re: /espesor.*(respaldo|fondo|trasero)|(respaldo|fondo|trasero).*espesor/, responder: (q, ops) => eligeOpcion(ops, /\b(9|12)\b/) || `${REGLAS_TALLER.respaldo.espesorMaxMM} mm o menos (respaldo/fondo no portante)` },
  { clave: 'refuerzo', re: /refuerzo|travesa|pandeo|carga.*(repisa|entrepa)/, responder: () => `Travesaño trasero si el claro es ≥ ${REGLAS_TALLER.refuerzo.claroMM} mm y cargará productos pesados; si no, sin refuerzo` },
];

/**
 * @param {Array} preguntas  preguntas normalizadas de la IA ({question_key, pregunta, tipo, opciones, supuesto, impacto, afecta})
 * @param {{aceptarSupuestosBajo?: boolean}} [o]  aceptar el supuesto de la IA cuando el impacto es bajo
 * @returns {{respuestas: Record<string,string>, detalle: Array<{question_key:string, regla:string, respuesta:string}>, pendientes: Array<string>}}
 */
/** Dato explícito (espesor en mm o calibre) que trae la pregunta/supuesto para las reglas de espesor y pintura/acero. */
export function explicitoDe(q, clave) {
  const fuente = `${q?.supuesto || ''} ${q?.afecta || ''} ${q?.pregunta || ''}`;
  if (/^espesor_/.test(clave)) {
    const m = fuente.match(/\b(\d{1,2}(?:[.,]\d)?)\s*mm\b/i);
    return m ? `${m[1].replace(',', '.')} mm` : null;
  }
  if (clave === 'pintura_acero') {
    const m = fuente.match(/\bcal(?:ibre)?\.?\s*(\d{1,2})\b/i);
    return m ? `calibre ${m[1]}` : null;
  }
  return null;
}
const alternativaDeCasa = (clave) => (clave === 'espesor_panel'
  ? 'Si el catálogo no lo tiene, 19 mm (estándar de casa) queda como alternativa por confirmar; no se sustituye solo.'
  : clave === 'espesor_respaldo' ? `Estándar de casa: ${REGLAS_TALLER.respaldo.espesorMaxMM} mm o menos; se conserva lo pedido.`
  : 'El estándar de casa queda como alternativa por confirmar; no se sustituye solo.');

/** Marca de las respuestas que SÓLO conservan un supuesto de la IA (no son confirmación de nadie). */
export const PREFIJO_SUPUESTO = 'Conserva tu supuesto como preliminar:';
export const esSupuestoPreliminar = (texto) => String(texto || '').trim().startsWith(PREFIJO_SUPUESTO);

export function respuestasPorReglaDeCasa(preguntas = [], { aceptarSupuestosBajo = true } = {}) {
  const respuestas = {}, detalle = [], pendientes = [];
  for (const q of (preguntas || [])) {
    if (!q || !q.question_key) continue;
    const texto = norm(`${q.question_key} ${q.pregunta || ''} ${q.afecta || ''}`);
    const ops = Array.isArray(q.opciones) ? q.opciones.map(String).filter((o) => o.trim()) : [];
    const regla = REGLAS.find((r) => r.re.test(texto));
    if (regla) {
      // Q5·4 (Dirección 13-oct): LO EXPLÍCITO GANA. Si la pregunta, lo que afecta o el supuesto de la IA traen un
      // espesor/calibre explícito del plano o del cliente (p. ej. "MDF 18 mm", "cal. 14"), la regla de casa NO lo
      // pisa: se conserva lo pedido y el estándar se ofrece como alternativa identificada, por confirmar.
      const explicito = explicitoDe(q, regla.clave);
      if (explicito) {
        const r = `Se respeta lo pedido: ${explicito}. ${alternativaDeCasa(regla.clave)}`;
        respuestas[q.question_key] = `${r} (regla de casa)`;
        detalle.push({ question_key: q.question_key, regla: `${regla.clave}:explicito_gana`, respuesta: r, explicito });
        continue;
      }
      const r = regla.responder(q, ops);
      if (r) { respuestas[q.question_key] = `${r} (regla de casa)`; detalle.push({ question_key: q.question_key, regla: regla.clave, respuesta: r }); continue; }
    }
    // Sin regla: si la IA ya trae un supuesto y el impacto es bajo, se conserva como preliminar.
    if (aceptarSupuestosBajo && q.supuesto && String(q.impacto || '').toLowerCase() === 'bajo') {
      respuestas[q.question_key] = `${PREFIJO_SUPUESTO} ${q.supuesto} (impacto bajo; regla de casa)`;
      detalle.push({ question_key: q.question_key, regla: 'supuesto_impacto_bajo', respuesta: q.supuesto });
      continue;
    }
    pendientes.push(q.question_key);
  }
  return { respuestas, detalle, pendientes };
}
