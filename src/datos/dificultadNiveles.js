// ============================================================================
//  Niveles de DIFICULTAD de fabricación (motor/dificultad.js) con ejemplos REALES: piezas APP LT
//  medidas contra horas estándar del ERP. Un solo texto para Costear y Cocrear (antes vivía dentro
//  de AsistenteEspecial.jsx). Normal (×1) = exactamente la fórmula Alba V1 de siempre.
// ============================================================================
export const NIVELES_DIFICULTAD = Object.freeze([
  ['muy_facil', 'Muy fácil', 'Mucho material y poco trabajo: cubiertas grandes, faldones (p.ej. ATCUBD46, ATFAL150).'],
  ['facil', 'Fácil', 'Piezas planas sencillas con material de valor: cubierta 1500, omega larga (ATCUBD45, ATOM4).'],
  ['normal', 'Normal', 'La fórmula de siempre. Cubierta 1200, omega ATOM3, módulo APP LT completo.'],
  ['dificil', 'Difícil', 'Estructura soldada con muchos cortes: patas U (ATPU2M/3M/75M).'],
  ['muy_dificil', 'Muy difícil', 'Mucho trabajo sobre poco material: acometidas, cajas, piezas con muchos dobleces (ATACM).'],
]);

// Niveles de NOVEDAD / primera vez (motor/dificultad.js · factorNovedad). Escalan SOLO el trabajo (horas/MO),
// nunca el material. PROVISIONAL: a calibrar con trabajos bespoke reales (horas 1ª vez vs estándar después).
// Eje DISTINTO de la dificultad: la dificultad = cuánto trabajo tiene la pieza; la novedad = cuánto MÁS cuesta
// la PRIMERA vez que se fabrica (setup, programar máquina, entenderla, reprocesos del 1er intento).
// Default `conocido` (×1) = exactamente la cuenta de siempre.
export const NIVELES_NOVEDAD = Object.freeze([
  ['conocido', 'Ya lo hacemos', 'Producto de línea o que ya se fabricó antes. Sin premio de primera vez.'],
  ['primera_vez', 'Primera vez (variación)', 'Variación de algo conocido. +15% al trabajo.'],
  ['nuevo', 'Nuevo de verdad', 'Pieza nueva, no una variación directa. +35% al trabajo.'],
  ['muy_nuevo', 'Nunca hecho', 'Geometría o proceso que nunca se ha fabricado. +60% al trabajo.'],
]);
