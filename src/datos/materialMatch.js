// ============================================================================
//  MATERIAL MATCH POLICY — regla explícita de correspondencia de materiales.
//
//  El pecado que esto evita (caso real, counter ASUR): el usuario pide
//  "superficie sólida azul", el catálogo NO la tiene, y el sistema la cuela como
//  "MDF + laminado HPL" porque son "parecidos". Eso FALSEA el costo y engaña a
//  Dirección. Aquí NUNCA se sustituye un material por otro de OTRA familia sin
//  que una persona lo confirme.
//
//  Clasificación (determinista, sin LLM):
//    EXACT                          → el id resuelto es de la MISMA familia pedida. Alimenta el BOM.
//    EQUIVALENT_APPROVED            → equivalencia pre-autorizada (misma familia, otro color/espesor). Alimenta el BOM.
//    SUBSTITUTE_REQUIRES_CONFIRMATION → el id resuelto es de OTRA familia (p.ej. piden solid surface, cae en MDF). NO alimenta el BOM.
//    NOT_AVAILABLE                  → se pidió un material reconocible que el catálogo no tiene. NO alimenta el BOM; estado INCOMPLETE_MATERIAL.
//
//  Regla de oro: sólo EXACT y EQUIVALENT_APPROVED pueden entrar automáticamente
//  al BOM económico. Lo demás se marca y NO se costea en $0 silenciosamente.
// ============================================================================

export const MATCH = Object.freeze({
  EXACT: 'EXACT',
  EQUIVALENT_APPROVED: 'EQUIVALENT_APPROVED',
  USER_CONFIRMED: 'USER_CONFIRMED',
  CANDIDATE_REQUIRES_CONFIRMATION: 'CANDIDATE_REQUIRES_CONFIRMATION',
  SUBSTITUTE_REQUIRES_CONFIRMATION: 'SUBSTITUTE_REQUIRES_CONFIRMATION',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
});

// Sólo EXACT y equivalencias autorizadas alimentan el BOM automáticamente.
export const MATCH_AUTOCOSTEABLE = new Set([MATCH.EXACT, MATCH.EQUIVALENT_APPROVED, MATCH.USER_CONFIRMED]);

// Familias canónicas de material. El orden importa: la primera regex que pega
// gana, así que las familias MÁS específicas van ANTES que las genéricas
// (p.ej. "superficie sólida" antes que "madera", "acero inoxidable" antes que
// "metal/lámina", "melamina/mdf" antes que "madera").
const FAMILIAS = [
  ['superficie_solida', /solid\s*surface|superficie\s+s[oó]lida|corian|krion|staron|hi-?macs|avonite|montelli/i],
  ['pet_acustico',      /\bpet\b|ac[uú]stic|sonara|poli[eé]ster ac/i],
  ['termoformado',      /termoform|membrana\s*pvc|vacuum\s*form/i],
  ['acrilico',          /acr[ií]lic|plexi|pmma/i],
  ['policarbonato',     /policarbonat|polycarbon|lexan/i],
  ['cristal',           /cristal|vidrio|templado|glass/i],
  ['marmol_piedra',     /m[aá]rmol|marble|granito|cuarzo|quartz|piedra|onix|[oó]nix/i],
  ['acero_inoxidable',  /inoxidable|inox\b|stainless|304|316/i],
  ['aluminio',          /aluminio|aluminum|anodiz/i],
  ['laminado_hpl',      /laminado|hpl|ecolegno|formica|high\s*pressure/i],
  ['melamina',          /melamina|melamine|aglomerad/i],
  ['mdf',               /\bmdf\b|fibrofacil|tablero de fibra/i],
  ['chapa_madera',      /chapa|veneer|enchap/i],
  ['madera_solida',     /madera\s+s[oó]lida|solid\s*wood|duela|tzalam|encino macizo|roble macizo/i],
  ['metal_lamina',      /l[aá]mina|lamina|acero|steel|ptr|tubular|tubo|fierro|hierro|metal/i],
  ['tapiceria',         /tapiz|tela|vinil|piel|cuero|textil|upholster/i],
];

/**
 * Familia canónica de un texto de material (nombre de insumo o material pedido).
 * @param {string} texto
 * @returns {string} slug de familia, o '' si no se reconoce.
 */
export function familiaDeMaterial(texto) {
  const t = String(texto || '').trim();
  if (!t) return '';
  for (const [fam, re] of FAMILIAS) {
    if (re.test(t)) return fam;
  }
  return '';
}

function espesoresMM(texto='') {
  const t=String(texto||'').toLowerCase();
  const out=new Set();
  for (const m of t.matchAll(/\b(\d+(?:[.,]\d+)?)\s*mm\b/g)) {
    const n=Number(String(m[1]).replace(',','.'));
    if(Number.isFinite(n) && n>0) out.add(n);
  }
  return [...out];
}

function conflictoEspesor(a='',b='') {
  const A=espesoresMM(a), B=espesoresMM(b);
  if(!A.length || !B.length) return false;
  return !A.some((x)=>B.includes(x));
}

const STOP_IDENTIDAD = new Set([
  'pieza','piezas','componente','componentes','material','accesorio','accesorios',
  'cubierta','costado','frente','panel','base','estructura','soporte','para','con',
]);
function tokensIdentidad(texto='') {
  const t=String(texto||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return (t.match(/[a-z0-9-]{4,}/g)||[]).filter((x)=>!STOP_IDENTIDAD.has(x));
}
function identidadComercialExacta(solicitado='', insumoNombre='') {
  const pide=[...new Set(tokensIdentidad(solicitado))];
  if(pide.length<2) return false;
  const tiene=new Set(tokensIdentidad(insumoNombre));
  return pide.every((x)=>tiene.has(x));
}

// Equivalencias PRE-AUTORIZADAS (misma familia tratada como intercambiable).
// Hoy vacío a propósito: ninguna equivalencia entre familias distintas está
// autorizada. Cuando Compras/Dirección autoricen una (p.ej. un color de melamina
// por otro), se agrega aquí como 'familiaPedida>familiaResuelta'. NUNCA cruza
// familias de distinta naturaleza (solid surface ≠ MDF jamás).
const EQUIVALENCIAS_APROBADAS = new Set([
  // 'superficie_solida>superficie_solida' se maneja como EXACT, no aquí.
]);

/**
 * Clasifica la correspondencia entre lo que el usuario PIDIÓ y lo que el
 * analizador resolvió contra el catálogo. Determinista.
 *
 * @param {object} args
 * @param {string} [args.solicitado]  Material/familia que el usuario pidió (texto del analizador: material_solicitado o nombre de pieza).
 * @param {string} [args.insumoId]    id que el analizador eligió del catálogo ('' si ninguno).
 * @param {string} [args.insumoNombre] nombre del insumo resuelto (para inferir su familia).
 * @returns {{clase:string, familiaSolicitada:string, familiaResuelta:string,
 *            autocosteable:boolean, insumoIdEfectivo:string, motivo:string}}
 */
export function clasificarMaterial({ solicitado = '', insumoId = '', insumoNombre = '' } = {}) {
  const famPide = familiaDeMaterial(solicitado);
  const famTiene = familiaDeMaterial(insumoNombre || insumoId);
  const tieneId = !!String(insumoId || '').trim();

  // Sin id resuelto: si pidió algo reconocible, NO está disponible; si ni
  // siquiera reconocemos lo pedido, también lo tratamos como no disponible
  // (no hay con qué costear) pero sin "substitute".
  if (!tieneId) {
    return {
      clase: MATCH.NOT_AVAILABLE,
      familiaSolicitada: famPide,
      familiaResuelta: '',
      autocosteable: false,
      insumoIdEfectivo: '',
      motivo: famPide
        ? `Se pidió ${famPide.replace(/_/g, ' ')} y el catálogo no tiene un insumo certificado para esa familia.`
        : 'No hay material asignado y no se pudo reconocer lo pedido.',
    };
  }

  // Hay id, pero no sabemos qué pidió. Eso es CANDIDATO, no evidencia de
  // exactitud. Antes la ausencia de contraste se interpretaba como PASS.
  if (!famPide) {
    // Componentes comprados (herrajes/equipamiento) pueden no pertenecer a una
    // familia de MP. Sólo se aceptan como EXACT cuando la identidad textual es
    // suficientemente específica y coincide con el artículo real del catálogo.
    if (identidadComercialExacta(solicitado, insumoNombre)) {
      return {
        clase: MATCH.EXACT,
        familiaSolicitada: '',
        familiaResuelta: famTiene,
        autocosteable: true,
        insumoIdEfectivo: insumoId,
        motivo: 'Identidad comercial específica coincide con el artículo del catálogo.',
      };
    }
    return {
      clase: MATCH.CANDIDATE_REQUIRES_CONFIRMATION,
      familiaSolicitada: '',
      familiaResuelta: famTiene,
      autocosteable: false,
      insumoIdEfectivo: '',
      insumoIdCandidato: insumoId,
      motivo: 'Hay un artículo candidato del catálogo, pero falta evidencia suficiente para confirmar identidad exacta.',
    };
  }

  // Misma familia no basta si una especificación explícita contradice al
  // candidato (p.ej. melamina 19 mm pedida vs 16 mm resuelta).
  if (famTiene && famTiene === famPide) {
    if (conflictoEspesor(solicitado, insumoNombre)) {
      return {
        clase: MATCH.CANDIDATE_REQUIRES_CONFIRMATION,
        familiaSolicitada: famPide,
        familiaResuelta: famTiene,
        autocosteable: false,
        insumoIdEfectivo: '',
        insumoIdCandidato: insumoId,
        motivo: 'La familia coincide, pero el espesor explícito no coincide; requiere confirmación.',
      };
    }
    return {
      clase: MATCH.EXACT,
      familiaSolicitada: famPide,
      familiaResuelta: famTiene,
      autocosteable: true,
      insumoIdEfectivo: insumoId,
      motivo: `Coincide la familia: ${famPide.replace(/_/g, ' ')}.`,
    };
  }

  // Equivalencia pre-autorizada entre familias (hoy ninguna).
  if (EQUIVALENCIAS_APROBADAS.has(`${famPide}>${famTiene}`)) {
    return {
      clase: MATCH.EQUIVALENT_APPROVED,
      familiaSolicitada: famPide,
      familiaResuelta: famTiene,
      autocosteable: true,
      insumoIdEfectivo: insumoId,
      motivo: `Equivalencia autorizada: ${famPide.replace(/_/g, ' ')} ↔ ${famTiene.replace(/_/g, ' ')}.`,
    };
  }

  // Familia distinta y NO autorizada → sustitución que requiere confirmación.
  // NO entra al BOM: devolvemos insumoIdEfectivo '' para que no se costee solo.
  return {
    clase: MATCH.SUBSTITUTE_REQUIRES_CONFIRMATION,
    familiaSolicitada: famPide,
    familiaResuelta: famTiene,
    autocosteable: false,
    insumoIdEfectivo: '',
    motivo: `Se pidió ${famPide.replace(/_/g, ' ')} pero el catálogo ofreció ${(famTiene || 'otro material').replace(/_/g, ' ')}. Requiere confirmación: no se sustituye solo.`,
  };
}

// Puntúa coincidencia de color/acabado/espesor de un texto contra el nombre de un insumo.
const RE_ESPESOR = /\b(9|12|16|19|25|28|30|36)\b/g;
/**
 * MEJOR insumo de la MISMA familia para un texto de material (red de seguridad
 * determinista: un material NOMBRADO nunca debe quedar sin costear). Escoge por
 * familia + color/acabado + espesor. NUNCA cruza familias: si la familia pedida no
 * existe en el catálogo, devuelve null (queda pendiente, p.ej. solid surface).
 * @param {string} texto  p.ej. "Costado melamina nogal claro 19 mm"
 * @param {Array<{id:string,nombre?:string,seccion?:string}>} catalogo  Object.values(insumos)
 * @returns {{id:string,nombre?:string}|null}
 */
export function mejorInsumoDeFamilia(texto, catalogo = []) {
  const fam = familiaDeMaterial(texto);
  if (!fam || !Array.isArray(catalogo)) return null;
  const t = String(texto).toLowerCase();
  const STOP = new Set(['melamina', 'laminado', 'madera', 'panel', 'costado', 'lateral', 'repisa', 'repisas', 'frente', 'frentes', 'cubierta', 'entrepano', 'puerta', 'para', 'con', 'del', 'los', 'las', 'mdf', 'acero', 'lamina']);
  const tokens = (t.match(/[a-záéíóúñ]{3,}/gi) || []).filter((w) => !STOP.has(w));
  const espesores = t.match(RE_ESPESOR) || [];
  let best = null, bestScore = -1;
  for (const ins of catalogo) {
    if (!ins || !ins.id) continue;
    if (familiaDeMaterial(ins.nombre || ins.id) !== fam) continue;
    const n = `${ins.nombre || ''} ${ins.id}`.toLowerCase();
    let score = 1; // misma familia ya vale
    for (const tok of tokens) if (n.includes(tok)) score += 2;          // color/acabado
    for (const e of espesores) if (new RegExp(`\\b${e}\\b`).test(n)) score += 3; // espesor
    if (score > bestScore) { bestScore = score; best = ins; }
  }
  return best;
}

/**
 * Aplica la política a una pieza del analizador. Sólo EXACT/EQUIVALENT_APPROVED
 * conservan el id del LLM. Si queda sin id PERO la FAMILIA existe en el catálogo
 * (p.ej. el LLM nombró "melamina nogal" pero no mapeó), se AUTO-PRECARGA el mejor
 * insumo de esa misma familia (cost-equivalente, nunca cruza familia). Si la
 * familia no existe (solid surface ausente), queda pendiente. NUNCA inyecta otra familia.
 *
 * @param {object} pieza  {insumoId, nombre, material_solicitado, cantidad, nota, confianza, razonamiento}
 * @param {(id:string)=>({nombre?:string}|undefined)} resolver  id => insumos[id]
 * @param {Array<{id:string,nombre?:string,seccion?:string}>} [catalogo]  Object.values(insumos) para auto-precarga
 * @returns {object} componente para el BOM, con _match {clase, motivo, solicitado, autollenado?}
 */
export function aplicarPoliticaMaterial(pieza, resolver, catalogo = null) {
  const id = String(pieza?.insumoId || '').trim();
  const existe = id ? resolver(id) : null;
  const insumoNombre = existe?.nombre || '';
  const solicitado = pieza?.material_solicitado || '';
  // VH-053: la IA elige del catálogo del SERVIDOR (insumos_catalogo, 259 ids); el
  // navegador costea con el local (config, 92). Un id que la IA declara EXACT y aquí
  // no existe es un material REAL sin precio certificado por Compras: se dice tal
  // cual y NO se sustituye por un pariente local (sería una sustitución silenciosa).
  const matchIA = String(pieza?.material_match || '').trim().toUpperCase();
  const servidorId = id && !existe && matchIA === 'EXACT' ? id : '';

  const clasif = clasificarMaterial({ solicitado, insumoId: existe ? id : '', insumoNombre });

  let insumoIdFinal = clasif.insumoIdEfectivo;
  let candidatoId = clasif.insumoIdCandidato || null;
  let clase = clasif.clase;
  let motivo = clasif.motivo;
  let autollenado = false;

  // Confirmación humana explícita: sólo entonces un candidato conocido puede
  // entrar al BOM económico.
  if (pieza?.material_confirmado === true && existe) {
    insumoIdFinal = id;
    candidatoId = id;
    clase = MATCH.USER_CONFIRMED;
    motivo = `Material confirmado por usuario: ${existe.nombre || id}.`;
  }

  // RED DE SEGURIDAD: material nombrado sin id → PROPONE el mejor de la misma
  // familia, pero no lo convierte en costo autoritativo sin confirmación.
  // VH-053: id EXACT de la IA que no existe localmente = material REAL sin precio certificado;
  // se dice tal cual y NO se sustituye por un pariente local.
  if (servidorId) {
    clase = MATCH.NOT_AVAILABLE; insumoIdFinal = ''; candidatoId = null;
    motivo = `Existe en el catálogo del servidor como «${servidorId}», pero sin precio certificado por Compras. No se costea hasta que Compras lo certifique o elijas un material local.`;
  }
  if (!insumoIdFinal && !candidatoId && !servidorId && Array.isArray(catalogo)) {
    const cand = mejorInsumoDeFamilia(solicitado, catalogo);
    if (cand) {
      candidatoId = cand.id;
      clase = MATCH.CANDIDATE_REQUIRES_CONFIRMATION;
      autollenado = true;
      motivo = `Candidato por familia: ${cand.nombre || cand.id}. Confirma acabado/espesor antes de costear.`;
    }
  }

  return {
    nombre: pieza?.nombre || 'Pieza',
    insumoId: insumoIdFinal,
    cantidad: pieza?.cantidad || 1,
    piezas: 1,
    iaNota: pieza?.nota || '',
    iaConf: pieza?.confianza || '',
    iaRazon: pieza?.razonamiento || '',
    _match: {
      clase, motivo, solicitado, autollenado,
      candidate_insumo_id: candidatoId,
      confirmado_por_usuario: pieza?.material_confirmado === true,
      familiaSolicitada: clasif.familiaSolicitada,
      familiaResuelta: clasif.familiaResuelta,
      ...(servidorId ? { servidorId, sinPrecioCertificado: true } : {}),
    },
  };
}

/**
 * Texto ÚNICO para la alerta de material en pantalla (Costeador y Asistente especial).
 * Antes cada pantalla decidía qué enseñar y el auto-asignado por familia no se veía:
 * una sustitución dentro de la familia pasaba en silencio. Devuelve null si no hay
 * nada que avisar.
 * @returns {{tono:'rojo'|'ambar', titulo:string, detalle:string}|null}
 */
export function alertaMaterial(m) {
  if (!m) return null;
  const pedido = m.solicitado ? ` Pediste «${m.solicitado}».` : '';
  if (m.sinPrecioCertificado) return { tono: 'ambar', titulo: 'Material real sin precio certificado', detalle: `${m.motivo}${pedido}` };
  if (m.clase === MATCH.NOT_AVAILABLE) return { tono: 'rojo', titulo: 'Material pendiente', detalle: `${m.motivo}${pedido} Escoge el material arriba para costearlo (no se sustituye solo).` };
  if (m.clase === MATCH.SUBSTITUTE_REQUIRES_CONFIRMATION) return { tono: 'ambar', titulo: 'Sustitución requiere confirmación', detalle: `${m.motivo}${pedido} Escoge el material arriba para costearlo (no se sustituye solo).` };
  if (m.clase === MATCH.CANDIDATE_REQUIRES_CONFIRMATION || m.autollenado) return { tono: 'ambar', titulo: 'Material propuesto por familia: confírmalo', detalle: `${m.motivo}${pedido} No se costea hasta que lo confirmes o lo cambies arriba.` };
  return null;
}
