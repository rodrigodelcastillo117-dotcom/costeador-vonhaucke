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
//  · P0.12: `material_solicitado` TAMBIÉN es client-controlled. El servidor NO declara EXACT
//    (emitible sin confirmar) sólo porque el browser mande un solicitado coherente con el
//    insumoId. EXACT requiere PROVENANCE server-side de la especificación (`origenSpecConfiable`);
//    sin ella, una coincidencia exacta se degrada a provisional (SAME_FAMILY_COMPATIBLE_PROPOSED,
//    por confirmar). Con confirmación válida o provenance, sí EXACT/USER_CONFIRMED.
//  · Cross-family: la confirmación estándar NO promueve una sustitución de otra familia; eso
//    exige `engineering_override` (+ capability). El servidor sólo lo honra con capability.
// `opts.{puedeConfirmar,origenLegacyConfiable,origenSpecConfiable}` los decide el servidor; default FALSE.
export function reconciliarMaterialServidor(comp = {}, resolver, catalogo = null, { puedeConfirmar = false, origenLegacyConfiable = false, origenSpecConfiable = false } = {}) {
  const solicitado = String(comp.material_solicitado || '').trim();
  const idTxt = String(comp.insumoId || '').trim();
  const existe = idTxt ? (resolver ? resolver(idTxt) : null) : null;
  const confirmar = comp.material_confirmado === true && puedeConfirmar === true; // capability real
  const overrideOK = comp.engineering_override === true && puedeConfirmar === true; // cross-family sólo con capability

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
    material_confirmado: confirmar,                 // sólo si hay capability (P0.9)
    engineering_override: overrideOK,               // cross-family sólo con capability
    override_motivo: comp.override_motivo,
    cantidad: comp.cantidad,
  }, resolver, catalogo);

  let claseEf = pol.material_match;
  let idEf = pol.insumoId;
  let matchEf = pol._match;
  // Auditoría 14-oct (paridad, lab ATCUBS45ABS): si el navegador mandó la pieza SIN material (pendiente), el servidor no
  // le elige uno por su cuenta (p. ej. el genérico "Tapacanto PVC") y lo cobra: el costo del servidor dejaba de cuadrar
  // con el de la pantalla. Se queda pendiente —con el candidato a la vista— y el costo queda incompleto en los dos lados.
  if (!idTxt && idEf && !confirmar) {
    return { ...comp, insumoId: '', material_match: MATCH.CANDIDATE_REQUIRES_CONFIRMATION,
      _match: { ...(matchEf || {}), clase: MATCH.CANDIDATE_REQUIRES_CONFIRMATION, autocosteable: false, candidate_insumo_id: idEf,
        motivo: 'La pieza llegó sin material elegido: el servidor no asigna uno por su cuenta. Elige o confirma el material.' } };
  }
  // P0.12: EXACT desde una spec SIN provenance server-side (y sin confirmación) NO es autoridad
  // de emisión. Se degrada a provisional "por confirmar" (sigue costeando, pero no emite).
  if (claseEf === MATCH.EXACT && !origenSpecConfiable && !confirmar) {
    claseEf = MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED;
    matchEf = { ...matchEf, clase: claseEf, autollenado: true,
      motivo: 'Coincidencia exacta PROPUESTA: la especificación la envió el cliente (sin provenance server-side). Requiere confirmación antes de emitir.' };
  }
  return {
    ...comp,
    insumoId: idEf,                       // efectivo (vacío si no autocosteable)
    material_match: claseEf,              // EFECTIVO: autoridad del servidor, no del browser
    _match: matchEf,
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
  // Equipo que suministra el cliente o se compra aparte (refrigerador, pantalla…): nunca es
  // "cristal" por decir "de vidrio". Sin candidatos en catálogo → queda pendiente con su motivo.
  ['equipo_externo',    /refrigera|enfriador|congelador|vitrina refrigerada|televis|electrodom[eé]stico|computadora|cafetera|microondas/i],
  ['superficie_solida', /solid\s*surface|superficie\s+s[oó]lida|corian|krion|staron|hi-?macs|avonite|montelli/i],
  ['pet_acustico',      /\bpet\b|ac[uú]stic|sonara|poli[eé]ster ac/i],
  ['termoformado',      /termoform|membrana\s*pvc|vacuum\s*form/i],
  ['acrilico',          /acr[ií]lic|plexi|pmma/i],
  ['policarbonato',     /policarbonat|polycarbon|lexan/i],
  // REGLAS DE CASA (2026-10-12): herrajes y consumibles tienen familia propia para que la IA
  // los AMARRE al catálogo (autorizado por Dirección) en vez de dejarlos "costo pendiente".
  // Van ANTES que cristal/metal para que "jaladera de acero" sea herraje, no lámina.
  // VH-180 (lab credenza 2026-10-13): la IA nombra el renglón "Canto nogal" / "Canto visible"; sin familia, la regla de
  // casa no lo veía y agregaba OTRO tapacanto (12 m + 32.64 m, y el de la IA sin material dejaba el costo incompleto).
  // Un texto que EMPIEZA por "canto(s)" es la cinta de canto; "chapa de canto"/"MDF con canto" no empiezan así.
  ['tapacanto',         /tapa\s*canto|cubre\s*canto|chapacinta|canto\s*(?:pvc|abs)|cubrecanto|^\s*cantos?\b|perfil\s+de\s+canto/i],
  ['herraje_bisagra',   /bisagra|\bhinge/i],
  ['herraje_corredera', /corredera|\bslide|\briel\b/i],
  ['herraje_jaladera',  /jaladera|tirador|\bhandle|manija/i],
  ['herraje_nivelador', /nivelador|regat[oó]n|leveler|leveller/i],
  ['herraje_cerradura', /cerradura|\block\b/i],
  // VH-181 (prueba ciega ERP 2026-10-13, biombo ATBIOCRT5): "Soporte tipo clamp/escuadra metálica…, acabado pintura en
  // polvo" se amarraba a PINTURA y cobraba 2 kg ($337.12) en vez de 2 soportes. El objeto manda sobre su acabado.
  ['herraje_soporte',   /\bsoporte|escuadra|\bclamp\b|m[eé]nsula|bracket/i],
  ['pintura_polvo',     /\bpintura\b|electrost[aá]tic|\bpowder\b/i],
  // P1-MAT-02 (cierre ChatGPT v3, 2026-10-20): UNA taxonomía de acabados para motor y validador estructural. Los acabados
  // líquidos (barniz, sellador, laca, esmalte, tinte, poliuretano de acabado) son familia propia: "Barniz de acabado sobre
  // chapa" es BARNIZ, no chapa. Igual que los herrajes, si el texto nombra PRIMERO el material base y el acabado es un
  // atributo ("Chapa de nogal barnizada", "MDF lacado"), manda el material base (ver familiaDeMaterial).
  ['acabado_liquido',   /\bbarniz|barnizad|\bsellador|\blaca\b|\blacad[oa]s?\b|\besmalt|\btint[ae]s?\b|\btintad[oa]|(?<!espuma\s+de\s+)(?<!hule\s+)\bpoliuretano\b(?![^,;()]*(?:espuma|flexible|expandid|inyectad|foam|r[ií]gido))/i],
  // VH-164 (2026-10-13): el ACABADO metálico (EcoCrom/cromado/niquelado) es un renglón propio, no
  // acero. Sólo cuando el texto EMPIEZA por el acabado ("cromado (EcoCrom) en base tubular",
  // "Acabado cromado de la base", "EcoCrom"); "tubular 3/4 cromado" sigue siendo el tubo.
  ['acabado_metal',     /^\s*(?:acabado\s+)?(?:cromad[oa]|eco\s*crom[e]?|niquelad[oa]|cromo)\b|^\s*eco\s*crom/i],
  ['iluminacion',       /\bled\b|luminaria|iluminaci[oó]n|tira\s*led/i],
  ['electrico',         /contacto|multicontacto|caja\s+el[eé]ctrica|\busb\b|byrne/i],
  ['adhesivo',          /adhesivo|pegamento|resistol|silic[oó]n/i],
  // VH-176: «atornillada/atornillado» describe cómo se fija una pieza, no es tornillería (\b antes de tornill).
  ['tornilleria',       /\btornill|\bpija|taquete|rondana|tuerca/i],
  // VH-165 (2026-10-13, mesa de centro V4): "soldadura para tubo" caía en metal_lamina por "tubo" y se
  // auto-asignaba al PTR cal. 14 ($270.78 como si fuera 1 m de tubo, y sumaba área al cromado). La
  // soldadura es un consumible: sin insumo propio queda pendiente, nunca se costea como perfil.
  ['soldadura',         /soldadura|soldar|electrodo|micro\s*alambre|\bmig\b|\btig\b/i],
  ['cristal',           /cristal|vidrio|templado|glass/i],
  // Cierre ChatGPT v3 (datos reales): el cuarzo del ERP se llama por marca ("HOJA ECOMARMOL SILESTONE…", "DEKTON…").
  ['marmol_piedra',     /m[aá]rmol|marble|granito|cuarzo|quartz|silestone|caesarstone|dekton|neolith|sinterizad|piedra|onix|[oó]nix/i],
  ['acero_inoxidable',  /inoxidable|inox\b|stainless|304|316/i],
  ['aluminio',          /aluminio|aluminum|anodiz/i],
  // VH-086 (2026-10-12): melamina ANTES que laminado/HPL. "Melamina / EcoLegno 19 mm" (nombre real en la
  // config de producción y en la semilla) caía en laminado_hpl por la palabra EcoLegno y el servidor
  // trataba melamina-19 como sustitución de otra familia: no se costeaba ni confirmada por Dirección.
  ['melamina',          /melamina|melamine|aglomerad/i],
  ['laminado_hpl',      /laminado|hpl|ecolegno|formica|high\s*pressure/i],
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
  // Cierre ChatGPT v3 (cocrear-7): el catálogo del servidor arma el nombre ERP como "<artículo> · <nota/clasificación>"
  // ("HOJA DE ECOMARMOL SILESTONE … · ACRILICO, ECOMARMOL MARQUINA"). La familia es la del ARTÍCULO (antes del " · ");
  // la nota sólo cuenta si el artículo solo no dice nada. Antes salía 'acrilico' y la confirmación de Diseño se rechazaba.
  const corte = t.indexOf(' · ');
  if (corte > 0) { const cabeza = familiaDeMaterial(t.slice(0, corte)); if (cabeza) return cabeza; }
  // Cierre v3 (cocrear-7): "MDF 19 mm (sustrato de refuerzo BAJO piedra)" es MDF; lo que va después de bajo/debajo de/
  // sobre/encima de es CONTEXTO (dónde va), no el material. Antes la tabla ponía piedra antes que MDF y la confirmación de
  // Diseño se rechazaba como cruce de familia. Si el texto sin contexto no dice nada, se usa el texto completo.
  // Cierre v3 (cocrear-4/6): también "para <uso>" ("tablero base PARA asiento tapizado" no es tapicería) y "sin <x>"
  // ("ARCHIVERO MÓVIL … SIN TORNILLOS" no es tornillería: se costeó un archivero de $793,379 como tornillos). Sólo se
  // quita la cláusula si NO es el inicio del texto ("Sobre de cristal" sigue siendo cristal). El texto sin contexto MANDA,
  // aunque no diga familia ('' = no se sabe; mejor que adivinar por una palabra del contexto).
  const sinContexto = t.replace(/(\S)\s+(?:bajo|debajo\s+de|sobre|encima\s+de|para|sin)\b[^,;()]*/gi, '$1 ').replace(/\(\s*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (sinContexto && sinContexto !== t) return familiaDeMaterial(sinContexto);
  let primera = '';
  for (const [fam, re] of FAMILIAS) {
    if (re.test(t)) { primera = fam; break; }
  }
  // Cierre v3: entre accesorios/consumibles manda el que se NOMBRA PRIMERO ("Tornillería y silicón estructural" es
  // tornillería, no adhesivo). Antes ganaba el orden de la tabla.
  if (primera && FAMILIAS_HERRAJE.has(primera)) {
    let mejor = { fam: primera, pos: posicionFamilia(t, primera) };
    for (const [fam, re] of FAMILIAS) {
      if (!FAMILIAS_HERRAJE.has(fam)) continue;
      const m = re.exec(t);
      if (m && m.index < mejor.pos) mejor = { fam, pos: m.index };
    }
    primera = mejor.fam;
  }
  // VH-176 (librero 5×8, Operación 10/10): "Melamina 16 mm Walnut, una pieza atornillada" se auto-asignaba a
  // TORNILLERÍA porque los herrajes/consumibles van antes en la tabla (para que "jaladera de acero" sea
  // herraje). Lo mismo con "MDF lacado" (→ pintura), "Melamina con jaladera" (→ jaladera) o "cristal con
  // bisagra". Regla: si el texto NOMBRA PRIMERO un material base (tablero, metal, cristal, piedra…) y el
  // accesorio aparece después como complemento, manda el material base. Si el texto empieza por el
  // accesorio ("Jaladera de acero", "Pintura electrostática para acero", "Tapacanto PVC") no cambia nada.
  if (primera && FAMILIAS_HERRAJE.has(primera)) {
    const posAcc = posicionFamilia(t, primera);
    let mejor = null;
    for (const [fam, re] of FAMILIAS) {
      if (FAMILIAS_HERRAJE.has(fam) || fam === 'equipo_externo' || FAMILIAS_ACABADO.has(fam) || fam === 'soldadura') continue;
      const m = re.exec(t);
      if (m && m.index < posAcc && (!mejor || m.index < mejor.pos)) mejor = { fam, pos: m.index };
    }
    if (mejor) return mejor.fam;
  }
  // VH-181: la pintura es material sólo cuando el texto EMPIEZA por ella ("Pintura electrostática negra"). Mencionada
  // como acabado de otra cosa sin material base reconocible ("Base metálica pintura electrostática") no se adivina:
  // sin familia, la pieza queda pendiente para que la persona diga de qué es.
  // P1-MAT-02: lo mismo para los acabados líquidos ("Mesa con barniz" no es barniz; "Barniz sobre chapa" sí).
  if ((primera === 'pintura_polvo' || primera === 'acabado_liquido') && !RE_INICIO_ACABADO.test(t)) return '';
  return primera;
}

function posicionFamilia(t, fam) {
  const par = FAMILIAS.find(([f]) => f === fam);
  const m = par ? par[1].exec(t) : null;
  return m ? m.index : Infinity;
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

// Familias de HERRAJE / CONSUMIBLE (reglas de casa 2026-10-12): ante varios candidatos sin
// variante pedida, el GENÉRICO (nombre más corto) es el estándar de casa, marcado por confirmar.
// P1-MAT-02: un texto EMPIEZA por un acabado (es el renglón del acabado, no de la pieza).
export const RE_INICIO_ACABADO = /^\s*(?:(?:la|el)\s+)?(?:acabado\s+(?:de\s+|en\s+)?)?(?:pintura|esmalt|laca|lacad|electrost|powder|recubrimiento|barniz|sellador|tint[ae]|tintad|poliuretano|cromad|eco\s*crom|niquelad|cromo)/i;
// Familias que son ACABADO (se aplican sobre una pieza; nunca son la pieza). La usan motor y validador estructural.
export const FAMILIAS_ACABADO = new Set(['pintura_polvo', 'acabado_liquido', 'acabado_metal']);
export const FAMILIAS_HERRAJE = new Set(['acabado_liquido', 'tapacanto', 'herraje_soporte', 'herraje_bisagra', 'herraje_corredera', 'herraje_jaladera', 'herraje_nivelador', 'herraje_cerradura', 'pintura_polvo', 'iluminacion', 'electrico', 'adhesivo', 'tornilleria']);
/** Espesores en mm que nombra un texto (exportado para las reglas de casa). */
export function espesoresDe(texto = '') { return espesoresMM(texto); }
// ¿Lo pedido nombra una VARIANTE de herraje que el candidato no tiene? ("bisagra cierre suave"
// vs "Bisagra"): se compara por raíces de palabra; si falta alguna → variante por confirmar.
const STOP_HERRAJE = new Set(['para', 'con', 'del', 'los', 'las', 'una', 'uno', 'por', 'sin', 'puerta', 'puertas', 'cajon', 'cajones', 'gaveta', 'gavetas', 'mueble', 'kit', 'juego', 'pza', 'pieza', 'piezas']);
const raiz = (w) => String(w).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/(es|s)$/, '');
function varianteHerrajeNoCubierta(solicitado = '', insumoNombre = '') {
  const pide = [...new Set((String(solicitado).match(/[a-záéíóúñ0-9]{3,}/gi) || []).map(raiz).filter((w) => !STOP_HERRAJE.has(w)))];
  const tiene = new Set((String(insumoNombre).match(/[a-záéíóúñ0-9]{3,}/gi) || []).map(raiz));
  return pide.filter((w) => !tiene.has(w));
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
const PANELES_FORMATO = new Set(['melamina', 'mdf', 'laminado_hpl', 'chapa_madera', 'madera_solida', 'metal_lamina', 'acrilico', 'policarbonato', 'pet_acustico']);
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

// P0.13 — IDENTIDAD DE PERFIL/METAL. redondo ≠ cuadrado ≠ rectangular ≠ lámina, y dimensiones
// de perfil distintas (1"x2" vs 3"x1½") NO son el mismo artículo aunque coincida familia/calibre.
function formaMetal(texto = '') {
  const t = String(texto).toLowerCase();
  if (/l[aá]mina|lamina|placa|plate|sheet/.test(t)) return 'lamina';
  if (/redond|circular|\bround\b/.test(t)) return 'redondo';
  if (/cuadrad|\bsquare\b/.test(t)) return 'cuadrado';
  if (/rectangul/.test(t)) return 'rectangular';
  if (/\bptr\b|tubular|\btubo\b|perfil/.test(t)) return 'tubo';
  return '';
}
function dimsPerfil(texto = '') {
  const t = String(texto).toLowerCase();
  return (t.match(/\d+(?:\s*\/\s*\d+)?\s*["']?\s*x\s*\d+(?:\s*\/\s*\d+)?/g) || []).map((s) => s.replace(/[\s"']/g, ''));
}
function conflictoPerfilMetal(a = '', b = '') {
  const fa = formaMetal(a), fb = formaMetal(b);
  // "PTR"/"tubo" genérico es compatible con cuadrado o rectangular (un PTR ES un tubo cuadrado o
  // rectangular); sólo lámina y redondo son otra cosa.
  const esTuboCompatible = (x, y) => x === 'tubo' && (y === 'cuadrado' || y === 'rectangular');
  if (fa && fb && fa !== fb && !esTuboCompatible(fa, fb) && !esTuboCompatible(fb, fa)) return true;   // lámina vs tubo, redondo vs cuadrado, etc.
  const da = dimsPerfil(a), db = dimsPerfil(b);
  if (da.length && db.length && !da.some((x) => db.includes(x))) return true; // 1x2 vs 3x1½
  return false;
}

// P0.14 — VARIANTE/ACABADO/COLOR. Misma familia + mismo espesor NO basta: melamina blanca 19 ≠
// melamina color/madera 19. Si lo pedido nombra un color/acabado concreto que el insumo NO tiene,
// es una variante distinta (por confirmar), no EXACT.
const COLORES = [
  ['blanco', /\bblanc[oa]s?\b|white/], ['negro', /\bnegr[oa]s?\b|black/], ['nogal', /nogal|walnut/],
  ['roble', /roble|\boak\b/], ['gris', /\bgris\b|gray|grey/], ['antracite', /antracit[ea]/],
  ['maple', /maple|\barce\b/], ['cedro', /cedro/], ['wengue', /wengu[eé]/], ['haya', /\bhaya\b|beech/],
  ['encino', /encino/], ['fresno', /fresno|\bash\b/], ['caoba', /caoba|mahogany/], ['pino', /\bpino\b|\bpine\b/],
];
function coloresDe(texto = '') {
  const t = String(texto).toLowerCase();
  const out = new Set();
  for (const [k, re] of COLORES) if (re.test(t)) out.add(k);
  if (/\bcolor\b|madera|wood/.test(t)) out.add('_madera_generico');  // "color/madera" = cualquier madera
  return out;
}
function conflictoAcabadoColor(solicitado = '', insumoNombre = '') {
  const A = coloresDe(solicitado), B = coloresDe(insumoNombre);
  const MADERAS = new Set(['nogal', 'roble', 'maple', 'cedro', 'wengue', 'haya', 'antracite', 'encino', 'fresno', 'caoba', 'pino']);
  // Especies CONCRETAS que nombra el insumo (VH-152b): "CHAPA DE MADERA ENCINO ROJO" no es "color madera"
  // genérico; si la persona pidió nogal, es otra especie → conflicto.
  const especiesB = [...B].filter((x) => MADERAS.has(x));
  for (const c of A) {
    if (c === '_madera_generico') continue;               // lo pedido genérico no exige color exacto
    if (B.has(c)) continue;                                // el color pedido está en el insumo
    if (B.has('_madera_generico') && MADERAS.has(c) && especiesB.length === 0) continue; // pidió madera concreta, insumo es "color/madera" genérico
    return true;                                           // p.ej. pidió BLANCO y el insumo es color/madera, o pidió NOGAL y el insumo es ENCINO
  }
  return false;
}

// ¿El conflicto de atributo entre lo pedido y el candidato es CRÍTICO (ingeniería), COMPATIBLE
// (inocuo para estimar) o sólo VARIANTE (acabado/color, por confirmar)? Determinista.
// VH-168 (2026-10-13, librero 5×8): el FORMATO de hoja es identidad del tablero. "Melamina 28 mm Walnut, hoja
// 5×8" contra el curado 4×8 salía EXACT (mismo espesor, familia y acabado) y el confirmado masivo lo aceptaba.
// Se lee el formato de lo pedido y del insumo (nombre o `formato` declarado). Sólo cuenta si AMBOS lo dicen
// (la ausencia no es igualdad ni diferencia). Pies comerciales 3–5 × 8–10, o medidas en mm/m de hoja.
const FORMATOS_PIES = { '4x8': [1220, 2440], '5x8': [1525, 2440], '4x10': [1220, 3050], '3x10': [914, 3048], '5x10': [1525, 3050], '4x9': [1220, 2745] };
export function formatoHojaDe(texto = '', formato = null) {
  if (formato && Number(formato.largoMM) > 0 && Number(formato.anchoMM) > 0) {
    const a = Math.min(Number(formato.largoMM), Number(formato.anchoMM)), b = Math.max(Number(formato.largoMM), Number(formato.anchoMM));
    return [a, b];
  }
  const t = String(texto || '').toLowerCase();
  const p = t.match(/(?:^|[^\d.,])([345])\s*['’]?\s*(?:x|×)\s*(8|9|10)\s*['’]?(?![\d.,]*\s*(?:mm|cm|"|”))/);
  if (p && FORMATOS_PIES[`${p[1]}x${p[2]}`]) return FORMATOS_PIES[`${p[1]}x${p[2]}`];
  const mm = t.match(/\b(9\d\d|1[0-6]\d\d)\s*(?:x|×)\s*(2[4-9]\d\d|3[0-1]\d\d)\b/) || t.match(/\b(2[4-9]\d\d|3[0-1]\d\d)\s*(?:x|×)\s*(9\d\d|1[0-6]\d\d)\b/);
  if (mm) { const a = Number(mm[1]), b = Number(mm[2]); return [Math.min(a, b), Math.max(a, b)]; }
  const m = t.match(/\b([01][.,]\d{2,3})\s*(?:x|×)\s*([23][.,]\d{2,3})\s*m?\b/);
  if (m) { const a = Math.round(Number(m[1].replace(',', '.')) * 1000), b = Math.round(Number(m[2].replace(',', '.')) * 1000); return [a, b]; }
  return null;
}
const nombreFormato = (f) => { const e = Object.entries(FORMATOS_PIES).find(([, v]) => Math.abs(v[0] - f[0]) <= 25 && Math.abs(v[1] - f[1]) <= 25); return e ? e[0].replace('x', '×') : `${f[0]}×${f[1]} mm`; };
function conflictoFormato(solicitado = '', insumoNombre = '', insumoFormato = null) {
  const a = formatoHojaDe(solicitado), b = formatoHojaDe(insumoNombre, insumoFormato);
  if (!a || !b) return null;
  return Math.abs(a[0] - b[0]) > 25 || Math.abs(a[1] - b[1]) > 25 ? `Solicitado hoja ${nombreFormato(a)} → candidato hoja ${nombreFormato(b)}` : null;
}

// VH-182 (prueba ciega ERP 2026-10-13): "Canto ABS para cubierta 28 mm" contra "Perfil de canto ABS 32 mm" salía como
// conflicto CRÍTICO de espesor y dejaba la cubierta sin canto. Los 28 mm son del TABLERO; el canto es más ancho para
// rebajarse al ras. Regla técnica con evidencia (REPORTE DEL COTIZADOR Intelisis 12/08/2026, lab/applt/componentes):
// las 6 cubiertas de 28 mm llevan PEABS32 y los faldones de 16 mm, PEABS22. Sólo esos pares; lo demás sigue igual.
const CANTO_POR_TABLERO_MM = Object.freeze({ 28: [32], 16: [22] });
// Auditoría 14-oct (lab ATCUBS45ABS en el link de prueba): "Cubre canto blanco 32 x 2 mm" sólo daba [2] mm (el grosor), no
// el ANCHO 32 que es el que cubre el tablero. Para el canto se toman también las medidas "A x B mm" del nombre.
const anchosCantoMM = (t = '') => [...String(t).toLowerCase().matchAll(/\b(\d+(?:[.,]\d+)?)\s*(?:mm\s*)?[x×]\s*(\d+(?:[.,]\d+)?)\s*mm\b/g)]
  .flatMap((m) => [m[1], m[2]].map((v) => Number(String(v).replace(',', '.')))).filter((n) => Number.isFinite(n) && n > 0);
function cantoCubreTablero(solicitado = '', insumoNombre = '') {
  const A = espesoresMM(solicitado), B = [...espesoresMM(insumoNombre), ...anchosCantoMM(insumoNombre)];
  return A.length > 0 && B.length > 0 && A.every((a) => (CANTO_POR_TABLERO_MM[a] || []).some((x) => B.includes(x)));
}

function severidadConflicto(fam, solicitado = '', insumoNombre = '') {
  const confEsp = fam === 'tapacanto' && cantoCubreTablero(solicitado, insumoNombre) ? false : conflictoEspesor(solicitado, insumoNombre);
  const confCal = conflictoCalibre(solicitado, insumoNombre);
  const confPerfil = FAMILIAS_CRITICAS.has(fam) && conflictoPerfilMetal(solicitado, insumoNombre); // P0.13
  const confColor = conflictoAcabadoColor(solicitado, insumoNombre);                                // P0.14
  if (!confEsp && !confCal && !confPerfil && !confColor) return { conflicto: false, critico: false };
  // REGLA DE CASA (2026-10-12): en acero/lámina/PTR el COLOR lo da la pintura electrostática
  // (línea aparte); el perfil va crudo. Sólo color distinto, mismo calibre/perfil → NO crítico.
  if (fam === 'metal_lamina' && !confEsp && !confCal && !confPerfil && confColor) return { conflicto: true, critico: false, pintura: true };
  // Calibre/perfil distinto, o familia estructural con cualquier conflicto → SIEMPRE crítico.
  if (confCal || confPerfil || FAMILIAS_CRITICAS.has(fam)) return { conflicto: true, critico: true };
  // Tablero con espesor distinto: COMPATIBLE sólo si el par está en la lista APROBADA (18↔19).
  if (confEsp) {
    if (FAMILIAS_PANEL.has(fam) && espesorPanelCompatible(solicitado, insumoNombre)) return { conflicto: true, critico: false };
    return { conflicto: true, critico: true };
  }
  // Sólo difiere acabado/color (sin espesor/calibre/perfil): VARIANTE por confirmar (no EXACT,
  // no crítica de ingeniería). Entra como provisional.
  return { conflicto: true, critico: false };
}

// Texto legible de qué cambió, p.ej. "Solicitado 18 mm → candidato 19 mm" o
// "Solicitado cal.14 → candidato cal.18". '' si no hay un atributo contrastable.
function textoCambio(solicitado = '', insumoNombre = '') {
  const eA = espesoresMM(solicitado), eB = espesoresMM(insumoNombre);
  if (eA.length && eB.length && !eA.some((x) => eB.includes(x)) && !(familiaDeMaterial(solicitado) === 'tapacanto' && cantoCubreTablero(solicitado, insumoNombre))) {
    return `Solicitado ${eA.join('/')} mm → candidato ${eB.join('/')} mm`;
  }
  const cA = calibresDe(solicitado), cB = calibresDe(insumoNombre);
  if (cA.length && cB.length && !cA.some((x) => cB.includes(x))) {
    return `Solicitado cal.${cA.join('/')} → candidato cal.${cB.join('/')}`;
  }
  const fa = formaMetal(solicitado), fb = formaMetal(insumoNombre);
  const tuboOk = (x, y) => x === 'tubo' && (y === 'cuadrado' || y === 'rectangular');
  if (fa && fb && fa !== fb && !tuboOk(fa, fb) && !tuboOk(fb, fa)) return `Solicitado perfil ${fa} → candidato ${fb}`;
  if (conflictoAcabadoColor(solicitado, insumoNombre)) {
    if (familiaDeMaterial(solicitado) === 'metal_lamina') return 'El color lo da la pintura electrostática (línea aparte); el acero va crudo';
    return 'Acabado/color distinto al solicitado';
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
export function clasificarMaterial({ solicitado = '', insumoId = '', insumoNombre = '', insumoFormato = null } = {}) {
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
      motivo: famPide === 'equipo_externo'
        ? 'Equipo externo (lo suministra el cliente o se compra aparte): no se costea como material; déjalo pendiente o captúralo como compra-venta.'
        : famPide
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
    // Herraje/consumible: "bisagra cierre suave" contra "Bisagra" NO es exacto: variante por confirmar.
    if (!sev.conflicto && FAMILIAS_HERRAJE.has(famPide)) {
      const faltan = varianteHerrajeNoCubierta(solicitado, insumoNombre);
      if (faltan.length) {
        return {
          clase: MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED, familiaSolicitada: famPide, familiaResuelta: famTiene,
          autocosteable: true, insumoIdEfectivo: insumoId, insumoIdCandidato: insumoId,
          cambio: `Variante pedida («${faltan.join(' ')}») no está en el nombre del catálogo`,
          motivo: `Herraje de la misma familia; la variante pedida («${faltan.join(' ')}») no consta en «${insumoNombre}». Entra provisional: confírmalo.`,
        };
      }
    }
    // VH-168: mismo material en otro FORMATO de hoja no es exacto: cambia el aprovechamiento y el precio.
    const cambioFmt = PANELES_FORMATO.has(famPide) ? conflictoFormato(solicitado, insumoNombre, insumoFormato) : null;
    if (!sev.conflicto && cambioFmt) {
      return {
        clase: MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED, familiaSolicitada: famPide, familiaResuelta: famTiene,
        autocosteable: true, insumoIdEfectivo: insumoId, insumoIdCandidato: insumoId, cambio: cambioFmt,
        motivo: `Mismo material, otro formato de hoja (${cambioFmt}). Entra provisional: confirma el formato.`,
      };
    }
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
// Puntuación de un insumo contra lo pedido (una sola función para mejorInsumoDeFamilia y
// candidatosDeFamilia). Normaliza acentos y plural/género ("electrostática" = "electrostatica",
// "negra" = "negro"), premia espesor (+3) y CALIBRE (+3: "cal.14" escoge el PTR cal. 14, no el 16)
// y, en pintura, el polvo por kg (+2) sobre la maquila, que es lo que Producción compra.
const STOP_SCORE = new Set(['melamina', 'laminado', 'madera', 'panel', 'costado', 'lateral', 'repisa', 'repisas', 'frente', 'frentes', 'cubierta', 'entrepano', 'puerta', 'para', 'con', 'del', 'los', 'las', 'mdf', 'acero', 'lamina', 'cal', 'calibre']);
const normTok = (w) => { let x = String(w).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); if (x.length > 4) x = x.replace(/(as|os|es)$/, '').replace(/[ao]$/, ''); else if (x.length > 3) x = x.replace(/s$/, ''); return x; };
function puntuarInsumo(texto, ins, fam) {
  const t = String(texto).toLowerCase();
  const tokens = (t.match(/[a-záéíóúñ]{3,}/gi) || []).filter((w) => !STOP_SCORE.has(w.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))).map(normTok);
  const espesores = t.match(RE_ESPESOR) || [];
  const calibres = calibresDe(t);
  const nRaw = `${ins.nombre || ''} ${ins.id}`.toLowerCase();
  const nTok = new Set((nRaw.match(/[a-záéíóúñ]{3,}/gi) || []).map(normTok));
  let score = 1; // misma familia ya vale
  for (const tok of tokens) if (nTok.has(tok) || nRaw.includes(tok)) score += 2;          // color/acabado/variante
  for (const e of espesores) if (new RegExp(`\\b${e}\\b`).test(nRaw)) score += 3;         // espesor
  const calIns = calibresDe(nRaw);
  for (const c of calibres) if (calIns.includes(c)) score += 3;                              // calibre
  if (fam === 'pintura_polvo' && ins.unidad === 'kg') score += 2;                            // polvo por kg (Producción)
  return score;
}
export function mejorInsumoDeFamilia(texto, catalogo = []) {
  const fam = familiaDeMaterial(texto);
  if (!fam || !Array.isArray(catalogo)) return null;
  let best = null, bestScore = -1;
  for (const ins of catalogo) {
    if (!ins || !ins.id) continue;
    if (familiaDeMaterial(ins.nombre || ins.id) !== fam) continue;
    const score = puntuarInsumo(texto, ins, fam);
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
  const puntuados = [];
  for (const ins of catalogo) {
    if (!ins || !ins.id) continue;
    if (familiaDeMaterial(ins.nombre || ins.id) !== fam) continue;
    puntuados.push({ id: ins.id, nombre: ins.nombre || ins.id, score: puntuarInsumo(texto, ins, fam),
      certificable: !!(ins.evidencia && ins.evidencia.certificable === true), actualizado: String(ins.actualizado || ''), ultimaCompra: fechaUltimaCompra(ins), precio: ins.precio == null ? null : Number(ins.precio) });
  }
  if (puntuados.length === 0) return { ambiguo: false, mejor: null, empatados: [] };
  puntuados.sort((a, b) => b.score - a.score);
  const top = puntuados[0];
  const empatados = puntuados.filter((p) => p.score === top.score);
  // Ambiguo si hay ≥2 en la cima y (a) nada los desempató (score 1 = sólo familia), o
  // (b) difieren en un atributo que CAMBIA el costo/ingeniería (espesor/calibre): elegir
  // uno a escondidas sería inventar. Si empatan pero son intercambiables, se toma el 1º.
  // Atributos que cambian costo/ingeniería: espesor (≤ 60 mm; "PIEZA DE 6000 mm" es largo, no espesor) y calibre.
  const attrs = new Set(empatados.map((e) => [...espesoresMM(e.nombre).filter((x) => x <= 60), ...calibresDe(e.nombre)].sort().join('|')));
  let ambiguo = empatados.length >= 2 && (top.score <= 1 || attrs.size > 1);
  // REGLAS DE CASA (2026-10-12): herraje/consumible. (a) tapacanto → el estándar de casa si está
  // entre los candidatos ("siempre es el mismo canto"); (b) empate sin variante pedida → el
  // GENÉRICO (nombre más corto) es el de casa. Sale marcado por confirmar, nunca escondido.
  if (FAMILIAS_HERRAJE.has(fam) && puntuados.length) {
    if (fam === 'tapacanto') { const std = puntuados.find((x) => x.id === 'tapacanto'); if (std) return { ambiguo: false, mejor: { ...std, generico: true }, empatados }; }
    // Empate sin variante pedida → "lo que el taller compra de verdad" (Dirección 12-oct: "los herrajes
    // vienen en la lista de compras, son los reales"): primero con precio certificado por Compras, luego
    // la compra más reciente, luego el nombre más corto (genérico). Determinista y marcado por confirmar.
    if (empatados.length >= 2) {
      const gen = [...empatados].sort((a, b) => (Number(b.certificable) - Number(a.certificable)) || (b.ultimaCompra > a.ultimaCompra ? 1 : b.ultimaCompra < a.ultimaCompra ? -1 : 0) || (a.nombre.length - b.nombre.length))[0];
      return { ambiguo: false, mejor: { ...gen, generico: true }, empatados };
    }
  }
  // REGLA DE CASA (acero, 12-oct): "PTR cal.14" SIN perfil contra varias variantes de perfil → el
  // perfil por defecto de casa (1"×1") si está entre los candidatos; si no, el genérico sin perfil
  // ("Tubo / PTR cal. 14"); si no hay ninguno, sigue ambiguo (elegir entre 3/4" y 4" sería inventar).
  if (fam === 'metal_lamina' && empatados.length >= 2 && !dimsPerfil(texto).length && !/\d\s*["”]/.test(texto)) {
    const esDefault = (n) => /\b1\s*["”]+\s*(?:x|×)\s*1\s*["”]+|cuadrad[oa]\s+(?:de\s+)?1\s*["”]+|\b1\s*["”]+\s*(?:cal|calibre)|\b25\s*x\s*25\b/i.test(n);
    const sinPerfil = (n) => !dimsPerfil(n).length && !/\d\s*["”]/.test(n) && !/redond|cuadrad|rectangul/i.test(n);
    const def = empatados.find((e) => esDefault(e.nombre)) || empatados.find((e) => sinPerfil(e.nombre));
    if (def) return { ambiguo: false, mejor: { ...def, generico: true, perfilSupuesto: true }, empatados };
  }
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
  // Cierre ChatGPT (cocrear-1 / P1-MAT-02, 2026-10-20): en un renglón que ES un acabado ("Pintura en polvo negro mate
  // (base)", "Barniz de acabado sobre chapa"), lo pedido describe el acabado y DÓNDE va ("acabado negro mate en metal",
  // "chapa nogal mate"): la familia es la del ACABADO, no la del material sobre el que va. Sin esto, la pintura confirmada
  // por Diseño se descartaba como "cruce de familia" y el servidor la cambiaba por "Frente de metal" (mampara por m²).
  const solicitadoRaw = pieza?.material_solicitado || '';
  const famSolRaw = familiaDeMaterial(solicitadoRaw);
  const famNombre = familiaDeMaterial(pieza?.nombre || '');
  const inicioAcabado = (String(pieza?.nombre || '').match(RE_INICIO_ACABADO) || [''])[0].trim();
  const solicitado = (FAMILIAS_ACABADO.has(famNombre) && famSolRaw && !FAMILIAS_ACABADO.has(famSolRaw) && inicioAcabado)
    ? `${inicioAcabado} ${solicitadoRaw}` : solicitadoRaw;
  // VH-053: la IA elige del catálogo del SERVIDOR (insumos_catalogo, 259 ids); el
  // navegador costea con el local (config, 92). Un id que la IA declara EXACT y aquí
  // no existe es un material REAL sin precio certificado por Compras: se dice tal
  // cual y NO se sustituye por un pariente local (sería una sustitución silenciosa).
  const matchIA = String(pieza?.material_match || '').trim().toUpperCase();
  const servidorId = id && !existe && matchIA === 'EXACT' ? id : '';

  const clasif = clasificarMaterial({ solicitado, insumoId: existe ? id : '', insumoNombre, insumoFormato: existe?.formato || null });

  let insumoIdFinal = clasif.insumoIdEfectivo;
  let candidatoId = clasif.insumoIdCandidato || null;
  let clase = clasif.clase;
  let motivo = clasif.motivo;
  let cambio = clasif.cambio || '';
  let resuelto = insumoNombre || '';
  let autollenado = false;

  // Confirmación humana explícita: promueve a USER_CONFIRMED. GUARD CROSS-FAMILY: una
  // confirmación ESTÁNDAR NO puede promover una sustitución de OTRA familia (solid surface →
  // MDF). Eso exige un ENGINEERING_OVERRIDE explícito (+ capability server-side + motivo
  // auditable). Sin override, la confirmación de un cruce de familia se IGNORA y queda como
  // sustitución bloqueada.
  if (pieza?.material_confirmado === true && existe) {
    const famPide = familiaDeMaterial(solicitado);
    const famTiene = familiaDeMaterial(insumoNombre || id);
    const cruzaFamilia = !!famPide && !!famTiene && famPide !== famTiene
      && !EQUIVALENCIAS_APROBADAS.has(`${famPide}>${famTiene}`);
    if (cruzaFamilia && pieza?.engineering_override !== true) {
      // NO se promueve: queda la clase de sustitución (no emitible). Se deja rastro.
      motivo = `Confirmación estándar NO promueve una sustitución de otra familia (${famPide.replace(/_/g, ' ')} → ${famTiene.replace(/_/g, ' ')}): requiere ENGINEERING_OVERRIDE de Diseño/Dirección con motivo.`;
    } else {
      insumoIdFinal = id;
      candidatoId = id;
      clase = MATCH.USER_CONFIRMED;
      cambio = '';
      motivo = cruzaFamilia
        ? `Sustitución entre familias CONFIRMADA por ingeniería (override): ${famPide.replace(/_/g, ' ')} → ${existe.nombre || id}. Motivo: ${String(pieza?.override_motivo || '').slice(0, 300) || '(sin motivo)'}.`
        : `Material confirmado por usuario: ${existe.nombre || id}.`;
    }
  }

  // VH-053: id EXACT de la IA que no existe localmente = material REAL del catálogo del
  // servidor sin precio certificado; se dice tal cual y NO se sustituye por un pariente local.
  if (servidorId) {
    clase = MATCH.NOT_AVAILABLE; insumoIdFinal = ''; candidatoId = null;
    motivo = `Existe en el catálogo del servidor como «${servidorId}», pero sin precio certificado por Compras. No se costea hasta que Compras lo certifique o elijas un material local.`;
  }
  // RED DE SEGURIDAD: material NOMBRADO sin id del LLM → busca en la MISMA familia.
  //  · Varios candidatos igualmente plausibles → AMBIGUOUS (no se escoge a escondidas).
  //  · Candidato único compatible (p.ej. melamina color) → autocostea PROVISIONAL.
  //  · Candidato único con atributo crítico (calibre/perfil) → preselecciona, NO autocostea.
  //  · Sin candidato de familia → queda como clasif (NOT_AVAILABLE / pendiente de precio).
  // TELCEL 26-oct: el LLM había puesto "Escuadra" a un "Refuerzo interno PTR 1x2".
  // clasificarMaterial lo bloqueó como cross-family, pero conservaba esa escuadra como CANDIDATO y
  // la UI seguía mostrándola. Si el candidato inicial cruza familia, se busca primero uno REAL
  // de la familia pedida. El override cross-family queda como último recurso si no existe alternativa.
  const candidatoCruzaFamilia = clase === MATCH.SUBSTITUTE_REQUIRES_CONFIRMATION;
  if (!insumoIdFinal && (!candidatoId || candidatoCruzaFamilia) && !servidorId && Array.isArray(catalogo) && familiaDeMaterial(solicitado) !== 'equipo_externo') {
    const { ambiguo, mejor } = candidatosDeFamilia(solicitado, catalogo);
    if (ambiguo) {
      candidatoId = null; resuelto = ''; cambio = '';
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
        motivo = mejor.generico
          ? `${mejor.certificable ? 'Última compra certificada por Compras' : 'Estándar de casa (genérico del catálogo)'}: ${mejor.nombre}. Confírmalo o elige la variante.`
          : `Auto-asignado por familia (provisional): ${mejor.nombre}.${cambio ? ' ' + cambio + '.' : ''} ${FAMILIAS_HERRAJE.has(familiaDeMaterial(solicitado)) ? 'Confírmalo o elige la variante.' : 'Confirma acabado/espesor.'}`;
        if (mejor.generico && !cambio) cambio = mejor.perfilSupuesto ? 'perfil supuesto 1"×1" (regla de casa)' : 'estándar de casa';
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
    material_solicitado: solicitadoRaw,
    candidate_insumo_id: candidatoId,
    _match: {
      clase, motivo, solicitado: solicitadoRaw, resuelto, cambio, autollenado,
      candidate_insumo_id: candidatoId,
      // ¿entra al cálculo provisional? (true para COMPATIBLE/EXACT/USER_CONFIRMED)
      autocosteable: MATCH_AUTOCOSTEABLE.has(clase) && !!insumoIdFinal,
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
  if (m.clase === MATCH.AMBIGUOUS) return { tono: 'ambar', titulo: 'Varios materiales posibles', detalle: `${m.motivo}${pedido} Elige de cuál es arriba.` };
  if (m.clase === MATCH.SAME_FAMILY_CRITICAL_CONFLICT) return { tono: 'ambar', titulo: 'Material crítico por confirmar', detalle: `${m.motivo}${pedido} No se costea hasta que lo confirmes.` };
  if (m.clase === MATCH.CANDIDATE_REQUIRES_CONFIRMATION || m.clase === MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED || m.autollenado) return { tono: 'ambar', titulo: 'Material propuesto por familia: confírmalo', detalle: `${m.motivo}${pedido} No se costea hasta que lo confirmes o lo cambies arriba.` };
  return null;
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
// Auditoría 2026-10-14 (P2-01): el artículo que la persona eligió para UNA pieza se PROPONE a sus hermanas, pero eso no
// es una decisión humana sobre cada una: entran al cálculo provisional marcadas "por confirmar" y con su origen.
export function patchPropuestaHermana(insumoId, origen = '') {
  return {
    material_match: MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED,
    material_confirmado: false,
    candidate_insumo_id: insumoId,
    propagado_desde: String(origen || ''),
    _match: { clase: MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED, confirmado_por_usuario: false, autollenado: true, autocosteable: true, candidate_insumo_id: insumoId },
  };
}

export function patchConfirmacionUI(insumoId) {
  return {
    material_match: MATCH.USER_CONFIRMED,
    material_confirmado: true,
    candidate_insumo_id: insumoId,
    _match: { clase: MATCH.USER_CONFIRMED, confirmado_por_usuario: true, autollenado: false, autocosteable: true, candidate_insumo_id: insumoId },
  };
}

// FECHA REAL DE ÚLTIMA COMPRA (auditoría ERP 13-oct). `actualizado` es la fecha de compra SÓLO en filas del ERP
// (catalogo_motor la toma de insumo_precios.vigente_desde); en curados/LEGACY es la fecha de CARGA y no sirve
// para decir "la compra más reciente". Se usa evidencia.ultima_compra (vh147) si existe; si no, `actualizado`
// sólo para ERP; si no, '' (sin compra documentada: ordena al final).
export function fechaUltimaCompra(ins = {}) {
  const ev = ins && ins.evidencia;
  if (ev && ev.ultima_compra) return String(ev.ultima_compra).slice(0, 10);
  const esErp = String(ins?.id || '').startsWith('erp-') || ins?.clasificacion === 'erp' || ev?.origen_precio === 'ERP';
  return esErp && ins.actualizado ? String(ins.actualizado).slice(0, 10) : '';
}

// ¿El texto de cambio declara una DIFERENCIA real frente a lo pedido (espesor/calibre/perfil, variante o
// acabado/color)? Las reglas de casa ('estándar de casa', 'perfil supuesto…', 'el color lo da la pintura…')
// no son diferencias. Una diferencia NUNCA se confirma en bloque: la persona la ve y decide fila por fila (VH-158).
export function difiereDeLoPedido(cambio = '') {
  const t = String(cambio || '');
  // Un cambio de espesor de tablero dentro de los pares APROBADOS por negocio (18↔19, 2026-10-08) es regla
  // de casa, no diferencia: puede ir en el bloque.
  const m = t.match(/^Solicitado ([\d/.]+) mm → candidato ([\d/.]+) mm$/);
  if (m) {
    const A = m[1].split('/').map(Number), B = m[2].split('/').map(Number);
    if (A.every((a) => B.every((b) => a === b || PARES_ESPESOR_PANEL_COMPATIBLE.has(parEspesor(a, b))))) return false;
  }
  return /^(Solicitado |Variante pedida|Acabado\/color distinto)/.test(t);
}

// Reglas de casa (amarre ERP): se exponen la severidad y el texto de cambio sin cambiar la API interna.
export const severidadConflicto_ = severidadConflicto;
export const textoCambio_ = textoCambio;
// Colores/especies explícitos de un texto (sin el marcador genérico 'color/madera'): para comparaciones SIMÉTRICAS.
export function coloresExplicitos(texto = '') { return [...coloresDe(texto)].filter((c) => c !== '_madera_generico').sort(); }
