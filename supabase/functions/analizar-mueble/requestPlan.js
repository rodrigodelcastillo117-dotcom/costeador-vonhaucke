// ============================================================================
//  P0.COSTEO · analizar-mueble · PLAN DE PETICIÓN (puro, testeable offline).
//
//  Aísla las decisiones de "cómo pedirle a la IA" para poder probarlas SIN Deno,
//  sin red y sin API key. El handler Deno (index.ts) importa estas funciones.
//
//  EXPERIMENTO CONTROLADO (Rodrigo): en la PRIMERA PASADA DE TEXTO se DIFIERE el
//  'informe' (auditoría de 8 secciones, lo más pesado de generar) para que el BOM
//  salga muy por debajo del timeout. Reglas:
//   · BOM/despiece es prioridad absoluta; NO se recorta ningún dato de costeo.
//   · 'informe' deja de ser REQUIRED ante Anthropic SÓLO en esa pasada; el contrato
//     público NO se rompe: la respuesta se normaliza a informe:"" (+ informe_pendiente).
//   · El informe completo queda como 2ª pasada/on-demand; nunca bloquea ver el BOM.
//   · NO se aplica el recorte a PDF/imagen ni a revisiones (se miden por separado).
//   · Fail-closed: si falta un dato indispensable, no se inventa (lo decide index.ts).
// ============================================================================

// Quita SÓLO 'informe' del required (deja intactos BOM, design_intent, preguntas, etc.).
export function schemaSinInforme(schema) {
  const req = Array.isArray(schema?.required) ? schema.required.filter((k) => k !== 'informe') : schema?.required;
  return { ...schema, required: req };
}

// Decide schema/effort/max_tokens por tipo de pasada.
//  · primeraPasadaTexto = sólo-texto, NO revisión, sin respuestas previas del usuario.
//  · Justificación de números (no arbitrarios):
//     - maxTok 8000 en texto-inicial: cota de un BOM GRANDE sin informe. Un BOM extenso
//       (~40 piezas × ~180 tokens/pieza ≈ 7.2k) + design_intent + preguntas + materiales
//       entra holgado en 8k; al NO generar el informe (~900 palabras ≈ 1.2–1.8k + prosa),
//       el modelo termina antes. Imagen/plano mantienen 10k (pueden traer más piezas y
//       el informe sigue requerido). Revisión mantiene 6k (ya era compacta).
//     - effort 'low' en texto-inicial: la tarea es EXTRAER/ESTRUCTURAR un BOM desde texto,
//       no redactar la auditoría COO (ésa era la consumidora de 'medium' y queda diferida).
//       La revisión ya usaba 'low'. Imagen/plano mantienen 'medium' (lectura geométrica).
export function planPass({ soloTexto = false, esRevision = false, respCount = 0 } = {}) {
  const sinResp = (Number(respCount) || 0) === 0;
  const primeraPasadaTexto = !!soloTexto && !esRevision && sinResp;
  // FIX timeout imagen/plano (P0): la 1ª pasada VISUAL (imagen/PDF, no revisión, sin respuestas
  // previas) TAMBIÉN difiere el 'informe' de 8 secciones — era el tiempo dominante que agotaba el
  // timeout del proveedor (~75 s → 502 PROVIDER_TIMEOUT). La lectura geométrica (visión) no depende
  // del 'effort', así que imagen conserva 'medium'; sólo se le quita la generación del informe y
  // baja maxTok a 8000 (un BOM sin informe entra holgado). El informe completo queda on-demand.
  const primeraPasadaVisual = !soloTexto && !esRevision && sinResp;
  const deferInforme = primeraPasadaTexto || primeraPasadaVisual;
  // La 1ª pasada visual también baja a 'low': con 'medium' el razonamiento geométrico + salida
  // excedia el wall-clock de la función (la plataforma la mataba sin escribir cierre -> non-2xx).
  // 'low' + informe diferido + 8000 extrae el BOM del plano/render muy por debajo del timeout
  // (misma estrategia que el texto). El informe de 8 secciones queda on-demand.
  const effortBajo = esRevision || primeraPasadaTexto || primeraPasadaVisual;
  return {
    primeraPasadaTexto,
    deferInforme,
    effort: effortBajo ? 'low' : 'medium',
    maxTok: esRevision ? 6000 : (deferInforme ? 8000 : 10000),
  };
}

// Normaliza la propuesta para NO romper consumidores: 'informe' SIEMPRE string.
// Cuando se difirió, marca informe_pendiente=true (la UI puede pedir la auditoría
// completa on-demand). NO inyecta precios (el MOTOR costea, no la IA) ni inventa datos.
export function normalizarPropuesta(propuesta, { deferInforme = false } = {}) {
  if (!propuesta || typeof propuesta !== 'object') return propuesta;
  if (propuesta.informe == null) propuesta.informe = '';
  if (deferInforme) {
    propuesta.informe_pendiente = !(typeof propuesta.informe === 'string' && propuesta.informe.trim().length > 0);
  }
  return propuesta;
}

// Nota de sistema para la primera pasada de texto: BOM primero, informe diferido.
export const NOTA_TEXTO_INICIAL =
  '\n\nPRIMERA PASADA (texto): PRIORIZA el BOM/despiece y design_intent. El \'informe\' ' +
  'NO es obligatorio en esta pasada: déjalo \'\' (la auditoría completa de 8 secciones se ' +
  'generará on-demand después). NO omitas ningún dato de costeo: medidas, cantidad, forma, ' +
  'hojas, material_solicitado, material_match, insumoId, confianza, razonamiento breve, nota, ' +
  'semantic_role y bloqueadores. Si falta un dato indispensable, márcalo como supuesto/' +
  'pregunta (fail-closed) — NO lo inventes.';
