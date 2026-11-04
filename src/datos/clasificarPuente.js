// ============================================================================
//  CLASIFICACIÓN DE UN PUENTE PROPUESTO frente a lo YA APROBADO, para la pantalla
//  "Aprobar puentes". Evita que Dirección choque contra la restricción de no-solape
//  (no_overlap_mapeo_aprobado) sin entender por qué:
//   · 'aprobable' : la clave no tiene puente aprobado activo → se puede aprobar.
//   · 'duplicado' : la clave ya tiene puente aprobado al MISMO insumo → retirar (no aporta nada).
//   · 'conflicto' : la clave ya tiene puente aprobado a OTRO insumo → decidir a mano
//                   (no se puede aprobar encima; una clave no apunta a dos insumos a la vez).
//  Espera una fila con `ya_aprobado: {id, insumoId, mismo} | null` (la arma puentesPropuestos).
// ============================================================================
export function clasificarPuente(f = {}) {
  const ap = f && f.ya_aprobado;
  if (!ap) return 'aprobable';
  return ap.mismo ? 'duplicado' : 'conflicto';
}
