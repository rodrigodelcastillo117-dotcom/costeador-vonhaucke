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
import { buscarEnColeccion, medidasAwd, asientoPara, OPERATIVOS, ESCRITORIOS, JUNTAS, RECEPCIONES } from './catalogoCanonico.js';

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
      dependientesObservados.push({ dependent_role: cls.dependent_role, quantity: q, zone: norm.zone || null, source_ref: norm.source_ref || null, dimensions: norm.dimensions || null, evidence: norm.evidence || null });
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
      grouping: norm.grouping || null, position: norm.position || null, evidence: norm.evidence || null,
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

/**
 * RESUELVE cada ANCLA observada contra el CATÁLOGO por su IDENTIDAD FÍSICA
 * (rol + dimensiones + línea), ANTES de colapsar a capacidad (P0-R10-7). Cada
 * ancla física se resuelve INDEPENDIENTE (1:1, cardinalidad-aware — P0-R10-8):
 * no se reutiliza un mismo módulo elegido por capacidad para varias anclas.
 *  · RESOLVED            → existe un producto canónico con ESA geometría.
 *  · NEEDS_DIMENSIONS    → el ancla no trae dimensiones; no se puede verificar.
 *  · NEEDS_CONFIRMATION  → no hay equivalente canónico → REQUIERE_DESARROLLO
 *                          (NUNCA se sustituye un bench 2400×1400 por 4800×1200).
 * @returns {Array<{anchor_role, source_ref, zone, dimensions, estado, producto?, motivo?}>}
 */
export function conciliarAnclasObservadas(anclas = [], opts = {}) {
  const linea = opts.linea || 'App LT';
  return (Array.isArray(anclas) ? anclas : []).map((an) => {
    const coleccion = COLECCION_ANCLA[an.anchor_role];
    const dims = an.dimensions;
    const base = identidadAncla(an);
    if (!coleccion) return { ...base, estado: 'NEEDS_CONFIRMATION', motivo: 'Rol de ancla sin colección canónica.' };
    if (!dims || (dims.w == null && dims.d == null)) {
      return { ...base, estado: 'NEEDS_DIMENSIONS', motivo: 'Ancla observada sin dimensiones: no se puede verificar el producto canónico.' };
    }
    // Match por dimensiones EXACTAS (con y sin línea pedida). El catálogo decide;
    // si no existe, el llamador trata NEEDS_CONFIRMATION, nunca sustituye.
    let matches = buscarEnColeccion(coleccion, { line: linea, dimensions: dims });
    if (!matches.length) matches = buscarEnColeccion(coleccion, { dimensions: dims });
    if (matches.length) {
      const wd = medidasAwd(matches[0].medidas) || {};
      return { ...base, estado: 'RESOLVED', producto: matches[0].id, producto_obj: matches[0], w: wd.w ?? null, d: wd.d ?? null };
    }
    return {
      ...base,
      estado: 'NEEDS_CONFIRMATION',
      motivo: 'REQUIERE_DESARROLLO: ningún producto canónico equivale a la geometría observada (no se sustituye por capacidad).',
    };
  });
}

/**
 * RECONCILIA los DEPENDIENTES observados (sillas/guardas) contra los que generó
 * el resolver desde las anclas (P0-R9-9). NO suma unos sobre otros: compara para
 * detectar divergencias (faltan/sobran). Las sillas observadas confirman, no
 * duplican: por eso NO alimentan el programa; aquí sólo se verifica coherencia.
 */
export function conciliarDependientes(observados = [], preview = []) {
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
  const res = sumaPorRol((Array.isArray(preview) ? preview : []).filter((p) => !/^ANCHOR_/.test(p.relation_role || '')), 'relation_role', 'cantidad');
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
    return { dependent_role: rol, observados: o, resueltos: r, estado };
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

/**
 * IDENTITY-FIRST (ChatGPT R11-1/2): cada ANCLA FÍSICA observada genera DIRECTAMENTE
 * su ProductResolution canónica por DIMENSIONES (no por capacidad agregada). Un
 * observed quantity=N produce N instancias físicas (cardinalidad 1:1). Si no hay
 * equivalente canónico para esa geometría → incompletos (NEEDS_CONFIRMATION), NUNCA
 * se sustituye por un módulo de otra medida que cubra la misma capacidad.
 * @returns {{partidas:Array, incompletos:Array}}
 */
export function resolverFisicoDesdeObservado(anclas, { linea = 'App LT' } = {}) {
  const partidas = [];
  const incompletos = [];
  (Array.isArray(anclas) ? anclas : []).forEach((an, i) => {
    const map = ANCHOR_REL[an.anchor_role];
    const coleccion = COLECCION_ANCLA[an.anchor_role];
    if (!map || !coleccion) { incompletos.push({ reason: 'ANCHOR_ROLE_DESCONOCIDO', source_ref: an.source_ref || null, anchor_role: an.anchor_role }); return; }
    const dims = an.dimensions;
    if (!dims || (dims.w == null && dims.d == null)) { incompletos.push({ reason: 'NEEDS_DIMENSIONS', source_ref: an.source_ref || null, anchor_role: an.anchor_role }); return; }
    let matches = buscarEnColeccion(coleccion, { line: linea, dimensions: dims });
    if (!matches.length) matches = buscarEnColeccion(coleccion, { dimensions: dims });
    if (!matches.length) { incompletos.push({ reason: 'REQUIERE_DESARROLLO', source_ref: an.source_ref || null, anchor_role: an.anchor_role, dimensions: dims }); return; }
    const prod = matches[0];
    const q = Number(an.quantity) > 0 ? Math.floor(Number(an.quantity)) : 1;
    const req_id = requirementId(an.zone || null, map.rol, i);
    const seatsPorUnidad = Number(an.capacity_per_unit) > 0 ? Math.round(Number(an.capacity_per_unit)) : 0;
    for (let k = 0; k < q; k++) {   // CARDINALIDAD 1:1: una instancia física por observada
      const res = construirResolucion(prod, {
        requirement_id: req_id, zone_id: an.zone || null, evidence: an.evidence || null,
        rol: map.rol, relation_role: map.rel,
        functional_group_id: groupId(req_id, k), instance_id: instanceId(req_id, k),
        cantidad: 1, inclusion: 'anchor',
      });
      if (res) { res.observed_source_ref = an.source_ref || null; partidas.push(res); }
      // Dependientes OBLIGATORIOS por regla (asiento), con identidad real de catálogo.
      if (map.seat && seatsPorUnidad > 0) {
        const silla = asientoPara(map.seat);
        for (let s = 0; s < seatsPorUnidad && silla; s++) {
          const dep = construirResolucion(silla, {
            requirement_id: req_id, zone_id: an.zone || null, rol: 'silla', relation_role: map.seat,
            anchor_role: map.rel, functional_group_id: groupId(req_id, k), instance_id: instanceId(req_id, `${map.seat}:${k}:${s}`),
            anchor_instance_id: instanceId(req_id, k), cantidad: 1, inclusion: 'mandatory_by_rule',
          });
          if (dep) partidas.push(dep);
        }
      }
    }
  });
  return { partidas, incompletos };
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
  const propuesta = { partidas: fisico.partidas, pendientes: fisico.incompletos, incompletos: fisico.incompletos, cotizable: fisico.incompletos.length === 0 };
  const preview = partidasPropuestas(propuesta);
  const dependientesConciliados = conciliarDependientes(dependientesObservados, preview);
  // GATE (R11-3): ancla no resuelta, cualquier pendiente, o dependiente observado
  // sin empate (OBSERVED_ONLY/DIVERGE) → requiereRevision (bloquea Aplicar).
  const depGate = dependientesConciliados.some((d) => d.estado === 'OBSERVED_ONLY' || d.estado === 'DIVERGE');
  const requiereRevision = hayAnclaNoResuelta || pendientes.length > 0 || depGate;
  // R11-4: el flag viaja DENTRO de la propuesta para que el gate de dominio pueda
  // rechazarla aunque un caller sólo pase `propuesta` (no sólo el botón disabled).
  propuesta.requiereRevision = requiereRevision;
  return {
    gobernadoPorObservado: true,
    observadoPendientes: pendientes,
    anclasObservadas, dependientesObservados,
    propuesta, preview, incompletos: fisico.incompletos, cotizable: propuesta.cotizable,
    anclasConciliadas, dependientesConciliados,
    requiereRevision,
  };
}

/** ¿Esta propuesta está BLOQUEADA para aplicar? (gate de dominio, R11-4) */
export function propuestaBloqueada(propuesta) {
  if (!propuesta) return true;
  if (propuesta.requiereRevision === true) return true;
  if (Array.isArray(propuesta.incompletos) && propuesta.incompletos.length > 0) return true;
  if (Array.isArray(propuesta.partidas) && propuesta.partidas.some((p) => p && p.product_status === 'NEEDS_CONFIRMATION')) return true;
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
