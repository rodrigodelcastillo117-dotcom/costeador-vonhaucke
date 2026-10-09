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
import { observedItem, ORIGEN, KIND } from './observedProgram.js';

const origenDeFuente = (f) => (f === 'detectado' ? ORIGEN.OBSERVED : f === 'estimado' ? ORIGEN.INFERRED : ORIGEN.SUGGESTED);
const conf = (f) => (f === 'detectado' ? 0.9 : f === 'estimado' ? 0.6 : 0.4);
const evi = (f, que) => (f === 'detectado' ? `plano: ${que} detectado` : f === 'estimado' ? `estimado por área: ${que}` : `sugerido (regla): ${que}`);
// ChatGPT P0-C: un MUEBLE esperado por la PRESENCIA de un cuarto (escritorio en un
// privado, mesa en una sala, mostrador en recepción) NO fue visto: es una
// EXPECTATIVA del cuarto → nunca OBSERVED, a lo sumo INFERRED hasta confirmar.
const capInferred = (origen) => (origen === ORIGEN.OBSERVED ? ORIGEN.INFERRED : origen);

/**
 * Convierte la salida de `programaDelPlano(areas)` en un observed_program.
 * @param {object} pr  salida de programaDelPlano (operativos, privados, juntas,
 *   salas[], recepcion, sugeridos{}, fuente{}, zonas{})
 * @returns {Array} items observed_program normalizados
 */
export function observedProgramDeLectura(pr = {}) {
  const f = pr.fuente || {};
  const items = [];

  // CUARTOS/zonas detectados (kind=ROOM) — ChatGPT #3: un cuarto observado NO es
  // mobiliario observado. La geometría del área es del plano (OBSERVED); su ROL
  // semántico puede ser detectado o estimado (se refleja en confidence).
  const z = pr.zonas || {};
  const room = (nombre, rolZona, fuenteRol) => observedItem({
    kind: KIND.ROOM, type: rolZona, role: rolZona, quantity: 1,
    zone: nombre || rolZona, origin: ORIGEN.OBSERVED,
    evidence: `plano: área "${nombre || rolZona}"`, confidence: conf(fuenteRol),
  });
  if (z.operativo) items.push(room(z.operativo.nombre, 'open_space', f.operativos));
  (z.privados || []).forEach((p) => items.push(room(p.nombre, 'privado', f.privados)));
  (z.juntas || []).forEach((s) => items.push(room(s.nombre, 'sala_juntas', f.salas)));
  if (z.recepcion) items.push(room(z.recepcion.nombre, 'recepcion', f.recepcion));

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

  // PRIVADOS → escritorio dirección. El CUARTO privado puede estar detectado, pero
  // el ESCRITORIO no fue visto: es expectativa del cuarto → INFERRED máx (P0-C).
  if (Number(pr.privados) > 0) {
    items.push(observedItem({
      type: 'escritorio_direccion', role: 'ANCHOR_DESK',
      quantity: pr.privados,
      zone: 'DIRECCION',
      origin: capInferred(origenDeFuente(f.privados)), evidence: `inferido del cuarto: se espera escritorio por privado (${f.privados || 'estimado'})`, confidence: conf(f.privados),
    }));
  }

  // SALAS → mesa de juntas. La SALA puede estar detectada, pero la MESA no fue
  // vista: expectativa del cuarto → INFERRED máx (P0-C).
  const salas = Array.isArray(pr.salas) ? pr.salas : [];
  salas.forEach((cap, i) => {
    if (Number(cap) <= 0) return;
    items.push(observedItem({
      type: 'mesa_juntas', role: 'ANCHOR_MEETING',
      quantity: 1, capacity_per_unit: cap,
      zone: pr.zonas?.juntas?.[i]?.nombre || 'JUNTAS',
      origin: capInferred(origenDeFuente(f.salas)), evidence: `inferido del cuarto: se espera mesa en sala de juntas (${f.salas || 'estimado'})`, confidence: conf(f.salas),
    }));
  });

  // RECEPCIÓN → mostrador. El ÁREA de recepción puede estar detectada, pero el
  // MOSTRADOR no fue visto: expectativa del cuarto → INFERRED máx (P0-C).
  if (pr.recepcion) {
    items.push(observedItem({
      type: 'recepcion', role: 'ANCHOR_RECEPTION', quantity: 1,
      zone: pr.zonas?.recepcion?.nombre || 'RECEPCION',
      origin: capInferred(origenDeFuente(f.recepcion)), evidence: `inferido del cuarto: se espera mostrador en recepción (${f.recepcion || 'estimado'})`, confidence: conf(f.recepcion),
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
