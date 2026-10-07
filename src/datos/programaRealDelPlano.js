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
