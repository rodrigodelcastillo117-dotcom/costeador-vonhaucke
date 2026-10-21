// ============================================================================
//  Traduce los códigos "pendiente de confirmar" del programa del plano (resolverPrograma.js)
//  a español claro CON acción. El vendedor NUNCA debe ver un enum crudo tipo
//  ESCRITORIO_SOLICITADO_NO_CANONICO: significa "pediste algo que no tengo idéntico
//  en catálogo", y hay que decírselo en humano y qué hacer. Es sólo presentación:
//  no cambia la lógica del programa ni el precio (el servidor revalida al emitir).
// ============================================================================

// Arma "Eclipse 2.10 m (línea App LT)" a partir de lo que pidió la persona.
function describirSolicitado(req = {}) {
  const m = req.model ? String(req.model).trim() : '';
  const dim = req.dimensions ? ` ${String(req.dimensions).trim()}` : '';
  const ln = req.line ? ` (línea ${String(req.line).trim()})` : '';
  return (m + dim + ln).trim();
}

/**
 * @param {{rol?:string, faltante?:{reason?:string, requested?:object}}} p
 * @returns {string} mensaje humano, sin ningún código crudo
 */
export function mensajePendientePrograma(p = {}) {
  const f = (p && p.faltante) || {};
  const que = describirSolicitado(f.requested) || '';
  const zona = p && p.rol ? `${p.rol}: ` : '';
  const comoElegir = 'Elige el más parecido con los botones de arriba, o pídelo como especial a Diseño.';

  switch (f.reason) {
    case 'ESCRITORIO_SOLICITADO_NO_CANONICO':
      return `${zona}Pediste un escritorio${que ? ` ${que}` : ''} que no tengo idéntico en catálogo. ${comoElegir}`;
    case 'ASIENTO_SOLICITADO_NO_CANONICO':
      return `${zona}Pediste una silla${que ? ` ${que}` : ''} que no tengo idéntica en catálogo. Elige la más parecida con los botones de arriba, o pídela como especial a Diseño.`;
    case 'NEEDS_CONFIRMATION':
    case undefined:
    case null:
    case '':
      return `${zona}${que ? `«${que}» ` : 'Esto '}necesita que lo confirmes antes de cotizar.`;
    default:
      // Cualquier código futuro: nunca se enseña crudo, se humaniza genérico.
      return `${zona}${que ? `«${que}» ` : ''}necesita tu confirmación antes de cotizar.`;
  }
}
