// ============================================================================
//  programaRealDelPlano · EL CABLE de P0.1 (FloorSpec → Acomodo), con PROPUESTA
//  y CONFIRMACIÓN SEPARADAS (#2/#3).
//
//  LEER el plano NO confirma nada comercialmente:
//    proponerProgramaDelPlano(areas)  → PROPUESTA (resuelve, NO confirma)
//    aplicarPrograma(propuesta)       → CONFIRMA (acto explícito del usuario,
//                                        botón "Aplicar programa detectado") y
//                                        produce las partidas para cotización/Acomodo.
//
//  Acomodo/costeo reciben ÚNICAMENTE partidas reales confirmadas (bancoId +
//  identidad + precio snapshot), con nombre semántico que coherencia reconoce.
//  JAMÁS sug-*. La geometría es del catálogo (w/d reales).
// ============================================================================
import { programaDelPlano } from './programaDelPlano.js';
import { resolverPrograma, construirResolucion, requirementId, instanceId, groupId } from './resolverPrograma.js';
import { confirmarPrograma } from './confirmarPrograma.js';
import { validarObservedProgram, observedItem, ORIGEN, KIND, UMBRAL_CONFIANZA_GOBERNAR } from './observedProgram.js';
import { clasificarMueble, CLASE, ANCHOR_ROLE } from './mobiliarioOntologia.js';
import { buscarEnColeccion, medidasAwd, asientoPara, OPERATIVOS, ESCRITORIOS, JUNTAS, RECEPCIONES, SILLAS } from './catalogoCanonico.js';

// Nombre que describe el ROL real en palabras que coherencia/ruteo legacy aún
// entienden. NO es la autoridad semántica (esa es relation_role); sólo etiqueta.
function nombreSemantico(it) {
  const base = it.nombre || it.bancoId;
  switch (it.relation_role) {
    case 'WORK_SEAT':         return `Silla operativa · ${base}`;
    case 'EXECUTIVE_SEAT':    return `Silla directiva · ${base}`;
    case 'MEETING_SEAT':      return `Silla de juntas · ${base}`;
    case 'VISITOR_SEAT':      return `Silla de visita · ${base}`;
    case 'UNDERDESK_STORAGE':
    case 'SUPPORT_STORAGE':   return `Gaveta/pedestal · ${base}`;
    case 'ANCHOR_WORKSTATION': return `Bench operativo · ${base}`;
    case 'ANCHOR_DESK':        return `Escritorio privado dirección · ${base}`;
    case 'ANCHOR_MEETING':     return `Mesa de juntas · ${base}`;
    case 'ANCHOR_RECEPTION':   return `Recepción · ${base}`;
    default:                   return base;
  }
}

// Mapea una partida (de propuesta o confirmada) al shape de Acomodo/costeo.
function aPartidaAcomodo(it) {
  return {
    id: it.id || it.instance_id || it.bancoId,
    piezaId: it.bancoId,
    bancoId: it.bancoId,
    source_ref: it.source_ref,
    // R12-5: provenance del plano viaja al shape de Acomodo/preview.
    plan_source_ref: it.plan_source_ref ?? null,
    product_source_ref: it.product_source_ref ?? it.bancoId ?? null,
    plan_tag: it.plan_tag ?? null,
    grouping: it.grouping ?? null,
    nombre: nombreSemantico(it),
    cantidad: it.cantidad,
    w: it.w,
    d: it.d,
    usuarios: it.usuarios,
    // P0.2c GAP15: capacidad y topología deben SOBREVIVIR el camino real hasta
    // Acomodo. user_capacity viene de `usuarios` (módulo operativo); placement_profile
    // lo adjuntó resolverOperativos (regla USER_CONFIRMED/CATALOG).
    user_capacity: Number(it.user_capacity ?? it.usuarios) > 0 ? Number(it.user_capacity ?? it.usuarios) : null,
    ...(it.placement_profile ? { placement_profile: it.placement_profile } : {}),
    linea: it.linea,
    // semántica estructural (autoridad, no el texto)
    relation_role: it.relation_role,
    anchor_role: it.anchor_role,
    instance_id: it.instance_id,
    anchor_instance_id: it.anchor_instance_id,
    functional_group_id: it.functional_group_id,
    inclusion: it.inclusion,
    // compuertas separadas
    product_status: it.product_status ?? 'RESOLVED',
    identity_status: it.identity_status ?? (it.productoId ? 'RESOLVED' : 'MISSING'),
    price_status: it.price_status ?? (Number(it.precio_lista_snapshot) > 0 ? 'SNAPSHOT_DISPLAY' : 'SIN_PRECIO'),
    productoId: it.productoId ?? (it.identidad ? it.identidad.producto_id : null),
    producto_version_id: it.producto_version_id ?? (it.identidad ? it.identidad.producto_version_id : null),
    lista_precio_item_id: it.lista_precio_item_id ?? (it.identidad ? it.identidad.lista_precio_item_id : null),
    precio_lista_snapshot: it.precio_lista_snapshot,
    autoridad: it.autoridad ?? 'SERVIDOR',
    source: it.source === 'CONFIRMADO_PROGRAMA' ? 'CONFIRMADO_PROGRAMA' : 'PROPUESTO_PROGRAMA',
  };
}

/**
 * ADAPTER CANÓNICO de ProductResolution confirmada → PARTIDA COMERCIAL (#5/#6/#7).
 * NO usa partidaDeCosteo (dominio de costeo): no inventa costo, no calcula BOM
 * vacío, no deriva margen. Conserva la semántica estructural a NIVEL SUPERIOR
 * (no escondida en config) para que Acomodo/coherencia/spatial la lean directo.
 * Precio: snapshot de DISPLAY (nunca $0; nunca FIRME); el servidor lo revalida.
 */
export function partidaComercialDesdeConfirmado(it) {
  const snap = Number(it.precio_lista_snapshot) > 0 ? Number(it.precio_lista_snapshot) : null;
  const sinPrecio = it.price_status === 'SIN_PRECIO' || snap == null;
  return {
    id: it.id || it.instance_id || `${it.relation_role}:${it.bancoId}`,
    // identidad de producto (top-level)
    piezaId: it.bancoId,
    bancoId: it.bancoId,
    source_ref: it.source_ref || it.bancoId,
    // R12-5/R14-4: la partida comercial CONSERVA de dónde vino en el plano (B-01),
    // aparte del producto de catálogo (op-2u…), + evidencia y posición/orientación
    // observadas, para poder explicar "¿de dónde salió este mueble?" y volver al plano.
    plan_source_ref: it.plan_source_ref ?? null,
    product_source_ref: it.product_source_ref ?? it.bancoId ?? null,
    plan_tag: it.plan_tag ?? null,
    grouping: it.grouping ?? null,
    evidence: it.evidence ?? null,
    ...(it.observed_position != null ? { observed_position: it.observed_position } : {}),
    ...(it.observed_orientation != null ? { observed_orientation: it.observed_orientation } : {}),
    productoId: it.productoId || null,
    producto_version_id: it.producto_version_id || null,
    nombre: it.nombre,
    w: it.w ?? null,
    d: it.d ?? null,
    usuarios: it.usuarios ?? null,
    // P0.2c GAP16.2: ningún adapter productivo borra la topología/capacidad confirmada.
    user_capacity: Number(it.user_capacity ?? it.usuarios) > 0 ? Number(it.user_capacity ?? it.usuarios) : null,
    ...(it.placement_profile ? { placement_profile: it.placement_profile } : {}),
    linea: it.linea ?? null,
    cantidad: Number(it.cantidad) || 1,
    // SEMÁNTICA ESTRUCTURAL (top-level, NO en config) — #5
    relation_role: it.relation_role ?? null,
    anchor_role: it.anchor_role ?? null,
    instance_id: it.instance_id ?? null,
    anchor_instance_id: it.anchor_instance_id ?? null,
    functional_group_id: it.functional_group_id ?? null,
    requirement_id: it.requirement_id ?? null,
    zone_id: it.zone_id ?? null,
    // P1-R15-H: la confirmación EXPLÍCITA de modelo de sillería SOBREVIVE hasta la
    // partida comercial → silleriaPendiente la ve cubierta. Sólo cuando es true.
    ...(it.confirmado_modelo === true ? { confirmado_modelo: true } : {}),
    // TRES COMPUERTAS (top-level)
    product_status: it.product_status ?? 'RESOLVED',
    identity_status: it.identity_status ?? (it.productoId ? 'RESOLVED' : 'MISSING'),
    price_status: it.price_status ?? (snap ? 'SNAPSHOT_DISPLAY' : 'SIN_PRECIO'),
    // PRECIO (#6): display, NUNCA $0 inventado, NUNCA firme hasta autoridad.
    precioUnitario: sinPrecio ? null : snap,
    precio_lista_snapshot: snap,
    precioReal: false,
    precioAutorizado: false,
    sinPrecioAutorizado: true,
    // COSTO (#7): desconocido/pendiente; jamás inventado ni 0.
    costoUnitario: null,
    costoPendiente: true,
    margen: null,
    // config SÓLO para configuración adicional
    config: { usuarios: it.usuarios ?? null },
    source: 'CONFIRMADO_PROGRAMA',
  };
}

/** Partidas confirmadas → shape Acomodo/costeo (tras aplicar). */
export function partidasParaAcomodo(confirmacion) {
  const items = (confirmacion && Array.isArray(confirmacion.items)) ? confirmacion.items : [];
  return items.map(aPartidaAcomodo);
}

/** Partidas PROPUESTAS → shape para PREVIEW (antes de confirmar; NO comercial). */
export function partidasPropuestas(propuesta) {
  const parts = (propuesta && Array.isArray(propuesta.partidas)) ? propuesta.partidas : [];
  return parts.map(aPartidaAcomodo);
}

/** PROPONE desde un programa ya contado (resuelve, NO confirma). */
export function proponerPrograma(programa, { linea = 'App LT' } = {}) {
  const propuesta = resolverPrograma(programa, { linea });
  return {
    programa,
    propuesta,
    preview: partidasPropuestas(propuesta),
    incompletos: propuesta.incompletos,
    cotizable: propuesta.cotizable,
  };
}

/**
 * PROPONE desde las áreas del plano (FloorSpec) + el BRIEF estructurado del
 * usuario (#4). NO confirma. El `brief` (línea/modelo/dimensiones/accesorios/
 * sillas/extras) lo interpreta CotizadorIA/VONI y se persiste; aquí se COMBINA
 * con el programa derivado del espacio — una sola ProgramRequirements, sin
 * reconstruir nada desde los textos de las partidas.
 */
export function proponerProgramaDelPlano(areas, { linea = 'App LT', brief = null } = {}) {
  const programa = programaDelPlano(areas);
  const salas = Array.isArray(programa.salas) ? programa.salas.filter((n) => Number(n) > 0) : [];
  // #19: conserva la identidad por-zona del FloorSpec (nombre/id del área) hasta el
  // ProgramRequirement, sin tirarla al agregar conteos. El brief del usuario (línea/
  // modelo/dims) se superpone sin pisar la identidad de zona.
  const z = programa.zonas || {};
  const briefBase = { ...(programa.brief || {}), ...(brief || {}) };
  if (z.operativo) briefBase.operativoZoneId = briefBase.operativoZoneId || z.operativo.id || z.operativo.nombre;
  if (z.recepcion) briefBase.recepcionZoneId = briefBase.recepcionZoneId || z.recepcion.id || z.recepcion.nombre;
  const mezclarZona = (arr = [], zonas = []) => zonas.map((zz, i) => ({ zone_id: zz.id || zz.nombre, ...(arr[i] || {}) }));
  briefBase.privados = mezclarZona(briefBase.privados, z.privados || []);
  briefBase.juntas = mezclarZona(briefBase.juntas, z.juntas || []);
  const entrada = {
    operativos: Number(programa.operativos) || 0,
    privados: Number(programa.privados) || 0,
    salas,
    recepcion: !!programa.recepcion,
    brief: briefBase,
  };
  return { programaDetectado: programa, ...proponerPrograma(entrada, { linea }) };
}

// ---------------------------------------------------------------------------
//  observed_program GOBIERNA el programa comercial (ChatGPT P0-R8-1).
//
//  Cuando el lector entrega un observed_program VÁLIDO, el programa NO se
//  reconstruye desde la geometría de áreas: lo que el plano REALMENTE muestra
//  (muebles observados) manda. Pipeline honesto:
//     observed_program (revalidado) → [revisión humana] → ProgramRequirements →
//     ProductResolver (resolverPrograma) → PROPUESTA (NO confirma).
//
//  · Sólo lo OBSERVED y sin issues GOBIERNA (capacity_total manda los PUESTOS,
//    no el número de muebles: 4 benches×2 = 8 puestos).
//  · SUGGESTED/INFERRED y los roles que aún no sabemos mapear NO se inventan:
//    van a `observadoPendientes` para revisión humana (el vocabulario de
//    mobiliario es el siguiente P0; aquí jamás se adivina un rol).
//  · Si NADA observado gobierna, devuelve null y el caller usa la heurística de
//    áreas (proponerProgramaDelPlano) — sin romper el camino actual.
// ---------------------------------------------------------------------------
/**
 * Reduce un observed_program VALIDADO a ProgramRequirements {operativos,
 * privados, salas[], recepcion}, usando la ONTOLOGÍA determinista (P0-R9-6):
 *  · SÓLO las ANCLAS gobiernan (bench→operativos por capacidad; escritorio
 *    privado→privados; mesa de juntas→una sala POR UNIDAD, P0-R9-7; recepción→bandera).
 *  · Las SILLAS/GUARDAS son DEPENDIENTES: NO crean anclas ni inflan puestos/salas;
 *    se guardan en `dependientesObservados` para RECONCILIAR (P0-R9-9).
 *  · AMENIDADES y roles no reconocidos → `pendientes` (revisión, nunca inventados).
 *  · Se preserva la IDENTIDAD FÍSICA de cada ancla en `anclasObservadas`
 *    (dims/zona/source_ref/capacidad/evidencia) para que el resolver haga match
 *    por dimensiones y NO colapse 4 benches en 1 módulo (P0-R9-8).
 * Sólo gobierna lo OBSERVED sin issues; el resto queda en `pendientes`.
 */
export function programRequirementsDesdeObservado(observedProgram) {
  const items = Array.isArray(observedProgram) ? observedProgram : [];
  const entrada = { operativos: 0, privados: 0, salas: [], recepcion: false };
  const pendientes = [];
  const anclasObservadas = [];        // identidad física preservada (P0-R9-8/R10-7)
  const dependientesObservados = [];  // sillas/guardas: reconcilian, no gobiernan (P0-R9-9)
  let gobernables = 0;

  items.forEach((rawIt) => {
    // Normalización src (aliases) + UNIÓN de issues con los del SERVIDOR (P0-R10-1):
    // el cliente puede AÑADIR validación defensiva, nunca BORRAR/rebajar lo que el
    // servidor ya marcó (ITEM_DUPLICADO, POSICION_FUERA_DE_ENVOLVENTE, etc.).
    const norm = observedItem(rawIt);
    const serverIssues = Array.isArray(rawIt.issues) ? rawIt.issues : [];
    const issuesFinal = Array.from(new Set([...serverIssues, ...(norm.issues || [])]));
    const serverReview = rawIt.review_required === true;
    const kind = (rawIt.kind || norm.kind || KIND.FURNITURE);
    const etiqueta = norm.type || norm.role || null;

    // P0-R10-4: un CUARTO (kind=room) jamás es mueble: ni ancla, ni dependiente,
    // ni suma capacidad. Es geometría de espacio (lo gobiernan las áreas).
    if (kind === KIND.ROOM) return;

    // Un item con issues (servidor o cliente) o REVIEW del servidor NO gobierna.
    if (norm.origin !== ORIGEN.OBSERVED || issuesFinal.length > 0 || serverReview) {
      pendientes.push({ code: 'REQUIERE_CONFIRMACION', type: etiqueta, origin: norm.origin, issues: issuesFinal });
      return;
    }
    // P1-R10-11: confianza por debajo del umbral único NO gobierna sola.
    if (!(Number(norm.confidence) >= UMBRAL_CONFIANZA_GOBERNAR)) {
      pendientes.push({ code: 'CONFIANZA_BAJA', type: etiqueta, origin: norm.origin, confidence: norm.confidence ?? null });
      return;
    }
    // P0-R10-4: sólo FURNITURE puede ser ancla/dependiente. amenity/unknown → revisión.
    if (kind === KIND.AMENITY) { pendientes.push({ code: 'AMENITY_SIN_VOCABULARIO', type: etiqueta, origin: norm.origin }); return; }
    if (kind === KIND.UNKNOWN) { pendientes.push({ code: 'ROLE_NO_MAPEADO', type: etiqueta, origin: norm.origin }); return; }

    const cls = clasificarMueble(norm);
    const q = Number(norm.quantity) > 0 ? Number(norm.quantity) : 1;
    const capTotal = Number(norm.capacity_total) > 0 ? Number(norm.capacity_total) : 0;
    const capPer = Number(norm.capacity_per_unit) > 0 ? Number(norm.capacity_per_unit)
      : (capTotal > 0 && q > 0 ? capTotal / q : 0);
    const plan_tag = (typeof rawIt.plan_tag === 'string' ? rawIt.plan_tag : null) || norm.plan_tag || null;

    if (cls.clase === CLASE.DEPENDENT) {
      // Una silla/guarda observada NO crea ancla: se usa para reconciliar (P0-R9-9/R10-9).
      // R13-4: plan_source_ref (S-01) ≠ observed_model (modelo comercial, si el lector lo dio).
      dependientesObservados.push({
        dependent_role: cls.dependent_role, quantity: q, zone: norm.zone || null,
        plan_source_ref: norm.source_ref || null, source_ref: norm.source_ref || null,
        observed_model: (typeof rawIt.observed_model === 'string' ? rawIt.observed_model : null) || (typeof rawIt.model === 'string' ? rawIt.model : null) || null,
        dimensions: norm.dimensions || null, evidence: norm.evidence || null,
      });
      return;
    }
    if (cls.clase === CLASE.AMENITY) { pendientes.push({ code: 'AMENITY_SIN_VOCABULARIO', type: etiqueta, origin: norm.origin }); return; }
    if (cls.clase !== CLASE.ANCHOR) { pendientes.push({ code: 'ROLE_NO_MAPEADO', type: etiqueta, origin: norm.origin }); return; }

    // ANCLA: conserva identidad física íntegra (P0-R10-7). Cuenta como gobernable
    // aunque falte capacidad (para NO caer al fallback de áreas); el hueco de
    // capacidad se marca aparte como pendiente.
    gobernables++;
    anclasObservadas.push({
      anchor_role: cls.anchor_role, type: norm.type || null, role: norm.role || null,
      quantity: q, capacity_per_unit: capPer || null, capacity_total: capTotal || (capPer ? capPer * q : null),
      dimensions: norm.dimensions || null, zone: norm.zone || null,
      source_ref: norm.source_ref || null, plan_tag,
      grouping: norm.grouping || null, position: norm.position || null,
      orientation: norm.orientation ?? null, evidence: norm.evidence || null,
    });
    // P1-R11: un ancla SIN etiqueta (source_ref/plan_tag) y SIN posición no tiene
    // identidad segura para gobernar sola → revisión (no se asume uniq:index válido).
    if (!norm.source_ref && !plan_tag && !norm.position) {
      pendientes.push({ code: 'IDENTIDAD_AMBIGUA', type: etiqueta, anchor_role: cls.anchor_role });
    }
    if (cls.anchor_role === ANCHOR_ROLE.WORKSTATION) {
      // P0-R10-5: NO inventar capacidad. Sin capacity_total NO se convierten muebles
      // en puestos; el ancla queda pendiente de capacidad (REVIEW), pero existe.
      if (capTotal > 0) entrada.operativos += capTotal;
      else pendientes.push({ code: 'NEEDS_CAPACITY', type: etiqueta, source_ref: norm.source_ref || null, anchor_role: cls.anchor_role });
    } else if (cls.anchor_role === ANCHOR_ROLE.DESK_PRIVATE) {
      entrada.privados += q;
    } else if (cls.anchor_role === ANCHOR_ROLE.MEETING) {
      if (capPer > 0) { for (let k = 0; k < q; k++) entrada.salas.push(capPer); }  // POR UNIDAD (P0-R9-7)
      else pendientes.push({ code: 'NEEDS_CAPACITY', type: etiqueta, source_ref: norm.source_ref || null, anchor_role: cls.anchor_role });
    } else if (cls.anchor_role === ANCHOR_ROLE.RECEPTION) {
      entrada.recepcion = true;
    }
  });
  return { entrada, pendientes, gobernables, anclasObservadas, dependientesObservados };
}

// Colección canónica por rol de ancla (para resolver por DIMENSIONES, no por
// capacidad): el mueble físico observado busca su equivalente real en catálogo.
const COLECCION_ANCLA = Object.freeze({
  [ANCHOR_ROLE.WORKSTATION]: OPERATIVOS,
  [ANCHOR_ROLE.DESK_PRIVATE]: ESCRITORIOS,
  [ANCHOR_ROLE.MEETING]: JUNTAS,
  [ANCHOR_ROLE.RECEPTION]: RECEPCIONES,
});

function identidadAncla(an) {
  return { anchor_role: an.anchor_role, source_ref: an.source_ref || null, zone: an.zone || null, dimensions: an.dimensions || null, quantity: an.quantity, capacity_total: an.capacity_total ?? null };
}

// Roles cuyo producto TIENE capacidad (usuarios) que debe coincidir (R12-2).
const ANCLA_CON_CAPACIDAD = new Set([ANCHOR_ROLE.WORKSTATION, ANCHOR_ROLE.MEETING]);
const txtModeloAncla = (an) => {
  const s = String(an.model || an.modelo || an.acabado || an.finish || '').trim();
  return s || null;
};

/**
 * RESUELVE UNA ancla observada contra el CATÁLOGO por IDENTIDAD FÍSICA, cruzando
 * rol + dimensiones + CAPACIDAD + línea/modelo (ChatGPT R12-1/R12-2). "Misma
 * dimensión" NO basta:
 *  · RESOLVED           → EXACTAMENTE un producto canónico compatible.
 *  · PRODUCT_AMBIGUOUS  → ≥2 candidatos y la evidencia no discrimina (p.ej. mesa
 *                         900×900 melamina/comedor/cristal) → NUNCA matches[0].
 *  · CAPACITY_MISMATCH  → la capacidad observada no coincide con la del producto
 *                         de esa geometría (1 bench 1500×1200 cap 8 ≠ op-2u).
 *  · NEEDS_DIMENSIONS   → sin dimensiones.
 *  · NEEDS_CONFIRMATION → sin equivalente canónico (REQUIERE_DESARROLLO).
 * P1: NO se cae a otra LÍNEA sólo porque coincida la dimensión (buscarEnColeccion
 * ya conserva productos sin línea; no se reintenta quitando la línea pedida).
 */
export function resolverAnclaCanonica(an, { linea = 'App LT' } = {}) {
  const coleccion = COLECCION_ANCLA[an.anchor_role];
  const dims = an.dimensions;
  const base = identidadAncla(an);
  if (!coleccion) return { ...base, estado: 'NEEDS_CONFIRMATION', motivo: 'Rol de ancla sin colección canónica.' };
  if (!dims || (dims.w == null && dims.d == null)) {
    return { ...base, estado: 'NEEDS_DIMENSIONS', motivo: 'Ancla observada sin dimensiones: no se puede verificar el producto canónico.' };
  }
  const modelo = txtModeloAncla(an);
  // Sin fallback cross-línea (P1): si se pide línea, otra línea requiere confirmación.
  let matches = buscarEnColeccion(coleccion, { line: linea, dimensions: dims, model: modelo });
  // Si NINGÚN producto tiene esa GEOMETRÍA → REQUIERE_DESARROLLO (no se sustituye).
  if (matches.length === 0) {
    return { ...base, estado: 'NEEDS_CONFIRMATION', motivo: 'REQUIERE_DESARROLLO: ningún producto canónico equivale a la geometría observada (no se sustituye por capacidad).' };
  }
  // La geometría EXISTE: ahora la CAPACIDAD debe coincidir cuando aplica (R12-2).
  const capPer = Number(an.capacity_per_unit) > 0 ? Math.round(Number(an.capacity_per_unit)) : null;
  if (ANCLA_CON_CAPACIDAD.has(an.anchor_role) && capPer != null) {
    const conCap = matches.filter((p) => Number(p.usuarios) === capPer);
    if (!conCap.length) {
      return { ...base, estado: 'CAPACITY_MISMATCH', capacity_per_unit: capPer, motivo: `Existe producto de ${dims.w}×${dims.d} pero su capacidad no coincide con la observada (${capPer}).`, candidatos: matches.map((p) => p.id) };
    }
    matches = conCap;
  }
  if (matches.length > 1) {
    return { ...base, estado: 'PRODUCT_AMBIGUOUS', motivo: 'Varios productos canónicos con esa geometría/capacidad; la evidencia no discrimina modelo/acabado.', candidatos: matches.map((p) => p.id) };
  }
  const wd = medidasAwd(matches[0].medidas) || {};
  return { ...base, estado: 'RESOLVED', producto: matches[0].id, producto_obj: matches[0], w: wd.w ?? null, d: wd.d ?? null };
}

/** RECONCILIA cada ANCLA observada por identidad física (una por una, 1:1). */
export function conciliarAnclasObservadas(anclas = [], opts = {}) {
  const linea = opts.linea || 'App LT';
  return (Array.isArray(anclas) ? anclas : []).map((an) => resolverAnclaCanonica(an, { linea }));
}

/**
 * RECONCILIA los DEPENDIENTES observados (sillas/guardas) contra los que generó
 * el resolver desde las anclas (P0-R9-9). NO suma unos sobre otros: compara para
 * detectar divergencias (faltan/sobran). Las sillas observadas confirman, no
 * duplican: por eso NO alimentan el programa; aquí sólo se verifica coherencia.
 */
export function conciliarDependientes(observados = [], requeridos = []) {
  const sumaPorRol = (arr, key, qtyKey) => {
    const m = {};
    for (const x of (Array.isArray(arr) ? arr : [])) {
      const r = x[key];
      if (!r) continue;
      m[r] = (m[r] || 0) + (Number(x[qtyKey]) || 0);
    }
    return m;
  };
  const obs = sumaPorRol(observados, 'dependent_role', 'quantity');
  // `requeridos` = recomendaciones de asiento (dependent_role, requirement_qty,
  // suggested_product). El producto sugerido es SUGGESTED: el modelo lo confirma
  // el usuario (R12-3) — por eso aquí NO se da por confirmada ninguna silla.
  const res = sumaPorRol(Array.isArray(requeridos) ? requeridos : [], 'dependent_role', 'requirement_qty');
  const modeloSugerido = {};
  for (const r of (Array.isArray(requeridos) ? requeridos : [])) if (r && r.dependent_role) modeloSugerido[r.dependent_role] = r.suggested_product || null;
  // R13-4: source_ref es la identidad del PLANO (S-01), NO el modelo comercial.
  // Sólo un modelo/producto EXPLÍCITO del observado cuenta como modelo observado.
  const modeloObservado = {};
  for (const o of (Array.isArray(observados) ? observados : [])) if (o && o.dependent_role) modeloObservado[o.dependent_role] = o.observed_product || o.observed_model || o.product || o.model || null;
  const roles = new Set([...Object.keys(obs), ...Object.keys(res)]);
  // P0-R10-9: 4 estados. Nada OBSERVADO desaparece: OBSERVED_ONLY exige acción
  // (identificar producto/desarrollo); GENERATED_ONLY es regla/sugerencia, no observado.
  return [...roles].sort().map((rol) => {
    const o = obs[rol] || 0;
    const r = res[rol] || 0;
    let estado = 'MATCH';
    if (o > 0 && r === 0) estado = 'OBSERVED_ONLY';
    else if (r > 0 && o === 0) estado = 'GENERATED_ONLY';
    else if (o !== r) estado = 'DIVERGE';
    const suggested = modeloSugerido[rol] || null;
    const observadoModelo = modeloObservado[rol] || null;
    // R12-3: el modelo del asiento NO está confirmado. Si el observado trae modelo
    // y difiere del sugerido → MODEL_MISMATCH; si no, el sugerido requiere confirmación.
    const requiere_confirmacion_modelo = !!suggested && (!observadoModelo || observadoModelo !== suggested);
    const modelo_mismatch = !!suggested && !!observadoModelo && observadoModelo !== suggested;
    return { dependent_role: rol, observados: o, resueltos: r, estado, suggested_product: suggested, observado_modelo: observadoModelo, requiere_confirmacion_modelo, modelo_mismatch };
  });
}

/**
 * PROPONE desde el observed_program (lo observado GOBIERNA). NO confirma.
 * Devuelve null si nada observado es gobernable (→ el caller cae a la
 * heurística de áreas). Mantiene PROPUESTA ≠ CONFIRMACIÓN.
 */
// Rol/relation por tipo de ancla (para construir la ProductResolution canónica).
const ANCHOR_REL = Object.freeze({
  [ANCHOR_ROLE.WORKSTATION]: { rel: 'ANCHOR_WORKSTATION', rol: 'operativo', seat: 'WORK_SEAT' },
  [ANCHOR_ROLE.DESK_PRIVATE]: { rel: 'ANCHOR_DESK', rol: 'privado', seat: null },
  [ANCHOR_ROLE.MEETING]: { rel: 'ANCHOR_MEETING', rol: 'juntas', seat: 'MEETING_SEAT' },
  [ANCHOR_ROLE.RECEPTION]: { rel: 'ANCHOR_RECEPTION', rol: 'recepcion', seat: null },
});

// Adjunta la PROVENANCE del plano a una resolución (R12-5): dos identidades
// SEPARADAS — plan_source_ref (B-01, del plano) vs product_source_ref (op-2u…,
// del catálogo) — más plan_tag/grouping/zone/posición/orientación observadas.
function conProvenance(res, an) {
  if (!res) return res;
  res.plan_source_ref = an.source_ref || null;       // identidad del PLANO (B-01)
  res.product_source_ref = res.bancoId || null;       // identidad del PRODUCTO (op-2u…)
  res.plan_tag = an.plan_tag || null;
  res.grouping = an.grouping || null;
  if (an.position) res.observed_position = an.position;
  if (an.orientation != null) res.observed_orientation = an.orientation;
  return res;
}

/**
 * IDENTITY-FIRST (ChatGPT R11-1/2 + R12): cada ANCLA FÍSICA observada resuelve su
 * producto canónico cruzando rol+dimensiones+CAPACIDAD+línea (resolverAnclaCanonica).
 * quantity=N → N instancias (1:1). PRODUCT_AMBIGUOUS/CAPACITY_MISMATCH/NEEDS_* →
 * incompletos (NUNCA matches[0] a ciegas).
 * Las SILLAS NO son partidas confirmadas: son RECOMENDACIONES (SUGGESTED) con el
 * producto sugerido por regla; el modelo real lo confirma el usuario (R12-3).
 * Conserva PROVENANCE del plano en cada resolución (R12-5).
 * @returns {{partidas:Array, incompletos:Array, recomendaciones:Array}}
 */
export function resolverFisicoDesdeObservado(anclas, { linea = 'App LT' } = {}) {
  const partidas = [];
  const incompletos = [];
  const recomendaciones = [];
  (Array.isArray(anclas) ? anclas : []).forEach((an, i) => {
    const map = ANCHOR_REL[an.anchor_role];
    if (!map) { incompletos.push({ reason: 'ANCHOR_ROLE_DESCONOCIDO', plan_source_ref: an.source_ref || null, anchor_role: an.anchor_role }); return; }
    const r = resolverAnclaCanonica(an, { linea });
    if (r.estado !== 'RESOLVED') {
      incompletos.push({ reason: r.estado, motivo: r.motivo || null, plan_source_ref: an.source_ref || null, anchor_role: an.anchor_role, dimensions: an.dimensions || null, candidatos: r.candidatos || undefined });
      return;
    }
    const prod = r.producto_obj;
    const q = Number(an.quantity) > 0 ? Math.floor(Number(an.quantity)) : 1;
    // R14-2/R15-3: identidad ESTABLE SIN colisiones. `grouping` SOLO no basta (dos
    // benches del mismo grupo colisionarían). Prioridad: source_ref → plan_tag →
    // grouping+zone+posición → zone+posición → posición → índice (último recurso).
    const pos = (an.position && an.position.x != null && an.position.y != null) ? `${an.position.x},${an.position.y}` : null;
    const stableKey = an.source_ref || an.plan_tag
      || (an.grouping && (an.zone || pos) ? `g:${an.grouping}:${an.zone || ''}:${pos || ''}` : null)
      || (an.zone && pos ? `z:${an.zone}:${pos}` : null)
      || (pos ? `p:${pos}` : null)
      || `idx${i}`;
    const req_id = requirementId(an.zone || null, map.rol, stableKey);
    const seatsPorUnidad = Number(an.capacity_per_unit) > 0 ? Math.round(Number(an.capacity_per_unit)) : 0;
    for (let k = 0; k < q; k++) {   // CARDINALIDAD 1:1: una instancia física por observada
      const res = construirResolucion(prod, {
        requirement_id: req_id, zone_id: an.zone || null, evidence: an.evidence || null,
        rol: map.rol, relation_role: map.rel,
        functional_group_id: groupId(req_id, k), instance_id: instanceId(req_id, k),
        cantidad: 1, inclusion: 'anchor',
      });
      if (res) partidas.push(conProvenance(res, an));
      // ASIENTOS: el REQUERIMIENTO (N sillas) es real, pero el PRODUCTO es una
      // SUGERENCIA (modelo no confirmado con VH) → recomendación, NO partida (R12-3).
      if (map.seat && seatsPorUnidad > 0) {
        const silla = asientoPara(map.seat);
        recomendaciones.push({
          dependent_role: map.seat,
          requirement_qty: seatsPorUnidad,
          para_ancla: res ? res.instance_id : null,
          // R15-C2: la silla HEREDA la topología canónica del ANCLA (mismo grupo
          // funcional + tipo de ancla), igual que los dependientes de resolverPrograma.
          anchor_functional_group_id: res ? res.functional_group_id : null,
          anchor_role: map.rel,
          plan_source_ref: an.source_ref || null,
          zone: an.zone || null,
          suggested_product: silla ? silla.id : null,
          suggested_nombre: silla ? (silla.nombre || silla.id) : null,
          product_status: 'SUGGESTED',
          requiere_confirmacion_modelo: true,
        });
      }
    }
  });
  return { partidas, incompletos, recomendaciones };
}

/**
 * ACCIÓN REAL de confirmación de sillería (ChatGPT R15-4): toma las RECOMENDACIONES
 * (SUGGESTED) y produce partidas de ASIENTO reales (ProductResolution RESOLVED) con
 * el producto sugerido — para "USAR SUGERIDO". El acto es explícito del usuario; una
 * vez aplicadas, las sillas dejan de ser pendientes (identidad comercial real).
 * @param {Array} recomendaciones  `fisico.recomendaciones`
 * @returns {{partidas:Array}}
 */
export function propuestaSilleriaSugerida(recomendaciones, { linea = 'App LT' } = {}) {
  const partidas = [];
  (Array.isArray(recomendaciones) ? recomendaciones : []).forEach((r, i) => {
    if (!r || !r.suggested_product) return;
    const silla = buscarEnColeccion(SILLAS, { line: linea }).find((s) => s.id === r.suggested_product)
      || SILLAS.find((s) => s.id === r.suggested_product);
    if (!silla) return;
    // R15-C: la identidad del asiento se LIGA al ANCLA física (para_ancla). Así, un
    // bench quantity=4 genera 4 recomendaciones (para_ancla distinto) × capacidad, con
    // instance_id ÚNICOS y anchor_instance_id correcto — sin duplicar ni cross-link.
    const ancla = r.para_ancla || `${r.plan_source_ref || 'x'}:${i}`;
    const req_id = requirementId(r.zone || null, 'silla', `${r.dependent_role}:${ancla}`);
    const n = Number(r.requirement_qty) > 0 ? Math.floor(Number(r.requirement_qty)) : 1;
    // R15-C2: HEREDA la topología canónica del ancla (grupo funcional + tipo de ancla),
    // NO inventa un grupo nuevo para la silla. instance_id sí propio y único por silla.
    const fg = r.anchor_functional_group_id || groupId(req_id, 0);
    for (let k = 0; k < n; k++) {
      const res = construirResolucion(silla, {
        requirement_id: req_id, zone_id: r.zone || null, rol: 'silla',
        relation_role: r.dependent_role, anchor_role: r.anchor_role || null,
        anchor_instance_id: r.para_ancla || null,
        functional_group_id: fg, instance_id: instanceId(req_id, k),
        cantidad: 1, inclusion: 'requested',
      });
      if (res) { res.plan_source_ref = r.plan_source_ref || null; res.confirmado_modelo = true; partidas.push(res); }
    }
  });
  return { partidas };
}

/**
 * ¿Queda sillería por confirmar? (ChatGPT R15-B) NO es "¿existe alguna silla?":
 * reconcilia por dependent_role y CANTIDAD FÍSICA. Pendiente si ALGÚN rol requerido
 * por el programa no está cubierto en cantidad por asientos reales en la cotización.
 * @param {Array} recomendaciones  requerimientos de asiento del observed
 * @param {Array} partidas         partidas ya en la cotización
 */
export function silleriaPendiente(recomendaciones, partidas = []) {
  const recs = Array.isArray(recomendaciones) ? recomendaciones : [];
  if (recs.length === 0) return false;
  // R15-B2: requerido por (rol, ANCLA) con su modelo sugerido — NO sólo por rol.
  const req = new Map();
  for (const r of recs) {
    if (!r || !r.dependent_role) continue;
    const ancla = String(r.para_ancla || '');
    const key = `${r.dependent_role}|${ancla}`;
    const cur = req.get(key) || { role: r.dependent_role, ancla, qty: 0, suggested: r.suggested_product || null };
    cur.qty += Number(r.requirement_qty) || 0;
    req.set(key, cur);
  }
  const seats = (Array.isArray(partidas) ? partidas : []).filter((p) => /SEAT/i.test(String(p.relation_role || '')) && (p.bancoId || p.product_status === 'RESOLVED'));
  // Cobertura por (rol, ancla, modelo): una silla legacy/suelta (sin anchor) NO cubre
  // en silencio el requerimiento de un ancla concreta; un modelo distinto tampoco
  // cuenta salvo acto explícito (confirmado_modelo).
  const cubierto = (role, ancla, suggested) => seats
    .filter((p) => String(p.relation_role) === role
      && String(p.anchor_instance_id || '') === ancla
      && (!suggested || String(p.bancoId) === String(suggested) || p.confirmado_modelo === true))
    .reduce((s, p) => s + (Number(p.cantidad) || 1), 0);
  for (const { role, ancla, qty, suggested } of req.values()) {
    if (cubierto(role, ancla, suggested) < qty) return true;   // pendiente
  }
  return false;
}

// P0-R15-F: AUTORIDAD ÚNICA de BLOQUEOS de PROGRAMA OBSERVADO para publicación.
// Dado el resultado de `proponerProgramaDesdeObservado` y las partidas ACTUALES de la
// cotización, devuelve la lista de bloqueos que impiden publicar (Propuesta Viva /
// guardado final / PDF) aunque el layout sea geométricamente válido. Combina:
//   1. propuestaPlano.requiereRevision (ancla sin producto canónico / dependiente en conflicto)
//   2. sillería pendiente REAL, reconciliada contra las partidas actuales
//   3. conflictos de reconciliación (aplicarPrograma vs partidas existentes)
// Estos tres determinan por completo si el programa está completo DADAS las partidas
// actuales. NO se usa `programaCompleto` como red de seguridad: ese flag se calcula al
// proponer (incluye requiereConfirmacionSillas) SIN conocer las partidas ya cotizadas,
// así que seguiría en false aunque la sillería YA esté cubierta por asientos confirmados.
// Lista vacía ⇒ el programa comercial observado está completo y es publicable.
// NOTA: la coherencia estructural (dependientes sin ancla real) la aporta
// `validarCoherenciaPrograma` y se concatena en el componente; aquí vive SÓLO lo observado.
export function bloqueosProgramaObservado(propuestaPlano, { partidas = [] } = {}) {
  const bloqueos = [];
  if (!propuestaPlano) return bloqueos;
  const recs = Array.isArray(propuestaPlano.recomendaciones) ? propuestaPlano.recomendaciones : [];
  const recon = propuestaPlano.propuesta
    ? aplicarPrograma(propuestaPlano.propuesta, { existentes: partidas })
    : null;
  if (propuestaPlano.requiereRevision) {
    bloqueos.push({
      code: 'OBSERVED_REQUIERE_REVISION',
      mensaje: 'Mobiliario observado por revisar: hay anclas sin producto canónico equivalente o dependientes en conflicto de modelo.',
      accion: 'Resuelve las anclas/dependientes del programa observado antes de publicar.',
    });
  }
  if (silleriaPendiente(recs, partidas)) {
    bloqueos.push({
      code: 'SILLERIA_PENDIENTE',
      mensaje: 'Falta confirmar la sillería del programa observado (modelo/cantidad por confirmar).',
      accion: 'Confirma la sillería sugerida antes de publicar.',
    });
  }
  for (const c of (recon?.conflictos || [])) {
    bloqueos.push({
      code: c?.code || 'CONFLICTO_RECONCILIACION',
      mensaje: `Conflicto de reconciliación con partidas existentes: ${c?.code || 'detalle no disponible'}.`,
      accion: 'Resuelve el conflicto de partidas antes de publicar.',
    });
  }
  return bloqueos;
}

export function proponerProgramaDesdeObservado(observedProgram, { linea = 'App LT', brief = null } = {}) {
  const red = programRequirementsDesdeObservado(observedProgram);
  const { pendientes, gobernables, anclasObservadas, dependientesObservados } = red;
  if (gobernables === 0) return null;
  // IDENTITY-FIRST (R11-1/2): NO se colapsa a {operativos,…} ni se llama
  // resolverPrograma por capacidad. Cada ancla física resuelve su producto por dims.
  const fisico = resolverFisicoDesdeObservado(anclasObservadas, { linea });
  const anclasConciliadas = conciliarAnclasObservadas(anclasObservadas, { linea });
  const hayAnclaNoResuelta = anclasConciliadas.some((a) => a.estado !== 'RESOLVED');
  // propuesta.partidas = SÓLO anclas confirmables; las sillas viven en recomendaciones
  // (SUGGESTED, R12-3) y NUNCA entran como partida confirmada.
  const propuesta = { partidas: fisico.partidas, recomendaciones: fisico.recomendaciones, pendientes: fisico.incompletos, incompletos: fisico.incompletos, cotizable: fisico.incompletos.length === 0, gobernadoPorObservado: true };
  const preview = partidasPropuestas(propuesta);
  // Reconcilia los dependientes OBSERVADOS contra el REQUERIMIENTO (recomendaciones),
  // comparando modelo cuando exista (R12-3).
  const dependientesConciliados = conciliarDependientes(dependientesObservados, fisico.recomendaciones);
  // GATE (R11-3 + R14-3): ancla no resuelta, cualquier pendiente, dependiente
  // observado sin empate (OBSERVED_ONLY/DIVERGE), o MODELO EN CONFLICTO
  // (modelo_mismatch) → requiereRevision (bloquea Aplicar).
  const depGate = dependientesConciliados.some((d) => d.estado === 'OBSERVED_ONLY' || d.estado === 'DIVERGE' || d.modelo_mismatch === true);
  const requiereRevision = hayAnclaNoResuelta || pendientes.length > 0 || depGate;
  // R14-3: sillería con modelo SIN confirmar NO bloquea aplicar las ANCLAS, pero el
  // PROGRAMA NO está COMPLETO hasta que el usuario confirme/elija el modelo.
  const requiereConfirmacionSillas = (fisico.recomendaciones || []).some((r) => r.requiere_confirmacion_modelo === true)
    || dependientesConciliados.some((d) => d.requiere_confirmacion_modelo === true);
  const programaCompleto = !requiereRevision && !requiereConfirmacionSillas;
  // R11-4: el flag viaja DENTRO de la propuesta para que el gate de dominio pueda
  // rechazarla aunque un caller sólo pase `propuesta` (no sólo el botón disabled).
  propuesta.requiereRevision = requiereRevision;
  propuesta.requiereConfirmacionSillas = requiereConfirmacionSillas;
  propuesta.programaCompleto = programaCompleto;
  return {
    gobernadoPorObservado: true,
    observadoPendientes: pendientes,
    anclasObservadas, dependientesObservados,
    propuesta, preview, recomendaciones: fisico.recomendaciones,
    incompletos: fisico.incompletos, cotizable: propuesta.cotizable,
    anclasConciliadas, dependientesConciliados,
    requiereRevision, requiereConfirmacionSillas, programaCompleto,
  };
}

/** ¿Esta propuesta está BLOQUEADA para aplicar? (gate de dominio, R11-4) */
export function propuestaBloqueada(propuesta) {
  if (!propuesta) return true;
  if (propuesta.requiereRevision === true) return true;
  if (Array.isArray(propuesta.incompletos) && propuesta.incompletos.length > 0) return true;
  // P1-R12: ninguna partida con producto sin resolver o SIN identidad (producto_id)
  // se aplica — blinda el gate aunque el flujo cambie.
  if (Array.isArray(propuesta.partidas) && propuesta.partidas.some((p) => p && (p.product_status === 'NEEDS_CONFIRMATION' || p.identity_status === 'MISSING'))) return true;
  return false;
}

/**
 * APLICA la propuesta: CONFIRMA (acto explícito) y produce partidas comerciales.
 * Para PREVIEW/reconciliación se reutiliza libremente; el GATE de aplicación real
 * (R11-4) lo aplica el único punto de acción de usuario (App.aplicarProgramaDetectado)
 * vía `propuestaBloqueada`, y `aplicarProgramaSeguro` para callers de dominio.
 */
export function aplicarPrograma(propuesta, { existentes = [] } = {}) {
  const confirmacion = confirmarPrograma(propuesta, { existentes });
  return {
    confirmacion,
    partidas: partidasParaAcomodo(confirmacion),
    conflictos: confirmacion.conflictos,
    ok: confirmacion.conflictos.length === 0,
  };
}

/**
 * APLICACIÓN SEGURA (gate de dominio, R11-4): rechaza una propuesta bajo revisión
 * aunque un caller se equivoque y la pase. Es la que deben usar las ACCIONES de
 * usuario (no el preview). Devuelve {ok:false, bloqueada:true} si está bajo revisión.
 */
export function aplicarProgramaSeguro(propuesta, { existentes = [] } = {}) {
  if (propuestaBloqueada(propuesta)) {
    return { confirmacion: { items: [], conflictos: [] }, partidas: [], conflictos: [], ok: false, bloqueada: true, motivo: 'PROPUESTA_REQUIERE_REVISION' };
  }
  return aplicarPrograma(propuesta, { existentes });
}

/**
 * P1-R15-I: DECISIÓN ATÓMICA DE APLICACIÓN — autoridad ÚNICA.
 * Dada una propuesta y las partidas EXISTENTES que se pasen (el `prev` fresco en el
 * punto atómico, NO un snapshot anterior), devuelve exactamente lo que se escribiría y
 * si hay commit. El flag `committed` es la verdad: false cuando la propuesta está
 * bloqueada, cuando la reconciliación arroja conflictos, o cuando es idempotente
 * (nada nuevo ni enriquecido). El resultado que reporta el caller DEBE derivarse de
 * esta función con las MISMAS `existentes` que usa el write — así el return refleja el
 * commit y no un snapshot que puede mentir bajo carrera (dos aplicaciones antes del
 * rerender: la segunda recibe `existentes` ya actualizadas → committed=false).
 * @returns {{committed:boolean, motivo:string, confirmadas:number, conflictos:Array, nuevas:Array, enriquecidos:Array, partidas:Array}}
 */
export function resolverAplicacionAtomica(propuesta, { existentes = [] } = {}) {
  const base = Array.isArray(existentes) ? existentes : [];
  if (!propuesta) {
    return { committed: false, motivo: 'SIN_PROPUESTA', confirmadas: 0, conflictos: [], nuevas: [], enriquecidos: [], partidas: base };
  }
  if (propuestaBloqueada(propuesta)) {
    return { committed: false, motivo: 'PROPUESTA_REQUIERE_REVISION', confirmadas: 0, conflictos: [], nuevas: [], enriquecidos: [], partidas: base };
  }
  const aplicado = aplicarPrograma(propuesta, { existentes: base });
  if ((aplicado.conflictos || []).length > 0) {
    return { committed: false, motivo: 'CONFLICTO_RECONCILIACION', confirmadas: 0, conflictos: aplicado.conflictos, nuevas: [], enriquecidos: [], partidas: base };
  }
  const { confirmacion } = aplicado;
  const enriquecidos = confirmacion.enriquecidos || [];
  const porId = new Map(enriquecidos.map((e) => [String(e.id), e.patch]));
  const patched = base.map((p) => {
    const patch = porId.get(String(p.id));
    return patch ? { ...p, ...patch } : p;      // sólo metadata estructural
  });
  const nuevas = (confirmacion.confirmadas || []).map(partidaComercialDesdeConfirmado);
  if (!nuevas.length && !enriquecidos.length) {
    return { committed: false, motivo: 'IDEMPOTENTE', confirmadas: 0, conflictos: [], nuevas: [], enriquecidos: [], partidas: base };
  }
  return { committed: true, motivo: 'OK', confirmadas: nuevas.length, conflictos: [], nuevas, enriquecidos, partidas: [...patched, ...nuevas] };
}

/**
 * Conveniencia proponer+aplicar en un paso. SÓLO para la acción de APLICAR
 * (p.ej. pruebas o un flujo que ya confirmó); el camino de LECTURA del plano usa
 * proponerProgramaDelPlano (que NO confirma).
 */
export function resolverYConfirmar(programa, { linea = 'App LT', existentes = [] } = {}) {
  const { propuesta } = proponerPrograma(programa, { linea });
  const aplicado = aplicarPrograma(propuesta, { existentes });
  return {
    programa,
    propuesta,
    confirmacion: aplicado.confirmacion,
    partidas: aplicado.partidas,
    incompletos: propuesta.incompletos,
    conflictos: aplicado.conflictos,
    ok: propuesta.ok && aplicado.ok,
  };
}
