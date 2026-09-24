// ============================================================================
//  HEX aproximado por color de acabado — solo para pintar una pastilla visual
//  junto al chip de texto del selector de "Color" (EditarPartida/CosteadorLinea).
//  Fuente: catálogo físico real "Acabados catálogo_2026_08_12.pdf" (Rodrigo,
//  2026-08-24) — estimado a ojo de las muestras fotografiadas del PDF, NO es
//  una medición Pantone ni un muestreo de píxel exacto.
//
//  Cubre SOLO los ids de acabados.js que aparecen fotografiados en ese PDF.
//  El resto de MELAMINA_POR_ESPESOR/PINTURA_COLORES (colores sin foto en el
//  PDF, ej. terracota, verde-esmeralda, sand) se queda sin pastilla — el chip
//  sigue mostrando solo texto, igual que antes de este cambio.
//
//  'ivory' aparece en AMBOS catálogos (pintura A102 y melamina B717) con un
//  tono casi idéntico en el PDF — se usa un solo hex compartido.
// ============================================================================
export const HEX_DE_COLOR = {
  // Pintura en polvo — pág. "Pintura para metal"
  'basic-white': '#F5F3EE',
  'silver-tx': '#C7C9CA',
  'antracita-tx': '#7C7D7C',
  'aluminio-anodizado': '#B9BBBC',
  'silver': '#ABADAE',
  'charcoal': '#2E2E2E',
  'black-tx': '#131313',

  // Melamina — pág. "Laminado Plástico"
  'ivory': '#F0EAD6',
  'frosty-white': '#F2F1EC',
  'black': '#0D0D0D',
  'ivory-vanyla': '#E9E3D0',
  'soft-grey': '#D6D5CF',
  'white-ash': '#E7E4DC',
  'light-ash-lp': '#C6C4BC',
  'walnut': '#7C5A38',
  'latte-tx': '#C6A575',
  'antracite-oak': '#857D6C',
  'blanco-absoluto': '#F2F2ED',
  'encino-polar-tx': '#D9D0BC',
  'durango-tx': '#96603A',
  'monarca-tx': '#AD7F52',
  'roble-merida-tx': '#AC875A',
  'nogal-neo-tx': '#6E4A2C',
  'fresno-bruma-tx': '#78766D',
  'white-ash-tx': '#EAE8E1',
  'antracite-oak-tx': '#58554C',
  'antracita-light-tx': '#87867F',
};

export const hexDeColor = (id) => HEX_DE_COLOR[id] || null;
