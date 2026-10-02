// ============================================================================
//  N14 — DEAL DESK: máquina de estados de aprobación (pura).
//  Una aprobación está LIGADA AL HASH de la revisión/cotización. Si el dinero
//  cambia (nuevo hash), la aprobación previa deja de ser vigente y se requiere
//  una nueva. La autoridad real (aprobar) la ejerce Dirección en la DB; aquí sólo
//  vive la lógica de transición y vigencia, verificable sin sesión humana.
// ============================================================================
export const ESTADOS = ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'CONTRAOFERTA'];

// Transiciones válidas (accion -> estado destino) desde cada estado.
const TRANSICIONES = {
  PENDIENTE:    { aprobar: 'APROBADA', rechazar: 'RECHAZADA', contraofertar: 'CONTRAOFERTA' },
  CONTRAOFERTA: { reenviar: 'PENDIENTE', aprobar: 'APROBADA', rechazar: 'RECHAZADA' },
  APROBADA:     {},   // terminal (salvo invalidación por cambio de hash)
  RECHAZADA:    {},   // terminal
};

/** Aplica una acción; devuelve el nuevo estado o lanza si la transición es inválida. */
export function transicion(estadoActual, accion) {
  const posibles = TRANSICIONES[estadoActual];
  if (!posibles) throw new Error(`Estado desconocido: ${estadoActual}`);
  const destino = posibles[accion];
  if (!destino) throw new Error(`Transición inválida: ${accion} desde ${estadoActual}`);
  return destino;
}

/** Acciones válidas desde un estado (para pintar botones). */
export function accionesValidas(estadoActual) {
  return Object.keys(TRANSICIONES[estadoActual] || {});
}

/**
 * ¿La aprobación es VIGENTE para el dinero actual?
 * Sólo si está APROBADA y su hash coincide con el hash actual de la cotización.
 * Si el dinero cambió (hash distinto), la aprobación previa YA NO aplica.
 */
export function aprobacionVigente(aprobacion, hashActual) {
  if (!aprobacion || aprobacion.estado !== 'APROBADA') return false;
  if (!aprobacion.revision_hash || !hashActual) return false;
  return aprobacion.revision_hash === hashActual;
}

/** ¿Un cambio de dinero (hash) invalida la aprobación previamente aprobada? */
export function requiereNuevaAprobacion(aprobacion, hashActual) {
  if (!aprobacion) return false;              // nunca hubo: no es "invalidada", es inexistente
  if (aprobacion.estado !== 'APROBADA') return false;
  return aprobacion.revision_hash !== hashActual;
}
