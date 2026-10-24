// ============================================================================
//  MODO DEL DOCUMENTO: DEFINITIVO o BORRADOR (lógica pura extraída de Cotizacion.jsx, 2026-10-14).
//  Refactor puro de `resolverModoDocumento`; el componente le pasa sus setters como callbacks.
//
//  Un documento SIEMPRE puede salir como BORRADOR. Lo que se bloquea fail-closed es la EMISIÓN
//  DEFINITIVA: sólo con problemas locales vacíos, gate del servidor exactamente 'ALLOWED' (DESCONOCIDO,
//  error o excepción ⇒ borrador) y revisión inmutable registrada (`onEmitida()` ok).
//  Se prueba por comportamiento en quoteEmissionAuthority.test.js (antes: texto de Cotizacion.jsx).
// ============================================================================
import { ESTADO_EMISION } from './emisionUX.js';

/**
 * @param {object} p
 * @param {string[]} p.probEmision          problemas de renglón (problemasDeEmision)
 * @param {boolean} p.bloqueoExcluidas      faltan confirmar piezas excluidas
 * @param {object[]} p.partidas
 * @param {(()=>Promise<object>)|null} p.verificarEmision   gate autoritativo (App)
 * @param {(()=>Promise<object>)|null} p.onEmitida          registra la revisión inmutable (App)
 * @param {object} [p.ui]  callbacks de UI: { cargando(bool), gate(g), verPorque() }
 * @returns {Promise<{definitivo:boolean, motivo:string, gate:object|null}>}
 */
export async function resolverModoDocumento({ probEmision = [], bloqueoExcluidas = false, partidas = [], verificarEmision, onEmitida, ui = {} }) {
  const razones = [];
  if (probEmision.length) razones.push(probEmision[0]);
  if (bloqueoExcluidas) razones.push('Falta confirmar las piezas excluidas.');
  if (partidas.some((p) => p.candadoUsuarios || p.requiereProyectista)) {
    razones.push('Requiere revisión/confirmación de proyecto antes de emitir definitivo.');
  }

  let g = null;
  if (!razones.length && verificarEmision) {
    ui.cargando?.(true);
    try { g = await verificarEmision(); }
    catch (e) { g = { estado: 'DESCONOCIDO', error: String(e?.message || e) }; }
    finally { ui.cargando?.(false); }
    ui.gate?.(g);
    const estadoGate = g?.estado || 'DESCONOCIDO';
    if (estadoGate !== 'ALLOWED') {
      ui.verPorque?.();
      const titulo = estadoGate === 'DESCONOCIDO'
        ? 'No se pudo verificar la emisión'
        : ((ESTADO_EMISION[estadoGate] || {}).titulo || 'No se puede emitir todavía; se revisa al emitir');
      razones.push(titulo);
    }
  }

  if (razones.length) return { definitivo: false, motivo: razones.join(' · '), gate: g };

  const reg = onEmitida ? await onEmitida() : { ok: false, motivo: 'sin-registro-emision' };
  if (!reg?.ok) {
    return {
      definitivo: false,
      motivo: /aprobaci|politica|supera/i.test(reg?.motivo || '')
        ? 'Requiere aprobación de Dirección.'
        : 'No se pudo conservar la revisión inmutable.',
      gate: g,
    };
  }
  return { definitivo: true, motivo: '', gate: g };
}
