// ============================================================================
//  Expedientes de PRUEBA (QA/RC) en la biblioteca (Operación 9.5 · punto 21). Medido 14-oct: 154 de 157 expedientes en
//  producción los creó la cuenta QA, y la biblioteca trae los 80 más recientes: los productos reales no aparecían.
//  No se borra nada: se ocultan por omisión y un interruptor los muestra.
//   · etiqueta 'prueba-rc'    → guardado desde el carril RC (marcarExpedienteRc)
//   · etiqueta 'qa-archivado' → PROPUESTA_qa_archivar_expedientes.sql (manifest de 154 ids, sin aplicar)
//   · nombre "PRUEBA RC · …"  → prefijo del carril RC
// ============================================================================
export const ETIQUETAS_PRUEBA = Object.freeze(['prueba-rc', 'qa-archivado']);

export function esExpedientePrueba(e) {
  if (!e) return false;
  const tags = Array.isArray(e.etiquetas) ? e.etiquetas.map((t) => String(t).toLowerCase()) : [];
  if (tags.some((t) => ETIQUETAS_PRUEBA.includes(t))) return true;
  return /^PRUEBA RC\s*·/i.test(String(e.nombre || ''));
}

/** Por omisión: en el carril RC TODO lo guardado es prueba ⇒ se muestra (si no, lo recién guardado desaparece); en
 *  producción se ocultan. Lab 14-oct (commit 2649de8): el expediente 160 se guardó y no aparecía en la biblioteca RC. */
export function mostrarPruebasPorOmision(carrilRc) { return carrilRc === true; }

export function filtrarBiblioteca(items = [], { mostrarPruebas = false } = {}) {
  const lista = Array.isArray(items) ? items : [];
  const visibles = mostrarPruebas ? lista : lista.filter((e) => !esExpedientePrueba(e));
  return { visibles, ocultas: lista.length - visibles.length };
}
