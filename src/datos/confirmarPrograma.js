// ============================================================================
//  confirmarPrograma · PROPUESTA → PARTIDAS CONFIRMADAS (P0.1 · #3/#4).
//
//  resolverPrograma devuelve una PROPUESTA (sugerencia de productos reales). NO
//  es una cotización. La confirmación es un acto explícito del usuario ("Aplicar
//  programa detectado"). Aquí se materializa ese acto de forma:
//
//   · IDEMPOTENTE (#3): aplicar el mismo programa dos veces NO duplica. Cada
//     partida tiene una CLAVE determinista (slot + producto) que no depende del
//     functional_group_id efímero, así que re-confirmar reconcilia contra lo ya
//     confirmado en vez de agregar copias.
//   · RECONCILIADO (#4): si ya existe una partida real que cubre el mismo slot
//     con el MISMO producto → se reutiliza (sin cambio). Si el slot ya está
//     ocupado por OTRO producto → se marca CONFLICTO y NO se sustituye en
//     silencio (decisión del usuario).
//
//  Una partida confirmada lleva identidad aplanada (producto_id +
//  producto_version_id) y el precio como snapshot de display (autoridad =
//  SERVIDOR). Nunca `sug-*`, nunca $0.
// ============================================================================

// Requerimiento base: 'operativo:WORK_SEAT' → 'operativo'. Anclas quedan igual.
function baseReq(requerimiento) {
  return String(requerimiento || '').split(':')[0] || 'desconocido';
}

// SLOT = posición funcional, SIN el producto. Dos productos distintos en el
// mismo slot = conflicto. El ordinal distingue instancias idénticas (p.ej. dos
// benches operativos iguales) de forma determinista por orden de la propuesta.
function slotBase(item) {
  const base = baseReq(item.requerimiento);
  const rol = item.relation_role || 'ANCHOR';
  const ancla = item.anchor_ref || '';
  return `${base}|${rol}|${ancla}|`;
}

function claveDeSlot(slot, bancoId) { return `${slot}::${bancoId}`; }

// Normaliza una partida (de propuesta o ya existente) a item confirmado.
function aItemConfirmado(part, slot, estado) {
  const ident = part.identidad || null;
  const precio = part.precio_autoridad || null;
  return {
    id: claveDeSlot(slot, part.bancoId),
    slot,
    estado,                                  // 'CONFIRMADO' | 'EXISTENTE'
    requerimiento: part.requerimiento,
    anchor_role: part.anchor_role ?? null,
    relation_role: part.relation_role ?? null,
    anchor_ref: part.anchor_ref ?? null,
    functional_group_id: part.functional_group_id ?? null,
    bancoId: part.bancoId,
    source_ref: part.source_ref ?? part.bancoId,
    nombre: part.nombre ?? null,
    linea: part.linea ?? null,
    usuarios: part.usuarios ?? null,
    w: part.w ?? null,
    d: part.d ?? null,
    cantidad: Number(part.cantidad) || 1,
    // identidad aplanada (compuerta 2)
    productoId: ident ? ident.producto_id : (part.productoId ?? null),
    producto_version_id: ident ? ident.producto_version_id : (part.producto_version_id ?? null),
    lista_precio_item_id: ident ? ident.lista_precio_item_id : (part.lista_precio_item_id ?? null),
    // precio (compuerta 3): display, autoridad servidor
    precio_lista_snapshot: precio ? precio.precio_lista_snapshot : (Number(part.precio) || null),
    price_status: precio ? precio.price_status : (part.price_status ?? 'SNAPSHOT_DISPLAY'),
    autoridad: precio ? precio.autoridad : 'SERVIDOR',
    source: 'CONFIRMADO_PROGRAMA',
  };
}

// Calcula slot+ordinales de una lista de partidas de forma determinista.
function conSlots(partidas) {
  const contador = new Map();
  return partidas.map((p) => {
    const base = p.slot ? p.slot.replace(/#\d+$/, '') : slotBase(p);
    const n = contador.get(base) || 0;
    contador.set(base, n + 1);
    return { part: p, slot: `${base}#${n}` };
  });
}

/**
 * Clave de reconciliación de un item. Si el item fue confirmado por este mismo
 * flujo trae `slot`; si no, se recalcula. (Exportada para pruebas y para que
 * Acomodo pueda indexar lo existente.)
 */
export function claveDe(item, ordinal = 0) {
  const slot = item.slot || `${slotBase(item)}#${ordinal}`;
  return { slot, clave: claveDeSlot(slot, item.bancoId) };
}

/**
 * Confirma una propuesta de resolverPrograma contra lo ya existente.
 * @param {object} propuesta  resultado de resolverPrograma (usa `.partidas`).
 * @param {object} opts.existentes  partidas ya en la cotización (con bancoId y, si vienen de aquí, slot).
 * @returns {{ items, confirmadas, sinCambio, conflictos, resumen }}
 */
export function confirmarPrograma(propuesta, { existentes = [] } = {}) {
  const partidas = (propuesta && Array.isArray(propuesta.partidas)) ? propuesta.partidas : [];

  // Index de lo existente por slot (slot → item). Ordinales estables.
  const existSlots = conSlots(existentes);
  const porSlot = new Map();
  for (const { part, slot } of existSlots) {
    if (!porSlot.has(slot)) porSlot.set(slot, part);
  }
  const slotsUsados = new Set();

  const confirmadas = [];
  const sinCambio = [];
  const conflictos = [];

  for (const { part, slot } of conSlots(partidas)) {
    const prev = porSlot.get(slot);
    if (prev) {
      if (String(prev.bancoId) === String(part.bancoId)) {
        // Mismo producto en el mismo slot → reutiliza (idempotente, sin duplicar).
        slotsUsados.add(slot);                    // ya lo re-emitimos como EXISTENTE
        sinCambio.push(aItemConfirmado(part, slot, 'EXISTENTE'));
      } else {
        // Slot ocupado por otro producto → CONFLICTO: se CONSERVA lo existente
        // (queda en `intactos`), NO se agrega lo propuesto, se registra el choque.
        conflictos.push({
          slot,
          existente: { bancoId: prev.bancoId, nombre: prev.nombre ?? null },
          propuesto: { bancoId: part.bancoId, nombre: part.nombre ?? null },
          code: 'SLOT_OCUPADO_PRODUCTO_DISTINTO',
        });
      }
    } else {
      confirmadas.push(aItemConfirmado(part, slot, 'CONFIRMADO'));
    }
  }

  // Items existentes que el programa NO toca se conservan intactos.
  const intactos = existSlots
    .filter(({ slot }) => !slotsUsados.has(slot))
    .map(({ part, slot }) => ({ ...part, slot: part.slot || slot }));

  const items = [...intactos, ...sinCambio, ...confirmadas];

  return {
    items,
    confirmadas,
    sinCambio,
    conflictos,
    resumen: {
      total: items.length,
      nuevas: confirmadas.length,
      reutilizadas: sinCambio.length,
      conflictos: conflictos.length,
      // Invariante dura: ninguna partida confirmada es sug-* ni $0.
      limpio: [...confirmadas, ...sinCambio].every(
        (it) => it.bancoId && !String(it.bancoId).startsWith('sug-') && Number(it.precio_lista_snapshot) > 0,
      ),
    },
  };
}
