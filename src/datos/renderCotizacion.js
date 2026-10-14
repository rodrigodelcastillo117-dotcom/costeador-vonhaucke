// ============================================================================
//  RENDERS EN COTIZACIÓN (lógica pura extraída de Cotizacion.jsx, 2026-10-14). Refactor puro.
//  · VH-045/VH-046: en el estado de la cotización SÓLO viajan URLs de Storage, nunca base64.
//  · El render final del espacio sólo puede venir del Acomodo validado (Cotización no inventa una oficina).
//  · El base64 que necesita el PDF existe sólo en memoria, en una COPIA de la cotización.
//  Probado por comportamiento en renderStoragePolicy.test.js.
// ============================================================================

/**
 * "Renderizar todas": pide render a las partidas que no tienen y guarda SÓLO la URL de Storage.
 * @param {object[]} partidas
 * @param {(pt:object)=>Promise<{ok:boolean,url?:string,error?:string}>} renderDe   nube.renderDePartida
 * @param {(id:any)=>void} [enCurso]   aviso de la partida en proceso (UI)
 * @returns {Promise<{partidas:object[], fallas:string[]}>}  copia (no muta la entrada)
 */
export async function rendersFaltantes(partidas, renderDe, enCurso = () => {}) {
  const ps = partidas.slice();
  const fallas = [];
  for (let i = 0; i < ps.length; i++) {
    if (ps[i].render) continue;
    enCurso(ps[i].id);
    const r = await renderDe(ps[i]);
    if (r.ok) ps[i] = { ...ps[i], render: r.url }; else fallas.push(`${ps[i].nombre || 'mueble'}: ${r.error}`);
  }
  return { partidas: ps, fallas };
}

/**
 * Botón "render de mi oficina" en Cotización: NUNCA genera. Devuelve el mensaje que se muestra.
 * @param {object|null} gate      evaluarAcomodoCliente(...)
 * @param {object} cotCliente     cotización vista por el cliente
 */
export function mensajeRenderOficina(gate, cotCliente) {
  if (!gate?.mostrar) {
    return gate?.existe
      ? `El acomodo todavía no está validado para cliente: ${(gate.razones || []).join(' · ') || gate.estado}. Revísalo en Acomodo primero.`
      : 'Primero crea y valida el acomodo del proyecto.';
  }
  // Un render "bonito" generado sólo con la lista de compras no es una propuesta exacta.
  if (!cotCliente.acomodo?.render3d) {
    return 'Para un render exacto, genéralo desde Acomodo → Render de mi oficina. Ahí VONI usa el layout real como referencia; desde Cotización no voy a inventar una oficina genérica.';
  }
  return 'El render vigente ya viene del Acomodo validado. Para regenerarlo sin perder fidelidad, vuelve a Acomodo.';
}

/** Copia de la cotización para el PDF: la URL del render del acomodo se sustituye por sus bytes SÓLO aquí. */
export function cotizacionParaPdf(cotCliente, render3dPdf) {
  return cotCliente.acomodo?.render3d
    ? { ...cotCliente, acomodo: { ...cotCliente.acomodo, render3d: render3dPdf || null } }
    : cotCliente;
}
