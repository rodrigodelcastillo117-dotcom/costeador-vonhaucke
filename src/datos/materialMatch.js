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
  SUBSTITUTE_REQUIRES_CONFIRMATION: 'SUBSTITUTE_REQUIRES_CONFIRMATION',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
});

// Sólo EXACT y equivalencias autorizadas alimentan el BOM automáticamente.
export const MATCH_AUTOCOSTEABLE = new Set([MATCH.EXACT, MATCH.EQUIVALENT_APPROVED]);

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

  // Hay id. Si no sabemos qué pidió (texto vacío/no reconocible), confiamos en
  // el id resuelto como EXACT: no hay evidencia de sustitución cruzada.
  if (!famPide) {
    return {
      clase: MATCH.EXACT,
      familiaSolicitada: '',
      familiaResuelta: famTiene,
      autocosteable: true,
      insumoIdEfectivo: insumoId,
      motivo: 'Material asignado del catálogo (sin familia explícita que contrastar).',
    };
  }

  // Misma familia → EXACT.
  if (famTiene && famTiene === famPide) {
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

/**
 * Aplica la política a una pieza del analizador y devuelve el componente listo
 * para el BOM, con el id ya filtrado (sólo EXACT/EQUIVALENT_APPROVED conservan
 * su insumoId) y los metadatos de match para la UI. NUNCA inyecta un material
 * de otra familia al costeo.
 *
 * @param {{insumoId?:string, nombre?:string, material_solicitado?:string, cantidad?:number, nota?:string, confianza?:string, razonamiento?:string}} pieza
 * @param {(id:string)=>({nombre?:string}|undefined)} resolver  Devuelve el insumo del catálogo por id (p.ej. id => insumos[id]).
 * @returns {object} componente para el BOM, con _match {clase, motivo, solicitado}.
 */
export function aplicarPoliticaMaterial(pieza, resolver) {
  const id = String(pieza?.insumoId || '').trim();
  const existe = id ? resolver(id) : null;
  const insumoNombre = existe?.nombre || '';
  const solicitado = pieza?.material_solicitado || '';

  // Si el id ni existe en el catálogo, es NOT_AVAILABLE directo (lo que ya hacía
  // mapIaComps al blanquearlo, pero ahora con metadato y motivo claros).
  const clasif = clasificarMaterial({
    solicitado,
    insumoId: existe ? id : '',
    insumoNombre,
  });

  return {
    nombre: pieza?.nombre || 'Pieza',
    insumoId: clasif.insumoIdEfectivo, // '' salvo EXACT/EQUIVALENT_APPROVED
    cantidad: pieza?.cantidad || 1,
    piezas: 1,
    iaNota: pieza?.nota || '',
    iaConf: pieza?.confianza || '',
    iaRazon: pieza?.razonamiento || '',
    _match: {
      clase: clasif.clase,
      motivo: clasif.motivo,
      solicitado,
      familiaSolicitada: clasif.familiaSolicitada,
      familiaResuelta: clasif.familiaResuelta,
    },
  };
}
