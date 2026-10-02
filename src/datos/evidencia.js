// ============================================================================
//  MODELO DE EVIDENCIA — N4 (lectura de planos de mueble) / N3 (componentes).
//  Capa PURA. Cada dato leído de un plano/brief lleva: valor, FUENTE y confianza.
//  Cuando dos fuentes dicen cosas distintas del MISMO campo, NO se elige en
//  silencio: se emite una CONTRADICCIÓN con UNA pregunta crítica para el humano.
//
//  No lee archivos ni red. El que interpreta el plano (edge leer-plano, o el
//  análisis de render) alimenta aquí los valores ya extraídos.
// ============================================================================

// Fuente/estado de un dato (de más a menos confiable).
export const FUENTES = Object.freeze({
  CONFIRMADO_USUARIO: 'CONFIRMADO_USUARIO',   // el humano lo validó
  VISIBLE_EN_PLANO: 'VISIBLE_EN_PLANO',       // cota/símbolo explícito en el plano
  INFERIDO_ESTRUCTURAL: 'INFERIDO_ESTRUCTURAL', // deducido por geometría/estructura
  SUPUESTO: 'SUPUESTO',                       // asumido por default razonable
});

const CONFIANZA = Object.freeze({
  CONFIRMADO_USUARIO: 1.0,
  VISIBLE_EN_PLANO: 0.9,
  INFERIDO_ESTRUCTURAL: 0.6,
  SUPUESTO: 0.3,
});

export function confianzaDeFuente(fuente) {
  return CONFIANZA[fuente] ?? 0;
}

/** Crea un dato con evidencia. */
export function evidencia(valor, fuente, opts = {}) {
  const f = FUENTES[fuente] ? fuente : FUENTES.SUPUESTO;
  return {
    valor,
    fuente: f,
    confianza: confianzaDeFuente(f),
    nota: opts.nota || null,
    origen: opts.origen || null, // p.ej. "planta", "elevación A-A", "detalle D3"
  };
}

// ¿Dos valores numéricos son "iguales" dentro de una tolerancia relativa?
function iguales(a, b, tolRel) {
  if (typeof a === 'number' && typeof b === 'number') {
    const base = Math.max(Math.abs(a), Math.abs(b), 1);
    return Math.abs(a - b) / base <= tolRel;
  }
  return String(a) === String(b);
}

/**
 * Dado un campo con varias lecturas (cada una con su fuente), decide:
 *  - si todas coinciden → resuelto con la fuente más confiable.
 *  - si difieren → CONTRADICCIÓN con UNA pregunta crítica (no se elige solo).
 * El usuario-confirmado SIEMPRE gana y cierra la contradicción.
 * @param {string} campo nombre legible ("ancho de la credenza").
 * @param {Array<{valor:any,fuente:string,origen?:string}>} lecturas
 * @param {{tolRel?:number, unidad?:string}} [opts]
 */
export function resolverCampo(campo, lecturas, opts = {}) {
  const tolRel = opts.tolRel ?? 0.02; // 2%
  const unidad = opts.unidad ? ` ${opts.unidad}` : '';
  const vals = (lecturas || []).filter((l) => l && l.valor != null);
  if (vals.length === 0) return { campo, resuelto: null, contradiccion: null, confianza: 0 };

  // Si el usuario confirmó algo, eso manda y cierra cualquier discrepancia.
  const conf = vals.find((l) => l.fuente === FUENTES.CONFIRMADO_USUARIO);
  if (conf) {
    return { campo, resuelto: evidencia(conf.valor, FUENTES.CONFIRMADO_USUARIO, { origen: conf.origen }), contradiccion: null, confianza: 1 };
  }

  // Ordena por confianza desc.
  const ord = [...vals].sort((a, b) => confianzaDeFuente(b.fuente) - confianzaDeFuente(a.fuente));
  const mejor = ord[0];
  const discrepan = ord.filter((l) => !iguales(l.valor, mejor.valor, tolRel));

  if (discrepan.length === 0) {
    return { campo, resuelto: evidencia(mejor.valor, mejor.fuente, { origen: mejor.origen }), contradiccion: null, confianza: confianzaDeFuente(mejor.fuente) };
  }

  // Contradicción: NO se elige en silencio. Una sola pregunta crítica.
  const opciones = ord.map((l) => ({ valor: l.valor, fuente: l.fuente, origen: l.origen || null }));
  const lista = opciones.map((o) => `${o.valor}${unidad}${o.origen ? ` (${o.origen})` : ''}`).join('  vs  ');
  return {
    campo,
    resuelto: null,
    confianza: 0,
    contradiccion: {
      campo,
      opciones,
      requiereConfirmacion: true,
      pregunta: `¿Cuál es el valor correcto de ${campo}? ${lista}`,
    },
  };
}

/**
 * Resuelve varios campos. Devuelve el modelo con lo resuelto y la lista de
 * contradicciones (una pregunta por contradicción), sin duplicar preguntas.
 * @param {Object<string, Array>} camposLecturas  { campo: [lecturas...] }
 */
export function modeloEvidencia(camposLecturas, opts = {}) {
  const resuelto = {};
  const contradicciones = [];
  for (const [campo, lecturas] of Object.entries(camposLecturas || {})) {
    const r = resolverCampo(campo, lecturas, opts[campo] || {});
    if (r.resuelto) resuelto[campo] = r.resuelto;
    if (r.contradiccion) contradicciones.push(r.contradiccion);
  }
  return {
    resuelto,
    contradicciones,
    requiereConfirmacion: contradicciones.length > 0,
    // Confianza global = promedio de lo resuelto (0 si todo en disputa).
    confianza: (() => {
      const vs = Object.values(resuelto).map((e) => e.confianza);
      return vs.length ? Math.round((vs.reduce((a, b) => a + b, 0) / vs.length) * 100) / 100 : 0;
    })(),
  };
}
