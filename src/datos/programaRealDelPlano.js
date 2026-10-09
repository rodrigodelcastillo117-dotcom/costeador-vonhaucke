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
import { resolverPrograma } from './resolverPrograma.js';
import { confirmarPrograma } from './confirmarPrograma.js';
import { validarObservedProgram, ORIGEN } from './observedProgram.js';
import { clasificarMueble, CLASE, ANCHOR_ROLE } from './mobiliarioOntologia.js';

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
  const { items } = validarObservedProgram(Array.isArray(observedProgram) ? observedProgram : []);
  const entrada = { operativos: 0, privados: 0, salas: [], recepcion: false };
  const pendientes = [];
  const anclasObservadas = [];        // identidad física preservada (P0-R9-8)
  const dependientesObservados = [];  // sillas/guardas: reconcilian, no gobiernan (P0-R9-9)
  let gobernables = 0;
  for (const it of items) {
    const cls = clasificarMueble(it);
    const real = it.origin === ORIGEN.OBSERVED && (it.issues?.length ?? 0) === 0;
    const etiqueta = it.type || it.role || null;
    if (!real) { pendientes.push({ code: 'REQUIERE_CONFIRMACION', clase: cls.clase, type: etiqueta, origin: it.origin }); continue; }

    const q = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
    const capTotal = Number(it.capacity_total) > 0 ? Number(it.capacity_total) : 0;
    const capPer = Number(it.capacity_per_unit) > 0 ? Number(it.capacity_per_unit)
      : (capTotal > 0 && q > 0 ? capTotal / q : 0);

    if (cls.clase === CLASE.DEPENDENT) {
      // Una silla/guarda observada NO crea ancla: se usa para reconciliar.
      dependientesObservados.push({ dependent_role: cls.dependent_role, quantity: q, zone: it.zone || null, source_ref: it.source_ref || null, dimensions: it.dimensions || null, evidence: it.evidence || null });
      continue;
    }
    if (cls.clase === CLASE.AMENITY) { pendientes.push({ code: 'AMENITY_SIN_VOCABULARIO', type: etiqueta, origin: it.origin }); continue; }
    if (cls.clase !== CLASE.ANCHOR) { pendientes.push({ code: 'ROLE_NO_MAPEADO', type: etiqueta, origin: it.origin }); continue; }

    // ANCLA: gobierna el programa + conserva su identidad física íntegra.
    gobernables++;
    anclasObservadas.push({
      anchor_role: cls.anchor_role, type: it.type || null, role: it.role || null,
      quantity: q, capacity_per_unit: capPer || null, capacity_total: capTotal || (capPer ? capPer * q : null),
      dimensions: it.dimensions || null, zone: it.zone || null,
      source_ref: it.source_ref || null, plan_tag: it.plan_tag || null,
      grouping: it.grouping || null, position: it.position || null, evidence: it.evidence || null,
    });
    if (cls.anchor_role === ANCHOR_ROLE.WORKSTATION) entrada.operativos += (capTotal > 0 ? capTotal : q);  // PUESTOS
    else if (cls.anchor_role === ANCHOR_ROLE.DESK_PRIVATE) entrada.privados += q;
    else if (cls.anchor_role === ANCHOR_ROLE.MEETING) { for (let k = 0; k < q; k++) entrada.salas.push(capPer || 0); }  // POR UNIDAD (P0-R9-7)
    else if (cls.anchor_role === ANCHOR_ROLE.RECEPTION) entrada.recepcion = true;
  }
  return { entrada, pendientes, gobernables, anclasObservadas, dependientesObservados };
}

// Mapea el anchor_role de la ONTOLOGÍA (observado) al relation_role que emite el
// ProductResolver en el preview, para poder cruzar observado vs resuelto.
const ANCHOR_A_RELATION = Object.freeze({
  [ANCHOR_ROLE.WORKSTATION]: 'ANCHOR_WORKSTATION',
  [ANCHOR_ROLE.DESK_PRIVATE]: 'ANCHOR_DESK',
  [ANCHOR_ROLE.MEETING]: 'ANCHOR_MEETING',
  [ANCHOR_ROLE.RECEPTION]: 'ANCHOR_RECEPTION',
});

// ¿La geometría observada equivale a la del producto resuelto? Compara el par
// (w,d) sin importar orientación, con tolerancia relativa + absoluta.
function dimsEquivalentes(a, b, tolRel = 0.06, tolAbs = 60) {
  if (!a || !b) return false;
  const close = (x, y) => x != null && y != null && Math.abs(Number(x) - Number(y)) <= Math.max(tolAbs, Math.max(Number(x), Number(y)) * tolRel);
  return (close(a.w, b.w) && close(a.d, b.d)) || (close(a.w, b.d) && close(a.d, b.w));
}

function identidadAncla(an) {
  return { anchor_role: an.anchor_role, source_ref: an.source_ref || null, zone: an.zone || null, dimensions: an.dimensions || null, quantity: an.quantity, capacity_total: an.capacity_total ?? null };
}

/**
 * RECONCILIA cada ANCLA observada (con sus dimensiones) contra el producto que
 * el resolver eligió por capacidad (P0-R9-8). Si la geometría NO coincide, el
 * ancla queda NEEDS_CONFIRMATION (REQUIERE_DESARROLLO): NUNCA se sustituye en
 * silencio un bench 2400×1400 por un módulo 4800×1200 sólo porque cubre 8 puestos.
 * @returns {Array<{anchor_role, source_ref, zone, dimensions, estado, producto?, motivo?}>}
 */
export function conciliarAnclasObservadas(anclas = [], preview = [], _opts = {}) {
  const anchorsPreview = (Array.isArray(preview) ? preview : []).filter((p) => /^ANCHOR_/.test(p.relation_role || ''));
  return (Array.isArray(anclas) ? anclas : []).map((an) => {
    const rel = ANCHOR_A_RELATION[an.anchor_role] || null;
    const candidatos = anchorsPreview.filter((p) => p.relation_role === rel);
    const sinDims = !an.dimensions || (an.dimensions.w == null && an.dimensions.d == null);
    if (sinDims) {
      return { ...identidadAncla(an), estado: 'NEEDS_DIMENSIONS', motivo: 'Ancla observada sin dimensiones: no se puede verificar el producto canónico.' };
    }
    const match = candidatos.find((p) => dimsEquivalentes(an.dimensions, { w: p.w, d: p.d }));
    if (match) return { ...identidadAncla(an), estado: 'RESOLVED', producto: match.bancoId || match.piezaId || null, w: match.w, d: match.d };
    return {
      ...identidadAncla(an),
      estado: 'NEEDS_CONFIRMATION',
      motivo: 'REQUIERE_DESARROLLO: ningún producto canónico equivale a la geometría observada (no se sustituye por capacidad).',
      candidatos_por_capacidad: candidatos.map((c) => ({ producto: c.bancoId || c.piezaId || null, w: c.w ?? null, d: c.d ?? null })),
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
  return [...roles].sort().map((rol) => ({
    dependent_role: rol,
    observados: obs[rol] || 0,
    resueltos: res[rol] || 0,
    estado: (obs[rol] || 0) === (res[rol] || 0) ? 'MATCH' : 'DIVERGE',
  }));
}

/**
 * PROPONE desde el observed_program (lo observado GOBIERNA). NO confirma.
 * Devuelve null si nada observado es gobernable (→ el caller cae a la
 * heurística de áreas). Mantiene PROPUESTA ≠ CONFIRMACIÓN.
 */
export function proponerProgramaDesdeObservado(observedProgram, { linea = 'App LT', brief = null } = {}) {
  const red = programRequirementsDesdeObservado(observedProgram);
  const { entrada, pendientes, gobernables, anclasObservadas, dependientesObservados } = red;
  if (gobernables === 0) return null;
  const salas = entrada.salas.filter((n) => Number(n) > 0);
  const entradaPrograma = {
    operativos: entrada.operativos,
    privados: entrada.privados,
    salas,
    recepcion: entrada.recepcion,
    brief: { ...(brief || {}) },
  };
  const base = { gobernadoPorObservado: true, observadoPendientes: pendientes, anclasObservadas, dependientesObservados, ...proponerPrograma(entradaPrograma, { linea }) };
  // P0-R9-8/R9-9: contrasta las ANCLAS observadas (con sus dimensiones) contra el
  // producto que eligió el resolver por capacidad; si no coincide la geometría,
  // marca NEEDS_CONFIRMATION en vez de sustituir en silencio.
  base.anclasConciliadas = conciliarAnclasObservadas(anclasObservadas, base.preview, { linea });
  base.dependientesConciliados = conciliarDependientes(dependientesObservados, base.preview);
  return base;
}

/** APLICA la propuesta: CONFIRMA (acto explícito) y produce partidas comerciales. */
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
