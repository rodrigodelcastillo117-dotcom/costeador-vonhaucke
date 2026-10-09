// ============================================================================
//  FloorPlanReader → observed_program (PLAN INTELLIGENCE, cable real)
//
//  Capa PURA. Traduce la salida REAL del lector de plano (`programaDelPlano`) al
//  contrato `observed_program`, conservando la PROCEDENCIA que el lector ya
//  distingue honestamente en su mapa `fuente`:
//    detectado  → OBSERVED  (contado/geometría del dibujo)
//    estimado   → INFERRED  (inferido por área; hay que confirmarlo)
//    sugerido   → SUGGESTED (regla que se PROPONE; nunca "del plano")
//
//  NO inventa cantidades: cada item sale de un campo real del lector. Esto es el
//  "cable" FloorPlanReader→observed_program; el PDF→lector (edge leer-plano) y la
//  verificación en vivo son el siguiente paso (requieren deploy). Aquí el cable
//  es testeable offline con una salida real de `programaDelPlano`.
// ============================================================================
import { observedItem, ORIGEN } from './observedProgram.js';

const origenDeFuente = (f) => (f === 'detectado' ? ORIGEN.OBSERVED : f === 'estimado' ? ORIGEN.INFERRED : ORIGEN.SUGGESTED);
const conf = (f) => (f === 'detectado' ? 0.9 : f === 'estimado' ? 0.6 : 0.4);
const evi = (f, que) => (f === 'detectado' ? `plano: ${que} detectado` : f === 'estimado' ? `estimado por área: ${que}` : `sugerido (regla): ${que}`);

/**
 * Convierte la salida de `programaDelPlano(areas)` en un observed_program.
 * @param {object} pr  salida de programaDelPlano (operativos, privados, juntas,
 *   salas[], recepcion, sugeridos{}, fuente{}, zonas{})
 * @returns {Array} items observed_program normalizados
 */
export function observedProgramDeLectura(pr = {}) {
  const f = pr.fuente || {};
  const items = [];

  // PUESTOS operativos (el lector da PUESTOS, no muebles). Capacidad = quantity
  // (1 puesto por unidad); el reparto a benches (muebles) ocurre al resolver.
  if (Number(pr.operativos) > 0) {
    items.push(observedItem({
      type: 'puesto_operativo', role: 'ANCHOR_WORKSTATION',
      quantity: pr.operativos, capacity_per_unit: 1,
      zone: pr.zonas?.operativo?.nombre || 'OPEN_SPACE',
      origin: origenDeFuente(f.operativos), evidence: evi(f.operativos, 'puestos operativos'), confidence: conf(f.operativos),
    }));
  }

  // PRIVADOS (escritorio dirección) — uno por zona privada.
  if (Number(pr.privados) > 0) {
    items.push(observedItem({
      type: 'escritorio_direccion', role: 'ANCHOR_DESK',
      quantity: pr.privados,
      zone: 'DIRECCION',
      origin: origenDeFuente(f.privados), evidence: evi(f.privados, 'privados'), confidence: conf(f.privados),
    }));
  }

  // MESAS de juntas — una por sala, con su capacidad (personas que caben).
  const salas = Array.isArray(pr.salas) ? pr.salas : [];
  salas.forEach((cap, i) => {
    if (Number(cap) <= 0) return;
    items.push(observedItem({
      type: 'mesa_juntas', role: 'ANCHOR_MEETING',
      quantity: 1, capacity_per_unit: cap,
      zone: pr.zonas?.juntas?.[i]?.nombre || 'JUNTAS',
      origin: origenDeFuente(f.salas), evidence: evi(f.salas, 'sala de juntas'), confidence: conf(f.salas),
    }));
  });

  // RECEPCIÓN.
  if (pr.recepcion) {
    items.push(observedItem({
      type: 'recepcion', role: 'ANCHOR_RECEPTION', quantity: 1,
      zone: pr.zonas?.recepcion?.nombre || 'RECEPCION',
      origin: origenDeFuente(f.recepcion), evidence: evi(f.recepcion, 'recepción'), confidence: conf(f.recepcion),
    }));
  }

  // SUGERIDOS (regla, NO dibujados): sillas, gavetas, archiveros.
  const sug = pr.sugeridos || {};
  const agregarSugerido = (type, role, cant, que) => {
    if (Number(cant) > 0) items.push(observedItem({ type, role, quantity: cant, origin: ORIGEN.SUGGESTED, evidence: `sugerido (regla): ${que}`, confidence: 0.4 }));
  };
  agregarSugerido('silla_operativa', 'WORK_SEAT', sug.sillasOperativas, 'una silla por puesto');
  agregarSugerido('gaveta', 'UNDERDESK_STORAGE', sug.gavetas, 'una gaveta por puesto');
  agregarSugerido('archivero', 'SUPPORT_STORAGE', sug.archiveros, 'uno por privado');

  return items;
}
