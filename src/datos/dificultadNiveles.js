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
