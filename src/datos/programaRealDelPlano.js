// ============================================================================
//  programaRealDelPlano · EL CABLE COMPLETO de P0.1 (FloorSpec → Acomodo).
//
//  Une la cadena que el mandato exige, sin inventar nada en el camino:
//    programaDelPlano(areas)            → programa { operativos, privados, salas[], recepcion }
//    resolverPrograma(programa)         → PROPUESTA de productos REALES
//    confirmarPrograma(propuesta)       → PARTIDAS CONFIRMADAS (idempotente)
//    partidasParaAcomodo(confirmacion)  → partidas con nombre semántico que
//                                          validarCoherenciaPrograma reconoce
//
//  Acomodo recibe ÚNICAMENTE partidas reales confirmadas (bancoId + identidad +
//  precio snapshot). JAMÁS `sug-*`, jamás geometría fantasma: la geometría es la
//  del catálogo (w/d reales). Las heurísticas visuales (ceil(n/2)*1500) quedan
//  como estimación NO autoritativa y nunca entran aquí.
// ============================================================================
import { programaDelPlano } from './programaDelPlano.js';
import { resolverPrograma } from './resolverPrograma.js';
import { confirmarPrograma } from './confirmarPrograma.js';

// Nombre que describe el ROL real en palabras que validarCoherenciaPrograma y el
// ruteo de destinoAcomodo entienden (no cambia el producto, sólo lo etiqueta).
function nombreSemantico(it) {
  const base = it.nombre || it.bancoId;
  switch (it.relation_role) {
    case 'WORK_SEAT':         return `Silla operativa · ${base}`;
    case 'EXECUTIVE_SEAT':    return `Silla directiva · ${base}`;
    case 'MEETING_SEAT':      return `Silla de juntas · ${base}`;
    case 'VISITOR_SEAT':      return `Silla de visita · ${base}`;
    case 'UNDERDESK_STORAGE':
    case 'SUPPORT_STORAGE':   return `Gaveta/pedestal · ${base}`;
    default: break;
  }
  switch (it.anchor_role) {
    case 'ANCHOR_WORKSTATION': return `Bench operativo · ${base}`;
    case 'ANCHOR_DESK':        return `Escritorio privado dirección · ${base}`;
    case 'ANCHOR_MEETING':     return `Mesa de juntas · ${base}`;
    case 'ANCHOR_RECEPTION':   return `Recepción · ${base}`;
    default:                   return base;
  }
}

/** Convierte las partidas confirmadas en partidas listas para Acomodo/costeo. */
export function partidasParaAcomodo(confirmacion) {
  const items = (confirmacion && Array.isArray(confirmacion.items)) ? confirmacion.items : [];
  return items.map((it) => ({
    id: it.id,                                   // clave estable de confirmación
    piezaId: it.bancoId,
    bancoId: it.bancoId,
    source_ref: it.source_ref,
    nombre: nombreSemantico(it),
    cantidad: it.cantidad,
    w: it.w,
    d: it.d,
    usuarios: it.usuarios,
    linea: it.linea,
    // roles / enlaces para el acomodo
    anchor_role: it.anchor_role,
    relation_role: it.relation_role,
    anchor_ref: it.anchor_ref,
    functional_group_id: it.functional_group_id,
    // identidad + precio (compuertas 2 y 3)
    productoId: it.productoId,
    producto_version_id: it.producto_version_id,
    lista_precio_item_id: it.lista_precio_item_id,
    precio_lista_snapshot: it.precio_lista_snapshot,
    autoridad: it.autoridad,
    source: 'CONFIRMADO_PROGRAMA',               // nunca sug-*
  }));
}

/**
 * Resuelve + confirma un programa ya contado. Pura y testeable.
 * @param {object} programa  { operativos, privados, salas:[], recepcion }
 * @param {object} opts  { linea (preferred_line), existentes, operativosConGuardas }
 */
export function resolverYConfirmar(programa, { linea = 'App LT', existentes = [], operativosConGuardas = true } = {}) {
  const propuesta = resolverPrograma(programa, { linea, operativosConGuardas });
  const confirmacion = confirmarPrograma(propuesta, { existentes });
  const partidas = partidasParaAcomodo(confirmacion);
  return {
    programa,
    propuesta,
    confirmacion,
    partidas,
    incompletos: propuesta.incompletos,
    conflictos: confirmacion.conflictos,
    ok: propuesta.ok && confirmacion.conflictos.length === 0,
  };
}

/**
 * Cadena completa desde las áreas del plano (FloorSpec). Cuenta el programa con
 * programaDelPlano y lo resuelve/confirma. Devuelve también `programa` para que
 * la UI muestre lo detectado antes de que el usuario pulse "Aplicar programa".
 */
export function programaRealDelPlano(areas, { linea = 'App LT', existentes = [], operativosConGuardas = true } = {}) {
  const programa = programaDelPlano(areas);
  const salas = Array.isArray(programa.salas) ? programa.salas.filter((n) => Number(n) > 0) : [];
  const entrada = {
    operativos: Number(programa.operativos) || 0,
    privados: Number(programa.privados) || 0,
    salas,
    recepcion: !!programa.recepcion,
  };
  return { programaDetectado: programa, ...resolverYConfirmar(entrada, { linea, existentes, operativosConGuardas }) };
}
