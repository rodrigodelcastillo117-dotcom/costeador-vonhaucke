// ============================================================================
//  PANTALLA DE INGENIERIA (directiva Direccion 2026-11-09) — view-model puro.
//  --------------------------------------------------------------------------
//  Un usuario no-programador termina un costeo. Toma el EXPEDIENTE existente (no
//  recalcula, no es un segundo sistema) y lo presenta en 5 secciones:
//    ESTO ENTENDI · ASI LO FABRICARIA · ESTO NECESITO CONFIRMAR · ESTE ES EL COSTO ·
//    ASI PODRIA MEJORARSE.
//  Las confirmaciones (resolver una decision) se aplican sobre el MISMO expediente
//  (aplicarConfirmacion) sin perder informacion ni repetir el analisis.
// ============================================================================

const money = (n) => (n == null ? null : +Number(n).toFixed(2));

/** Mejoras concretas derivadas de la EVIDENCIA (propuestas, no cambios). */
export function mejorasDe(costo = {}) {
  const m = [];
  const ev = costo.material?.evidencia || [];
  for (const e of ev) {
    if (e.aprovechamiento_pct != null && e.aprovechamiento_pct < 70) {
      m.push({ tipo: 'aprovechamiento', clave: e.clave,
        propuesta: `Aprovechamiento ${e.aprovechamiento_pct}% en ${e.clave}: nestear junto con otras piezas de ${e.lamina?.id} o evaluar formato alterno para subir rendimiento.` });
    }
  }
  // Nesteo conjunto por lamina compartida
  const porLamina = {};
  for (const e of ev) if (e.lamina?.id) (porLamina[e.lamina.id] ||= []).push(e.clave);
  for (const [lam, claves] of Object.entries(porLamina)) if (claves.length >= 2) {
    m.push({ tipo: 'nesteo_conjunto', propuesta: `Cortar ${claves.join(', ')} en la misma hoja de ${lam} (nesteo conjunto) para reducir merma y hojas compradas.` });
  }
  // Make-vs-buy: piezas compradas caras que podrian fabricarse (o al reves)
  if ((costo.cobertura?.compradas_sin_precio || []).length) {
    m.push({ tipo: 'make_vs_buy', propuesta: `Definir make-vs-buy de ${costo.cobertura.compradas_sin_precio.map((c) => c.clave).join(', ')}: cotizar compra vs fabricar en casa.` });
  }
  // Calibre: donde se propuso calibre (no venia del plano), estandarizar
  const calibrePropuesto = ev.filter((e) => e.calibre_fuente && e.calibre_fuente !== 'del plano').map((e) => e.clave);
  if (calibrePropuesto.length) m.push({ tipo: 'estandarizar_calibre', propuesta: `Estandarizar calibre de ${calibrePropuesto.join(', ')} (hoy propuesto): un solo calibre por familia simplifica compra y corte.` });
  return m;
}

/** Construye el view-model de 5 secciones desde un expediente ya costeado. */
export function vistaIngenieria(expediente = {}) {
  const it = expediente.interpretacion || {};
  const costo = expediente.costo_industrial || {};
  const routing = expediente.routing || {};
  return {
    clave: expediente.clave || null,
    esto_entendi: {
      producto: it.producto || null,
      funcion: it.funcion || null,
      dimensiones_mm: it.dimensiones_generales_mm || null,
      modulos: (it.modulos || []).map((x) => x.modulo),
      materiales: it.criterio_ingenieria || null,
    },
    asi_lo_fabricaria: {
      bom: expediente.bom_canonico || null,
      operaciones_por_centro: routing.por_centro || null,
      total_operaciones: routing.total_operaciones ?? null,
      piezas_fabricadas: (costo.material?.evidencia || []).map((e) => ({ clave: e.clave, tipo: e.desarrollo?.tipo, lamina: e.lamina?.id, costo_mp: money(e.costo_mp_mxn) })),
      desarrollos_pendientes: costo.cobertura?.desarrollos_pendientes || [],
    },
    esto_necesito_confirmar: (costo.preguntas_por_decision || []).map((q) => ({ decision: q.decision, afecta: q.afecta, n: q.n })),
    este_es_el_costo: {
      material_total: money(costo.material?.total_mxn),
      material_fabricado_lamina: money(costo.material?.fabricado_lamina_mxn),
      material_comprado: money(costo.material?.comprado_mxn),
      mano_obra_politica_vh: money(costo.mano_obra?.politica_vh_mxn),
      mano_obra_routing_tiempos: costo.mano_obra?.routing_tiempos_mxn ?? null,
      gif: money(costo.gif_mxn),
      costo_fabricacion_vh: money(costo.costo_fabricacion_vh_mxn),
      estado: costo.cobertura?.cerrado ? 'COMPLETO (sujeto a validacion)' : 'PARCIAL — faltan desarrollos 3D y/o precios',
      certificable: false,
    },
    asi_podria_mejorarse: mejorasDe(costo),
  };
}

/**
 * Aplica una confirmacion de Ingenieria sobre el MISMO expediente (inmutable):
 * registra la respuesta por decision y marca las claves resueltas, sin borrar nada.
 * No recalcula aqui (eso lo hace el pipeline cuando corresponda); solo persiste la decision.
 */
export function aplicarConfirmacion(expediente = {}, { decision, respuesta, por = 'ingenieria', fecha = null } = {}) {
  if (!decision) throw new Error('falta la decision a confirmar');
  const confirmaciones = { ...(expediente.confirmaciones || {}) };
  confirmaciones[decision] = { respuesta: respuesta ?? null, por, fecha: fecha || new Date().toISOString().slice(0, 10) };
  const pendientesPrevias = (expediente.costo_industrial?.preguntas_por_decision || []);
  const resueltas = Object.keys(confirmaciones);
  return {
    ...expediente,
    confirmaciones,
    pendientes_resueltas: resueltas,
    pendientes_abiertas: pendientesPrevias.map((q) => q.decision).filter((d) => !resueltas.includes(d)),
  };
}
