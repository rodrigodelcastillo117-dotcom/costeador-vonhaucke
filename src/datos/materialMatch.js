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
  // MISMA familia, variante COMPATIBLE para ESTIMACIÓN (p.ej. melamina/MDF 18→19 mm, mismo
  // acabado). La IA propone el insumo de la misma familia; ENTRA al cálculo PROVISIONAL
  // (costo-equivalente) pero va marcado "POR CONFIRMAR" (no es certificado ni confirmado).
  SAME_FAMILY_COMPATIBLE_PROPOSED: 'SAME_FAMILY_COMPATIBLE_PROPOSED',
  // MISMA familia pero cambia un ATRIBUTO CRÍTICO de ingeniería (calibre de acero/PTR,
  // perfil, grado, espesor estructural de vidrio, capacidad de herraje, spec eléctrica).
  // Se PRESELECCIONA/mostramos el candidato para facilitar la decisión, pero NO es
  // equivalencia aprobada: NO autocostea y bloquea emisión final hasta confirmación.
  SAME_FAMILY_CRITICAL_CONFLICT: 'SAME_FAMILY_CRITICAL_CONFLICT',
  CANDIDATE_REQUIRES_CONFIRMATION: 'CANDIDATE_REQUIRES_CONFIRMATION',
  // Varios candidatos de la misma familia igualmente plausibles: NO se escoge a escondidas.
  AMBIGUOUS: 'AMBIGUOUS',
  SUBSTITUTE_REQUIRES_CONFIRMATION: 'SUBSTITUTE_REQUIRES_CONFIRMATION',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  // SELECCIÓN DIRECTA / LEGACY (backward-compat): un componente con insumoId pero SIN
  // material_solicitado (BOM histórico o selección manual del Costeador) no hace ningún
  // RECLAMO de material que reconciliar. Se PRESERVA el insumo y SÍ costea/emite (para no
  // romper las cotizaciones legacy), pero se etiqueta distinto de un EXACT fresco: NO se
  // declara "certificado" ni "confirmado por IA". NUNCA se inventa confirmación.
  LEGACY_SELECTED: 'LEGACY_SELECTED',
});

// Entran al BOM (costo provisional/autoritativo). SAME_FAMILY_COMPATIBLE_PROPOSED entra como
// provisional (misma familia, variante compatible) marcado "por confirmar". El CRÍTICO, el
// cruce de familia, lo ambiguo y lo no disponible JAMÁS están aquí (fail-closed).
export const MATCH_AUTOCOSTEABLE = new Set([MATCH.EXACT, MATCH.EQUIVALENT_APPROVED, MATCH.USER_CONFIRMED, MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED, MATCH.LEGACY_SELECTED]);

// GATE ECONÓMICO: clases que, aunque muestren un costo PROVISIONAL, BLOQUEAN la emisión
// hasta confirmación humana. El costo conocido/subtotal puede existir y mostrarse, pero
// `costeoEmitible` devuelve emitible=false y costoTotal=null mientras haya alguna de éstas.
// USER_CONFIRMED NO está aquí: la confirmación humana libera el gate.
export const REQUIERE_CONFIRMACION = new Set([
  MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED,
  MATCH.SAME_FAMILY_CRITICAL_CONFLICT,
  MATCH.AMBIGUOUS,
  MATCH.CANDIDATE_REQUIRES_CONFIRMATION,
]);

// ¿Esta partida tiene un material "por confirmar" (provisional/pendiente) que impide emitir?
// Lee el contrato EXPLÍCITO `material_match` (sincronizado en cada componente) y, de respaldo,
// `_match.clase`. No depende de `_match` para la decisión de seguridad (el servidor recibe
// `material_match` en el DTO). USER_CONFIRMED o EXACT ⇒ false.
export function requiereConfirmacion(comp = {}) {
  const clase = comp.material_match || comp?._match?.clase || '';
  return REQUIERE_CONFIRMACION.has(clase);
}

// FUENTE ÚNICA de estados de match VÁLIDOS (P0.6). Un `material_match` que no esté aquí es
// input hostil o corrupto: el DTO lo rechaza (400), NUNCA lo trata como seguro por omisión.
export const MATCH_VALIDOS = new Set(Object.values(MATCH));

// CAPABILITY de CONFIRMACIÓN TÉCNICA (P0.9): quién puede promover un material a USER_CONFIRMED.
// El modelo es IA propone → DISEÑO/DIRECCIÓN confirma → VENTAS consume. Ventas (u otros roles)
// NO pueden confirmar técnicamente un material. Lo decide el SERVIDOR con el rol que ya conoce;
// nunca el browser. Fuente ÚNICA para index.ts y las pruebas.
const ROLES_CONFIRMADORES = new Set(['direccion', 'diseno', 'diseño']);
export function puedeConfirmarMaterial(rol) {
  return ROLES_CONFIRMADORES.has(String(rol || '').trim().toLowerCase());
}

// RECONCILIACIÓN SERVER-SIDE (P0.5 + P0.9 + P0.10 + backward-compat): el `material_match` y
// cualquier flag `legacy` del BROWSER NO son autoridad. El servidor RECALCULA la clase EFECTIVA
// con la MISMA lógica determinista:
//  · CON material_solicitado (reclamo de la IA): clasifica contra el catálogo autoritativo.
//    La confirmación humana (material_confirmado) SÓLO se honra si `puedeConfirmar` (capability
//    de rol, P0.9); si no, se ignora y queda la clase provisional/crítica real.
//  · SIN material_solicitado: la AUSENCIA de ese campo NO prueba legacy (P0.10). Un request
//    interactivo nuevo sin material_solicitado queda PENDIENTE (CANDIDATE_REQUIRES_CONFIRMATION,
//    no emitible), nunca legacy automático. `LEGACY_SELECTED` sólo se origina desde una
//    PROVENANCE SERVER-SIDE confiable (`opts.origenLegacyConfiable`, que el cliente no puede
//    fijar). Con confirmación válida → USER_CONFIRMED. insumoId inválido → NOT_AVAILABLE.
// `opts.puedeConfirmar` y `opts.origenLegacyConfiable` los decide el servidor; por defecto FALSE.
export function reconciliarMaterialServidor(comp = {}, resolver, catalogo = null, { puedeConfirmar = false, origenLegacyConfiable = false } = {}) {
  const solicitado = String(comp.material_solicitado || '').trim();
  const idTxt = String(comp.insumoId || '').trim();
  const existe = idTxt ? (resolver ? resolver(idTxt) : null) : null;
  const confirmar = comp.material_confirmado === true && puedeConfirmar === true; // capability real

  // SIN reclamo de material (no hay material_solicitado).
  if (!solicitado) {
    if (!existe) {
      return { ...comp, insumoId: '', material_match: MATCH.NOT_AVAILABLE,
        _match: { clase: MATCH.NOT_AVAILABLE, solicitado: '', confirmado_por_usuario: false, autocosteable: false, candidate_insumo_id: '', motivo: 'insumoId no existe en el catálogo autoritativo.' } };
    }
    // Confirmación humana explícita y autorizada → USER_CONFIRMED (emite).
    if (confirmar) {
      return { ...comp, insumoId: idTxt, material_match: MATCH.USER_CONFIRMED,
        _match: { clase: MATCH.USER_CONFIRMED, solicitado: '', resuelto: existe.nombre || idTxt, confirmado_por_usuario: true, autocosteable: true, candidate_insumo_id: idTxt, cambio: '' } };
    }
    // PROVENANCE legacy confiable (sólo el servidor la fija) → LEGACY_SELECTED (costea/emite,
    // pero con estado tope preliminar/histórico, nunca certificado — P0.11).
    if (origenLegacyConfiable) {
      return { ...comp, insumoId: idTxt, material_match: MATCH.LEGACY_SELECTED,
        _match: { clase: MATCH.LEGACY_SELECTED, solicitado: '', resuelto: existe.nombre || idTxt, confirmado_por_usuario: false, autocosteable: true, candidate_insumo_id: idTxt, cambio: '' } };
    }
    // Request nuevo sin material_solicitado ni confirmación ni provenance → PENDIENTE (no emite).
    return { ...comp, insumoId: '', material_match: MATCH.CANDIDATE_REQUIRES_CONFIRMATION,
      _match: { clase: MATCH.CANDIDATE_REQUIRES_CONFIRMATION, solicitado: '', resuelto: existe.nombre || idTxt, confirmado_por_usuario: false, autocosteable: false, candidate_insumo_id: idTxt, cambio: '', motivo: 'Material sin especificar ni confirmar: requiere confirmación (no se asume legacy).' } };
  }

  // CON reclamo de material: reclasificación determinista contra el catálogo.
  const pol = aplicarPoliticaMaterial({
    insumoId: comp.insumoId,
    nombre: comp.nombre,
    material_solicitado: solicitado,
    material_confirmado: confirmar,        // sólo si hay capability (P0.9)
    cantidad: comp.cantidad,
  }, resolver, catalogo);
  return {
    ...comp,
    insumoId: pol.insumoId,               // efectivo (vacío si no autocosteable)
    material_match: pol.material_match,   // EFECTIVO: autoridad del servidor, no del browser
    _match: pol._match,
  };
}

// P0.11 — LEGACY_SELECTED nunca se vuelve "certificado" automáticamente. Precio certificado del
// INSUMO ≠ selección certificada del MATERIAL para esa pieza. Si cualquier componente efectivo
// es LEGACY_SELECTED, el estado económico se topa en 'preliminar' hasta migración/confirmación
// válida (que lo convertiría en USER_CONFIRMED y cambiaría el hash/revisión — P0.7/N).
export function estadoConTopeLegacy(estadoBase, componentes = []) {
  const hayLegacy = (Array.isArray(componentes) ? componentes : [])
    .some((c) => (c?.material_match || c?._match?.clase) === MATCH.LEGACY_SELECTED);
  if (hayLegacy && estadoBase === 'certificado') return 'preliminar';
  return estadoBase;
}

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

// Calibre de lámina/PTR ("cal 14", "calibre 18", "cal.14"). Distinto de espesor en mm.
function calibresDe(texto='') {
  const t=String(texto||'').toLowerCase();
  const out=new Set();
  for (const m of t.matchAll(/\bcal(?:ibre)?\.?\s*(\d{1,2})\b/g)) {
    const n=Number(m[1]); if(Number.isFinite(n)&&n>0) out.add(n);
  }
  return [...out];
}
function conflictoCalibre(a='',b='') {
  const A=calibresDe(a), B=calibresDe(b);
  if(!A.length || !B.length) return false;
  return !A.some((x)=>B.includes(x));
}

// Familias de TABLERO (donde ciertas variantes de espesor PUEDEN ser compatibles para estimar).
const FAMILIAS_PANEL = new Set(['melamina', 'mdf', 'laminado_hpl', 'chapa_madera', 'madera_solida']);
// Familias donde un cambio de espesor/calibre/perfil es CRÍTICO (estructural/funcional):
// acero/lámina/PTR por calibre, aluminio por perfil, vidrio por espesor estructural.
const FAMILIAS_CRITICAS = new Set(['metal_lamina', 'acero_inoxidable', 'aluminio', 'cristal']);

// EQUIVALENCIAS DE ESPESOR APROBADAS (EXPLÍCITAS, conservadoras). Un cambio de espesor dentro
// de una familia-panel SÓLO es COMPATIBLE para estimar si el par (ordenado) está AQUÍ. NO se
// asume que "cualquier tablero de otro espesor es equivalente": 28→19, 36→19, 16→19, 9→19
// pueden cambiar construcción (doble tablero/engrosado), rigidez, hojas, laminación, canto,
// peso y proceso → CRÍTICO. Ampliar esta lista es una DECISIÓN de negocio, no un supuesto.
const PARES_ESPESOR_PANEL_COMPATIBLE = new Set([
  '18|19',   // 18 mm (no existe en catálogo) ↔ 19 mm estándar, mismo acabado — aprobado 2026-10-08
]);
function parEspesor(a, b) { return [Number(a), Number(b)].sort((x, y) => x - y).join('|'); }
// ¿TODO par de espesores en conflicto está aprobado como compatible? Conservador: si ALGÚN
// par no está aprobado, NO es compatible (→ crítico).
function espesorPanelCompatible(solicitado, insumoNombre) {
  const A = espesoresMM(solicitado), B = espesoresMM(insumoNombre);
  if (!A.length || !B.length) return false;
  return A.every((a) => B.every((b) => a === b || PARES_ESPESOR_PANEL_COMPATIBLE.has(parEspesor(a, b))));
}

// ¿El conflicto de atributo entre lo pedido y el candidato es CRÍTICO (ingeniería) o
// COMPATIBLE (inocuo para estimar)? Determinista, por familia + REGLA EXPLÍCITA de espesor.
function severidadConflicto(fam, solicitado = '', insumoNombre = '') {
  const confEsp = conflictoEspesor(solicitado, insumoNombre);
  const confCal = conflictoCalibre(solicitado, insumoNombre);
  if (!confEsp && !confCal) return { conflicto: false, critico: false };
  // Calibre distinto, o familia estructural (acero/aluminio/vidrio) → SIEMPRE crítico.
  if (confCal || FAMILIAS_CRITICAS.has(fam)) return { conflicto: true, critico: true };
  // Tablero con espesor distinto: COMPATIBLE sólo si el par está en la lista APROBADA (18↔19).
  // Cualquier otro salto (28→19, 36→19, 16→19, 9→19) u otra familia con conflicto → CRÍTICO.
  if (FAMILIAS_PANEL.has(fam) && espesorPanelCompatible(solicitado, insumoNombre)) {
    return { conflicto: true, critico: false };
  }
  return { conflicto: true, critico: true };
}

// Texto legible de qué cambió, p.ej. "Solicitado 18 mm → candidato 19 mm" o
// "Solicitado cal.14 → candidato cal.18". '' si no hay un atributo contrastable.
function textoCambio(solicitado = '', insumoNombre = '') {
  const eA = espesoresMM(solicitado), eB = espesoresMM(insumoNombre);
  if (eA.length && eB.length && !eA.some((x) => eB.includes(x))) {
    return `Solicitado ${eA.join('/')} mm → candidato ${eB.join('/')} mm`;
  }
  const cA = calibresDe(solicitado), cB = calibresDe(insumoNombre);
  if (cA.length && cB.length && !cA.some((x) => cB.includes(x))) {
    return `Solicitado cal.${cA.join('/')} → candidato cal.${cB.join('/')}`;
  }
  return '';
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

  // Misma familia. Si no hay conflicto de atributo → EXACT. Si lo hay, la SEVERIDAD
  // decide: tableros con espesor distinto (18→19) = COMPATIBLE para estimar (autocostea,
  // "por confirmar"); calibre/perfil/grado o familia estructural = CRÍTICO (preselecciona
  // candidato pero NO autocostea ni es equivalencia aprobada).
  if (famTiene && famTiene === famPide) {
    const sev = severidadConflicto(famPide, solicitado, insumoNombre);
    if (!sev.conflicto) {
      return {
        clase: MATCH.EXACT,
        familiaSolicitada: famPide,
        familiaResuelta: famTiene,
        autocosteable: true,
        insumoIdEfectivo: insumoId,
        motivo: `Coincide la familia: ${famPide.replace(/_/g, ' ')}.`,
      };
    }
    const cambio = textoCambio(solicitado, insumoNombre);
    if (sev.critico) {
      return {
        clase: MATCH.SAME_FAMILY_CRITICAL_CONFLICT,
        familiaSolicitada: famPide,
        familiaResuelta: famTiene,
        autocosteable: false,
        insumoIdEfectivo: '',
        insumoIdCandidato: insumoId,
        cambio,
        motivo: `Misma familia pero cambia un atributo crítico (${cambio || 'calibre/perfil/grado'}). Requiere confirmación; no se trata como equivalencia segura.`,
      };
    }
    return {
      clase: MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED,
      familiaSolicitada: famPide,
      familiaResuelta: famTiene,
      autocosteable: true,
      insumoIdEfectivo: insumoId,
      insumoIdCandidato: insumoId,
      cambio,
      motivo: `Misma familia, variante compatible para estimar (${cambio || 'espesor equivalente'}). Entra como provisional; confirma espesor/acabado.`,
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
 * Candidatos de la MISMA familia, ordenados por score, para detectar AMBIGÜEDAD.
 * Si el mejor y el segundo empatan en score, no hay ganador determinista → no se
 * escoge a escondidas (se devuelve ambiguo:true con los empatados).
 * @returns {{ambiguo:boolean, mejor:(object|null), empatados:Array}}
 */
export function candidatosDeFamilia(texto, catalogo = []) {
  const fam = familiaDeMaterial(texto);
  if (!fam || !Array.isArray(catalogo)) return { ambiguo: false, mejor: null, empatados: [] };
  const t = String(texto).toLowerCase();
  const STOP = new Set(['melamina', 'laminado', 'madera', 'panel', 'costado', 'lateral', 'repisa', 'repisas', 'frente', 'frentes', 'cubierta', 'entrepano', 'puerta', 'para', 'con', 'del', 'los', 'las', 'mdf', 'acero', 'lamina']);
  const tokens = (t.match(/[a-záéíóúñ]{3,}/gi) || []).filter((w) => !STOP.has(w));
  const espesores = t.match(RE_ESPESOR) || [];
  const puntuados = [];
  for (const ins of catalogo) {
    if (!ins || !ins.id) continue;
    if (familiaDeMaterial(ins.nombre || ins.id) !== fam) continue;
    const n = `${ins.nombre || ''} ${ins.id}`.toLowerCase();
    let score = 1;
    for (const tok of tokens) if (n.includes(tok)) score += 2;
    for (const e of espesores) if (new RegExp(`\\b${e}\\b`).test(n)) score += 3;
    puntuados.push({ id: ins.id, nombre: ins.nombre || ins.id, score });
  }
  if (puntuados.length === 0) return { ambiguo: false, mejor: null, empatados: [] };
  puntuados.sort((a, b) => b.score - a.score);
  const top = puntuados[0];
  const empatados = puntuados.filter((p) => p.score === top.score);
  // Ambiguo si hay ≥2 en la cima y (a) nada los desempató (score 1 = sólo familia), o
  // (b) difieren en un atributo que CAMBIA el costo/ingeniería (espesor/calibre): elegir
  // uno a escondidas sería inventar. Si empatan pero son intercambiables, se toma el 1º.
  const attrs = new Set(empatados.map((e) => [...espesoresMM(e.nombre), ...calibresDe(e.nombre)].sort().join('|')));
  const ambiguo = empatados.length >= 2 && (top.score <= 1 || attrs.size > 1);
  return { ambiguo, mejor: ambiguo ? null : top, empatados };
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

  const clasif = clasificarMaterial({ solicitado, insumoId: existe ? id : '', insumoNombre });

  let insumoIdFinal = clasif.insumoIdEfectivo;
  let candidatoId = clasif.insumoIdCandidato || null;
  let clase = clasif.clase;
  let motivo = clasif.motivo;
  let cambio = clasif.cambio || '';
  let resuelto = insumoNombre || '';
  let autollenado = false;

  // Confirmación humana explícita: sólo entonces un candidato conocido puede
  // entrar al BOM económico (se promueve a USER_CONFIRMED).
  if (pieza?.material_confirmado === true && existe) {
    insumoIdFinal = id;
    candidatoId = id;
    clase = MATCH.USER_CONFIRMED;
    cambio = '';
    motivo = `Material confirmado por usuario: ${existe.nombre || id}.`;
  }

  // RED DE SEGURIDAD: material NOMBRADO sin id del LLM → busca en la MISMA familia.
  //  · Varios candidatos igualmente plausibles → AMBIGUOUS (no se escoge a escondidas).
  //  · Candidato único compatible (p.ej. melamina color) → autocostea PROVISIONAL.
  //  · Candidato único con atributo crítico (calibre/perfil) → preselecciona, NO autocostea.
  //  · Sin candidato de familia → queda como clasif (NOT_AVAILABLE / pendiente de precio).
  if (!insumoIdFinal && !candidatoId && Array.isArray(catalogo)) {
    const { ambiguo, mejor } = candidatosDeFamilia(solicitado, catalogo);
    if (ambiguo) {
      clase = MATCH.AMBIGUOUS;
      motivo = `Varios candidatos de la misma familia igualmente plausibles para "${solicitado}". Elige cuál aplica.`;
    } else if (mejor) {
      const sev = severidadConflicto(familiaDeMaterial(solicitado), solicitado, mejor.nombre);
      candidatoId = mejor.id;
      resuelto = mejor.nombre;
      cambio = textoCambio(solicitado, mejor.nombre);
      autollenado = true;
      if (sev.critico) {
        clase = MATCH.SAME_FAMILY_CRITICAL_CONFLICT;
        motivo = `Candidato de la misma familia con atributo crítico distinto (${cambio || 'calibre/perfil'}): ${mejor.nombre}. Confirma antes de costear.`;
      } else {
        insumoIdFinal = mejor.id;
        clase = MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED;
        motivo = `Auto-asignado por familia (provisional): ${mejor.nombre}.${cambio ? ' ' + cambio + '.' : ''} Confirma acabado/espesor.`;
      }
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
    // CONTRATO EXPLÍCITO del estado de material (lo recibe el servidor por el DTO; no se
    // depende de `_match` para seguridad server-side). Se mantiene sincronizado con _match.clase.
    material_match: clase,
    // Lo PEDIDO viaja top-level: lo usan el DTO, la firma del BOM (P0.7) y la RECONCILIACIÓN
    // server-side (P0.5) para recalcular la clase; sin esto el servidor no tendría qué reclasificar.
    material_solicitado: solicitado,
    candidate_insumo_id: candidatoId,
    _match: {
      clase, motivo, solicitado, resuelto, cambio, autollenado,
      candidate_insumo_id: candidatoId,
      // ¿entra al cálculo provisional? (true para COMPATIBLE/EXACT/USER_CONFIRMED)
      autocosteable: MATCH_AUTOCOSTEABLE.has(clase) && !!insumoIdFinal,
      confirmado_por_usuario: pieza?.material_confirmado === true,
      familiaSolicitada: clasif.familiaSolicitada,
      familiaResuelta: clasif.familiaResuelta,
    },
  };
}

/**
 * ESTADO DE MATERIAL PARA LA UI (fuente ÚNICA, para que Costeador y AsistenteEspecial
 * se comporten IDÉNTICO). Puro: decide qué muestra el selector y el aviso de cada pieza.
 *
 * Reglas:
 *  · costeable = hay insumoId resuelto en el catálogo → el motor lo cuesta (EXACT o
 *    COMPATIBLE provisional). COMPATIBLE autollenado y no confirmado ⇒ badge "POR CONFIRMAR".
 *  · no costeable + candidato crítico ⇒ se PRESELECCIONA el candidato en el selector
 *    (selVal), "Costo pendiente" + botón Confirmar; nunca se autocostea.
 *  · ambiguo ⇒ "elige de cuál es"; no se escoge solo.
 *  · nada costeable ni candidato ⇒ "Costo pendiente — falta confirmar material" (NUNCA $0).
 *
 * @returns {{selVal:string, costeable:boolean, candId:string, clase:string, cambio:string,
 *            badge:string, badgeTipo:('confirmar'|''), pendiente:boolean, pendienteMsg:string,
 *            mostrarConfirmar:boolean}}
 */
export function estadoMaterialUI(c = {}, insumos = {}) {
  const mt = c._match || {};
  const cand = mt.candidate_insumo_id || '';
  const insActual = c.insumoId ? insumos[c.insumoId] : null;
  const costeable = !!insActual;
  const selVal = c.insumoId || cand || '';
  const clase = mt.clase || '';
  const cambio = mt.cambio || '';
  const propuesto = !mt.confirmado_por_usuario && (mt.autollenado || clase === MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);

  let badge = '', badgeTipo = '', pendienteMsg = '', mostrarConfirmar = false;
  if (costeable && propuesto) {
    badge = `IA · POR CONFIRMAR${cambio ? ': ' + cambio : ''}`;
    badgeTipo = 'confirmar';
  } else if (!costeable) {
    if (clase === MATCH.SAME_FAMILY_CRITICAL_CONFLICT && cand) {
      pendienteMsg = `Costo pendiente — confirma material (crítico${cambio ? ': ' + cambio : ''}).`;
      mostrarConfirmar = true;
    } else if (clase === MATCH.AMBIGUOUS) {
      pendienteMsg = 'Varios materiales posibles — elige de cuál es.';
    } else {
      pendienteMsg = 'Costo pendiente — falta confirmar material.';
    }
  }
  return { selVal, costeable, candId: cand, clase, cambio, badge, badgeTipo, pendiente: !costeable, pendienteMsg, mostrarConfirmar };
}

// PARCHE DE CONFIRMACIÓN HUMANA PARA LA UI (P0.8): fuente ÚNICA para que Costeador y
// AsistenteEspecial persistan EXACTAMENTE la misma intención al elegir/confirmar un material.
// Lleva el campo de INTENCIÓN dedicado `material_confirmado` (lo que el servidor verifica y
// convierte a estado efectivo), además de material_match=USER_CONFIRMED para la UI/hash.
// No se acepta que una UI mande USER_CONFIRMED y la otra conserve COMPATIBLE.
export function patchConfirmacionUI(insumoId) {
  return {
    material_match: MATCH.USER_CONFIRMED,
    material_confirmado: true,
    candidate_insumo_id: insumoId,
    _match: { clase: MATCH.USER_CONFIRMED, confirmado_por_usuario: true, autollenado: false, autocosteable: true, candidate_insumo_id: insumoId },
  };
}
