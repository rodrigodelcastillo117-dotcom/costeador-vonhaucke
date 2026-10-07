// ============================================================================
//  confirmarPrograma · PROPUESTA → PARTIDAS CONFIRMADAS (P0.1 · #3/#4).
//
//  resolverPrograma devuelve una PROPUESTA (productos reales sugeridos). NO es
//  cotización. La confirmación es un acto EXPLÍCITO del usuario ("Aplicar
//  programa detectado"); este módulo la materializa:
//
//   · IDEMPOTENTE (#3): clave determinista por SLOT (rol|relation_role|
//     anchor_instance_id|#ordinal) + producto, independiente de ids efímeros.
//     Aplicar el mismo programa 2+ veces NO duplica.
//   · RECONCILIADO (#4): mismo slot + mismo producto → reutiliza. Slot ocupado
//     por OTRO producto → CONFLICTO; se conserva lo existente, no se sustituye
//     en silencio.
//
//  Compuertas SEPARADAS (#12): el resumen distingue realidad de producto de
//  disponibilidad de precio. Un producto RESOLVED con price SIN_PRECIO es REAL;
//  bloquea emisión, no existencia. El precio es snapshot de display; la cifra
//  oficial la valida el servidor.
// ============================================================================

// Rol base del requerimiento (operativo/privado/juntas/recepcion). Acepta el
// modelo nuevo (`rol`) y el legacy (`requerimiento`).
function baseRol(item) {
  const r = item.rol || item.requerimiento || '';
  return String(r).split(':')[0] || 'desconocido';
}

// SLOT = posición funcional, SIN el producto. relation_role distingue ancla de
// dependiente; anchor_instance_id ata el dependiente a la INSTANCIA de su ancla.
function slotBase(item) {
  const base = baseRol(item);
  const rel = item.relation_role || 'ANCHOR';
  const ancla = item.anchor_instance_id || item.anchor_ref || '';
  return `${base}|${rel}|${ancla}|`;
}

function claveDeSlot(slot, bancoId) { return `${slot}::${bancoId}`; }

function aItemConfirmado(part, slot, estado) {
  const ident = part.identidad || null;
  const snapshot = Number(part.precio_lista_snapshot ?? part.precio) || null;
  return {
    id: claveDeSlot(slot, part.bancoId),
    slot,
    estado,                                      // 'CONFIRMADO' | 'EXISTENTE'
    rol: part.rol ?? baseRol(part),
    relation_role: part.relation_role ?? null,
    anchor_role: part.anchor_role ?? null,
    anchor_instance_id: part.anchor_instance_id ?? null,
    instance_id: part.instance_id ?? null,
    functional_group_id: part.functional_group_id ?? null,
    inclusion: part.inclusion ?? null,
    bancoId: part.bancoId,
    source_ref: part.source_ref ?? part.bancoId,
    nombre: part.nombre ?? null,
    linea: part.linea ?? null,
    usuarios: part.usuarios ?? null,
    w: part.w ?? null,
    d: part.d ?? null,
    cantidad: Number(part.cantidad) || 1,
    // COMPUERTA 1: realidad de producto
    product_status: part.product_status ?? 'RESOLVED',
    // COMPUERTA 2: identidad
    identity_status: part.identity_status ?? (ident ? 'RESOLVED' : 'MISSING'),
    productoId: ident ? ident.producto_id : (part.productoId ?? null),
    producto_version_id: ident ? ident.producto_version_id : (part.producto_version_id ?? null),
    lista_precio_item_id: ident ? ident.lista_precio_item_id : (part.lista_precio_item_id ?? null),
    // COMPUERTA 3: precio (display, autoridad servidor)
    precio_lista_snapshot: snapshot,
    price_status: part.price_status ?? (snapshot ? 'SNAPSHOT_DISPLAY' : 'SIN_PRECIO'),
    autoridad: 'SERVIDOR',
    source: 'CONFIRMADO_PROGRAMA',
  };
}

function conSlots(partidas) {
  const contador = new Map();
  return partidas.map((p) => {
    const base = p.slot ? p.slot.replace(/#\d+$/, '') : slotBase(p);
    const n = contador.get(base) || 0;
    contador.set(base, n + 1);
    return { part: p, slot: `${base}#${n}` };
  });
}

/** Clave de reconciliación de un item. (Exportada para pruebas / indexado.) */
export function claveDe(item, ordinal = 0) {
  const slot = item.slot || `${slotBase(item)}#${ordinal}`;
  return { slot, clave: claveDeSlot(slot, item.bancoId) };
}

/**
 * Confirma una propuesta de resolverPrograma contra lo ya existente.
 * @param {object} propuesta  resultado de resolverPrograma (usa `.partidas`).
 * @param {object} opts.existentes  partidas ya en la cotización.
 */
export function confirmarPrograma(propuesta, { existentes = [] } = {}) {
  const partidas = (propuesta && Array.isArray(propuesta.partidas)) ? propuesta.partidas : [];

  const existSlots = conSlots(existentes);
  const porSlot = new Map();
  for (const { part, slot } of existSlots) { if (!porSlot.has(slot)) porSlot.set(slot, part); }
  const slotsUsados = new Set();

  const confirmadas = [];
  const sinCambio = [];
  const conflictos = [];

  for (const { part, slot } of conSlots(partidas)) {
    const prev = porSlot.get(slot);
    if (prev) {
      if (String(prev.bancoId) === String(part.bancoId)) {
        slotsUsados.add(slot);
        sinCambio.push(aItemConfirmado(part, slot, 'EXISTENTE'));
      } else {
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

  const intactos = existSlots
    .filter(({ slot }) => !slotsUsados.has(slot))
    .map(({ part, slot }) => ({ ...part, slot: part.slot || slot }));

  const items = [...intactos, ...sinCambio, ...confirmadas];
  const propias = [...confirmadas, ...sinCambio];

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
      // Compuertas SEPARADAS (#12): realidad de producto ≠ disponibilidad de precio.
      productosReales: propias.every((it) => it.bancoId && !String(it.bancoId).startsWith('sug-') && it.product_status === 'RESOLVED'),
      identidadesValidas: propias.every((it) => it.identity_status === 'RESOLVED'),
      preciosDisponibles: propias.every((it) => it.price_status !== 'SIN_PRECIO'),
    },
  };
}
