// ============================================================================
//  ESTIMADO DE DISEÑO · el nivel económico intermedio (sin inventar dinero).
//  Entre "COSTO CERTIFICADO" (exige BOM/economía válida) y "REFERENCIA COMERCIAL"
//  (precios de lista de comparables) hay un hueco útil: con los INSUMOS REALES
//  disponibles y cantidades geométricamente estimables se puede dar un estimado
//  PARCIAL honesto. Lo que no se puede estimar con evidencia se nombra como
//  PENDIENTE — NUNCA $0 — y se reporta la cobertura y la confianza.
//
//  Reglas duras: (1) solo precios reales de `insumos`; (2) nada se pone en $0 por
//  defecto; (3) no es costo certificado ni precio de venta. Función pura/testeable.
// ============================================================================

const red2 = (n) => Math.round(n * 100) / 100;

// Precio real de un insumo del catálogo vigente, o null si no existe/!>0.
function precioRealInsumo(insumos, id) {
  const it = insumos?.[id];
  const p = Number(it?.precio);
  if (!Number.isFinite(p) || p <= 0) return null;
  return { precio: p, nombre: it.nombre || id, unidad: it.unidad || 'm2', fuente: it.fuente || null };
}

export function estimadoDisenoCocrear(intent, insumos = {}) {
  const feats = new Set(intent?.caracteristicas || []);
  const cap = Math.max(1, Math.min(24, Number(intent?.capacidad_personas || intent?.capacidad?.personas) || 6));
  const items = [];
  const pendientes = [];

  // 1) Panel acústico PET — precio real del ERP ($/m²). El área es un SUPUESTO DE
  //    DISEÑO declarado (≈0.5 m² de panel por puesto, biombo entre estaciones);
  //    el precio es evidencia real, la cantidad se afina en el despiece.
  const pet = precioRealInsumo(insumos, 'pet-acustico');
  if (feats.has('acustica') || feats.has('divisores')) {
    if (pet) {
      const area = red2(cap * 0.5);
      items.push({
        concepto: 'Panel acústico PET',
        detalle: `~${area} m² (supuesto ≈0.5 m²/puesto) × ${pet.nombre}`,
        insumoId: 'pet-acustico', cantidad: area, unidad: pet.unidad,
        precioUnit: pet.precio, subtotal: Math.round(area * pet.precio),
        fuente: pet.fuente || 'ERP',
      });
    } else {
      pendientes.push('Panel acústico (sin precio de insumo disponible)');
    }
  }

  // 2) Lo que HOY no se estima con evidencia: se nombra, jamás en $0.
  if (feats.has('electrificacion_integrada')) pendientes.push('Electrificación oculta (canaleta, contactos, cableado)');
  if (feats.has('jardinera_integrada')) pendientes.push('Jardinera (sustrato, riego, drenaje, impermeabilización)');
  if (feats.has('iluminacion_integrada')) pendientes.push('Iluminación integrada (tira LED, driver)');
  pendientes.push('Estructura, cubierta y herrajes');
  pendientes.push('Mano de obra y ensamble');

  const total = items.reduce((a, it) => a + it.subtotal, 0);
  const nLineas = items.length + pendientes.length;
  // Cobertura POR CONTEO de partidas (no del costo total): cuántas de las partidas
  // del alcance ya tienen número real contra cuántas siguen pendientes.
  const coberturaPct = nLineas ? Math.round((items.length / nLineas) * 100) : 0;

  return {
    nivel: 'ESTIMADO_DISENO',
    disponible: items.length > 0,
    items,
    total,
    pendientes,
    coberturaPct,
    confianza: 'baja',
    nota: 'Estimado de diseño con insumos reales disponibles. NO es costo certificado ni precio de venta: no incluye lo marcado como pendiente. Se certifica al bajar el concepto a despiece (BOM).',
  };
}
