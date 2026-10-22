// ============================================================================
//  estadoHumano — traduce estados/códigos internos a LENGUAJE HUMANO.
//
//  REGLA ABSOLUTA (pase UX "simple afuera, riguroso adentro"):
//  esto NO cambia lógica. Los enums, gates y códigos siguen EXACTAMENTE igual en
//  el motor, el servidor y el PDF. Lo único que cambia es cómo se le PRESENTA al
//  usuario: una frase en español + un color. El gate de verdad sigue siendo
//  server-side; este módulo sólo decide el texto y el semáforo del chip/banner.
//
//  Fuente de verdad: UX_LANGUAGE_MAP.md (147 estados · 18 verde / 103 amarillo /
//  26 rojo). Semántica del color:
//    - verde    = todo listo, se puede avanzar/emitir.
//    - amarillo = puedes continuar, pero revisa. NUNCA se siente como error.
//    - rojo     = no es seguro continuar (sólo lo que de verdad debe bloquear).
//
//  Puro y testeable: estadoHumano(codigo, {ambito}) no toca globals.
// ============================================================================

export const COLOR = Object.freeze({ VERDE: 'verde', AMARILLO: 'amarillo', ROJO: 'rojo' });

// Atajos para las entradas de la tabla.
const V = (frase) => ({ frase, color: COLOR.VERDE, continuar: true });
const A = (frase) => ({ frase, color: COLOR.AMARILLO, continuar: true });
const R = (frase) => ({ frase, color: COLOR.ROJO, continuar: false });

// --- A. Emisión / Cotización (gate server-side; sólo se humaniza el chip) ---
const EMISION = {
  ALLOWED: V('Lista para emitir.'),
  DESCONOCIDO: A('No se pudo consultar al servidor; se vuelve a verificar al emitir.'),
  ECONOMICS_INCOMPLETE: A('Falta confirmar un costo antes de emitir esta propuesta (no es un error).'),
  APPROVAL_REQUIRED: A('Requiere aprobación de Dirección antes de emitir.'),
  BLOCKED: R('Todavía no se puede emitir; resuelve lo señalado.'),
  costo_productversion_desconocido: A('Este producto no tiene costo industrial oficial; Dirección lo carga. Queda como borrador mientras tanto.'),
  costo_preliminar: A('Su costo es preliminar: falta certificar precios/evidencias antes de emitir.'),
  costo_no_certificado: A('Su costo es preliminar: falta certificar precios/evidencias antes de emitir.'),
  costo_preliminar_no_certificado: A('Su costo es preliminar: falta certificar precios/evidencias antes de emitir.'),
  sin_material: A('Tiene piezas sin material asignado; asígnalo.'),
  sin_product_id: A('Vuelve a agregarla desde su ficha (le falta identidad de producto).'),
  sin_product_version_id: A('Vuelve a agregarla desde su ficha (le falta identidad de producto).'),
  producto_version_id_invalido: A('Vuelve a agregarla desde su ficha (le falta identidad de producto).'),
  product_version_no_corresponde: A('Vuelve a agregarla desde su ficha (le falta identidad de producto).'),
  producto_id_invalido: A('Vuelve a agregarla desde su ficha (le falta identidad de producto).'),
  producto_no_registrado: A('Vuelve a agregarla desde su ficha (le falta identidad de producto).'),
  ingenieria_preliminar: A('El especial todavía no tiene ingeniería aprobada.'),
  costo_especial_no_certificado: A('Falta confirmar el costo del especial con Diseño/Dirección.'),
  costo_especial_desconocido: A('Falta confirmar el costo del especial con Diseño/Dirección.'),
  especial_sin_costo: A('Falta confirmar el costo del especial con Diseño/Dirección.'),
  precio_especial_no_autoritativo: R('El precio no coincide con el autorizado para el especial; vuelve a cotizarla.'),
  descuento_invalido: R('El descuento no es válido (debe ir de 0 a 100 %).'),
  piezas_excluidas_sin_confirmar: A('Confirma las piezas que NO se cotizan antes de emitir.'),
  sin_partidas: A('La cotización todavía no tiene partidas; agrega muebles.'),
  snapshot_sin_partidas: A('La cotización todavía no tiene partidas; agrega muebles.'),
  no_existe: A('La cotización no está guardada en la nube; guárdala de nuevo.'),
  cotizacion_no_existe: A('La cotización no está guardada en la nube; guárdala de nuevo.'),
  precio_bajo_costo: A('Este precio queda bajo el mínimo rentable: requiere aprobación de Dirección.'),
  margen_bajo: A('Este precio queda bajo el mínimo rentable: requiere aprobación de Dirección.'),
  no_corresponde_a_lo_costeado: R('Este renglón ya no es el que se costeó (cambió el mueble, medidas, material o cantidad); guárdalo y, si cambió el mueble, pide recosteo.'),
  identidad_no_coincide: A('Cambió respecto a lo guardado; guárdala de nuevo.'),
  sin_correspondencia: A('Cambió respecto a lo guardado; guárdala de nuevo.'),
  cantidad_invalida: R('Falta una cantidad válida en esta partida.'),
  precio_invalido: R('Falta un precio válido en esta partida.'),
  partidas_no_corresponden: A('Guarda la cotización antes de emitir.'),
  politica_comercial_sin_margen_minimo: A('Falta configurar la política comercial (margen mínimo); avisa a Dirección.'),
  aprobacion_requerida: A('Este contenido requiere aprobación de Dirección.'),
  sin_permiso: R('No tienes permiso para emitir esta cotización.'),
  no_autorizado: R('No tienes permiso para emitir esta cotización.'),
  sin_guardar: A('Guarda la cotización primero.'),
};

// --- B. Acomodo / Planos ---
const ACOMODO = {
  LAYOUT_VALID: V('Acomodo validado: todo cabe.'),
  LAYOUT_INCOMPLETE: A('El acomodo todavía no cabe completo; sigue ajustándolo.'),
  PROGRAM_INCOMPLETE: A('Falta completar el programa antes de acomodar.'),
  STALE_PROGRAM: A('El programa cambió; vuelve a acomodar para reflejarlo.'),
  PASS: V('Acomodo validado por el servidor.'),
  REVIEW_REQUIRED: A('Acomodo válido, con puntos por revisar.'),
  PARTIAL: A('Acomodo parcial: quedaron muebles sin colocar.'),
  FAIL: R('El motor no pudo colocar ningún mueble; acomódalo a mano o revisa el espacio.'),
  NEEDS_SEMANTIC_REVIEW: A('Geometría válida; falta revisar orientación y asientos de los kits.'),
  QUALITY_REVIEW_REQUIRED: A('Geometría y semántica válidas; revisa accesos y agrupación.'),
  NEEDS_REVIEW_METADATA: A('Geometría válida; faltan perfiles del catálogo para juzgar la semántica.'),
  NEEDS_REVIEW: A('Acomodo con observaciones por revisar.'),
  SIN_VALIDACION: A('El servidor no devolvió validación del acomodo.'),
  REVISION: A('Hay puntos por revisar antes de dar el acomodo por bueno.'),
  PARCIAL: A('Acomodo parcial: faltan piezas por colocar.'),
  FALLA: R('El acomodo tiene fallas físicas que impiden presentarlo.'),
  SIN_PLAN: A('Aún no hay acomodo; genera uno.'),
  OVERLAP: R('Dos muebles están encimados.'),
  BLOCKS_DOOR: R('Un mueble tapa una puerta.'),
  HITS_OBSTACLE: R('Un mueble choca con una columna u obstáculo.'),
  OUT_OF_BOUNDS: R('Un mueble se sale de su cuarto.'),
  OUTSIDE_AREA: R('Un mueble se sale de su cuarto.'),
  OUTSIDE_POLYGON: R('Un mueble se sale de su cuarto.'),
  AREA_INEXISTENTE: R('Un mueble apunta a un cuarto que no existe.'),
  INVALID_AREA: R('Un mueble apunta a un cuarto que no existe.'),
  GHOST_PLACEMENT: R('Hay un mueble colocado que no está en la lista.'),
  DUPLICATE_PLACEMENT: R('Un mueble quedó colocado dos veces.'),
  PLACEMENT_INVARIANT_BROKEN: R('Hay una inconsistencia interna en la colocación.'),
  DOOR_SWING_UNKNOWN: A('Falta confirmar hacia dónde abre una puerta.'),
  ANCHOR_WRONG_ZONE: A('Un mueble quedó en una zona que no le corresponde; reubícalo.'),
  DEPENDENT_WRONG_ZONE: A('Una silla o guarda quedó en un cuarto distinto al de su mueble.'),
  DEPENDENT_DETACHED: A('Esta silla quedó demasiado lejos de su mesa.'),
  DEPENDENT_UNASSIGNED: A('Una silla o guarda se quedó sin mueble que la reciba.'),
  FUNCTIONAL_GROUP_SPLIT: A('Un grupo de muebles quedó repartido en cuartos distintos.'),
  MISSING_GROUP_ANCHOR: A('Falta o está mal el mueble principal del grupo.'),
  WRONG_GROUP_ANCHOR: A('Falta o está mal el mueble principal del grupo.'),
  GROUP_CAPACITY_INCOMPLETE: A('Al grupo le faltan lugares para completar su capacidad.'),
  GROUP_ANCHOR_TOO_FAR: A('El mueble principal del grupo quedó demasiado lejos de los demás.'),
  NO_SPACE: A('No hay espacio para esta pieza en su zona.'),
  FUNCTIONAL_CLEARANCE: A('No queda el pasillo mínimo alrededor de la pieza.'),
  UNKNOWN_PIECE: A('Una pieza no se reconoce en el catálogo.'),
  INVALID_ROTATION: A('Una pieza quedó con un giro no válido.'),
  SEMANTIC_PROFILE_UNKNOWN: A('El catálogo no dice de qué lados se sienta la gente; se revisa a mano.'),
  SLOT_UNFILLED_REQUIRED: A('Un lugar quedó sin silla.'),
  DEPENDENT_WRONG_SLOT: A('Una silla quedó en un lugar que no corresponde a su mueble.'),
  KIT_FUNCTIONAL_RELATION_BROKEN: A('Una pieza no es del tipo que su mueble espera.'),
  ANCHOR_TOPOLOGY_BROKEN: A('Un mueble de dos caras quedó con sillas de un solo lado.'),
  SLOT_DOUBLE_OCCUPIED: A('Dos sillas quedaron en el mismo lugar.'),
  INVALID_FACING: A('Una silla quedó sin orientación conocida.'),
  DEPENDENT_WRONG_ORIENTATION: A('Una silla no mira hacia su mesa o escritorio.'),
  ACTIVE_SIDE_BLOCKED_BY_WALL: A('Una silla quedó pegada al muro: no hay espacio para sentarse.'),
  ACTIVE_SIDE_BLOCKED_BY_OBSTACLE: A('Una silla quedó bloqueada por una columna u obstáculo.'),
  ACTIVE_SIDE_ACCESS_TIGHT: A('Una silla quedó con el acceso muy justo.'),
  DUPLICATED_REQUIREMENT: A('Hay dos muebles para el mismo lugar; conserva uno.'),
  MISSING_ANCHOR: A('Esta silla o guarda no tiene escritorio/mesa que la reciba.'),
  UNKNOWN_FOOTPRINT: A('La medida es supuesta por tipo; captura ancho × fondo reales.'),
  UNRESOLVED_PRODUCT: A('Pieza sin identidad de catálogo; elige el producto real o pide desarrollo.'),
  COLLISION: A('No se colocó porque se encima con otro mueble.'),
  CLEARANCE: A('No se colocó porque no conserva el pasillo mínimo.'),
  BLOCKED_DOOR: A('No se colocó porque bloquearía una puerta.'),
  INCOMPATIBLE_ZONE: A('La zona asignada no admite este mueble.'),
  DEPENDENCY_MISMATCH: A('Su mueble receptor no quedó colocado; resuelve primero el mueble.'),
  SEAT_NO_ACCESS: A('El mueble sí cupo, pero la silla no tiene los 600 mm para retirarla.'),
  SIN_DIAGNOSTICO: A('El servidor no explicó esta pieza; vuelve a acomodar.'),
};

// --- C. Costeo (clasificación de material) ---
const MATERIAL = {
  EXACT: V('Material exacto confirmado.'),
  EQUIVALENT_APPROVED: V('Equivalente ya aprobado de fábrica.'),
  USER_CONFIRMED: V('Material confirmado por ti.'),
  LEGACY_SELECTED: V('Material seleccionado (histórico): costea y emite.'),
  SAME_FAMILY_COMPATIBLE_PROPOSED: A('Material de la misma familia, propuesto por Voni: confírmalo antes de emitir.'),
  SAME_FAMILY_CRITICAL_CONFLICT: A('Cambia un dato crítico (calibre, perfil o espesor); no se cobra solo, confírmalo.'),
  CANDIDATE_REQUIRES_CONFIRMATION: A('Hay un candidato de material; confírmalo para costear.'),
  AMBIGUOUS: A('Varios materiales posibles por igual; elige cuál.'),
  SUBSTITUTE_REQUIRES_CONFIRMATION: A('Se propone un sustituto; confírmalo.'),
  NOT_AVAILABLE: A('No hay material disponible para esta pieza; pide una alternativa o su desarrollo.'),
};

// --- D. Procedencia / Confianza ---
const PROCEDENCIA = {
  CONFIRMADO: V('Confirmado: producto de catálogo con precio autorizado.'),
  INFERIDO: A('Inferido del texto con base razonable; conviene confirmarlo.'),
  SUPUESTO: A('Estimación por modelo: valida producto y precio.'),
  SUGERIDO: A('Voni lo propuso como acompañante; quítalo si no va.'),
  REQUIERE_DESARROLLO: R('Producto sin identidad ni precio autorizado; Diseño debe desarrollarlo (no se inventa SKU).'),
};

// --- E. Render ---
const RENDER = {
  VIGENTE: V('Render vigente de esta versión.'),
  PENDIENTE_VALIDACION: A('Render pendiente de validar.'),
  STALE: A('Render histórico: ya no corresponde a esta versión; regenéralo.'),
  SIN_RENDER_VALIDO: A('No hay render de esta versión; genera uno.'),
  SIN_VERSION: A('Sin versión canónica: no aplica el render oficial.'),
  PRELIMINAR: A('Acomodo en borrador: hay medidas o precios por confirmar.'),
};

// --- F. Comercial / Proyecto ---
const COMERCIAL = {
  GANADA: { frase: 'Proyecto ganado.', color: COLOR.VERDE, continuar: true },
  PERDIDA: { frase: 'Proyecto perdido.', color: COLOR.ROJO, continuar: false },
  CANCELADA: { frase: 'Proyecto cancelado.', color: COLOR.ROJO, continuar: false },
  SUSPENDIDA: { frase: 'Proyecto suspendido.', color: COLOR.ROJO, continuar: false },
  SIN_PROXIMA_ACCION: A('Este proyecto no tiene una próxima acción definida.'),
  ACCION_VENCE_HOY: A('Una acción de este proyecto vence hoy.'),
  APROBACION_PENDIENTE: A('Hay una aprobación pendiente en esta cotización.'),
  COTIZACION_BLOQUEADA: A('Esta cotización no puede emitirse todavía por datos faltantes; resuélvelos.'),
  PRODUCTO_SIN_PRECIO: A('Esta cotización tiene productos sin precio autorizado.'),
  INCONSISTENCIA_ALCANCE: A('El alcance requerido no coincide con lo cotizado/acomodado; revísalo.'),
  EVALUADO: V('Comparación de presupuesto lista.'),
  NO_EVALUABLE: A('Aún no hay presupuesto objetivo para comparar; captúralo en el proyecto.'),
  PRESUPUESTO_DESCONOCIDO: A('Aún no hay presupuesto objetivo para comparar; captúralo en el proyecto.'),
  TOTAL_DESCONOCIDO: A('Aún no hay un total de propuesta para comparar.'),
};

// Estados de APROBACIÓN (ámbito propio: colisionan de nombre con render/acomodo).
const APROBACION = {
  PENDIENTE: A('Aprobación pendiente de Dirección.'),
  APROBADA: V('Aprobación otorgada.'),
  RECHAZADA: R('Aprobación rechazada; no se emite con este descuento/precio.'),
  CONTRAOFERTA: A('Dirección propuso una contraoferta; revísala.'),
};

// Lectura de plano y confianza: por nivel (ámbito explícito).
const LECTURA = {
  alta: V('Lectura del plano confiable.'),
  media: A('Lectura con dudas: revísala antes de usarla.'),
  baja: A('Lectura poco confiable: revísala con cuidado.'),
  nula: R('No reconocí cuartos en el plano; dibújalo o vuelve a subirlo.'),
};
const CONFIANZA = {
  alta: V('Interpretación confiable.'),
  media: A('Confianza media: revísala.'),
  baja: A('Confianza baja: valídala.'),
};

// Orden de búsqueda global (para cuando no se pasa ámbito). Los ámbitos con
// nombres únicos primero; APROBACION al final porque sus claves (PENDIENTE…)
// colisionan y sólo deben ganar con ámbito explícito.
const AMBITOS = { emision: EMISION, acomodo: ACOMODO, material: MATERIAL, procedencia: PROCEDENCIA, render: RENDER, comercial: COMERCIAL, aprobacion: APROBACION, lectura: LECTURA, confianza: CONFIANZA };
const ORDEN_GLOBAL = [EMISION, ACOMODO, MATERIAL, PROCEDENCIA, RENDER, COMERCIAL];

// Prefijos para familias de códigos con sufijo variable (p. ej. recosteo_pendiente_producto).
const PREFIJOS = [
  { re: /^recosteo_pendiente(_|$)/i, ...R('Esta pieza cambió después de costearse: su costo anterior ya no vale y Dirección debe recostearla.') },
  { re: /^linea_\d+_costo_desconocido$/i, ...A('Falta confirmar el costo con Diseño/Dirección.') },
  { re: /^especial_/i, ...A('El especial aún no está listo para cotizarse.') },
];

const DESCONOCIDO_SEGURO = Object.freeze({ frase: 'Hay algo por revisar.', color: COLOR.AMARILLO, continuar: true, desconocido: true });

/**
 * Traduce un código/estado interno a lenguaje humano.
 * @param {string} codigo  código crudo del motor/servidor (p. ej. 'ECONOMICS_INCOMPLETE').
 * @param {{ambito?: 'emision'|'acomodo'|'material'|'procedencia'|'render'|'comercial'|'aprobacion'|'lectura'|'confianza'}} [opciones]
 *        ámbito para desambiguar códigos que colisionan entre tablas (p. ej. PENDIENTE).
 * @returns {{frase:string, color:'verde'|'amarillo'|'rojo', continuar:boolean, desconocido?:boolean}}
 */
export function estadoHumano(codigo, opciones = {}) {
  if (codigo == null || codigo === '') return DESCONOCIDO_SEGURO;
  const crudo = String(codigo).trim();
  const ambito = opciones.ambito;

  // 1) ámbito explícito: respeta la tabla pedida (desambigua colisiones).
  if (ambito && AMBITOS[ambito]) {
    const t = AMBITOS[ambito];
    if (crudo in t) return t[crudo];
    const low = crudo.toLowerCase();
    if (low in t) return t[low];
    const up = crudo.toUpperCase();
    if (up in t) return t[up];
  }

  // 2) prefijos (familias con sufijo variable).
  for (const p of PREFIJOS) if (p.re.test(crudo)) return { frase: p.frase, color: p.color, continuar: p.continuar };

  // 3) búsqueda global en los ámbitos de nombres únicos.
  for (const t of ORDEN_GLOBAL) {
    if (crudo in t) return t[crudo];
    const up = crudo.toUpperCase();
    if (up in t) return t[up];
  }

  // 4) desconocido: amarillo "puedes continuar" — el gate real sigue siendo del servidor.
  return DESCONOCIDO_SEGURO;
}

/** ¿El estado bloquea de verdad (rojo)? Azúcar para gates de presentación. */
export function esBloqueante(codigo, opciones) {
  return estadoHumano(codigo, opciones).color === COLOR.ROJO;
}
